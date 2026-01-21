import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import axios from 'axios';
import { PaymentInitRequest, PayTRTokenResponse, PaymentDocument } from '../types/paytr.types';
import { PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT, getPayTRConfig } from '../config/paytr.config';

const db = getFirestore();

export const initializePayment = onCall<PaymentInitRequest>(
  {
    secrets: [PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT],
    region: 'europe-west1',
    cors: true,
    maxInstances: 10,
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = request.auth.uid;
    const data = request.data;

    // Validate request data
    if (!data.jobId || !data.carrierId || !data.amount || !data.carrierIban) {
      throw new HttpsError('invalid-argument', 'Missing required fields: jobId, carrierId, amount, carrierIban');
    }

    // bidId is optional - warn if missing but don't fail
    if (!data.bidId) {
      console.warn('⚠️ [initializePayment] bidId not provided - bid will not be auto-accepted after payment');
    }

    // Verify user has permission for this job
    const jobDoc = await db.collection('jobs').doc(data.jobId).get();
    if (!jobDoc.exists) {
      throw new HttpsError('not-found', 'Job not found');
    }

    const jobData = jobDoc.data();
    if (jobData?.customerId !== userId) {
      throw new HttpsError('permission-denied', 'Not authorized for this job');
    }

    // Check if payment already exists
    const existingPayment = await db.collection('payments')
      .where('jobId', '==', data.jobId)
      .where('payment_status', '==', 'success')
      .limit(1)
      .get();

    if (!existingPayment.empty) {
      throw new HttpsError('already-exists', 'Payment already completed for this job');
    }

    // Get PayTR configuration (automatically determines test vs production mode)
    const paytrConfig = getPayTRConfig();
    const merchant_id = paytrConfig.merchant_id;
    const merchant_key = paytrConfig.merchant_key;
    const merchant_salt = paytrConfig.merchant_salt;
    const test_mode: string = paytrConfig.test_mode;

    // Generate unique order ID (alphanumeric only for PayTR)
    const merchant_oid = `${data.jobId}${Date.now()}`;

    console.log('Payment initialization started:', {
      jobId: data.jobId,
      merchant_oid,
      amount: data.amount,
      customerEmail: data.customerEmail,
      environment: test_mode === '1' ? 'TEST' : 'PRODUCTION'
    });

    // Get user IP from request context
    const user_ip = request.rawRequest.headers['x-forwarded-for']?.toString().split(',')[0] ||
                   request.rawRequest.socket.remoteAddress || '127.0.0.1';

    // Calculate payment amount (multiply by 100 for PayTR format)
    const payment_amount = Math.round(data.amount * 100).toString();

    // Prepare basket
    const basket_items = [[`Shipping Job ${data.jobId}`, data.amount.toFixed(2), 1]];
    const user_basket = Buffer.from(JSON.stringify(basket_items)).toString('base64');

    // Generate payment token
    const hash_str = merchant_id + user_ip + merchant_oid + data.customerEmail + 
                    payment_amount + user_basket + '0' + '0' + 'TL' + test_mode;
    
    const paytr_token = crypto.createHmac('sha256', merchant_key)
      .update(hash_str + merchant_salt)
      .digest('base64');

    console.log('PayTR request parameters:', {
      merchant_id,
      merchant_oid,
      payment_amount,
      test_mode,
      test_mode_value: test_mode === '0' ? 'PRODUCTION' : 'TEST',
      debug_on: test_mode === '1' ? '1' : '0',
      user_basket,
      hash_str_length: hash_str.length,
      token_generated: !!paytr_token
    });

    try {
      // Request iframe token from PayTR
      const response = await axios.post<PayTRTokenResponse>(
        'https://www.paytr.com/odeme/api/get-token',
        new URLSearchParams({
          merchant_id,
          user_ip,
          merchant_oid,
          email: data.customerEmail,
          payment_amount,
          paytr_token,
          user_basket,
          debug_on: test_mode === '1' ? '1' : '0',
          no_installment: '0',
          max_installment: '0',
          user_name: data.customerName,
          user_address: data.customerAddress || 'N/A',
          user_phone: data.customerPhone,
          merchant_ok_url: `https://giris.ankago.com/payment-callback/success?jobId=${data.jobId}&oid=${merchant_oid}`,
          merchant_fail_url: `https://giris.ankago.com/payment-callback/failed?jobId=${data.jobId}&oid=${merchant_oid}`,
          merchant_notify_url: 'https://paytrwebhook-garyb35oea-ew.a.run.app/webhook',
          timeout_limit: '30',
          currency: 'TL',
          test_mode,
          lang: 'tr'
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      console.log('PayTR API response:', {
        status: response.data.status,
        hasToken: !!response.data.token,
        reason: response.data.reason,
        fullResponse: JSON.stringify(response.data)
      });

      if (response.data.status === 'success' && response.data.token) {
        // Store payment record
        const paymentData: any = {
          userId,
          jobId: data.jobId,
          carrierId: data.carrierId,
          carrierName: data.carrierName,
          carrierIban: data.carrierIban,
          amount: data.amount,
          commissionRate: data.commissionRate,
          status: 'pending',
          merchantOid: merchant_oid, // FIXED: Use camelCase to match trigger expectations
          created_at: FieldValue.serverTimestamp(),
          test_mode: test_mode === '1',
          transfer_status: 'pending'
        };

        // Only include bidId if provided (for web payment flow)
        if (data.bidId) {
          paymentData.bidId = data.bidId;
          console.log('✅ [initializePayment] bidId included in payment document:', data.bidId);
        } else {
          console.log('⚠️ [initializePayment] bidId NOT included - mobile payment flow');
        }

        await db.collection('payments').doc(merchant_oid).set(paymentData);

        return {
          success: true,
          token: response.data.token,
          iframe_url: `https://www.paytr.com/odeme/guvenli/${response.data.token}`,
          merchant_oid
        };
      } else {
        throw new HttpsError('internal', response.data.reason || 'Token generation failed');
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      if (axios.isAxiosError(error)) {
        throw new HttpsError('internal', error.response?.data?.reason || error.message);
      }
      throw new HttpsError('internal', 'Payment initialization failed');
    }
  }
);
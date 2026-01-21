import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import axios from 'axios';
import { PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT } from '../config/paytr.config';

const db = getFirestore();

interface StatusQueryRequest {
  merchant_oid: string;
}

export const queryPaymentStatus = onCall<StatusQueryRequest>(
  {
    secrets: [PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT],
    region: 'europe-west1',
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { merchant_oid } = request.data;

    if (!merchant_oid) {
      throw new HttpsError('invalid-argument', 'Merchant OID is required');
    }

    // Verify user has access to this payment
    const paymentDoc = await db.collection('payments').doc(merchant_oid).get();
    if (!paymentDoc.exists) {
      throw new HttpsError('not-found', 'Payment not found');
    }

    const payment = paymentDoc.data();
    if (payment?.userId !== request.auth.uid && !payment?.isAdmin) {
      throw new HttpsError('permission-denied', 'Not authorized to view this payment');
    }

    // Get PayTR configuration
    const merchant_id = PAYTR_MERCHANT_ID.value();
    const merchant_key = PAYTR_MERCHANT_KEY.value();
    const merchant_salt = PAYTR_MERCHANT_SALT.value();

    // Create hash for status query
    const paytr_token = crypto.createHmac('sha256', merchant_key)
      .update(merchant_id + merchant_oid + merchant_salt)
      .digest('base64');

    try {
      const response = await axios.post(
        'https://www.paytr.com/odeme/durum-sorgu',
        new URLSearchParams({
          merchant_id,
          merchant_oid,
          paytr_token
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      return {
        success: true,
        status: response.data.status,
        payment_amount: response.data.payment_amount,
        currency: response.data.currency,
        test_mode: response.data.test_mode,
        payment_type: response.data.payment_type,
        transfer_status: response.data.transfer_status,
        trans_id: response.data.trans_id
      };
    } catch (error) {
      console.error('Status query error:', error);
      throw new HttpsError('internal', 'Failed to query payment status');
    }
  }
);
// src/functions/transfer.functions.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import axios from 'axios';
import { TransferRequest } from '../types/paytr.types';
import { PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT } from '../config/paytr.config';

const db = getFirestore();

export const processMarketplaceTransfer = onCall<TransferRequest>(
  {
    secrets: [PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT],
    region: 'europe-west1',
    cors: true,
    maxInstances: 5,
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // Check if user is admin or has permission to release payments
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isAdmin && userData?.userType !== 'admin') {
      throw new HttpsError('permission-denied', 'Only admins can release payments');
    }

    const { paymentId, jobId } = request.data;

    if (!paymentId || !jobId) {
      throw new HttpsError('invalid-argument', 'Payment ID and Job ID are required');
    }

    // Verify job is completed and documents are verified
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      throw new HttpsError('not-found', 'Job not found');
    }

    const jobData = jobDoc.data();
    if (jobData?.status !== 'completed') {
      throw new HttpsError('failed-precondition', 'Job must be completed before releasing payment');
    }

    // Check if required documents are verified
    if (!jobData?.documentsVerified) {
      throw new HttpsError('failed-precondition', 'Documents must be verified before releasing payment');
    }

    // Get payment record
    const paymentDoc = await db.collection('payments').doc(paymentId).get();
    if (!paymentDoc.exists) {
      throw new HttpsError('not-found', 'Payment not found');
    }

    const payment = paymentDoc.data();
    if (!payment) {
      throw new HttpsError('not-found', 'Payment data not found');
    }

    // Verify payment status
    if (payment.payment_status !== 'success') {
      throw new HttpsError('failed-precondition', 'Payment must be successful before transfer');
    }

    if (payment.transfer_status === 'completed') {
      throw new HttpsError('already-exists', 'Transfer already completed');
    }

    // Check if payment is at least 24 hours old (PayTR requirement)
    const paidAt = payment.paid_at?.toDate();
    if (paidAt) {
      const hoursSincePaid = (Date.now() - paidAt.getTime()) / (1000 * 60 * 60);
      if (hoursSincePaid < 24) {
        throw new HttpsError(
          'failed-precondition', 
          `Transfer can only be initiated 24 hours after payment. ${(24 - hoursSincePaid).toFixed(1)} hours remaining.`
        );
      }
    }

    // Get PayTR configuration
    const merchant_id = PAYTR_MERCHANT_ID.value();
    const merchant_key = PAYTR_MERCHANT_KEY.value();
    const merchant_salt = PAYTR_MERCHANT_SALT.value();

    // Calculate amounts
    const total_amount_cents = Math.round(payment.amount * 100);
    const carrier_amount_cents = Math.round(payment.amount * (1 - payment.commissionRate) * 100);
    const commission_amount = (total_amount_cents - carrier_amount_cents) / 100;

    // Generate unique transfer ID
    const trans_id = `${paymentId}_${Date.now()}`;

    // Create transfer hash
    const hash_str = merchant_id + paymentId + trans_id + 
                    carrier_amount_cents + total_amount_cents + 
                    payment.carrierName + payment.carrierIban;
    
    const paytr_token = crypto.createHmac('sha256', merchant_key)
      .update(hash_str + merchant_salt)
      .digest('base64');

    try {
      // Send transfer instruction to PayTR
      const response = await axios.post(
        'https://www.paytr.com/odeme/platform/transfer',
        new URLSearchParams({
          merchant_id,
          merchant_oid: paymentId,
          trans_id,
          submerchant_amount: carrier_amount_cents.toString(),
          total_amount: total_amount_cents.toString(),
          transfer_name: payment.carrierName,
          transfer_iban: payment.carrierIban,
          paytr_token
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      if (response.data.status === 'success') {
        // Update payment record
        await db.collection('payments').doc(paymentId).update({
          transfer_status: 'completed',
          trans_id,
          carrier_amount: carrier_amount_cents / 100,
          marketplace_commission: commission_amount,
          transferred_at: FieldValue.serverTimestamp(),
          transferred_by: request.auth.uid
        });

        // Update job record
        await db.collection('jobs').doc(jobId).update({
          payment_released: true,
          payment_released_at: FieldValue.serverTimestamp(),
          payment_released_by: request.auth.uid
        });

        // Log the transfer for audit
        await db.collection('transfer_logs').add({
          payment_id: paymentId,
          job_id: jobId,
          trans_id,
          carrier_amount: carrier_amount_cents / 100,
          commission_amount,
          total_amount: total_amount_cents / 100,
          carrier_name: payment.carrierName,
          carrier_iban: payment.carrierIban,
          initiated_by: request.auth.uid,
          created_at: FieldValue.serverTimestamp()
        });

        return {
          success: true,
          trans_id,
          carrier_amount: carrier_amount_cents / 100,
          commission: commission_amount,
          message: 'Transfer initiated successfully'
        };
      } else {
        console.error('Transfer failed:', response.data);
        throw new HttpsError('internal', response.data.reason || 'Transfer failed');
      }
    } catch (error) {
      console.error('Transfer request error:', error);
      if (axios.isAxiosError(error)) {
        throw new HttpsError('internal', error.response?.data?.reason || error.message);
      }
      throw new HttpsError('internal', 'Transfer request failed');
    }
  }
);
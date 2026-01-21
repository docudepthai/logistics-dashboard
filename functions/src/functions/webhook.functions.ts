import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { PayTRWebhookPayload } from '../types/paytr.types';
import { PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT } from '../config/paytr.config';

const db = getFirestore();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true }));

app.post('/webhook', async (req, res) => {
  console.log('🔔 [WEBHOOK] PayTR webhook received!');
  console.log('📦 [WEBHOOK] Payload:', JSON.stringify(req.body, null, 2));

  try {
    const payload: PayTRWebhookPayload = req.body;
    const merchant_key = PAYTR_MERCHANT_KEY.value();
    const merchant_salt = PAYTR_MERCHANT_SALT.value();

    console.log(`🔍 [WEBHOOK] Processing payment: ${payload.merchant_oid}, status: ${payload.status}`);

    // CRITICAL: Verify hash to prevent fraud
    const hash_str = payload.merchant_oid + merchant_salt + payload.status + payload.total_amount;
    const calculated_hash = crypto.createHmac('sha256', merchant_key)
      .update(hash_str)
      .digest('base64');

    if (calculated_hash !== payload.hash) {
      console.error('❌ [WEBHOOK] Hash verification failed!', {
        merchant_oid: payload.merchant_oid,
        expected: calculated_hash,
        received: payload.hash
      });
      return res.status(400).send('PAYTR notification failed: bad hash');
    }

    console.log('✅ [WEBHOOK] Hash verified successfully');

    // Use transaction for idempotency
    await db.runTransaction(async (transaction) => {
      const paymentRef = db.collection('payments').doc(payload.merchant_oid);
      const paymentDoc = await transaction.get(paymentRef);

      if (!paymentDoc.exists) {
        console.error('❌ [WEBHOOK] Payment document not found:', payload.merchant_oid);
        return;
      }

      const paymentData = paymentDoc.data();
      console.log(`📊 [WEBHOOK] Current payment status: ${paymentData?.status}, payment_status: ${paymentData?.payment_status}`);

      // Check if already processed (idempotency)
      if (paymentData?.payment_status === 'success') {
        console.log('⏭️ [WEBHOOK] Payment already processed (duplicate notification):', payload.merchant_oid);
        return;
      }

      // Process based on status
      if (payload.status === 'success') {
        console.log(`✅ [WEBHOOK] Updating payment ${payload.merchant_oid} to SUCCESS`);

        transaction.update(paymentRef, {
          status: 'success', // Update main status field - THIS TRIGGERS onPaymentStatusUpdate
          payment_status: 'success',
          total_amount: parseInt(payload.total_amount) / 100,
          payment_type: payload.payment_type,
          currency: payload.currency,
          installment_count: parseInt(payload.installment_count || '0'),
          paid_at: FieldValue.serverTimestamp(),
          completed_at: FieldValue.serverTimestamp(),
          raw_callback: payload
        });

        console.log(`🎉 [WEBHOOK] Payment ${payload.merchant_oid} marked as SUCCESS! onPaymentStatusUpdate trigger should fire now.`);
      } else {
        console.log(`❌ [WEBHOOK] Payment ${payload.merchant_oid} FAILED: ${payload.failed_reason_msg}`);

        transaction.update(paymentRef, {
          status: 'failed',
          payment_status: 'failed',
          failure_reason: payload.failed_reason_msg,
          failed_reason_code: payload.failed_reason_code,
          failed_reason_msg: payload.failed_reason_msg,
          failed_at: FieldValue.serverTimestamp(),
          raw_callback: payload
        });
      }
    });

    console.log('✅ [WEBHOOK] Transaction committed successfully');

    // MUST respond with plain text "OK"
    res.set('Content-Type', 'text/plain');
    return res.send('OK');

  } catch (error) {
    console.error('❌ [WEBHOOK] Error processing webhook:', error);
    // Still return OK to prevent infinite retries
    res.set('Content-Type', 'text/plain');
    return res.send('OK');
  }
});

export const paytrWebhook = onRequest(
  {
    secrets: [PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT],
    region: 'europe-west1',
    maxInstances: 10,
  },
  app
);
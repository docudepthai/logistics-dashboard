// functions/src/functions/payment_verification.ts

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();

interface VerifyPaymentRequest {
  merchantOid: string;
  jobId: string;
}

/**
 * Callable function to verify payment and ensure job status is updated
 * This can be called manually or automatically after payment
 */
export const verifyPaymentAndUpdateJob = onCall<VerifyPaymentRequest>(
  {
    region: 'europe-west1',
    cors: true,
  },
  async (request) => {
    const { merchantOid, jobId } = request.data;

    logger.info(`Verifying payment for job ${jobId}, merchantOid: ${merchantOid}`);

    if (!merchantOid || !jobId) {
      throw new HttpsError('invalid-argument', 'Missing merchantOid or jobId');
    }

    try {
      // Check payment status in database
      const paymentQuery = await db
        .collection('payments')
        .where('merchantOid', '==', merchantOid)
        .limit(1)
        .get();

      if (paymentQuery.empty) {
        logger.warn(`Payment not found for merchantOid: ${merchantOid}`);
        throw new HttpsError('not-found', 'Payment record not found');
      }

      const paymentDoc = paymentQuery.docs[0];
      const paymentData = paymentDoc.data();

      // Verify payment is successful
      if (paymentData.status !== 'success' && paymentData.status !== 'completed') {
        logger.warn(`Payment status is not success: ${paymentData.status}`);
        throw new HttpsError('failed-precondition', `Payment status is ${paymentData.status}`);
      }

      // Get the job document
      const jobRef = db.collection('jobs').doc(jobId);
      const jobDoc = await jobRef.get();

      if (!jobDoc.exists) {
        logger.error(`Job not found: ${jobId}`);
        throw new HttpsError('not-found', 'Job not found');
      }

      const jobData = jobDoc.data()!;

      // Check if job is already matched
      if (jobData.status === 'matched' || jobData.status === 'in_progress') {
        logger.info(`Job ${jobId} is already in correct status: ${jobData.status}`);
        return {
          success: true,
          message: 'Job already updated',
          jobStatus: jobData.status,
          paymentStatus: paymentData.status,
        };
      }

      // Update job status to matched
      logger.info(`Updating job ${jobId} status to matched`);

      const updateData: any = {
        status: 'matched',
        paymentCompleted: true,
        paymentCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentMerchantOid: merchantOid,
        paymentAmount: paymentData.amount,
        acceptedCarrierId: paymentData.carrierId,
        acceptedCarrierName: paymentData.carrierName,
        acceptedBidAmount: paymentData.amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // If there's a bid ID, also update accepted bid
      if (paymentData.bidId) {
        updateData.acceptedBidId = paymentData.bidId;
      }

      await jobRef.update(updateData);

      // Create notification for carrier
      const notificationRef = db.collection('notifications').doc();
      await notificationRef.set({
        id: notificationRef.id,
        userId: paymentData.carrierId,
        type: 'job_matched',
        title: 'İş Eşleşti!',
        message: `Tebrikler! ${jobData.pickupLocation} - ${jobData.dropoffLocation} rotası için teklifiniz kabul edildi.`,
        jobId: jobId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update bid status if exists
      if (paymentData.bidId) {
        await db.collection('bids').doc(paymentData.bidId).update({
          status: 'accepted',
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Reject other bids
        const otherBids = await db
          .collection('bids')
          .where('jobId', '==', jobId)
          .where('status', '==', 'pending')
          .get();

        const batch = db.batch();
        otherBids.docs.forEach((doc) => {
          if (doc.id !== paymentData.bidId) {
            batch.update(doc.ref, {
              status: 'rejected',
              rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
              rejectionReason: 'Another bid was accepted',
            });
          }
        });

        await batch.commit();
      }

      logger.info(`✅ Successfully verified payment and updated job ${jobId}`);

      return {
        success: true,
        message: 'Payment verified and job updated successfully',
        jobStatus: 'matched',
        paymentStatus: paymentData.status,
      };

    } catch (error) {
      logger.error('Error verifying payment:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to verify payment and update job');
    }
  }
);

/**
 * Trigger function that monitors payment status changes
 * Automatically updates job when payment is marked as successful
 */
export const onPaymentStatusUpdate = onDocumentUpdated(
  {
    document: 'payments/{paymentId}',
    region: 'europe-west1',
  },
  async (event) => {
    logger.info(`🔔 [TRIGGER] onPaymentStatusUpdate fired for payment: ${event.params.paymentId}`);

    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn('⚠️ [TRIGGER] Missing before or after data');
      return;
    }

    logger.info(`📊 [TRIGGER] Status change: "${before.status}" → "${after.status}"`);
    logger.info(`📊 [TRIGGER] Payment data:`, {
      jobId: after.jobId,
      bidId: after.bidId,
      merchantOid: after.merchantOid,
      carrierId: after.carrierId,
      amount: after.amount,
    });

    // Only process if payment status changed to success
    const statusChanged = before.status !== after.status;
    const isNowSuccessful = after.status === 'success' || after.status === 'completed';

    logger.info(`🔍 [TRIGGER] statusChanged: ${statusChanged}, isNowSuccessful: ${isNowSuccessful}`);

    if (!statusChanged || !isNowSuccessful) {
      logger.info('⏭️ [TRIGGER] Skipping - status not changed to success');
      return;
    }

    const jobId = after.jobId;
    const merchantOid = after.merchantOid;

    if (!jobId || !merchantOid) {
      logger.warn('⚠️ [TRIGGER] Payment missing jobId or merchantOid');
      return;
    }

    logger.info(`🚀 [TRIGGER] Processing payment ${merchantOid} for job ${jobId}`);

    try {
      // Get the job
      const jobRef = db.collection('jobs').doc(jobId);
      const jobDoc = await jobRef.get();

      if (!jobDoc.exists) {
        logger.error(`❌ [TRIGGER] Job ${jobId} not found`);
        return;
      }

      const jobData = jobDoc.data()!;
      logger.info(`📦 [TRIGGER] Current job status: ${jobData.status}`);

      // Skip if job already matched or in progress
      if (jobData.status === 'matched' || jobData.status === 'in_progress') {
        logger.info(`✓ [TRIGGER] Job ${jobId} already in correct status: ${jobData.status}`);
        return;
      }

      // Update job to matched
      logger.info(`📝 [TRIGGER] Updating job ${jobId} to MATCHED status...`);

      const updateData: any = {
        status: 'matched',
        paymentCompleted: true,
        paymentCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentMerchantOid: merchantOid,
        paymentAmount: after.amount,
        paymentId: event.params.paymentId, // Save payment document ID for refunds
        acceptedCarrierId: after.carrierId,
        acceptedCarrierName: after.carrierName,
        acceptedBidAmount: after.amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (after.bidId) {
        updateData.acceptedBidId = after.bidId;
        logger.info(`📌 [TRIGGER] Including bidId in update: ${after.bidId}`);
      }

      await jobRef.update(updateData);
      logger.info(`✅ [TRIGGER] Job ${jobId} updated to MATCHED with payment info for refunds`);

      // Send notification to carrier
      const notificationRef = db.collection('notifications').doc();
      await notificationRef.set({
        id: notificationRef.id,
        userId: after.carrierId,
        type: 'job_matched',
        title: 'İş Eşleşti!',
        message: `Ödeme onaylandı! ${jobData.pickupLocation} - ${jobData.dropoffLocation} işi size atandı.`,
        jobId: jobId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info(`📧 [TRIGGER] Notification sent to carrier ${after.carrierId}`);

      // Update bid if exists
      if (after.bidId) {
        logger.info(`📝 [TRIGGER] Updating bid ${after.bidId} to ACCEPTED`);
        await db.collection('bids').doc(after.bidId).update({
          status: 'accepted',
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Reject other pending bids
        const otherBids = await db
          .collection('bids')
          .where('jobId', '==', jobId)
          .where('status', '==', 'pending')
          .get();

        logger.info(`📝 [TRIGGER] Rejecting ${otherBids.size} other bids`);

        const batch = db.batch();
        otherBids.docs.forEach((doc) => {
          if (doc.id !== after.bidId) {
            batch.update(doc.ref, {
              status: 'rejected',
              rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
              rejectionReason: 'Another bid was accepted',
            });
          }
        });

        await batch.commit();
      }

      logger.info(`🎉 [TRIGGER] SUCCESS! Job ${jobId} fully processed and matched!`);

    } catch (error) {
      logger.error(`❌ [TRIGGER] Error updating job ${jobId}:`, error);
    }
  }
);

/**
 * Scheduled function to check for stuck payments
 * Runs every 5 minutes to ensure no payments are left in limbo
 */
export const checkStuckPayments = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'europe-west1',
  },
  async () => {
    logger.info('Checking for stuck payments...');

    const fiveMinutesAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 5 * 60 * 1000)
    );

    try {
      // Find successful payments where job is not updated
      const stuckPayments = await db
        .collection('payments')
        .where('status', 'in', ['success', 'completed'])
        .where('jobStatusUpdated', '!=', true)
        .where('createdAt', '<', fiveMinutesAgo)
        .limit(10)
        .get();

      if (stuckPayments.empty) {
        logger.info('No stuck payments found');
        return;
      }

      logger.info(`Found ${stuckPayments.size} stuck payments`);

      for (const paymentDoc of stuckPayments.docs) {
        const paymentData = paymentDoc.data();
        const jobId = paymentData.jobId;

        if (!jobId) {
          continue;
        }

        try {
          // Get job
          const jobRef = db.collection('jobs').doc(jobId);
          const jobDoc = await jobRef.get();

          if (!jobDoc.exists) {
            logger.warn(`Job ${jobId} not found for payment ${paymentDoc.id}`);
            continue;
          }

          const jobData = jobDoc.data()!;

          // Skip if already matched
          if (jobData.status === 'matched' || jobData.status === 'in_progress') {
            // Mark payment as processed
            await paymentDoc.ref.update({
              jobStatusUpdated: true,
              jobStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            continue;
          }

          // Update job
          await jobRef.update({
            status: 'matched',
            paymentCompleted: true,
            paymentCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentMerchantOid: paymentData.merchantOid,
            paymentAmount: paymentData.amount,
            acceptedCarrierId: paymentData.carrierId,
            acceptedCarrierName: paymentData.carrierName,
            acceptedBidAmount: paymentData.amount,
            acceptedBidId: paymentData.bidId || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Mark payment as processed
          await paymentDoc.ref.update({
            jobStatusUpdated: true,
            jobStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          logger.info(`✅ Fixed stuck payment for job ${jobId}`);

        } catch (error) {
          logger.error(`Error fixing stuck payment for job ${jobId}:`, error);
        }
      }

    } catch (error) {
      logger.error('Error checking stuck payments:', error);
    }
  }
);
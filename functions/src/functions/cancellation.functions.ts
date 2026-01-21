import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();

interface CancelJobRequest {
  jobId: string;
  cancelledBy: 'customer' | 'carrier';
  cancellationReason: string;
}

interface CancellationResult {
  success: boolean;
  refundAmount: number;
  cancellationFee: number;
  message: string;
}

/**
 * Calculate cancellation penalty based on timing and job status
 */
function calculateCancellationFee(
  pickupTime: Date,
  jobStatus: string,
  cancelledBy: 'customer' | 'carrier'
): number {
  const now = new Date();
  const hoursUntilPickup = (pickupTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Different penalties for customer vs carrier
  if (cancelledBy === 'customer') {
    // Customer cancellation penalties
    // IMPORTANT: Open jobs can ALWAYS be cancelled for free, regardless of timing
    if (jobStatus === 'open') {
      return 0;
    }

    // For matched/in-progress jobs, apply time-based penalties
    if (jobStatus === 'inProgress' || hoursUntilPickup < 0) {
      // After pickup started
      return 2500;
    } else if (hoursUntilPickup <= 6) {
      // Within 6 hours of pickup
      return 2500;
    } else if (hoursUntilPickup <= 24) {
      // 6-24 hours before pickup
      return 1000;
    } else {
      // More than 24 hours before pickup - free cancellation
      return 0;
    }
  } else {
    // Carrier cancellation penalties
    if (jobStatus === 'inProgress' || hoursUntilPickup < 0) {
      // After pickup started - heavy penalty
      return 5000;
    } else if (hoursUntilPickup <= 6) {
      // Within 6 hours - heavy penalty
      return 3000;
    } else if (hoursUntilPickup <= 24) {
      // 6-24 hours before
      return 1500;
    } else if (hoursUntilPickup <= 48) {
      // 24-48 hours before
      return 500;
    } else {
      // More than 48 hours before pickup - free cancellation
      return 0;
    }
  }
}

export const cancelJobWithRefund = onCall<CancelJobRequest>(
  {
    region: 'europe-west1',
    cors: true,
    maxInstances: 10,
  },
  async (request): Promise<CancellationResult> => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = request.auth.uid;
    const { jobId, cancelledBy, cancellationReason } = request.data;

    // Validate input
    if (!jobId || !cancelledBy || !cancellationReason) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    if (cancelledBy !== 'customer' && cancelledBy !== 'carrier') {
      throw new HttpsError('invalid-argument', 'Invalid cancelledBy value');
    }

    try {
      // Use transaction for atomicity
      const result = await db.runTransaction(async (transaction) => {
        // 1. Get job document
        const jobRef = db.collection('jobs').doc(jobId);
        const jobDoc = await transaction.get(jobRef);

        if (!jobDoc.exists) {
          throw new HttpsError('not-found', 'Job not found');
        }

        const jobData = jobDoc.data()!;
        const jobStatus = jobData.status as string;

        // 2. Verify permissions
        if (cancelledBy === 'customer' && jobData.customerId !== userId) {
          throw new HttpsError('permission-denied', 'Not authorized to cancel this job');
        }

        if (cancelledBy === 'carrier') {
          const acceptedCarrierId = jobData.acceptedCarrierId as string | undefined;
          if (!acceptedCarrierId || acceptedCarrierId !== userId) {
            throw new HttpsError('permission-denied', 'Not authorized to cancel this job');
          }
        }

        // 3. Check if job can be cancelled
        if (jobStatus === 'cancelled') {
          throw new HttpsError('failed-precondition', 'Job already cancelled');
        }

        if (jobStatus === 'completed') {
          throw new HttpsError('failed-precondition', 'Cannot cancel completed job');
        }

        // 4. Get payment information
        const paymentQuery = await db
          .collection('payments')
          .where('jobId', '==', jobId)
          .where('status', '==', 'success')
          .limit(1)
          .get();

        let paymentDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
        let paymentAmount = 0;

        if (!paymentQuery.empty) {
          paymentDoc = paymentQuery.docs[0];
          paymentAmount = paymentDoc.data().amount as number;
        } else {
          // No successful payment yet - check for payment amount in job
          paymentAmount = (jobData.paymentAmount as number) ||
            (jobData.acceptedPrice as number) ||
            (jobData.basePrice as number) ||
            0;
        }

        // 5. Calculate cancellation fee
        const pickupTime = (jobData.pickupTime as FirebaseFirestore.Timestamp).toDate();
        const cancellationFee = calculateCancellationFee(pickupTime, jobStatus, cancelledBy);
        const refundAmount = Math.max(0, paymentAmount - cancellationFee);

        console.log('Cancellation details:', {
          jobId,
          cancelledBy,
          jobStatus,
          pickupTime: pickupTime.toISOString(),
          paymentAmount,
          cancellationFee,
          refundAmount,
          hoursUntilPickup: (pickupTime.getTime() - Date.now()) / (1000 * 60 * 60)
        });

        // 6. Update job document
        transaction.update(jobRef, {
          status: 'cancelled',
          cancelledAt: FieldValue.serverTimestamp(),
          cancelledBy,
          cancellationReason,
          cancellationFee,
          refundAmount,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // 7. Update payment document if exists
        if (paymentDoc) {
          transaction.update(paymentDoc.ref, {
            status: 'refunded',
            refund_amount: refundAmount,
            refunded_at: FieldValue.serverTimestamp(),
            cancellation_fee: cancellationFee,
            cancellation_reason: cancellationReason,
            cancelled_by: cancelledBy,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // 8. Cancel related bids
        const isSchedule = jobData.isSchedule as boolean | undefined;
        const bidsCollection = isSchedule ? 'scheduleBids' : 'bids';
        const bidFieldName = isSchedule ? 'scheduleId' : 'jobId';

        const bidsQuery = await db
          .collection(bidsCollection)
          .where(bidFieldName, '==', jobId)
          .where('status', '==', 'pending')
          .get();

        for (const bid of bidsQuery.docs) {
          transaction.update(bid.ref, {
            status: 'cancelled',
            cancelledAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // 9. Update user cancellation stats
        if (cancelledBy === 'customer') {
          const customerRef = db.collection('users').doc(jobData.customerId);
          transaction.update(customerRef, {
            cancelledJobCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else if (cancelledBy === 'carrier') {
          const carrierId = jobData.acceptedCarrierId as string;
          const carrierRef = db.collection('users').doc(carrierId);
          transaction.update(carrierRef, {
            cancelledJobCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // Generate appropriate message based on job status and payment
        let message: string;
        if (jobStatus === 'open') {
          message = 'İş başarıyla iptal edildi.';
        } else if (cancellationFee > 0) {
          message = `İş iptal edildi. ${cancellationFee}₺ iptal ücreti kesildi, ${refundAmount}₺ iade edilecek.`;
        } else {
          message = `İş başarıyla iptal edildi. ${refundAmount}₺ tam iade edilecek.`;
        }

        return {
          success: true,
          refundAmount,
          cancellationFee,
          message,
        };
      });

      return result;
    } catch (error) {
      console.error('Job cancellation error:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', `Job cancellation failed: ${error}`);
    }
  }
);

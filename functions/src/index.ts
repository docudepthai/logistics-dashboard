// functions/src/index.ts

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
import * as logger from 'firebase-functions/logger';
import dayjsLib from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import { defineString, defineSecret } from 'firebase-functions/params';
import * as ExcelJS from 'exceljs';

// Initialize Firebase Admin
admin.initializeApp();

export * from "./returnOpportunities";
export * from "./documentExpiryChecker";
export * from "./placesProxy";
export * from "./nearbyJobNotifications";
// src/index.ts
export { initializePayment } from './functions/payment.functions';
export { paytrWebhook } from './functions/webhook.functions';
export { processMarketplaceTransfer } from './functions/transfer.functions';
export { queryPaymentStatus } from './functions/status.functions';
export { cancelJobWithRefund } from './functions/cancellation.functions';
export {
  verifyPaymentAndUpdateJob,
  onPaymentStatusUpdate,
  checkStuckPayments
} from './functions/payment_verification';
export {
  generateTOTPSecret,
  verifyTOTPSetup,
  adminLogin,
  disableTOTP
} from './adminAuth';
export {
  scheduledBulkEmailSender,
  manualBulkEmailSender
} from './bulkEmailSender';
export {
  sendOTP,
  verifyOTP
} from './twilioAuth';
const db = admin.firestore();
const messaging = admin.messaging();

// Agora configuration
const AGORA_APP_ID = 'a410a6a6933840d0a214573aeef1bfa2';
const AGORA_APP_CERTIFICATE = '6cece16d70d745819a2fe241c482baad';

const dayjs = dayjsLib;
dayjs.extend(utc);
dayjs.extend(tz);

const TZ = "Europe/Istanbul";

// Define secrets for Gmail (stored in Secret Manager)
const gmailEmail = defineSecret('GMAIL_EMAIL');
const gmailPassword = defineSecret('GMAIL_PASSWORD');

// Types
interface SendVerificationEmailData {
  userId: string;
  email: string;
  userName?: string;
}

interface VerificationDocument {
  email: string;
  token: string;
  createdAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
  verified: boolean;
  verifiedAt?: admin.firestore.Timestamp;
}

let transporter: nodemailer.Transporter;

const initTransporter = (): nodemailer.Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailEmail.value(),
        pass: gmailPassword.value()
      }
    });
  }
  return transporter;
};

interface DocumentInfo {
  url: string;
  status: string;
  expiryDate?: admin.firestore.Timestamp;
}

interface DocumentExpiryInfo {
  name: string;
  displayName: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  isExpired: boolean;
  isVehicleDocument: boolean;
}

// Type definitions
interface CallData {
  callerId: string;
  receiverId: string;
  channelName: string;
  status: string;
  type: 'voice' | 'video';
  createdAt: admin.firestore.Timestamp;
  answeredAt?: admin.firestore.Timestamp;
  endedAt?: admin.firestore.Timestamp;
  duration?: number;
  endReason?: string;
}

interface RefreshTokenRequest {
  callId: string;
  channelName: string;
  uid: number;
}

interface CallNotificationData {
  receiverId: string;
  callId: string;
  callerName: string;
  callType: 'voice' | 'video';
}

interface CallValidationRequest {
  receiverId: string;
}

interface UserData {
  fcmToken?: string;
  fullName?: string;
  profilePhotoUrl?: string;
  blockedUsers?: string[];
  doNotDisturb?: boolean;
  totalCallMinutes?: number;
  totalCalls?: number;
  lastCallAt?: admin.firestore.Timestamp;
  platform?: 'ios' | 'android' | string;
  fcmTokenUpdatedAt?: admin.firestore.Timestamp;
  deviceInfo?: {
    os?: string;
    osVersion?: string;
    isPhysicalDevice?: boolean;
  };
  phone?: string;
}

interface InsuranceNotificationData {
  jobId: string;

  // Customer info
  customerTCKN: string;
  customerDOB: string; // Format: DD/MM/YYYY
  customerVKN: string;
  customerFullName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;

  // Vehicle info
  vehicleType: string; // kamyon or çekici
  vehiclePlate: string;
  trailerPlate?: string; // Only if vehicleType is çekici

  // Shipment info
  pickupLocation: string;
  dropoffLocation: string;
  dropoffLocationSecond?: string;
  pickupDate: string; // Format: DD/MM/YYYY

  // Insurance
  insuranceAmount: number;
}

// Generate unique contract number
function generateContractNumber(isProduction: boolean): string {
  const prefix = isProduction ? 'SG' : 'TST';
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');

  return `${prefix}${year}${month}${day}${random}`;
}

// ==================== EXISTING NOTIFICATION FUNCTIONS ====================

/**
 * Send push notification when a notification document is created
 */
export const sendPushNotification = onDocumentCreated(
  {
    document: 'notifications/{notificationId}',
    region: 'europe-west1',
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data associated with the event');
      return;
    }

    const notification = snapshot.data();
    const notificationId = event.params.notificationId;

    try {
      // Get user's FCM token
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(notification.userId)
        .get();

      if (!userDoc.exists) {
        console.log(`User ${notification.userId} not found`);
        return null;
      }

      const userData = userDoc.data() as UserData;
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) {
        console.log(`No FCM token for user ${notification.userId}`);
        return null;
      }

      // Handle incoming call notifications specially
      if (notification.type === 'incoming_call') {
        // This is handled by the call notification system
        return null;
      }

      // Get notification title based on type
      const getTitle = (type: string): string => {
        switch (type) {
          case 'bid_accepted':
            return 'Teklifiniz Kabul Edildi!';
          case 'bid_rejected':
            return 'Teklifiniz Reddedildi';
          case 'bid_withdrawn':
            return 'Teklif Geri Çekildi';
          case 'new_bid':
            return 'Yeni Teklif Aldınız';
          case 'job_matched':
            return 'İş Eşleşti!';
          case 'job_cancelled':
            return 'İş İptal Edildi';
          case 'job_completed':
            return 'İş Tamamlandı';
          case 'job_started':
            return 'Teslimat Başladı';
          case 'new_message':
            return 'Yeni Mesaj';
          case 'missed_call':
            return 'Cevapsız Arama';
          default:
            return '🔔 Bildirim';
        }
      };

      // Get additional context for better notification messages
      let bodyText = notification.message || '';

      // If it's a new bid, try to get bid amount
      if (notification.type === 'new_bid' && notification.bidId) {
        try {
          const bidDoc = await admin.firestore()
            .collection('bids')
            .doc(notification.bidId)
            .get();

          if (bidDoc.exists) {
            const bidData = bidDoc.data();
            if (bidData?.offeredPrice) {
              bodyText = `Yeni teklif: ₺${bidData.offeredPrice}. ${bodyText}`;
            }
          }
        } catch (e) {
          console.log('Could not fetch bid details:', e);
        }
      }

      // Prepare notification payload
      const payload: admin.messaging.Message = {
        notification: {
          title: getTitle(notification.type),
          body: bodyText,
        },
        data: {
          type: notification.type || '',
          bidId: notification.bidId || '',
          jobId: notification.jobId || '',
          notificationId: notificationId,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        token: fcmToken,
        android: {
          priority: 'high',
          notification: {
            channelId: notification.type?.includes('bid') ? 'bid_channel' :
              notification.type?.includes('job') ? 'job_channel' :
                notification.type === 'new_message' ? 'message_channel' :
                  notification.type === 'missed_call' ? 'calls' :
                    'default_channel',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
            tag: notification.type,
          },
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default',
              contentAvailable: true,
              category: notification.type,
            },
          },
        },
      };

      // Send the notification
      const response = await admin.messaging().send(payload);
      console.log(`✅ Successfully sent notification to ${notification.userId}:`, response);

      // Update the notification document to mark as sent
      await admin.firestore()
        .collection('notifications')
        .doc(notificationId)
        .update({
          pushSent: true,
          pushSentAt: admin.firestore.FieldValue.serverTimestamp(),
          messageId: response,
        });

      return response;
    } catch (error) {
      console.error(`❌ Error sending notification to ${notification.userId}:`, error);

      // Update the notification document with error
      await admin.firestore()
        .collection('notifications')
        .doc(notificationId)
        .update({
          pushSent: false,
          pushError: error instanceof Error ? error.message : 'Unknown error',
        });

      return null;
    }
  }
);

/**
 * Update badge count when notifications change
 */
export const updateBadgeCount = onDocumentCreated(
  {
    document: 'notifications/{notificationId}',
    region: 'europe-west1',
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const notification = snapshot.data();
    const userId = notification.userId;

    try {
      // Count unread notifications
      const unreadSnapshot = await admin.firestore()
        .collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .get();

      const unreadCount = unreadSnapshot.size;

      // Get user's FCM token
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .get();

      if (!userDoc.exists) return;

      const userData = userDoc.data() as UserData;
      const fcmToken = userData?.fcmToken;

      if (!fcmToken) return;

      // Send silent notification to update badge (iOS)
      const payload: admin.messaging.Message = {
        data: {
          badge: unreadCount.toString(),
        },
        token: fcmToken,
        apns: {
          payload: {
            aps: {
              badge: unreadCount,
              contentAvailable: true,
            },
          },
        },
        android: {
          notification: {
            notificationCount: unreadCount,
          },
        },
      };

      await admin.messaging().send(payload);
      console.log(`📛 Updated badge count to ${unreadCount} for user ${userId}`);
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  }
);

// ==================== EMAIL VERIFICATION ====================

export const sendVerificationEmail = onCall<SendVerificationEmailData>(
  {
    region: 'us-central1',
    cors: true,
    maxInstances: 10,
    secrets: [gmailEmail, gmailPassword],
  },
  async (request) => {
    const { userId, email, userName } = request.data;

    // Validate input
    if (!userId || !email) {
      throw new HttpsError(
        'invalid-argument',
        'Missing required parameters: userId and email'
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new HttpsError('invalid-argument', 'Invalid email format');
    }

    try {
      // Initialize Gmail transporter
      const mailTransporter = initTransporter();

      // Generate secure random token
      const token = crypto.randomBytes(32).toString('hex');

      // Create verification document
      const verificationData: VerificationDocument = {
        email: email,
        token: token,
        createdAt: admin.firestore.Timestamp.now(),
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
        ),
        verified: false
      };

      // Save to Firestore
      await admin.firestore()
        .collection('email_verifications')
        .doc(userId)
        .set(verificationData);

      // Get project ID
      const projectId = process.env.GCLOUD_PROJECT || 'your-project-id';

      // Create verification URL
      const verificationUrl = `https://us-central1-${projectId}.cloudfunctions.net/verifyEmail?token=${token}&uid=${userId}`;

      // Email HTML content
      const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <style type="text/css">
      /* Prevent dark mode color inversion */
      @media (prefers-color-scheme: dark) {
        .header-text {
          color: #ffffff !important;
        }
      }
      /* Force white text on all clients */
      .header-text {
        color: #ffffff !important;
        -webkit-text-fill-color: #ffffff !important;
        mso-line-height-rule: exactly;
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #563ACC 0%, #866EE1 100%); padding: 40px 30px; text-align: center;">
        <h1 class="header-text" style="margin: 0; color: #ffffff !important; font-size: 32px; -webkit-text-fill-color: #ffffff !important;">AnkaGo</h1>
        <p class="header-text" style="margin: 10px 0 0; color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;">E-posta Doğrulama</p>
      </div>
            
            <!-- Body -->
            <div style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #333;">Hoşgeldin${userName ? ', ' + userName : ''}!</h2>

              <p style="color: #666; line-height: 1.6; margin: 0 0 30px;">
                AnkaGo'ya kaydolduğunuz için teşekkürler. Lütfen kaydınızı tamamlamak ve tüm özellikleri açmak için e-posta adresinizi doğrulayın.
              </p>
              
              <!-- Button -->
<div style="text-align: center; margin: 35px 0;">
  <a href="${verificationUrl}" 
     class="header-text"
     style="display: inline-block; background: linear-gradient(135deg, #563ACC 0%, #866EE1 100%); 
            color: #ffffff !important; padding: 14px 35px; text-decoration: none; border-radius: 8px; 
            font-size: 16px; font-weight: bold; -webkit-text-fill-color: #ffffff !important;">
    E-posta Adresini Doğrula
  </a>
</div>
              
              <!-- Alternative link -->
              <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <p style="margin: 0 0 10px; color: #999; font-size: 14px;">
                  Ya da bu bağlantıyı kopyalayıp yapıştırabilirsiniz:
                </p>
                <p style="margin: 0; color: #563ACC; font-size: 13px; word-break: break-all;">
                  ${verificationUrl}
                </p>
              </div>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              
              <p style="color: #999; font-size: 14px; margin: 0;">
               Bu bağlantı 24 saat geçerlidir. Eğer bu e-postayı siz talep etmediyseniz, lütfen bu e-postayı görmezden gelin.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 25px; text-align: center;">
              <p style="margin: 0; color: #999; font-size: 12px;">
                © ${new Date().getFullYear()} AnkaGo. Tüm hakları saklıdır.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Email text content
      const textContent = `
AnkaGo'ya Hoşgeldin${userName ? ', ' + userName : ''}!

Lütfen e-posta adresinizi doğrulamak için bu bağlantıya tıklayın:
${verificationUrl}

Bu bağlantı 24 saat geçerlidir.

Eğer bu e-postayı siz talep etmediyseniz, lütfen bu e-postayı görmezden gelin.

© ${new Date().getFullYear()} AnkaGo. Tüm hakları saklıdır.
      `.trim();

      // Send email
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"AnkaGo" <${gmailEmail.value()}>`,
        to: email,
        subject: 'E-posta Doğrulama - AnkaGo',
        html: htmlContent,
        text: textContent
      };

      const info = await mailTransporter.sendMail(mailOptions);

      // Update user document
      await admin.firestore()
        .collection('users')
        .doc(userId)
        .update({
          emailVerificationSentAt: admin.firestore.FieldValue.serverTimestamp()
        });

      console.log(`Email sent to ${email}, messageId: ${info.messageId}`);

      return {
        success: true,
        message: 'Verification email sent successfully',
        messageId: info.messageId
      };

    } catch (error) {
      console.error('Error sending email:', error);

      if (error instanceof Error) {
        throw new HttpsError('internal', `Failed to send email: ${error.message}`);
      }
      throw new HttpsError('internal', 'Failed to send verification email');
    }
  }
);

export const verifyEmail = onRequest(
  {
    region: 'us-central1',
    cors: true,
    maxInstances: 10,
  },
  async (req, res) => {
    const token = req.query.token as string | undefined;
    const uid = req.query.uid as string | undefined;

    // Check parameters
    if (!token || !uid) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <div style="max-width: 400px; margin: 0 auto;">
            <h2 style="color: #dc3545;">Geçersiz Bağlantı</h2>
            <p>Doğrulama bağlantısı geçersiz veya eksik parametreler içeriyor.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    try {
      // Get verification record from Firestore
      const verificationDoc = await admin.firestore()
        .collection('email_verifications')
        .doc(uid)
        .get();

      if (!verificationDoc.exists) {
        res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <div style="max-width: 400px; margin: 0 auto;">
              <h2 style="color: #dc3545;">Bulunamadı</h2>
              <p>Hiçbir doğrulama kaydı bulunamadı. Lütfen yeni bir doğrulama e-postası talep edin.</p>
            </div>
          </body>
          </html>
        `);
        return;
      }

      const data = verificationDoc.data() as VerificationDocument;

      // Check if already verified
      if (data.verified) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <div style="max-width: 400px; margin: 0 auto;">
              <div style="font-size: 60px; color: #28a745;">✓</div>
              <h2 style="color: #28a745;">Zaten Doğrulandı</h2>
              <p>E-posta adresiniz zaten doğrulandı. Bu pencereyi kapatabilirsiniz.</p>
            </div>
          </body>
          </html>
        `);
        return;
      }

      // Validate token
      if (data.token !== token) {
        res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <div style="max-width: 400px; margin: 0 auto;">
              <h2 style="color: #dc3545;">Geçersiz Token</h2>
              <p>Doğrulama tokeni geçersiz. Lütfen yeni bir e-posta talep edin.</p>
            </div>
          </body>
          </html>
        `);
        return;
      }

      // Check expiration
      const expirationDate = data.expiresAt.toDate();
      if (new Date() > expirationDate) {
        res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <div style="max-width: 400px; margin: 0 auto;">
              <h2 style="color: #ffc107;">Link Süresi Dolmuş</h2>
              <p>Bu doğrulama bağlantısının süresi dolmuş. Lütfen yeni bir tane talep edin.</p>
            </div>
          </body>
          </html>
        `);
        return;
      }

      // Verify the email - Update both collections
      const batch = admin.firestore().batch();

      // Update verification document
      batch.update(verificationDoc.ref, {
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update user document
      const userRef = admin.firestore().collection('users').doc(uid);
      batch.update(userRef, {
        emailVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Commit both updates
      await batch.commit();

      // Success response
      res.send(`
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5;">
          <div style="max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="font-size: 80px; color: #563ACC;">✓</div>
            <h2 style="color: #333; margin: 20px 0;">E-posta Doğrulandı!</h2>
            <p style="color: #666; margin: 0 0 30px;">
              E-posta adresiniz başarıyla doğrulandı.<br>
              Artık bu pencereyi kapatabilir ve uygulamaya dönebilirsiniz.
            </p>
            <a href="https://ankago.com" 
               style="display: inline-block; background: linear-gradient(135deg, #563ACC 0%, #866EE1 100%); 
                      color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px;">
              AnkaGo Uygulamasını Aç
            </a>
          </div>
        </body>
        </html>
      `);

      console.log(`Email verified for user: ${uid}`);

    } catch (error) {
      console.error('Error verifying email:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <div style="max-width: 400px; margin: 0 auto;">
            <h2 style="color: #dc3545;">Hata</h2>
            <p>E-posta doğrulama işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.</p>
          </div>
        </body>
        </html>
      `);
    }
  }
);

// Scheduled function to send daily insurance report
export const sendDailyInsuranceReport = onSchedule(
  {
    schedule: 'every day 18:00', // 6 PM Istanbul time
    timeZone: 'Europe/Istanbul',
    region: 'europe-west1',
    secrets: [gmailEmail, gmailPassword],
  },
  async (event) => {
    console.log('Starting daily insurance report generation');

    try {
      const today = dayjs().tz(TZ);
      const startOfDay = today.startOf('day').toDate();
      const endOfDay = today.endOf('day').toDate();

      // Query insurance notifications for today
      const insuranceQuery = await db
        .collection('insurance_notifications')
        .where('sentAt', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
        .where('sentAt', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
        .orderBy('sentAt', 'asc')
        .get();

      if (insuranceQuery.empty) {
        console.log('No insurance requests for today');
        return;
      }

      console.log(`Found ${insuranceQuery.size} insurance requests`);

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');

      // Define columns matching your template
      worksheet.columns = [
        { header: 'SÖZLEŞME NO', key: 'contractNo', width: 15 },
        { header: 'SİGORTALI TC', key: 'tc', width: 15 },
        { header: 'SİGORTALI TC_DOĞUM TARİHİ\n(örnek format 01/01/1990)', key: 'dob', width: 20 },
        { header: 'SİGORTALI VKN', key: 'vkn', width: 15 },
        { header: 'SİGORTALI FİRMA VEYA AD-SOYAD', key: 'name', width: 35 },
        { header: 'Sigortalı Adresi', key: 'address', width: 40 },
        { header: 'Telefon numarası\n(xxx) 543 54 54', key: 'phone', width: 20 },
        { header: 'E-mail adresi', key: 'email', width: 30 },
        { header: 'KAMYON PLAKA NO', key: 'plate', width: 15 },
        { header: 'SEVKİYAT BAŞLANGIÇ VE\nBİTİŞ YERİ DETAYI', key: 'route', width: 40 },
        { header: 'YÜKLEME TARİHİ\n(örnek format 01/05/2025)', key: 'loadDate', width: 20 },
        { header: 'SİGORTA KONUSU', key: 'subject', width: 30 },
        { header: 'SİGORTA BEDELİ (TL)', key: 'amount', width: 20 }
      ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      worksheet.getRow(1).height = 40;

      // Corrected section of sendDailyInsuranceReport function

      // Add data rows
      for (const doc of insuranceQuery.docs) {
        const data = doc.data();

        // Get full job details for additional data
        const jobDoc = await db.collection('jobs').doc(data.jobId).get();
        const jobData = jobDoc.exists ? jobDoc.data() : null;

        // Format route with null checks
        let route = `${jobData?.pickupLocation || 'N/A'} - ${jobData?.dropoffLocation || 'N/A'}`;
        if (jobData?.dropoffLocationSecond) {
          route += ` - ${jobData.dropoffLocationSecond}`;
        }

        // Format phone number if needed
        const formatPhone = (phone: string) => {
          // Remove all non-digits
          const digits = phone.replace(/\D/g, '');
          if (digits.length === 11 && digits.startsWith('0')) {
            // Format as (0XXX) XXX XX XX
            return `(${digits.slice(0, 4)}) ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
          }
          return phone;
        };

        // Use stored insurance data from notification record
        // This is more reliable since it's guaranteed to exist
        const insuranceData = data.insuranceData || {};

        worksheet.addRow({
          contractNo: data.contractNumber,
          tc: insuranceData.customerTCKN || 'N/A',
          dob: insuranceData.customerDOB || 'N/A',
          vkn: insuranceData.customerVKN || 'N/A',
          name: insuranceData.customerFullName || 'N/A',
          address: insuranceData.customerAddress || 'N/A',
          phone: formatPhone(insuranceData.customerPhone || 'N/A'),
          email: insuranceData.customerEmail || 'N/A',
          plate: insuranceData.vehiclePlate || 'N/A',
          route: route,
          loadDate: insuranceData.pickupDate || 'N/A',
          subject: 'MUHTELİF EMTEA (İSTİSNA EMTEALAR HARİÇ)',
          amount: insuranceData.insuranceAmount || 0
        });
      }
      const excelBuffer = await workbook.xlsx.writeBuffer();
      // Convert to Node.js Buffer
      const buffer = Buffer.from(excelBuffer);

      // Prepare email
      const mailTransporter = initTransporter();
      const dateStr = today.format('DD-MM-YYYY');
      const environment = process.env.GCLOUD_PROJECT?.includes('prod') ? 'PROD' : 'TEST';
      const mailOptions = {
        from: `"AnkaGo" <info@ankago.com>`,
        to: 'cuneyt@cdsigorta.com',
        subject: `${environment === 'TEST' ? '' : ''}Günlük Sigorta Talepleri - ${dateStr}`,
        text: `Merhaba,

${dateStr} tarihli sigorta talepleri ektedir.

Toplam ${insuranceQuery.size} adet talep bulunmaktadır.

${environment === 'TEST' ? '' : ''}

Saygılarımızla,
AnkaGo`,
        attachments: [
          {
            filename: `ankago_sigorta_talepleri_${dateStr.replace(/-/g, '_')}.xlsx`,
            content: buffer, // Now using Node.js Buffer
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }
        ]
      };

      await mailTransporter.sendMail(mailOptions);

      // Log the report generation
      await db.collection('insurance_reports').add({
        date: dateStr,
        recordCount: insuranceQuery.size,
        sentTo: 'cuneyt@cdsigorta.com',
        environment: environment,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Daily insurance report sent: ${insuranceQuery.size} records`);

    } catch (error) {
      console.error('❌ Error generating insurance report:', error);
      throw error;
    }
  }
);

// Send Insurance Notification
export const sendInsuranceNotification = onCall<InsuranceNotificationData>(
  {
    region: 'europe-west1',
    cors: true,
    secrets: [gmailEmail, gmailPassword],
  },
  async (request) => {
    const data = request.data;

    const isProduction = process.env.GCLOUD_PROJECT?.includes('prod') ||
      process.env.NODE_ENV === 'production';
    const environment = isProduction ? 'PROD' : 'TEST';

    try {
      const mailTransporter = initTransporter();
      const contractNumber = generateContractNumber(isProduction);
      const shortJobId = data.jobId.slice(-8).toUpperCase();

      // Build vehicle info based on type
      let vehicleInfo = `ARAÇ PLAKA: ${data.vehiclePlate}`;
      if (data.vehicleType === 'çekici' && data.trailerPlate) {
        vehicleInfo += `\nRÖMORK PLAKA: ${data.trailerPlate}`;
      }

      // Build dropoff text
      let dropoffText = data.dropoffLocation;
      if (data.dropoffLocationSecond) {
        dropoffText += `\nTESLİMAT 2: ${data.dropoffLocationSecond}`;
      }

      const textContent = `
ANKAGO SİGORTA TALEBİ - ${environment}
=====================================
SÖZLEŞME NO: ${contractNumber}

MÜŞTERİ BİLGİLERİ
-----------------
TCKN: ${data.customerTCKN}
DOĞUM TARİHİ: ${data.customerDOB}
VKN: ${data.customerVKN}
AD SOYAD/ÜNVAN: ${data.customerFullName}
ADRES: ${data.customerAddress}
TELEFON: ${data.customerPhone}
E-POSTA: ${data.customerEmail}

ARAÇ BİLGİLERİ
--------------
ARAÇ TİPİ: ${data.vehicleType.toUpperCase()}
${vehicleInfo}

SEVKİYAT BİLGİLERİ
------------------
BAŞLANGIÇ: ${data.pickupLocation}
BİTİŞ: ${dropoffText}
YÜKLEME TARİHİ: ${data.pickupDate}

SİGORTA BEDELİ: ${data.insuranceAmount} TL

${!isProduction ? '' : ''}
=====================================
      `.trim();

      const mailOptions = {
        from: `"AnkaGo" <info@ankago.com>`,
        to: 'cuneyt@cdsigorta.com',
        subject: `${environment === 'TEST' ? '' : ''}SİGORTA TALEBİ #${contractNumber}`,
        text: textContent,
        headers: {
          'X-Priority': '3',
          'X-Mailer': 'AnkaGo-Platform',
        }
      };

      await mailTransporter.sendMail(mailOptions);

      await db.collection('insurance_notifications').add({
        jobId: data.jobId,
        shortJobId: shortJobId,
        contractNumber: contractNumber,
        environment: environment,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        // Store all the data for Excel generation
        insuranceData: {
          customerTCKN: data.customerTCKN,
          customerDOB: data.customerDOB,
          customerVKN: data.customerVKN,
          customerFullName: data.customerFullName,
          customerAddress: data.customerAddress,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          vehiclePlate: data.vehiclePlate,
          trailerPlate: data.trailerPlate,
          vehicleType: data.vehicleType,
          pickupLocation: data.pickupLocation,
          dropoffLocation: data.dropoffLocation,
          dropoffLocationSecond: data.dropoffLocationSecond,
          pickupDate: data.pickupDate,
          insuranceAmount: data.insuranceAmount,
        }
      });

      await db.collection('jobs').doc(data.jobId).update({
        insuranceContractNumber: contractNumber,
        insuranceNotificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
        insuranceNotificationData: data, // Store all data for report generation
      });

      return {
        success: true,
        contractNumber: contractNumber
      };
    } catch (error) {
      console.error('Insurance notification failed:', error);
      throw new HttpsError('internal', 'Failed to send notification');
    }
  }
);

// ==================== AGORA TOKEN GENERATION ====================

/**
 * Generate Agora token for video/voice calls
 */
// Define the function
export const generateAgoraToken = onCall(
  {
    region: 'europe-west1',
    cors: true, // Add CORS support
  },
  async (request) => {
    logger.info('generateAgoraToken called', { data: request.data });

    // Your existing implementation here
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated to generate token'
      );
    }

    const { channelName, uid, role = 'publisher', expireTime = 3600 } = request.data;

    if (!channelName) {
      throw new HttpsError(
        'invalid-argument',
        'Channel name is required'
      );
    }

    if (uid === undefined || uid === null) {
      throw new HttpsError(
        'invalid-argument',
        'UID is required'
      );
    }

    try {
      const currentTime = Math.floor(Date.now() / 1000);
      const privilegeExpireTime = currentTime + expireTime;

      const tokenRole = role === 'publisher'
        ? RtcRole.PUBLISHER
        : RtcRole.SUBSCRIBER;

      const token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName,
        uid,
        tokenRole,
        privilegeExpireTime
      );

      logger.info('Token generated successfully');

      return {
        token: token,
        appId: AGORA_APP_ID,
        channelName: channelName,
        uid: uid,
        expireTime: privilegeExpireTime,
      };

    } catch (error) {
      logger.error('Error generating token:', error);
      throw new HttpsError(
        'internal',
        'Failed to generate token'
      );
    }
  }
);

/**
 * Refresh Agora token for ongoing calls
 */
export const refreshAgoraToken = onCall<RefreshTokenRequest>(
  {
    region: 'europe-west1',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated to refresh token'
      );
    }

    const { callId, channelName, uid } = request.data;

    if (!callId || !channelName || (uid === undefined || uid === null)) {
      throw new HttpsError(
        'invalid-argument',
        'Call ID, channel name, and UID are required'
      );
    }

    try {
      // Verify the call exists and user is part of it
      const callDoc = await admin.firestore()
        .collection('calls')
        .doc(callId)
        .get();

      if (!callDoc.exists) {
        throw new HttpsError(
          'not-found',
          'Call not found'
        );
      }

      const callData = callDoc.data() as CallData;
      const userId = request.auth.uid;

      // Verify user is part of this call
      if (callData.callerId !== userId && callData.receiverId !== userId) {
        throw new HttpsError(
          'permission-denied',
          'User is not part of this call'
        );
      }

      // Generate new token with 1 hour expiry
      const currentTime = Math.floor(Date.now() / 1000);
      const privilegeExpireTime = currentTime + 3600;

      const token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName,
        uid,
        RtcRole.PUBLISHER,
        privilegeExpireTime
      );

      // Update call document with new token
      await callDoc.ref.update({
        lastTokenRefresh: admin.firestore.FieldValue.serverTimestamp(),
        tokenExpireTime: privilegeExpireTime,
      });

      return {
        token: token,
        expireTime: privilegeExpireTime,
      };

    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new HttpsError(
        'internal',
        'Failed to refresh token'
      );
    }
  }
);

// ==================== CALL NOTIFICATION ====================

/**
 * Send call notification via FCM with improved iOS handling
 */
export const sendCallNotification = onCall<CallNotificationData>(
  {
    region: 'europe-west1',
    cors: true,
  },
  async (request) => {
    logger.info('sendCallNotification called', {
      auth: request.auth?.uid,
      data: request.data
    });

    if (!request.auth) {
      logger.error('No authentication provided');
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { receiverId, callId, callerName, callType } = request.data;

    // Validate input
    if (!receiverId || !callId || !callerName || !callType) {
      logger.error('Missing required fields', { receiverId, callId, callerName, callType });
      throw new HttpsError(
        'invalid-argument',
        'Missing required fields'
      );
    }

    try {
      // Check if receiver is not the same as caller
      if (receiverId === request.auth.uid) {
        logger.warn('Caller and receiver are the same');
        return {
          success: false,
          reason: 'Cannot call yourself'
        };
      }

      // Get receiver's data
      logger.info(`Getting receiver data for ${receiverId}`);
      const receiverDoc = await admin.firestore()
        .collection('users')
        .doc(receiverId)
        .get();

      if (!receiverDoc.exists) {
        logger.error(`Receiver not found: ${receiverId}`);
        throw new HttpsError(
          'not-found',
          'Receiver not found'
        );
      }

      const receiverData = receiverDoc.data() as UserData;
      const fcmToken = receiverData.fcmToken;
      const platform = receiverData.platform || 'unknown';

      if (!fcmToken) {
        logger.warn(`No FCM token for receiver: ${receiverId}`);
        return {
          success: false,
          reason: 'No FCM token - user may not have notifications enabled'
        };
      }

      logger.info(`Receiver platform: ${platform}, token: ${fcmToken.substring(0, 20)}...`);

      // Get caller's avatar
      const callerDoc = await admin.firestore()
        .collection('users')
        .doc(request.auth.uid)
        .get();

      const callerData = callerDoc.data() as UserData;
      const callerAvatar = callerData?.profilePhotoUrl || '';

      // Get call document for channel name and token
      const callDoc = await admin.firestore()
        .collection('calls')
        .doc(callId)
        .get();

      if (!callDoc.exists) {
        logger.error(`Call document not found: ${callId}`);
        throw new HttpsError(
          'not-found',
          'Call not found'
        );
      }

      const callData = callDoc.data() as CallData;

      // Build platform-specific message
      let message: admin.messaging.Message;

      if (platform === 'ios') {
        // iOS-specific message with high priority
        message = {
          token: fcmToken,
          // Data-only message for iOS to ensure background wake
          data: {
            type: 'incoming_call',
            callId: callId,
            callerId: request.auth.uid,
            callerName: callerName,
            callerAvatar: callerAvatar || '',
            callType: callType,
            channelName: callData.channelName || '',
            timestamp: Date.now().toString(),
            // Add priority flag
            priority: 'high',
          },
          apns: {
            payload: {
              aps: {
                // Critical alert for calls
                'content-available': 1,
                'mutable-content': 1,
                // Add sound for immediate alert
                sound: {
                  critical: true,
                  name: 'default',
                  volume: 1.0,
                },
                // Alert for notification display
                alert: {
                  title: `${callType === 'video' ? 'Video' : 'Voice'} Call`,
                  body: `${callerName} arıyor...`,
                },
                category: 'INCOMING_CALL',
                // Thread ID for grouping
                'thread-id': 'calls',
              },
            },
            headers: {
              'apns-priority': '10', // Highest priority
              'apns-push-type': 'alert',
              'apns-expiration': Math.floor(Date.now() / 1000 + 30).toString(),
              // Add collapse ID to prevent duplicate notifications
              'apns-collapse-id': `call-${callId}`,
            },
          },
          // Add FCM options for deduplication
          fcmOptions: {
            analyticsLabel: 'incoming_call',
          },
        };
      } else {
        // Android-specific message format
        message = {
          token: fcmToken,
          // Keep notification for Android to ensure display
          notification: {
            title: `${callType === 'video' ? 'Video' : 'Voice'} Call`,
            body: `${callerName} arıyor...`,
          },
          data: {
            type: 'incoming_call',
            callId: callId,
            callerId: request.auth.uid,
            callerName: callerName,
            callerAvatar: callerAvatar || '',
            callType: callType,
            channelName: callData.channelName || '',
            timestamp: Date.now().toString(),
          },
          android: {
            priority: 'high',
            ttl: 60000, // 60 seconds
            // Collapse key to prevent duplicates
            collapseKey: `call_${callId}`,
            notification: {
              channelId: 'calls',
              priority: 'max',
              visibility: 'public',
              defaultSound: false,
              sound: 'ringtone',
              notificationCount: 1,
              tag: `call_${callId}`, // Unique tag to prevent duplicates
              sticky: true,
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
              icon: 'ic_notification',
              color: '#563ACC',
              // Add light settings for devices that support it
              lightSettings: {
                color: '#563ACC',
                lightOnDurationMillis: 1000,
                lightOffDurationMillis: 500,
              },
            },
          },
        };
      }

      // Log the message for debugging
      logger.info('Sending FCM message', {
        platform,
        hasNotification: !!message.notification,
        dataKeys: Object.keys(message.data || {}),
        apnsHeaders: platform === 'ios' ? message.apns?.headers : undefined,
      });

      // Send the message
      const response = await admin.messaging().send(message);
      logger.info('Call notification sent successfully', {
        messageId: response,
        platform,
        receiverId,
        callId
      });

      // Store notification send timestamp to prevent duplicates
      await admin.firestore()
        .collection('calls')
        .doc(callId)
        .update({
          notificationSentAt: admin.firestore.FieldValue.serverTimestamp(),
          notificationMessageId: response,
        });

      return {
        success: true,
        messageId: response,
        platform
      };

    } catch (error: any) {
      logger.error('Error in sendCallNotification:', {
        error: error.message,
        code: error.code,
        stack: error.stack,
      });

      // More specific error handling
      if (error.code === 'messaging/invalid-argument') {
        logger.error('Invalid FCM message format', {
          details: error.errorInfo,
        });
        throw new HttpsError(
          'invalid-argument',
          'Invalid FCM token or message format'
        );
      }

      if (error.code === 'messaging/registration-token-not-registered') {
        logger.warn('FCM token not registered');
        return {
          success: false,
          reason: 'FCM token is not valid - user needs to re-register for notifications'
        };
      }

      if (error.code === 'messaging/invalid-registration-token') {
        logger.warn('Invalid FCM token format');
        return {
          success: false,
          reason: 'FCM token format is invalid'
        };
      }

      // Generic error
      throw new HttpsError(
        'internal',
        `Failed to send notification: ${error.message}`
      );
    }
  }
);

// ==================== CALL VALIDATION ====================

/**
 * Validate call request before initiating
 */
export const validateCallRequest = onCall<CallValidationRequest>(
  {
    region: 'europe-west1',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { receiverId } = request.data;
    const callerId = request.auth.uid;

    try {
      // Check if users have blocked each other
      const [receiverDoc] = await Promise.all([
        admin.firestore().collection('users').doc(callerId).get(),
        admin.firestore().collection('users').doc(receiverId).get(),
      ]);

      if (!receiverDoc.exists) {
        throw new HttpsError(
          'not-found',
          'Receiver not found'
        );
      }

      const receiverData = receiverDoc.data() as UserData;

      // Check if caller is blocked by receiver
      if (receiverData.blockedUsers?.includes(callerId)) {
        return {
          allowed: false,
          reason: 'You have been blocked by this user',
        };
      }

      // Check if receiver has do-not-disturb enabled
      if (receiverData.doNotDisturb) {
        return {
          allowed: false,
          reason: 'User has Do Not Disturb enabled',
        };
      }

      // Check rate limiting (max 5 calls per minute to same user)
      const recentCalls = await admin.firestore()
        .collection('calls')
        .where('callerId', '==', callerId)
        .where('receiverId', '==', receiverId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(Date.now() - 60000)))
        .get();

      if (recentCalls.size >= 5) {
        return {
          allowed: false,
          reason: 'Too many call attempts. Please wait before trying again.',
        };
      }

      return {
        allowed: true,
        receiverName: receiverData.fullName || 'Unknown',
        receiverAvatar: receiverData.profilePhotoUrl || '',
      };

    } catch (error) {
      console.error('Error validating call request:', error);
      throw new HttpsError(
        'internal',
        'Failed to validate call request'
      );
    }
  }
);

// ==================== CALL EVENT HANDLERS ====================

/**
 * Handle call status changes
 */
export const onCallStatusChange = onDocumentUpdated(
  {
    document: 'calls/{callId}',
    region: 'europe-west1',
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const before = snapshot.before.data() as CallData;
    const after = snapshot.after.data() as CallData;

    // Check if status changed
    if (before.status === after.status) return;

    try {
      // Handle different status changes
      switch (after.status) {
        case 'accepted':
          // Log call start
          await admin.firestore().collection('call_analytics').add({
            callId: event.params.callId,
            event: 'call_started',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            participants: [after.callerId, after.receiverId],
            type: after.type,
          });
          break;

        case 'ended':
          // Calculate call metrics
          if (after.answeredAt) {
            const duration = after.duration || 0;
            await admin.firestore().collection('call_analytics').add({
              callId: event.params.callId,
              event: 'call_ended',
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              duration: duration,
              endReason: after.endReason,
            });

            // Update user stats
            const updateUserStats = async (userId: string) => {
              const userRef = admin.firestore().collection('users').doc(userId);
              await userRef.update({
                totalCallMinutes: admin.firestore.FieldValue.increment(Math.ceil(duration / 60)),
                totalCalls: admin.firestore.FieldValue.increment(1),
                lastCallAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            };

            await Promise.all([
              updateUserStats(after.callerId),
              updateUserStats(after.receiverId),
            ]);
          }
          break;

        case 'missed':
          // FIX: Get caller's actual name instead of using UID
          const callerDoc = await admin.firestore()
            .collection('users')
            .doc(after.callerId) // Use callerId, not receiverId
            .get();

          const callerName = callerDoc.exists
            ? (callerDoc.data() as UserData).fullName || 'Unknown Caller'
            : 'Unknown Caller';

          // Send missed call notification to receiver
          const receiverDoc = await admin.firestore()
            .collection('users')
            .doc(after.receiverId)
            .get();

          if (receiverDoc.exists) {
            const receiverData = receiverDoc.data() as UserData;
            if (receiverData.fcmToken) {
              await admin.messaging().send({
                token: receiverData.fcmToken,
                notification: {
                  title: '📞 Cevapsız Arama', // Turkish: Missed Call
                  body: `${callerName} tarafından ${after.type === 'video' ? 'görüntülü' : 'sesli'} arama`, // "[Name] made a voice/video call"
                },
                data: {
                  type: 'missed_call',
                  callId: event.params.callId,
                  callerId: after.callerId,
                  callerName: callerName,
                  callType: after.type,
                },
                android: {
                  priority: 'high',
                  notification: {
                    channelId: 'calls',
                    priority: 'high',
                    defaultSound: true,
                    defaultVibrateTimings: true,
                    tag: 'missed_call',
                  },
                },
                apns: {
                  payload: {
                    aps: {
                      badge: 1,
                      sound: 'default',
                      contentAvailable: true,
                      category: 'missed_call',
                    },
                  },
                },
              });

              console.log(`✅ Sent missed call notification for ${callerName} to ${after.receiverId}`);
            }
          }
          break;
      }
    } catch (error) {
      console.error('Error in call status change handler:', error);
    }
  }
);

// ==================== WEBHOOK FOR AGORA EVENTS ====================

/**
 * Webhook to handle call events from Agora (optional but recommended)
 */
export const agoraWebhook = onRequest(
  {
    region: 'europe-west1',
    cors: true,
  },
  async (req, res) => {
    const { eventType, payload } = req.body;

    try {
      switch (eventType) {
        case 'channel_create':
          // Channel created
          console.log('Channel created:', payload);
          break;

        case 'channel_destroy':
          // Channel destroyed - all users left
          const { channelName } = payload;
          // Find and update the call status
          const callQuery = await admin.firestore()
            .collection('calls')
            .where('channelName', '==', channelName)
            .where('status', 'in', ['pending', 'accepted'])
            .get();

          if (!callQuery.empty) {
            const batch = admin.firestore().batch();
            callQuery.docs.forEach(doc => {
              batch.update(doc.ref, {
                status: 'ended',
                endedAt: admin.firestore.FieldValue.serverTimestamp(),
                endReason: 'Channel destroyed',
              });
            });
            await batch.commit();
          }
          break;

        case 'broadcaster_join':
          // User joined as broadcaster
          console.log('Broadcaster joined:', payload);
          break;

        case 'broadcaster_leave':
          // User left
          console.log('Broadcaster left:', payload);
          break;
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).send('Internal error');
    }
  }
);

// ==================== CLEANUP SCHEDULED FUNCTION ====================

/**
 * Clean up old calls periodically
 */
export const cleanupOldCalls = onSchedule(
  {
    schedule: 'every 24 hours',
    region: 'europe-west1',
  },
  async (event) => {
    const cutoffTime = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    );

    const oldCallsQuery = await admin.firestore()
      .collection('calls')
      .where('createdAt', '<', cutoffTime)
      .limit(500)
      .get();

    if (oldCallsQuery.empty) {
      console.log('No old calls to clean up');
      return;
    }

    const batch = admin.firestore().batch();
    oldCallsQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Deleted ${oldCallsQuery.size} old calls`);
  }
);

// ==================== Weekly Incentives ====================

// Build a week key like "2025-35" (ISO-like Mon–Sun)
function weekIdFrom(ts: admin.firestore.Timestamp) {
  // We’ll emulate ISO week by anchoring to Monday 00:00 TR time.
  // Simpler approach: take the local date, find Monday of that week, and derive week number by format 'GGGG-ww' via Intl.
  // Day.js core doesn't ship isoWeek plugin by default, so we’ll roll a stable Monday-week start key:

  const d = dayjs(ts.toDate()).tz(TZ);

  // Get Monday 00:00 of this week in TR time
  const weekday = d.day(); // 0=Sun ... 6=Sat
  const daysFromMonday = (weekday + 6) % 7; // convert so Mon=0
  const monday = d.startOf("day").subtract(daysFromMonday, "day");

  // Year of the Monday anchor
  const year = monday.year();

  // Week number within the year, Monday-based (simple rolling count):
  const startOfYearMonday = dayjs(`${year}-01-01`).tz(TZ);
  const startWeekday = (startOfYearMonday.day() + 6) % 7;
  const firstMonday = startOfYearMonday.startOf("day").subtract(startWeekday, "day");
  const weekNumber = Math.floor(monday.diff(firstMonday, "day") / 7) + 1;

  return `${year}-${String(weekNumber).padStart(2, "0")}`;
}

function rewardFor(count: number) {
  if (count >= 5) return 1200;
  if (count >= 4) return 900;
  if (count >= 2) return 400;
  return 0;
}

function milestoneForCount(count: number) {
  if (count >= 5) return 5;
  if (count >= 4) return 4;
  if (count >= 2) return 2;
  return 0;
}

/**
 * On job delivered, update weekly challenges for carriers
 */
export const onJobDeliveredTrigger = onDocumentUpdated(
  {
    document: "jobs/{jobId}",
    region: "europe-west1",
  },
  async (event) => {
    const before = event.data?.before.data() as any | undefined;
    const after = event.data?.after.data() as any | undefined;
    if (!before || !after) return;

    // Only act the FIRST time deliveredAt appears
    const deliveredAtNowSet = !before.deliveredAt && !!after.deliveredAt;
    if (!deliveredAtNowSet) return;

    // Use acceptedCarrierId (matching your JobModel)
    const carrierId = after.acceptedCarrierId;
    if (!carrierId) {
      console.log(`No acceptedCarrierId found for job ${event.params.jobId}`);
      return;
    }

    const jobRef = event.data!.after.ref;

    // Use deliveredAt (matching your JobModel)
    const deliveredAt = after.deliveredAt as admin.firestore.Timestamp;
    if (!deliveredAt) {
      console.log(`No deliveredAt timestamp for job ${event.params.jobId}`);
      return;
    }

    const weekId = weekIdFrom(deliveredAt);

    console.log(`Processing completed job ${event.params.jobId} for carrier ${carrierId} in week ${weekId}`);

    // Persist weekId once (best-effort; won't break if fails)
    if (!after.weekId) {
      await jobRef.set({ weekId }, { merge: true });
    }

    // weeklyChallenges/{weekId}/carriers/{carrierId}
    const weeklyDoc = db
      .collection("weeklyChallenges").doc(weekId)
      .collection("carriers").doc(carrierId);

    // idempotency guard so we can't double-count the same job
    const eventDoc = weeklyDoc.collection("events").doc(event.params.jobId);

    await db.runTransaction(async (trx) => {
      const evSnap = await trx.get(eventDoc);
      if (evSnap.exists) {
        console.log(`Job ${event.params.jobId} already processed for weekly challenge`);
        return; // already processed
      }

      const weeklySnap = await trx.get(weeklyDoc);
      const base = weeklySnap.exists ? weeklySnap.data()! : {};

      const deliveredCount = (base.deliveredCount ?? 0) + 1;
      const unlockedReward = rewardFor(deliveredCount);

      const milestone = milestoneForCount(deliveredCount);
      const payoutRef = db.collection("weeklyPayouts").doc(`${weekId}_${carrierId}`);

      console.log(`Updating weekly challenge for carrier ${carrierId}: count=${deliveredCount}, reward=${unlockedReward}`);

      trx.set(
        weeklyDoc,
        {
          deliveredCount,
          unlockedReward,
          paidOut: base.paidOut ?? false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          // optional audit list
          jobIds: admin.firestore.FieldValue.arrayUnion(event.params.jobId),
        },
        { merge: true }
      );

      trx.set(eventDoc, {
        jobId: event.params.jobId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      trx.set(
        payoutRef,
        {
          weekId,
          carrierId,
          deliveredCount,
          milestone,                       // 0 | 2 | 4 | 5
          amountTRY: unlockedReward,       // 0 | 400 | 900 | 1200
          currency: "TRY",
          status: "pending",               // your payout worker will flip to 'paid'
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          jobIds: admin.firestore.FieldValue.arrayUnion(event.params.jobId),
        },
        { merge: true }
      );
    });

    console.log(`Successfully updated weekly challenge for carrier ${carrierId} - job ${event.params.jobId}`);
  }
);

export const finalizeWeeklyPayouts = onSchedule(
  {
    schedule: "5 0 * * 1",              // every Monday 00:05 TR time
    timeZone: "Europe/Istanbul",
    region: "europe-west1",
  },
  async () => {
    const now = dayjs().tz(TZ);
    // Step into the previous week safely (Sunday 23:55 TR)
    const ts = admin.firestore.Timestamp.fromDate(now.subtract(10, "minute").toDate());
    const lastWeekId = weekIdFrom(ts);

    const carriersSnap = await db
      .collection("weeklyChallenges").doc(lastWeekId)
      .collection("carriers").get();

    if (carriersSnap.empty) return;

    const batch = db.batch();

    for (const doc of carriersSnap.docs) {
      const d = doc.data() as any;
      const deliveredCount = d.deliveredCount ?? 0;
      const amountTRY = d.unlockedReward ?? 0;
      if (amountTRY <= 0) continue; // nothing to pay

      const carrierId = doc.id;
      const milestone = milestoneForCount(deliveredCount);

      const payoutRef = db.collection("weeklyPayouts").doc(`${lastWeekId}_${carrierId}`);

      // finalize/lock payout row for the week (idempotent merge)
      batch.set(
        payoutRef,
        {
          weekId: lastWeekId,
          carrierId,
          deliveredCount,
          milestone,
          amountTRY,
          currency: "TRY",
          jobIds: d.jobIds ?? [],
          status: "pending", // your payout worker will set 'processing'/'paid'
          finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // mark scoreboard row as exported/closed
      batch.set(
        doc.ref,
        {
          paidOut: true,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
  }
);

// ==================== RETURN OPPORTUNITIES ====================
export const trackReturnOpportunityAcceptance = onCall(
  {
    region: 'europe-west1',
  },
  async (request) => {
    const { carrierId, originalJobId, acceptedJobId } = request.data;

    logger.info('trackReturnOpportunityAcceptance called with:', {
      carrierId,
      originalJobId,
      acceptedJobId
    });

    if (!carrierId || !originalJobId || !acceptedJobId) {
      throw new HttpsError('invalid-argument', 'Missing required parameters');
    }

    const corridorId = `${carrierId}_${originalJobId}`;
    logger.info(`Looking for corridor: ${corridorId}`);

    try {
      // First, check if the corridor exists
      const corridorRef = db.collection('returnOpportunities').doc(corridorId);
      const corridorDoc = await corridorRef.get();

      if (!corridorDoc.exists) {
        logger.error(`Corridor not found: ${corridorId}`);
        // Instead of throwing, just record the acceptance anyway
        await db.collection('returnOpportunityAnalytics').add({
          carrierId,
          originalJobId,
          acceptedJobId,
          corridorId,
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          note: 'Corridor not found, tracking anyway',
        });

        return { success: true, warning: 'Corridor not found but tracked' };
      }

      const corridor = corridorDoc.data()!;
      logger.info(`Found corridor with ${corridor.opportunities?.length || 0} opportunities`);

      // Find the accepted job in opportunities
      const acceptedOpp = corridor.opportunities?.find(
        (opp: any) => opp.jobId === acceptedJobId
      );

      if (!acceptedOpp) {
        logger.warn(`Job ${acceptedJobId} not found in corridor opportunities`);
      }

      // Use a simple write instead of transaction for now
      const analyticsData: any = {
        carrierId,
        originalJobId,
        acceptedJobId,
        corridorId,
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (acceptedOpp) {
        analyticsData.deviationKm = acceptedOpp.deviationKm;
        analyticsData.directionScore = acceptedOpp.directionScore;
        analyticsData.totalScore = acceptedOpp.totalScore;
      }

      // Record the acceptance
      await db.collection('returnOpportunityAnalytics').add(analyticsData);

      // Update carrier stats (non-critical, don't fail if this fails)
      try {
        await db.collection('users').doc(carrierId).update({
          'returnOpportunityStats.accepted': admin.firestore.FieldValue.increment(1),
          'returnOpportunityStats.lastAcceptedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {
        logger.warn('Failed to update user stats:', e);
      }

      // Mark opportunity as accepted (non-critical)
      if (acceptedOpp) {
        try {
          const updatedOpportunities = corridor.opportunities.map((opp: any) =>
            opp.jobId === acceptedJobId
              ? { ...opp, accepted: true }
              : opp
          );

          await corridorRef.update({
            opportunities: updatedOpportunities,
            hasAcceptedJobs: true,
            lastAcceptedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) {
          logger.warn('Failed to update corridor:', e);
        }
      }

      logger.info(`Successfully tracked acceptance: ${acceptedJobId}`);
      return { success: true };

    } catch (error: any) {
      logger.error('Unexpected error in trackReturnOpportunityAcceptance:', error);
      logger.error('Error details:', error.message, error.stack);

      // Don't throw, just return success false
      return { success: false, error: error.message };
    }
  }
);

// ==================== NEW JOB NOTIFICATION TO OPS TEAM ====================

/**
 * Send email notification to operations team when a new job is created
 */
export const onJobCreatedNotifyOps = onDocumentCreated(
  {
    document: 'jobs/{jobId}',
    region: 'europe-west1',
    secrets: [gmailEmail, gmailPassword],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data associated with the event');
      return;
    }

    const jobData = snapshot.data();
    const jobId = event.params.jobId;

    console.log(`📧 New job created: ${jobId}, sending notification to ops team`);

    try {
      const mailTransporter = initTransporter();

      // Get customer info
      let customerName = 'Bilinmeyen Müşteri';
      let customerPhone = 'N/A';
      let customerEmail = 'N/A';

      if (jobData.customerId) {
        const customerDoc = await db.collection('users').doc(jobData.customerId).get();
        if (customerDoc.exists) {
          const customerData = customerDoc.data();
          customerName = customerData?.fullName || customerData?.companyName || 'Bilinmeyen Müşteri';
          customerPhone = customerData?.phone || 'N/A';
          customerEmail = customerData?.email || 'N/A';
        }
      }

      // Format dates
      const formatDate = (timestamp: any): string => {
        if (!timestamp) return 'Belirtilmemiş';
        try {
          const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
          return dayjs(date).tz(TZ).format('DD/MM/YYYY HH:mm');
        } catch {
          return 'Geçersiz Tarih';
        }
      };

      // Format price
      const formatPrice = (price: any): string => {
        if (!price && price !== 0) return 'Belirtilmemiş';
        return new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: 'TRY',
          minimumFractionDigits: 0,
        }).format(price);
      };

      // Build special handling info
      const specialHandling: string[] = [];
      if (jobData.needsSpecialHandling) specialHandling.push('Özel Taşıma Gerekli');
      if (jobData.isUrgent) specialHandling.push('ACİL');
      if (jobData.isStackable) specialHandling.push('İstiflenebilir');
      if (jobData.hasInsurance) specialHandling.push('Sigortalı');

      // Operations team email recipients
      const opsTeamEmails = [
        'sadettinokan@ankago.com',
        'cbinici@ankago.com',
        'berkin.eken2002@hotmail.com',
      ];

      // Email text content
      const textContent = `
YENİ İŞ TALEBİ - ${jobId.slice(-8).toUpperCase()}
=====================================

MÜŞTERİ BİLGİLERİ
-----------------
Ad/Firma: ${customerName}
Telefon: ${customerPhone}
E-posta: ${customerEmail}

GÜZERGAH BİLGİLERİ
------------------
Yükleme: ${jobData.pickupLocation || 'Belirtilmemiş'}
Teslimat: ${jobData.dropoffLocation || 'Belirtilmemiş'}
${jobData.dropoffLocationSecond ? `Teslimat 2: ${jobData.dropoffLocationSecond}` : ''}

ZAMANLAMA
---------
Yükleme Zamanı: ${formatDate(jobData.pickupTime)}
Teslim Zamanı: ${formatDate(jobData.dropOffTime)}
Oluşturulma: ${formatDate(jobData.createdAt)}

YÜK BİLGİLERİ
-------------
Açıklama: ${jobData.loadDescription || 'Belirtilmemiş'}
Ağırlık: ${jobData.loadWeightKg ? `${jobData.loadWeightKg} kg` : 'Belirtilmemiş'}
Palet Sayısı: ${jobData.palletCount || 'Belirtilmemiş'}
Palet Tipi: ${jobData.palletType || 'Belirtilmemiş'}
${jobData.en && jobData.boy ? `Boyutlar: ${jobData.en} x ${jobData.boy} cm` : ''}

FİYATLANDIRMA
-------------
Taban Fiyat: ${formatPrice(jobData.basePrice)}
Yük Değeri: ${formatPrice(jobData.loadValue)}
${jobData.hasInsurance ? `Sigorta Primi: ${formatPrice(jobData.totalPrimAmount)}` : ''}

${specialHandling.length > 0 ? `ÖZEL DURUMLAR: ${specialHandling.join(' | ')}` : ''}

${jobData.notes ? `NOTLAR:\n${jobData.notes}` : ''}

=====================================
Bu e-posta AnkaGo sistemi tarafından otomatik gönderilmiştir.
      `.trim();

      // Email HTML content
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #563ACC 0%, #866EE1 100%); padding: 25px 30px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 24px; }
    .header p { margin: 10px 0 0; color: #ffffff; opacity: 0.9; }
    .content { padding: 30px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14px; font-weight: bold; color: #563ACC; text-transform: uppercase; margin-bottom: 12px; border-bottom: 2px solid #563ACC; padding-bottom: 5px; }
    .info-row { display: flex; margin-bottom: 8px; }
    .info-label { font-weight: bold; color: #666; width: 140px; flex-shrink: 0; }
    .info-value { color: #333; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 5px; margin-top: 5px; }
    .badge-urgent { background: #dc3545; color: white; }
    .badge-special { background: #ffc107; color: #333; }
    .badge-insurance { background: #28a745; color: white; }
    .badge-stackable { background: #17a2b8; color: white; }
    .notes-box { background: #f8f9fa; border-left: 4px solid #563ACC; padding: 15px; margin-top: 15px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999; }
    .job-id { font-family: monospace; padding: 2px 6px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Yeni Is Talebi</h1>
      <p>İş No: <span class="job-id">${jobId.slice(-8).toUpperCase()}</span></p>
    </div>

    <div class="content">
      <!-- Customer Info -->
      <div class="section">
        <div class="section-title">Musteri Bilgileri</div>
        <div class="info-row"><span class="info-label">Ad/Firma:</span><span class="info-value">${customerName}</span></div>
        <div class="info-row"><span class="info-label">Telefon:</span><span class="info-value">${customerPhone}</span></div>
        <div class="info-row"><span class="info-label">E-posta:</span><span class="info-value">${customerEmail}</span></div>
      </div>

      <!-- Route Info -->
      <div class="section">
        <div class="section-title">Guzergah</div>
        <div class="info-row"><span class="info-label">Yükleme:</span><span class="info-value">${jobData.pickupLocation || 'Belirtilmemiş'}</span></div>
        <div class="info-row"><span class="info-label">Teslimat:</span><span class="info-value">${jobData.dropoffLocation || 'Belirtilmemiş'}</span></div>
        ${jobData.dropoffLocationSecond ? `<div class="info-row"><span class="info-label">Teslimat 2:</span><span class="info-value">${jobData.dropoffLocationSecond}</span></div>` : ''}
      </div>

      <!-- Schedule -->
      <div class="section">
        <div class="section-title">Zamanlama</div>
        <div class="info-row"><span class="info-label">Yükleme:</span><span class="info-value">${formatDate(jobData.pickupTime)}</span></div>
        <div class="info-row"><span class="info-label">Teslim:</span><span class="info-value">${formatDate(jobData.dropOffTime)}</span></div>
      </div>

      <!-- Load Info -->
      <div class="section">
        <div class="section-title">Yuk Bilgileri</div>
        <div class="info-row"><span class="info-label">Açıklama:</span><span class="info-value">${jobData.loadDescription || 'Belirtilmemiş'}</span></div>
        <div class="info-row"><span class="info-label">Ağırlık:</span><span class="info-value">${jobData.loadWeightKg ? `${jobData.loadWeightKg} kg` : 'Belirtilmemiş'}</span></div>
        <div class="info-row"><span class="info-label">Palet:</span><span class="info-value">${jobData.palletCount || 0} adet ${jobData.palletType || ''}</span></div>
        ${jobData.en && jobData.boy ? `<div class="info-row"><span class="info-label">Boyutlar:</span><span class="info-value">${jobData.en} x ${jobData.boy} cm</span></div>` : ''}
      </div>

      <!-- Pricing -->
      <div class="section">
        <div class="section-title">Fiyatlandirma</div>
        <div class="info-row"><span class="info-label">Taban Fiyat:</span><span class="info-value">${formatPrice(jobData.basePrice)}</span></div>
        <div class="info-row"><span class="info-label">Yük Değeri:</span><span class="info-value">${formatPrice(jobData.loadValue)}</span></div>
        ${jobData.hasInsurance ? `<div class="info-row"><span class="info-label">Sigorta Primi:</span><span class="info-value">${formatPrice(jobData.totalPrimAmount)}</span></div>` : ''}
      </div>

      <!-- Special Handling -->
      ${specialHandling.length > 0 ? `
      <div class="section">
        <div class="section-title">Ozel Durumlar</div>
        <div>
          ${jobData.isUrgent ? '<span class="badge badge-urgent">ACİL</span>' : ''}
          ${jobData.needsSpecialHandling ? '<span class="badge badge-special">Özel Taşıma</span>' : ''}
          ${jobData.hasInsurance ? '<span class="badge badge-insurance">Sigortalı</span>' : ''}
          ${jobData.isStackable ? '<span class="badge badge-stackable">İstiflenebilir</span>' : ''}
        </div>
      </div>
      ` : ''}

      <!-- Notes -->
      ${jobData.notes ? `
      <div class="section">
        <div class="section-title">Notlar</div>
        <div class="notes-box">${jobData.notes}</div>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <p>Bu e-posta AnkaGo sistemi tarafından otomatik olarak gönderilmiştir.</p>
      <p>© ${new Date().getFullYear()} AnkaGo. Tüm hakları saklıdır.</p>
    </div>
  </div>
</body>
</html>
      `;

      const mailOptions = {
        from: `"AnkaGo" <${gmailEmail.value()}>`,
        replyTo: 'info@ankago.com',
        to: opsTeamEmails.join(', '),
        subject: `Yeni Is Talebi - ${jobData.pickupLocation || 'N/A'} - ${jobData.dropoffLocation || 'N/A'} | #${jobId.slice(-8).toUpperCase()}`,
        html: htmlContent,
        text: textContent,
      };

      const info = await mailTransporter.sendMail(mailOptions);

      // Log the notification
      await db.collection('job_notifications').add({
        jobId: jobId,
        type: 'new_job_ops_notification',
        sentTo: opsTeamEmails,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        messageId: info.messageId,
        success: true,
      });

      console.log(`✅ Ops team notification sent for job ${jobId}, messageId: ${info.messageId}`);

    } catch (error) {
      console.error(`❌ Error sending ops notification for job ${jobId}:`, error);

      // Log the failure
      await db.collection('job_notifications').add({
        jobId: jobId,
        type: 'new_job_ops_notification',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ==================== DOCUMENT CHECK ====================

export const checkSoloCarrierDocuments = onSchedule(
  {
    schedule: '0 0 * * *', // Midnight UTC = 3 AM Istanbul
    timeZone: 'Europe/Istanbul',
    region: 'europe-west1',
  },
  async (event) => {
    console.log('🔍 Starting solo carrier document check at 3 AM Istanbul time');

    try {
      // Get all solo carriers who haven't been active in 48 hours
      const fortyEightHoursAgo = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - 48 * 60 * 60 * 1000)
      );

      // Query solo carriers
      const soloCarriersQuery = await db
        .collection('users')
        .where('userType', '==', 'carrier')
        .where('carrierType', '==', 'solo')
        .where('accountStatus', 'in', ['verified', 'documents_expiring'])
        .get();

      console.log(`Found ${soloCarriersQuery.size} solo carriers to check`);

      const batch = db.batch();
      const notifications: any[] = [];
      let processedCount = 0;
      let notificationsSent = 0;

      for (const userDoc of soloCarriersQuery.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;

        // Check last activity
        const lastActive = userData.lastLoginAt || userData.updatedAt;
        if (lastActive && lastActive.toDate() > fortyEightHoursAgo.toDate()) {
          console.log(`Skipping ${userId} - active within 48 hours`);
          continue;
        }

        // Check if user has opted out of notifications
        if (userData.receiveNotifications === false) {
          console.log(`Skipping ${userId} - notifications disabled`);
          continue;
        }

        // Check documents
        const checkResult = await checkUserDocuments(userId, userData);

        if (checkResult.hasExpired) {
          // Update account status to expired
          batch.update(userDoc.ref, {
            accountStatus: 'documents_expired',
            accountStatusReason: `Documents expired: ${checkResult.expiredDocuments.map((d: DocumentExpiryInfo) => d.displayName).join(', ')}`,
            accountStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            documentStatus: checkResult.toFirestore(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Create critical notification
          if (userData.fcmToken) {
            notifications.push({
              token: userData.fcmToken,
              notification: {
                title: '⚠️ Belgelerinizin Süresi Doldu',
                body: `${checkResult.expiredDocuments.length} belgenizin süresi doldu. Hesabınız askıya alındı.`,
              },
              data: {
                type: 'documents_expired',
                userId: userId,
                expiredCount: checkResult.expiredDocuments.length.toString(),
                action: 'open_documents',
              },
              android: {
                priority: 'high' as const,
                notification: {
                  color: '#FF0000',
                  sound: 'default',
                },
              },
              apns: {
                payload: {
                  aps: {
                    sound: 'default',
                    badge: 1,
                  },
                },
              },
            });
          }

          // Create in-app notification
          const notificationRef = db.collection('notifications').doc();
          batch.set(notificationRef, {
            id: notificationRef.id,
            userId: userId,
            type: 'documents_expired',
            priority: 'critical',
            title: 'Belgelerinizin Süresi Doldu',
            message: `${checkResult.expiredDocuments.map((d: DocumentExpiryInfo) => d.displayName).join(', ')} belgelerinizin süresi doldu. Hesabınız askıya alındı.`,
            expiredDocuments: checkResult.expiredDocuments.map((d: DocumentExpiryInfo) => ({
              name: d.name,
              displayName: d.displayName,
              isVehicleDocument: d.isVehicleDocument,
            })),
            accountBlocked: true,
            actionRequired: true,
            actionType: 'upload_documents',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
          });

          notificationsSent++;

        } else if (checkResult.hasExpiringSoon) {
          // Check which reminders to send
          const notificationStatus = userData.documentStatus?.notifications || {};

          for (const doc of checkResult.expiringSoonDocuments) {
            const days = doc.daysUntilExpiry;
            let shouldSend = false;
            let timeFrame = '';
            let reminderKey = '';

            // Determine which reminder to send
            if (days <= 3 && !notificationStatus[`day3Sent_${doc.name}`]) {
              shouldSend = true;
              timeFrame = '3 gün';
              reminderKey = 'day3';
            } else if (days <= 7 && !notificationStatus[`day7Sent_${doc.name}`]) {
              shouldSend = true;
              timeFrame = '7 gün';
              reminderKey = 'day7';
            } else if (days <= 14 && !notificationStatus[`day14Sent_${doc.name}`]) {
              shouldSend = true;
              timeFrame = '14 gün';
              reminderKey = 'day14';
            } else if (days <= 30 && !notificationStatus[`day30Sent_${doc.name}`]) {
              shouldSend = true;
              timeFrame = '30 gün';
              reminderKey = 'day30';
            }

            if (shouldSend && userData.fcmToken) {
              // Send push notification
              notifications.push({
                token: userData.fcmToken,
                notification: {
                  title: '📋 Belge Süresi Doluyor',
                  body: `${doc.displayName} belgenizin süresi ${timeFrame} içinde dolacak.`,
                },
                data: {
                  type: 'document_expiring',
                  userId: userId,
                  documentName: doc.name,
                  daysRemaining: days.toString(),
                  action: 'open_documents',
                },
                android: {
                  priority: days <= 7 ? 'high' as const : 'normal' as const,
                  notification: {
                    color: days <= 7 ? '#FFA500' : '#FFD700',
                    sound: 'default',
                  },
                },
                apns: {
                  payload: {
                    aps: {
                      sound: 'default',
                    },
                  },
                },
              });

              // Create in-app notification
              const notificationRef = db.collection('notifications').doc();
              batch.set(notificationRef, {
                id: notificationRef.id,
                userId: userId,
                type: 'document_expiring',
                priority: days <= 7 ? 'high' : 'medium',
                title: 'Belge Süresi Doluyor',
                message: `${doc.displayName} belgenizin süresi ${timeFrame} içinde dolacak. Lütfen yenileyin.`,
                documentType: doc.name,
                expiryDate: admin.firestore.Timestamp.fromDate(doc.expiryDate),
                daysUntilExpiry: days,
                isVehicleDocument: doc.isVehicleDocument,
                actionRequired: true,
                actionType: 'upload_document',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
              });

              // Mark notification as sent
              batch.update(userDoc.ref, {
                [`documentStatus.notifications.${reminderKey}Sent_${doc.name}`]: true,
                [`documentStatus.notifications.${reminderKey}SentAt_${doc.name}`]: admin.firestore.FieldValue.serverTimestamp(),
              });

              notificationsSent++;
            }
          }

          // Update document status
          batch.update(userDoc.ref, {
            documentStatus: checkResult.toFirestore(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        processedCount++;
      }

      // Commit all updates
      await batch.commit();

      // Send push notifications in batches
      if (notifications.length > 0) {
        const chunks: any[][] = [];
        for (let i = 0; i < notifications.length; i += 500) {
          chunks.push(notifications.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          try {
            const response = await messaging.sendAll(chunk);
            console.log(`Sent ${response.successCount} notifications, ${response.failureCount} failed`);
          } catch (error) {
            console.error('Error sending notifications batch:', error);
          }
        }
      }

      console.log(`✅ Document check complete: ${processedCount} users processed, ${notificationsSent} notifications sent`);

    } catch (error) {
      console.error('❌ Error in document check:', error);
      throw error;
    }
  }
);

// Helper function to check user documents
async function checkUserDocuments(userId: string, userData: any) {
  const now = new Date();
  const expiredDocs: DocumentExpiryInfo[] = [];
  const expiringSoonDocs: DocumentExpiryInfo[] = [];
  let nearestExpiry: Date | null = null;

  // Helper to check a single document
  const checkDocument = (
    doc: DocumentInfo | null,
    fieldName: string,
    displayName: string,
    isVehicleDoc = false
  ) => {
    if (!doc || !doc.expiryDate) return;

    const expiryDate = doc.expiryDate.toDate();
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const docInfo: DocumentExpiryInfo = {
      name: fieldName,
      displayName,
      expiryDate,
      daysUntilExpiry,
      isExpired: daysUntilExpiry < 0,
      isVehicleDocument: isVehicleDoc,
    };

    if (daysUntilExpiry < 0) {
      expiredDocs.push(docInfo);
    } else if (daysUntilExpiry <= 30) {
      expiringSoonDocs.push(docInfo);
    }

    if (!nearestExpiry || expiryDate < nearestExpiry) {
      nearestExpiry = expiryDate;
    }
  };

  // Check user documents
  checkDocument(userData.criminalRecord, 'criminalRecord', 'Adli Sicil Kaydı');
  checkDocument(userData.licenseImage, 'licenseImage', 'Ehliyet');
  checkDocument(userData.k1Document, 'k1Document', 'K1 Belgesi');
  checkDocument(userData.srcDocument, 'srcDocument', 'SRC Belgesi');

  // Check vehicle documents if user has a vehicle
  if (userData.vehicleId) {
    const vehicleDoc = await db.collection('vehicles').doc(userData.vehicleId).get();

    if (vehicleDoc.exists) {
      const vehicleData = vehicleDoc.data()!;

      checkDocument(vehicleData.vehicleLicense, 'vehicleLicense', 'Araç Ruhsatı', true);
      checkDocument(vehicleData.insurancePolicy, 'insurancePolicy', 'Kasko/Trafik Sigortası', true);
      checkDocument(vehicleData.liabilityInsurancePolicy, 'liabilityInsurancePolicy', 'Sorumluluk Sigortası', true);
      checkDocument(vehicleData.tractorRegistration, 'tractorRegistration', 'Çekici Tescil', true);
      checkDocument(vehicleData.trailerRegistration, 'trailerRegistration', 'Dorse Tescil', true);
    }
  }

  return {
    hasExpired: expiredDocs.length > 0,
    hasExpiringSoon: expiringSoonDocs.length > 0,
    expiredDocuments: expiredDocs,
    expiringSoonDocuments: expiringSoonDocs,
    nearestExpiryDate: nearestExpiry,
    toFirestore: () => ({
      allValid: expiredDocs.length === 0,
      hasExpired: expiredDocs.length > 0,
      hasExpiringSoon: expiringSoonDocs.length > 0,
      expiredDocuments: expiredDocs.map(d => d.name),
      expiringDocuments: expiringSoonDocs.map(d => d.name),
      expiredDocumentDetails: expiredDocs.map(d => d.displayName),
      expiringDocumentDetails: expiringSoonDocs.map(d => d.displayName),
      nextExpiryDate: nearestExpiry ? admin.firestore.Timestamp.fromDate(nearestExpiry) : null,
      lastChecked: admin.firestore.Timestamp.now(),
    }),
  };
}
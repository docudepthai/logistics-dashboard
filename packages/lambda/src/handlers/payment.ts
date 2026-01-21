import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHmac } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

// PayTR credentials from environment
const PAYTR_MERCHANT_ID = process.env.PAYTR_MERCHANT_ID || '';
const PAYTR_MERCHANT_KEY = process.env.PAYTR_MERCHANT_KEY || '';
const PAYTR_MERCHANT_SALT = process.env.PAYTR_MERCHANT_SALT || '';

// Subscription price in kuruş (1000 TL = 100000 kuruş)
const SUBSCRIPTION_PRICE = process.env.SUBSCRIPTION_PRICE || '100000'; // 1000 TL
const SUBSCRIPTION_DAYS = 30; // 1 month

interface PayTRTokenResponse {
  status: 'success' | 'failed';
  token?: string;
  reason?: string;
}

interface PayTRWebhookPayload {
  merchant_oid: string;
  status: 'success' | 'failed';
  total_amount: string;
  hash: string;
  failed_reason_msg?: string;
}

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Generate a PayTR payment link for a user
 */
async function generatePaymentLink(phoneNumber: string, userIp: string): Promise<{
  success: boolean;
  paymentUrl?: string;
  error?: string;
}> {
  if (!PAYTR_MERCHANT_ID || !PAYTR_MERCHANT_KEY || !PAYTR_MERCHANT_SALT) {
    return { success: false, error: 'PayTR credentials not configured' };
  }

  // Generate unique order ID: phoneTimestamp (alphanumeric only for PayTR)
  const merchantOid = `${phoneNumber}${Date.now()}`;

  // User details (minimal for WhatsApp users)
  const email = `${phoneNumber}@whatsapp.logistics.local`;
  const userName = phoneNumber;
  const userPhone = phoneNumber.startsWith('90') ? phoneNumber : `90${phoneNumber}`;

  // Basket: 1 month subscription
  const basketItems = [['Lojistik Bot Premium Uyelik (1 Ay)', (parseInt(SUBSCRIPTION_PRICE) / 100).toFixed(2), 1]];
  const userBasket = Buffer.from(JSON.stringify(basketItems)).toString('base64');

  // Generate PayTR token (order: merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode)
  const noInstallment = '0';
  const maxInstallment = '0';
  const currency = 'TL';
  const testMode = '0'; // Production mode

  const hashStr = PAYTR_MERCHANT_ID + userIp + merchantOid + email +
                  SUBSCRIPTION_PRICE + userBasket + noInstallment + maxInstallment + currency + testMode;

  console.log('Hash components:', {
    merchant_id: PAYTR_MERCHANT_ID,
    user_ip: userIp,
    merchant_oid: merchantOid,
    email,
    payment_amount: SUBSCRIPTION_PRICE,
    user_basket: userBasket,
    no_installment: noInstallment,
    max_installment: maxInstallment,
    currency,
    test_mode: testMode,
    hashStr_length: hashStr.length,
  });

  const paytrToken = createHmac('sha256', PAYTR_MERCHANT_KEY)
    .update(hashStr + PAYTR_MERCHANT_SALT)
    .digest('base64');

  console.log('Generated token length:', paytrToken.length);

  // Webhook URL - this Lambda's /webhook endpoint
  const webhookUrl = process.env.PAYMENT_WEBHOOK_URL || 'https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/payment';

  try {
    const formData = new URLSearchParams({
      merchant_id: PAYTR_MERCHANT_ID,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email,
      payment_amount: SUBSCRIPTION_PRICE,
      paytr_token: paytrToken,
      user_basket: userBasket,
      debug_on: testMode, // Enable debug in test mode
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: userName,
      user_address: 'Turkey',
      user_phone: userPhone,
      merchant_ok_url: `${webhookUrl}?status=ok&phone=${phoneNumber}`,
      merchant_fail_url: `${webhookUrl}?status=fail&phone=${phoneNumber}`,
      merchant_notify_url: webhookUrl,
      timeout_limit: '30',
      currency: currency,
      test_mode: testMode,
      lang: 'tr',
    });

    console.log('PayTR request:', {
      merchant_id: PAYTR_MERCHANT_ID,
      merchant_oid: merchantOid,
      payment_amount: SUBSCRIPTION_PRICE,
      email,
      user_ip: userIp,
    });

    const res = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    console.log('PayTR response status:', res.status, res.statusText);
    const responseText = await res.text();
    console.log('PayTR raw response:', responseText || '(empty)');

    let data: PayTRTokenResponse;
    try {
      data = JSON.parse(responseText) as PayTRTokenResponse;
    } catch {
      console.error('Failed to parse PayTR response:', responseText);
      return { success: false, error: 'Invalid response from payment service' };
    }

    if (data.status === 'success' && data.token) {
      // Store pending payment in DynamoDB
      await docClient.send(new UpdateCommand({
        TableName: CONVERSATIONS_TABLE,
        Key: { pk: `PAYMENT#${merchantOid}`, sk: 'PENDING' },
        UpdateExpression: 'SET phoneNumber = :phone, amount = :amount, createdAt = :now, #s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':phone': phoneNumber,
          ':amount': parseInt(SUBSCRIPTION_PRICE) / 100,
          ':now': new Date().toISOString(),
          ':status': 'pending',
        },
      }));

      return {
        success: true,
        paymentUrl: `https://www.paytr.com/odeme/guvenli/${data.token}`,
      };
    } else {
      console.error('PayTR token error:', data.reason);
      return { success: false, error: data.reason || 'Token generation failed' };
    }
  } catch (error) {
    console.error('PayTR API error:', error);
    return { success: false, error: 'Payment service unavailable' };
  }
}

/**
 * Handle PayTR webhook callback
 */
async function handleWebhook(payload: PayTRWebhookPayload): Promise<boolean> {
  console.log('PayTR webhook received:', JSON.stringify(payload, null, 2));

  // Verify hash
  const hashStr = payload.merchant_oid + PAYTR_MERCHANT_SALT + payload.status + payload.total_amount;
  const calculatedHash = createHmac('sha256', PAYTR_MERCHANT_KEY)
    .update(hashStr)
    .digest('base64');

  console.log('Hash verification:', {
    received: payload.hash,
    calculated: calculatedHash,
    match: calculatedHash === payload.hash
  });

  if (calculatedHash !== payload.hash) {
    console.error('PayTR hash verification failed');
    return false;
  }

  // Look up phone number from payment record (more reliable than extracting from merchantOid)
  let phoneNumber: string | undefined;
  try {
    const paymentRecord = await docClient.send(new GetCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: { pk: `PAYMENT#${payload.merchant_oid}`, sk: 'PENDING' },
    }));
    phoneNumber = paymentRecord.Item?.phoneNumber as string;
    console.log('Found phone from payment record:', phoneNumber);
  } catch (err) {
    console.error('Error looking up payment record:', err);
  }

  // Fallback: extract from merchant_oid (phone numbers can be 10-12 digits)
  if (!phoneNumber) {
    // Try different phone number lengths (US: 11 digits, Turkish: 12 digits)
    const phoneMatch = payload.merchant_oid.match(/^(\d{10,12})/);
    if (phoneMatch && phoneMatch[1]) {
      // If starts with 90, it's Turkish (12 digits); otherwise check length
      const extracted = phoneMatch[1];
      if (extracted.startsWith('90') && extracted.length >= 12) {
        phoneNumber = extracted.substring(0, 12);
      } else if (extracted.startsWith('1') && extracted.length >= 11) {
        phoneNumber = extracted.substring(0, 11);
      } else {
        phoneNumber = extracted;
      }
    } else {
      phoneNumber = payload.merchant_oid.substring(0, 11);
    }
    console.log('Extracted phone from merchantOid:', phoneNumber);
  }

  if (payload.status === 'success') {
    // Calculate new expiration date (30 days from now)
    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + SUBSCRIPTION_DAYS);

    // Update user to premium
    await docClient.send(new UpdateCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: { pk: `USER#${phoneNumber}`, sk: 'PROFILE' },
      UpdateExpression: 'SET membershipStatus = :status, paidUntil = :paidUntil, paymentId = :paymentId, updatedAt = :now',
      ExpressionAttributeValues: {
        ':status': 'premium',
        ':paidUntil': paidUntil.toISOString(),
        ':paymentId': payload.merchant_oid,
        ':now': new Date().toISOString(),
      },
    }));

    // Update payment record
    await docClient.send(new UpdateCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: { pk: `PAYMENT#${payload.merchant_oid}`, sk: 'PENDING' },
      UpdateExpression: 'SET #s = :status, paidAt = :now, totalAmount = :amount',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':status': 'success',
        ':now': new Date().toISOString(),
        ':amount': parseInt(payload.total_amount) / 100,
      },
    }));

    console.log(`User ${phoneNumber} upgraded to premium until ${paidUntil.toISOString()}`);
    return true;
  } else {
    console.log(`Payment failed for ${phoneNumber}: ${payload.failed_reason_msg}`);

    // Update payment record as failed
    await docClient.send(new UpdateCommand({
      TableName: CONVERSATIONS_TABLE,
      Key: { pk: `PAYMENT#${payload.merchant_oid}`, sk: 'PENDING' },
      UpdateExpression: 'SET #s = :status, failedAt = :now, failReason = :reason',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':status': 'failed',
        ':now': new Date().toISOString(),
        ':reason': payload.failed_reason_msg || 'Unknown error',
      },
    }));

    return true;
  }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Payment handler:', event.httpMethod, event.path, event.queryStringParameters);
  if (event.httpMethod === 'POST') {
    console.log('POST body:', event.body?.substring(0, 500));
    console.log('POST headers:', JSON.stringify(event.headers, null, 2));
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  // GET /payment?status=ok - Payment success page (redirect from PayTR)
  if (event.httpMethod === 'GET' && event.queryStringParameters?.status === 'ok') {
    const phone = event.queryStringParameters.phone || '';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Odeme Basarili</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f0fff0;}</style></head>
<body>
<h1 style="color:green;">✅ Odeme Basarili!</h1>
<p>Tebrikler! Premium uyeliginiz aktif edildi.</p>
<p>Artik tum telefon numaralarini gorebilirsiniz.</p>
<p style="margin-top:30px;color:#666;">WhatsApp'a donup yuk aramaya devam edebilirsiniz.</p>
</body></html>`,
    };
  }

  // GET /payment?status=fail - Payment failed page (redirect from PayTR)
  if (event.httpMethod === 'GET' && event.queryStringParameters?.status === 'fail') {
    const phone = event.queryStringParameters.phone || '';
    const retryUrl = `https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/payment?phone=${phone}`;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Odeme Basarisiz</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:sans-serif;text-align:center;padding:50px;background:#fff0f0;}</style></head>
<body>
<h1 style="color:red;">❌ Odeme Basarisiz</h1>
<p>Odeme islemi tamamlanamadi.</p>
<p>Lutfen tekrar deneyin veya farkli bir kart kullanin.</p>
<p style="margin-top:30px;"><a href="${retryUrl}" style="background:#007bff;color:white;padding:15px 30px;text-decoration:none;border-radius:5px;">Tekrar Dene</a></p>
</body></html>`,
    };
  }

  // GET /payment?phone=905321234567 - Generate payment link and redirect to PayTR
  if (event.httpMethod === 'GET' && event.queryStringParameters?.phone) {
    const phoneNumber = event.queryStringParameters.phone;
    const userIp = event.requestContext.identity?.sourceIp || '127.0.0.1';

    const result = await generatePaymentLink(phoneNumber, userIp);

    if (result.success && result.paymentUrl) {
      // Redirect directly to PayTR payment page (better UX for WhatsApp users)
      return {
        statusCode: 302,
        headers: {
          'Location': result.paymentUrl,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        body: '',
      };
    } else {
      // Show error page
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: `<!DOCTYPE html>
<html><head><title>Odeme Hatasi</title></head>
<body style="font-family: sans-serif; text-align: center; padding: 50px;">
<h1>Odeme Baslatilamadi</h1>
<p>Hata: ${result.error || 'Bilinmeyen hata'}</p>
<p>Lutfen tekrar deneyin veya destek ile iletisime gecin.</p>
</body></html>`,
      };
    }
  }

  // POST /payment - PayTR webhook callback
  if (event.httpMethod === 'POST') {
    try {
      // PayTR sends form-urlencoded data
      const body = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf-8')
        : event.body || '';

      const params = new URLSearchParams(body);
      const payload: PayTRWebhookPayload = {
        merchant_oid: params.get('merchant_oid') || '',
        status: (params.get('status') || 'failed') as 'success' | 'failed',
        total_amount: params.get('total_amount') || '0',
        hash: params.get('hash') || '',
        failed_reason_msg: params.get('failed_reason_msg') || undefined,
      };

      const success = await handleWebhook(payload);

      // PayTR expects plain text "OK" response
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: 'OK',
      };
    } catch (error) {
      console.error('Webhook error:', error);
      // Still return OK to prevent retries
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: 'OK',
      };
    }
  }

  return response(405, { error: 'Method not allowed' });
}

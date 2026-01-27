import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { createHmac } from 'crypto';

const CHECKOUT_TOKEN_SECRET = process.env.CHECKOUT_TOKEN_SECRET || '';
const TABLE_NAME = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

// PayTR credentials
const PAYTR_MERCHANT_ID = process.env.PAYTR_MERCHANT_ID || '';
const PAYTR_MERCHANT_KEY = process.env.PAYTR_MERCHANT_KEY || '';
const PAYTR_MERCHANT_SALT = process.env.PAYTR_MERCHANT_SALT || '';
const PAYMENT_WEBHOOK_URL = process.env.PAYMENT_WEBHOOK_URL || 'https://pay.patron.ankago.com/payment';
const CHECKOUT_BASE_URL = process.env.CHECKOUT_BASE_URL || 'https://pay.patron.ankago.com';

// Pricing (in kuruş)
const SUBSCRIPTION_PRICE = 120000; // 1200 TL = 120000 kuruş (including VAT)

// Initialize DynamoDB client with explicit credentials for Amplify
const dynamoClient = new DynamoDBClient({
  region: process.env.MY_AWS_REGION || process.env.AWS_REGION || 'eu-central-1',
  ...(process.env.MY_AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
    },
  }),
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface CheckoutTokenPayload {
  phone: string;
  exp: number;
  iat: number;
  nonce: string;
}

interface CompanyData {
  companyName: string;
  vkn: string;
  taxOffice: string;
  address: string;
  city: string;
  district: string;
  email: string;
  phone: string;
}

function verifyToken(token: string): { valid: boolean; payload?: CheckoutTokenPayload; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'TOKEN_INVALID' };
    }

    const [payloadBase64, signature] = parts;

    const expectedSignature = createHmac('sha256', CHECKOUT_TOKEN_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'TOKEN_INVALID' };
    }

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString()) as CheckoutTokenPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'TOKEN_EXPIRED' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'TOKEN_INVALID' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token, wantsInvoice, companyData } = await request.json() as {
      token: string;
      wantsInvoice: boolean;
      companyData?: CompanyData;
    };

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token required' }, { status: 400 });
    }

    // Verify token
    const verification = verifyToken(token);
    if (!verification.valid || !verification.payload) {
      return NextResponse.json({ success: false, error: verification.error }, { status: 401 });
    }

    const { phone: phoneNumber } = verification.payload;

    // Verify token exists in DynamoDB
    const storedToken = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: `CHECKOUT_TOKEN#${phoneNumber}`, sk: 'ACTIVE' },
    }));

    if (!storedToken.Item || storedToken.Item.token !== token) {
      return NextResponse.json({ success: false, error: 'TOKEN_NOT_FOUND' }, { status: 401 });
    }

    // Generate unique merchant order ID
    const merchantOid = `${phoneNumber}${Date.now()}`;

    // Get user IP from headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const userIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

    // User details
    const email = `${phoneNumber}@whatsapp.logistics.local`;
    const userName = phoneNumber;
    const userPhone = phoneNumber.startsWith('90') ? phoneNumber : `90${phoneNumber}`;

    // Basket items
    const basketItems = [['Patron Premium Uyelik (1 Ay)', (SUBSCRIPTION_PRICE / 100).toFixed(2), 1]];
    const userBasket = Buffer.from(JSON.stringify(basketItems)).toString('base64');

    // Generate PayTR token
    const noInstallment = '0';
    const maxInstallment = '0';
    const currency = 'TL';
    const testMode = '0';

    const hashStr = PAYTR_MERCHANT_ID + userIp + merchantOid + email +
                    SUBSCRIPTION_PRICE.toString() + userBasket + noInstallment + maxInstallment + currency + testMode;

    const paytrToken = createHmac('sha256', PAYTR_MERCHANT_KEY)
      .update(hashStr + PAYTR_MERCHANT_SALT)
      .digest('base64');

    // Request PayTR token
    const formData = new URLSearchParams({
      merchant_id: PAYTR_MERCHANT_ID,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email,
      payment_amount: SUBSCRIPTION_PRICE.toString(),
      paytr_token: paytrToken,
      user_basket: userBasket,
      debug_on: testMode,
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: userName,
      user_address: 'Turkey',
      user_phone: userPhone,
      merchant_ok_url: `${CHECKOUT_BASE_URL}/success?phone=${phoneNumber}`,
      merchant_fail_url: `${CHECKOUT_BASE_URL}/failed?phone=${phoneNumber}`,
      merchant_notify_url: PAYMENT_WEBHOOK_URL,
      timeout_limit: '30',
      currency: currency,
      test_mode: testMode,
      lang: 'tr',
    });

    const paytrRes = await fetch('https://www.paytr.com/odeme/api/get-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const paytrData = await paytrRes.json() as { status: string; token?: string; reason?: string };

    if (paytrData.status !== 'success' || !paytrData.token) {
      console.error('PayTR token error:', paytrData.reason);
      return NextResponse.json({
        success: false,
        error: paytrData.reason || 'Odeme servisi hatasi',
      }, { status: 500 });
    }

    // Store pending payment record
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `PAYMENT#${merchantOid}`,
        sk: 'PENDING',
        phoneNumber,
        amount: SUBSCRIPTION_PRICE / 100,
        createdAt: new Date().toISOString(),
        status: 'pending',
      },
    }));

    // Store invoice data if provided
    if (wantsInvoice && companyData) {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `PAYMENT#${merchantOid}`,
          sk: 'INVOICE_DATA',
          invoiceType: 'company',
          companyData: {
            companyName: companyData.companyName,
            vkn: companyData.vkn,
            taxOffice: companyData.taxOffice,
            address: companyData.address,
            city: companyData.city,
            district: companyData.district,
            email: companyData.email,
            phone: companyData.phone || '',
          },
          createdAt: new Date().toISOString(),
        },
      }));
    }

    // Invalidate checkout token (one-time use)
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: `CHECKOUT_TOKEN#${phoneNumber}`, sk: 'ACTIVE' },
    }));

    return NextResponse.json({
      success: true,
      paymentUrl: `https://www.paytr.com/odeme/guvenli/${paytrData.token}`,
      merchantOid,
    });
  } catch (err) {
    console.error('Payment initiation error:', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

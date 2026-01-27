import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createHmac } from 'crypto';

const CHECKOUT_TOKEN_SECRET = process.env.CHECKOUT_TOKEN_SECRET || '';
const TABLE_NAME = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

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

function verifyToken(token: string): { valid: boolean; payload?: CheckoutTokenPayload; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'TOKEN_INVALID' };
    }

    const [payloadBase64, signature] = parts;

    // Verify signature
    const expectedSignature = createHmac('sha256', CHECKOUT_TOKEN_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'TOKEN_INVALID' };
    }

    // Decode and parse payload
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString()) as CheckoutTokenPayload;

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'TOKEN_EXPIRED' };
    }

    return { valid: true, payload };
  } catch (err) {
    console.error('Token verification error:', err);
    return { valid: false, error: 'TOKEN_INVALID' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ valid: false, error: 'TOKEN_INVALID' }, { status: 400 });
    }

    // Verify token signature and expiration
    const verification = verifyToken(token);
    if (!verification.valid || !verification.payload) {
      return NextResponse.json({ valid: false, error: verification.error }, { status: 401 });
    }

    const { phone } = verification.payload;

    // Check if token exists in DynamoDB (one-time use check)
    const storedToken = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: `CHECKOUT_TOKEN#${phone}`, sk: 'ACTIVE' },
    }));

    if (!storedToken.Item) {
      return NextResponse.json({ valid: false, error: 'TOKEN_NOT_FOUND' }, { status: 401 });
    }

    // Verify token matches stored one
    if (storedToken.Item.token !== token) {
      return NextResponse.json({ valid: false, error: 'TOKEN_INVALID' }, { status: 401 });
    }

    // Get user profile to check current status
    const userProfile = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: `USER#${phone}`, sk: 'PROFILE' },
    }));

    // Check if already premium
    const membershipStatus = userProfile.Item?.membershipStatus || 'expired';
    if (membershipStatus === 'premium') {
      const paidUntil = userProfile.Item?.paidUntil;
      if (paidUntil && new Date(paidUntil) > new Date()) {
        return NextResponse.json({
          valid: false,
          error: 'ALREADY_PREMIUM',
          paidUntil,
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      valid: true,
      phoneNumber: phone,
      membershipStatus,
    });
  } catch (err) {
    console.error('Token validation error:', err);
    return NextResponse.json({ valid: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

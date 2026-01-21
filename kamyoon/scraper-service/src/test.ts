/**
 * Test script - fetches from Kamyoon without sending to webhook
 */

import { config } from 'dotenv';
import { KamyoonClient } from './kamyoon-client.js';
import { transformToWebhookPayload } from './transformer.js';

// Load environment variables
config();

const KAMYOON_TOKEN = process.env.KAMYOON_TOKEN || '';

async function main() {
  console.log('=== Kamyoon API Test ===\n');

  if (!KAMYOON_TOKEN) {
    console.error('KAMYOON_TOKEN is required. Set it in .env file.');
    process.exit(1);
  }

  const client = new KamyoonClient(KAMYOON_TOKEN);

  try {
    console.log('Fetching 5 offers...\n');
    const offers = await client.getLoadOffers(5);

    console.log(`Received ${offers.length} offers:\n`);

    offers.forEach((offer, i) => {
      console.log(`--- Offer ${i + 1} ---`);
      console.log(`ID: ${offer.id}`);
      console.log(`Phone: ${offer.phoneNumber}`);
      console.log(`Time: ${offer.messageSentTime}`);
      console.log(`Message:\n${offer.message.slice(0, 200)}...`);
      console.log('');
    });

    if (offers.length > 0) {
      console.log('\n=== Transformed Format ===\n');
      const transformed = transformToWebhookPayload(offers[0], 'test-instance');
      console.log(JSON.stringify(transformed, null, 2));
    }

    console.log('\n=== Client Stats ===');
    console.log(client.getStats());

  } catch (error) {
    console.error('Test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

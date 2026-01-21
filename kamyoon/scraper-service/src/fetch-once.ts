/**
 * One-time fetch script for testing
 * Fetches from Kamyoon and sends to webhook without starting cron
 */

import { config } from 'dotenv';
import { KamyoonClient } from './kamyoon-client.js';
import { WebhookSender } from './webhook-sender.js';
import { transformOffers } from './transformer.js';

// Load environment variables
config();

const KAMYOON_TOKEN = process.env.KAMYOON_TOKEN || '';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/webhook';
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY || '';
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'kamyoon-scraper';

async function main() {
  console.log('=== Kamyoon One-Time Fetch ===\n');

  if (!KAMYOON_TOKEN) {
    console.error('KAMYOON_TOKEN is required');
    process.exit(1);
  }

  if (!WEBHOOK_API_KEY) {
    console.error('WEBHOOK_API_KEY is required');
    process.exit(1);
  }

  const kamyoonClient = new KamyoonClient(KAMYOON_TOKEN);
  const webhookSender = new WebhookSender({
    webhookUrl: WEBHOOK_URL,
    apiKey: WEBHOOK_API_KEY,
  });

  try {
    // Fetch a small batch for testing
    const size = parseInt(process.argv[2] || '5', 10);
    console.log(`Fetching ${size} offers from Kamyoon...`);

    const offers = await kamyoonClient.getLoadOffers(size);
    console.log(`Received ${offers.length} offers\n`);

    if (offers.length === 0) {
      console.log('No offers received.');
      return;
    }

    // Show sample data
    console.log('Sample offer:');
    console.log(JSON.stringify(offers[0], null, 2));
    console.log('');

    // Transform to webhook format
    const payloads = transformOffers(offers, INSTANCE_NAME);

    console.log('Transformed payload sample:');
    console.log(JSON.stringify(payloads[0], null, 2));
    console.log('');

    // Ask for confirmation
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(`Send ${payloads.length} messages to webhook? (y/n): `, resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('Aborted.');
      return;
    }

    // Send to webhook
    console.log('\nSending to webhook...');
    const result = await webhookSender.sendBatch(payloads, 100);

    console.log('\n=== Results ===');
    console.log(`Sent: ${result.sent}`);
    console.log(`Failed: ${result.failed}`);

    if (result.failed > 0) {
      console.log('\nFailed messages:');
      result.results
        .filter((r) => !r.success)
        .forEach((r) => console.log(`  - ${r.messageId}: ${r.error}`));
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

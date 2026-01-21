/**
 * Kamyoon Scraper Service
 * Fetches logistics data from Kamyoon API every 15 minutes
 * and sends it to AWS Lambda webhook for processing
 */

import { CronJob } from 'cron';
import { config } from 'dotenv';
import { KamyoonClient } from './kamyoon-client.js';
import { WebhookSender } from './webhook-sender.js';
import { transformOffers } from './transformer.js';
import { DedupStore } from './dedup-store.js';

// Load environment variables
config();

// Configuration
const KAMYOON_TOKEN = process.env.KAMYOON_TOKEN || '';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/webhook';
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY || '';
const FETCH_SIZE = parseInt(process.env.FETCH_SIZE || '50', 10);
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/15 * * * *'; // Every 15 minutes
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'kamyoon-scraper';
const TIMEZONE = process.env.TIMEZONE || 'Europe/Istanbul';

// Validate required configuration
function validateConfig(): boolean {
  const errors: string[] = [];

  if (!KAMYOON_TOKEN) {
    errors.push('KAMYOON_TOKEN is required');
  }

  if (!WEBHOOK_API_KEY) {
    errors.push('WEBHOOK_API_KEY is required');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach((e) => console.error(`  - ${e}`));
    return false;
  }

  return true;
}

// Initialize services
const kamyoonClient = new KamyoonClient(KAMYOON_TOKEN);
const webhookSender = new WebhookSender({
  webhookUrl: WEBHOOK_URL,
  apiKey: WEBHOOK_API_KEY,
});
const dedupStore = new DedupStore(10000);

// Statistics
let runCount = 0;
let totalOffersProcessed = 0;
let lastRunTime: Date | null = null;

/**
 * Main scraping function
 */
async function scrapeAndSend(): Promise<void> {
  runCount++;
  lastRunTime = new Date();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${lastRunTime.toISOString()}] Starting scrape run #${runCount}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // 1. Fetch offers from Kamyoon
    const offers = await kamyoonClient.getLoadOffers(FETCH_SIZE);

    if (offers.length === 0) {
      console.log('[Scraper] No offers received from Kamyoon');
      return;
    }

    // 2. Filter out already processed offers
    const newOffers = dedupStore.filterNew(offers);

    if (newOffers.length === 0) {
      console.log(`[Scraper] All ${offers.length} offers already processed, skipping`);
      return;
    }

    console.log(`[Scraper] Found ${newOffers.length} new offers (${offers.length - newOffers.length} duplicates filtered)`);

    // 3. Transform to webhook format
    const payloads = transformOffers(newOffers, INSTANCE_NAME);

    // 4. Send to webhook
    const result = await webhookSender.sendBatch(payloads, 50);

    // 5. Mark successfully sent offers as processed
    const sentOfferIds = result.results
      .filter((r) => r.success)
      .map((r) => {
        const idMatch = r.messageId.match(/kamyoon-(\d+)-/);
        return idMatch ? parseInt(idMatch[1], 10) : 0;
      })
      .filter((id) => id > 0);

    dedupStore.addMany(sentOfferIds);
    totalOffersProcessed += sentOfferIds.length;

    // 6. Log summary
    console.log(`\n[Summary] Run #${runCount}`);
    console.log(`  - Offers fetched: ${offers.length}`);
    console.log(`  - New offers: ${newOffers.length}`);
    console.log(`  - Sent successfully: ${result.sent}`);
    console.log(`  - Failed: ${result.failed}`);
    console.log(`  - Total processed: ${totalOffersProcessed}`);

  } catch (error) {
    console.error('[Scraper] Run failed:', error instanceof Error ? error.message : error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'KAMYOON_TOKEN_EXPIRED') {
        console.error('[CRITICAL] Kamyoon token has expired! Update KAMYOON_TOKEN environment variable.');
        // Optionally: send alert notification
      } else if (error.message === 'KAMYOON_RATE_LIMITED') {
        console.error('[WARNING] Rate limited by Kamyoon. Consider increasing CRON_SCHEDULE interval.');
      }
    }
  }
}

/**
 * Log service status
 */
function logStatus(): void {
  console.log('\n--- Service Status ---');
  console.log(`  Runs completed: ${runCount}`);
  console.log(`  Total offers processed: ${totalOffersProcessed}`);
  console.log(`  Last run: ${lastRunTime?.toISOString() || 'Never'}`);
  console.log(`  Kamyoon stats: ${JSON.stringify(kamyoonClient.getStats())}`);
  console.log(`  Webhook stats: ${JSON.stringify(webhookSender.getStats())}`);
  console.log(`  Dedup stats: ${JSON.stringify(dedupStore.getStats())}`);
  console.log('----------------------\n');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('  Kamyoon Scraper Service');
  console.log('='.repeat(60));
  console.log('');

  // Validate configuration
  if (!validateConfig()) {
    console.error('Exiting due to configuration errors.');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  - Webhook URL: ${WEBHOOK_URL}`);
  console.log(`  - Fetch size: ${FETCH_SIZE}`);
  console.log(`  - Cron schedule: ${CRON_SCHEDULE}`);
  console.log(`  - Instance name: ${INSTANCE_NAME}`);
  console.log(`  - Timezone: ${TIMEZONE}`);
  console.log('');

  // Run immediately on startup
  console.log('Running initial scrape...');
  await scrapeAndSend();
  logStatus();

  // Set up cron job
  const job = new CronJob(
    CRON_SCHEDULE,
    async () => {
      await scrapeAndSend();
      logStatus();
    },
    null, // onComplete
    true, // start
    TIMEZONE // timezone
  );

  console.log(`\nCron job scheduled: ${CRON_SCHEDULE} (${TIMEZONE})`);
  console.log('Next run:', job.nextDate().toISO());
  console.log('\nService is running. Press Ctrl+C to stop.\n');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Shutting down...');
    job.stop();
    logStatus();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM. Shutting down...');
    job.stop();
    logStatus();
    process.exit(0);
  });
}

// Start the service
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

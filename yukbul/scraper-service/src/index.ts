/**
 * YukBul Scraper Service
 * Fetches logistics data from YukBul API every 15 minutes
 * and sends it to AWS Lambda webhook for processing
 */

import { CronJob } from 'cron';
import { config } from 'dotenv';
import { YukbulClient } from './yukbul-client.js';
import { WebhookSender } from './webhook-sender.js';
import { transformListings } from './transformer.js';
import { DedupStore } from './dedup-store.js';

// Load environment variables
config();

// Configuration
const YUKBUL_API_KEY = process.env.YUKBUL_API_KEY || '';
const YUKBUL_AUTH_TOKEN = process.env.YUKBUL_AUTH_TOKEN || '';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/webhook';
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY || '';
const FETCH_SIZE = parseInt(process.env.FETCH_SIZE || '100', 10);
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/15 * * * *'; // Every 15 minutes
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'yukbul-scraper';
const TIMEZONE = process.env.TIMEZONE || 'Europe/Istanbul';

// Validate required configuration
function validateConfig(): boolean {
  const errors: string[] = [];

  if (!YUKBUL_API_KEY) {
    errors.push('YUKBUL_API_KEY is required');
  }

  if (!YUKBUL_AUTH_TOKEN) {
    errors.push('YUKBUL_AUTH_TOKEN is required');
  }

  // WEBHOOK_API_KEY is optional - webhook may not require it

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach((e) => console.error(`  - ${e}`));
    return false;
  }

  return true;
}

// Initialize services
const yukbulClient = new YukbulClient(YUKBUL_API_KEY, YUKBUL_AUTH_TOKEN);
const webhookSender = new WebhookSender({
  webhookUrl: WEBHOOK_URL,
  apiKey: WEBHOOK_API_KEY,
});
const dedupStore = new DedupStore(10000);

// Statistics
let runCount = 0;
let totalListingsProcessed = 0;
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
    // 1. Fetch listings from YukBul
    const listings = await yukbulClient.getListings(FETCH_SIZE);

    if (listings.length === 0) {
      console.log('[Scraper] No listings received from YukBul');
      return;
    }

    // 2. Filter out already processed listings
    const newListings = dedupStore.filterNew(listings);

    if (newListings.length === 0) {
      console.log(`[Scraper] All ${listings.length} listings already processed, skipping`);
      return;
    }

    console.log(`[Scraper] Found ${newListings.length} new listings (${listings.length - newListings.length} duplicates filtered)`);

    // 3. Transform to webhook format
    const payloads = transformListings(newListings, INSTANCE_NAME);

    // 4. Send to webhook
    const result = await webhookSender.sendBatch(payloads, 50);

    // 5. Mark successfully sent listings as processed
    const sentListingIds = result.results
      .filter((r) => r.success)
      .map((r) => {
        const idMatch = r.messageId.match(/yukbul-(\d+)-/);
        return idMatch ? parseInt(idMatch[1], 10) : 0;
      })
      .filter((id) => id > 0);

    dedupStore.addMany(sentListingIds);
    totalListingsProcessed += sentListingIds.length;

    // 6. Log summary
    console.log(`\n[Summary] Run #${runCount}`);
    console.log(`  - Listings fetched: ${listings.length}`);
    console.log(`  - New listings: ${newListings.length}`);
    console.log(`  - Sent successfully: ${result.sent}`);
    console.log(`  - Failed: ${result.failed}`);
    console.log(`  - Total processed: ${totalListingsProcessed}`);

  } catch (error) {
    console.error('[Scraper] Run failed:', error instanceof Error ? error.message : error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'YUKBUL_TOKEN_EXPIRED') {
        console.error('[CRITICAL] YukBul token has expired! Update YUKBUL_AUTH_TOKEN environment variable.');
      } else if (error.message === 'YUKBUL_RATE_LIMITED') {
        console.error('[WARNING] Rate limited by YukBul. Consider increasing CRON_SCHEDULE interval.');
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
  console.log(`  Total listings processed: ${totalListingsProcessed}`);
  console.log(`  Last run: ${lastRunTime?.toISOString() || 'Never'}`);
  console.log(`  YukBul stats: ${JSON.stringify(yukbulClient.getStats())}`);
  console.log(`  Webhook stats: ${JSON.stringify(webhookSender.getStats())}`);
  console.log(`  Dedup stats: ${JSON.stringify(dedupStore.getStats())}`);
  console.log('----------------------\n');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('  YukBul Scraper Service');
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

# Kamyoon Scraper Service

A background service that fetches logistics load offers from Kamyoon's API and sends them to AWS Lambda for processing. Designed to run on Railway.

## Architecture

```
┌─────────────────────┐      ┌──────────────────────────────────────────┐
│                     │      │                                          │
│   Kamyoon API       │─────▶│   Kamyoon Scraper (Railway)              │
│                     │      │                                          │
│   Load Offers       │      │   1. Fetch every 15 min                  │
│                     │      │   2. Transform to Evolution API format    │
└─────────────────────┘      │   3. Deduplicate                         │
                             │   4. Send to webhook                     │
                             │                                          │
                             └────────────────┬─────────────────────────┘
                                              │
                                              │ POST /webhook
                                              │ x-api-key: ***
                                              ▼
                             ┌──────────────────────────────────────────┐
                             │                                          │
                             │   AWS API Gateway                        │
                             │   → Lambda (webhook)                     │
                             │   → SQS                                  │
                             │   → Lambda (processor)                   │
                             │   → PostgreSQL                           │
                             │                                          │
                             └──────────────────────────────────────────┘
```

## Features

- Fetches load offers from Kamyoon API every 15 minutes
- Transforms data to Evolution API webhook format for compatibility
- Deduplication to avoid sending the same offer twice
- Graceful error handling (token expiry, rate limiting)
- Configurable via environment variables

## Prerequisites

- Node.js 20+
- pnpm (or npm)
- Railway account (for deployment)
- Kamyoon API token (from iOS app)

## Local Development

### 1. Install dependencies

```bash
cd kamyoon/scraper-service
pnpm install
```

### 2. Configure environment

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
KAMYOON_TOKEN=your_jwt_token_here
WEBHOOK_API_KEY=turkish-logistics-secret-2024
```

### 3. Test the API connection

```bash
pnpm test
```

This fetches 5 offers without sending to webhook.

### 4. Run one-time fetch (with webhook)

```bash
pnpm fetch-once 10
```

This fetches 10 offers and asks for confirmation before sending.

### 5. Start the service

```bash
pnpm dev
```

This starts the cron job that runs every 15 minutes.

## Railway Deployment

### Step 1: Create Railway Project

1. Go to [Railway](https://railway.app/)
2. Click "New Project"
3. Select "Deploy from GitHub repo" or "Empty project"

### Step 2: Deploy via GitHub (Recommended)

1. Push this directory to a GitHub repo
2. In Railway, select your repo
3. Railway will auto-detect the Dockerfile

### Step 3: Deploy via CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up
```

### Step 4: Configure Environment Variables

In Railway dashboard, go to your project → Variables tab:

| Variable | Required | Description |
|----------|----------|-------------|
| `KAMYOON_TOKEN` | Yes | JWT token from Kamyoon iOS app |
| `WEBHOOK_API_KEY` | Yes | API key for AWS Lambda webhook |
| `WEBHOOK_URL` | No | Webhook URL (defaults to production) |
| `FETCH_SIZE` | No | Offers per fetch (default: 50) |
| `CRON_SCHEDULE` | No | Cron expression (default: `*/15 * * * *`) |
| `INSTANCE_NAME` | No | Service identifier (default: `kamyoon-scraper`) |
| `TIMEZONE` | No | Timezone for cron (default: `Europe/Istanbul`) |

### Step 5: Verify Deployment

Check Railway logs for output like:

```
============================================================
  Kamyoon Scraper Service
============================================================

Configuration:
  - Webhook URL: https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/webhook
  - Fetch size: 50
  - Cron schedule: */15 * * * *
  - Instance name: kamyoon-scraper
  - Timezone: Europe/Istanbul

Running initial scrape...
[2026-01-15T12:00:00.000Z] Kamyoon request #1: fetching 50 offers...
[2026-01-15T12:00:01.234Z] Received 50 offers from Kamyoon
[Scraper] Found 50 new offers (0 duplicates filtered)
[Webhook] Sending batch of 50 messages...
[Webhook] Batch complete: 50 sent, 0 failed

Cron job scheduled: */15 * * * * (Europe/Istanbul)
Next run: 2026-01-15T12:15:00.000+03:00

Service is running. Press Ctrl+C to stop.
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KAMYOON_TOKEN` | (required) | JWT Bearer token from Kamyoon API |
| `WEBHOOK_API_KEY` | (required) | API key for AWS webhook authentication |
| `WEBHOOK_URL` | `https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/webhook` | AWS Lambda webhook URL |
| `FETCH_SIZE` | `50` | Number of offers to fetch (1-500) |
| `CRON_SCHEDULE` | `*/15 * * * *` | Cron schedule (every 15 min) |
| `INSTANCE_NAME` | `kamyoon-scraper` | Instance name in logs |
| `TIMEZONE` | `Europe/Istanbul` | Timezone for cron job |

## Cron Schedule Examples

| Schedule | Expression |
|----------|-----------|
| Every 15 minutes | `*/15 * * * *` |
| Every 30 minutes | `*/30 * * * *` |
| Every hour | `0 * * * *` |
| Every 2 hours | `0 */2 * * *` |
| Business hours only (8am-8pm) | `*/15 8-20 * * *` |

## How It Works

### 1. Fetching

The service calls Kamyoon's API endpoint:
```
GET https://api.kamyoon.com.tr/api/WhatsAppSelenium/GetWhatsAppLoadOffers?Size=50
```

With specific headers that mimic the iOS app (see `kamyoon-client.ts`).

### 2. Transformation

Each Kamyoon offer is transformed to Evolution API webhook format:

**Kamyoon format:**
```json
{
  "id": 2226256,
  "message": "*📍BURSA GEMLİK YÜKLEMELİ*\n*✅KÜTAHYA MERKEZ*...",
  "phoneNumber": "05529478883",
  "messageSentTime": "2026-01-15T03:57:37"
}
```

**Evolution API format:**
```json
{
  "event": "messages.upsert",
  "instance": "kamyoon-scraper",
  "data": {
    "key": {
      "id": "kamyoon-2226256-abc12345",
      "remoteJid": "kamyoon-loads@g.us",
      "fromMe": false,
      "participant": "905529478883@s.whatsapp.net"
    },
    "pushName": "Kamyoon-05529478883",
    "message": {
      "conversation": "*📍BURSA GEMLİK YÜKLEMELİ*..."
    },
    "messageType": "conversation",
    "messageTimestamp": 1736912257
  }
}
```

### 3. Deduplication

Offer IDs are tracked in memory to avoid sending duplicates. The store auto-purges when it reaches 10,000 entries.

### 4. Webhook Delivery

Messages are sent sequentially with 50ms delay to avoid overwhelming Lambda:
```
POST /webhook
Content-Type: application/json
x-api-key: turkish-logistics-secret-2024
```

## Error Handling

| Error | Behavior |
|-------|----------|
| Token expired (401) | Logs critical error, continues running |
| Rate limited (429) | Logs warning, retries on next cron |
| Network error | Logs error, retries on next cron |
| Webhook failure | Logs per-message failure, continues batch |

## Monitoring

### Railway Logs

```bash
railway logs
```

### Key Metrics in Logs

- `Kamyoon request #N`: Request counter
- `Found N new offers`: New offers after dedup
- `Batch complete: N sent, M failed`: Webhook results
- `Total processed: N`: Running total

## Troubleshooting

### Token Expired

```
[CRITICAL] Kamyoon token has expired! Update KAMYOON_TOKEN environment variable.
```

**Solution:** Get a new token from Kamyoon iOS app using Proxyman.

### Rate Limited

```
[WARNING] Rate limited by Kamyoon. Consider increasing CRON_SCHEDULE interval.
```

**Solution:** Change `CRON_SCHEDULE` to `*/30 * * * *` (every 30 minutes).

### Webhook Auth Failed

```
[Webhook] Failed to send kamyoon-XXX: HTTP 401 - Unauthorized
```

**Solution:** Verify `WEBHOOK_API_KEY` matches the AWS Lambda configuration.

### No New Offers

```
[Scraper] All 50 offers already processed, skipping
```

This is normal - no new offers since last fetch.

## Files

```
kamyoon/scraper-service/
├── src/
│   ├── index.ts         # Main entry with cron scheduler
│   ├── kamyoon-client.ts # Kamyoon API client
│   ├── webhook-sender.ts # AWS webhook sender
│   ├── transformer.ts    # Data transformation
│   ├── dedup-store.ts    # Deduplication store
│   ├── types.ts          # TypeScript types
│   ├── test.ts           # Test script (no webhook)
│   └── fetch-once.ts     # One-time fetch script
├── Dockerfile            # Railway deployment
├── railway.toml          # Railway config
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## License

Internal use only.

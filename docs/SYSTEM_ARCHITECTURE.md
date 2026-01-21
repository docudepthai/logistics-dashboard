# Turkish Logistics WhatsApp Bot - System Architecture

## Overview

This system aggregates logistics job postings from WhatsApp groups, parses Turkish logistics messages, extracts structured data, and stores it in a database for querying.

## System Flow

```
WhatsApp Groups
      │
      │ messages
      ▼
┌─────────────────────────────────────────────────────────────┐
│                    WhatsApp Business API                     │
│              (Evolution API / Official WA API)               │
└─────────────────────┬───────────────────────────────────────┘
                      │ webhook POST
                      │ Header: x-api-key: <secret>
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     AWS API Gateway                          │
│         https://t50lrx3amk.execute-api.eu-central-1.         │
│                amazonaws.com/prod/webhook                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Lambda: Webhook Handler                    │
│                 turkish-logistics-webhook                    │
│                                                              │
│  1. Validates API key (x-api-key header)                    │
│  2. Filters: only group messages, skip own messages          │
│  3. Stores raw JSON in S3                                    │
│  4. Queues message to SQS FIFO                               │
└──────────┬────────────────────────────┬─────────────────────┘
           │                            │
           ▼                            ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│      S3 Bucket       │    │        SQS FIFO Queue            │
│  turkish-logistics-  │    │  turkish-logistics-messages.fifo │
│   raw-messages-*     │    │                                  │
│                      │    │  - Ordered processing            │
│  Raw message backup  │    │  - Deduplication                 │
│  Lifecycle: 30d→IA   │    │  - Dead letter queue (3 retries) │
│            90d→Glacier│    │                                  │
└──────────────────────┘    └──────────────┬───────────────────┘
                                           │ trigger
                                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Lambda: Processor Handler                   │
│                 turkish-logistics-processor                  │
│                                                              │
│  1. Receives batch from SQS                                  │
│  2. Parses Turkish logistics text                            │
│  3. Extracts: origin, destination, cargo, weight, phone      │
│  4. Saves structured data to PostgreSQL                      │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL                              │
│                                                              │
│  Tables:                                                     │
│  - raw_messages (original webhook data)                      │
│  - jobs (parsed logistics job postings)                      │
│  - contacts (extracted contact info)                         │
│  - source_groups (whatsapp groups being monitored)           │
│  - processing_logs (parsing audit trail)                     │
└─────────────────────────────────────────────────────────────┘
```

## AWS Resources

| Resource | Name | Description |
|----------|------|-------------|
| API Gateway | Turkish Logistics Webhook API | REST API for webhooks |
| Lambda | turkish-logistics-webhook | Receives and validates webhooks |
| Lambda | turkish-logistics-processor | Parses and stores messages |
| S3 Bucket | turkish-logistics-raw-messages-* | Raw message archive |
| SQS | turkish-logistics-messages.fifo | Message queue |
| SQS | turkish-logistics-messages-dlq.fifo | Dead letter queue |
| RDS PostgreSQL | turkish-logistics-db | Production database |
| Secrets Manager | turkish-logistics/database | DB credentials |
| Secrets Manager | turkish-logistics/webhook-api-key | Webhook auth |

## Production Database (RDS)

The system uses AWS RDS PostgreSQL for production data storage.

### Connection Details
| Setting | Value |
|---------|-------|
| Engine | PostgreSQL 17.4 |
| Instance | db.t3.micro (Free Tier) |
| Endpoint | `turkish-logistics-db.c10uo6ua4no3.eu-central-1.rds.amazonaws.com` |
| Port | 5432 |
| Database | `logistics_jobs` |
| Region | eu-central-1 |

### Lambda Environment
The processor Lambda connects to RDS with these environment variables:
```
DATABASE_URL=postgresql://logistics_admin:***@turkish-logistics-db.c10uo6ua4no3.eu-central-1.rds.amazonaws.com:5432/logistics_jobs?sslmode=require
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Security
- RDS is in a public subnet with security group restricting access
- SSL/TLS required for all connections
- Credentials stored securely (not in code)

## Webhook Security

The webhook endpoint requires an API key for authentication:

```
POST /webhook
Host: t50lrx3amk.execute-api.eu-central-1.amazonaws.com
x-api-key: <your-secret-key>
Content-Type: application/json
```

- Without API key: `401 Unauthorized`
- Wrong API key: `401 Unauthorized`
- Valid API key: Message processed

## Message Parsing

The parser extracts the following from Turkish logistics messages:

### Input Example
```
ANTALYA - ISTANBUL 20 ton demir yük var TIR ARANIYOR 0532 xxx xx xx acil
```

### Output Structure
```json
{
  "messageType": "VEHICLE_WANTED",
  "origin": {
    "provinceName": "Antalya",
    "provinceCode": 7
  },
  "destination": {
    "provinceName": "Istanbul",
    "provinceCode": 34
  },
  "vehicle": {
    "vehicleType": "TIR",
    "isRefrigerated": false
  },
  "weight": {
    "value": 20,
    "unit": "ton"
  },
  "cargoType": "demir",
  "phones": ["0532XXXXXXX"],
  "isUrgent": true,
  "confidenceLevel": "HIGH"
}
```

### Supported Extractions

| Field | Examples |
|-------|----------|
| **Origin/Destination** | 81 Turkish provinces + districts |
| **Vehicle Types** | TIR, KAMYON, KAMYONET, PICKUP |
| **Body Types** | TENTELI, FRIGO, TANKER, LOWBED |
| **Cargo Types** | demir, tekstil, gida, mobilya, etc. |
| **Weight** | 20 ton, 5000 kg |
| **Phone** | 0532 xxx xx xx (masked or full) |
| **Urgency** | acil, hemen, bugün |

### Message Types

| Type | Turkish Keywords |
|------|------------------|
| VEHICLE_WANTED | araniyor, aranıyor, lazim, lazım |
| CARGO_AVAILABLE | yük var, yükümüz var |
| VEHICLE_AVAILABLE | boş araç, müsait |

## Database Schema

### jobs table
```sql
- id (UUID, PK)
- message_id (unique, FK to raw_messages)
- source_group_jid
- raw_text
- origin_province, origin_province_code
- destination_province, destination_province_code
- vehicle_type, body_type, is_refrigerated
- contact_phone, contact_name
- weight, weight_unit, cargo_type
- is_urgent
- confidence_score, confidence_level
- message_type
- posted_at, created_at, is_active
```

### raw_messages table
```sql
- id (UUID, PK)
- message_id (unique)
- instance_name, remote_jid
- content, raw_payload (JSONB)
- s3_bucket, s3_key
- is_processed, processed_at
- received_at, message_timestamp
```

## Local Development

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- pnpm

### Start Services
```bash
# Start all services
pnpm docker:up

# Services:
# - PostgreSQL: localhost:5433
# - Redis: localhost:6379
# - LocalStack: localhost:4566
# - Evolution API: localhost:8080
```

### Database
```bash
# Push schema
DATABASE_URL="postgresql://logistics_user:logistics_dev@localhost:5433/logistics_jobs" \
  pnpm --filter @turkish-logistics/database db:push

# Connect to DB
docker exec logistics-postgres psql -U logistics_user -d logistics_jobs
```

### Run Tests
```bash
pnpm --filter @turkish-logistics/parser test
```

## Project Structure

```
packages/
├── shared/           # Shared types and utilities
│   └── src/
│       ├── types/    # TypeScript interfaces
│       ├── constants/# Turkish cities, cargo types
│       └── utils/    # Text normalization
│
├── parser/           # Message parsing logic
│   └── src/
│       ├── extractors/  # Location, vehicle, phone, etc.
│       ├── parser.ts    # Main parse function
│       └── confidence.ts# Confidence scoring
│
├── database/         # Database schema and queries
│   └── src/
│       ├── schema/   # Drizzle ORM schemas
│       ├── queries/  # Prepared queries
│       └── client.ts # Connection pool
│
├── lambda/           # AWS Lambda handlers
│   └── src/handlers/
│       ├── webhook.ts   # Webhook receiver
│       └── processor.ts # Message processor
│
└── infrastructure/   # AWS CDK stack
    └── lib/
        └── stack.ts  # All AWS resources
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| MESSAGE_QUEUE_URL | SQS FIFO queue URL |
| RAW_MESSAGES_BUCKET | S3 bucket name |
| EVOLUTION_WEBHOOK_API_KEY | Webhook authentication key |

### Webhook Configuration (Evolution API)

When setting up webhook in Evolution API or WhatsApp Business API:

| Setting | Value |
|---------|-------|
| URL | `https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/webhook` |
| Header Name | `x-api-key` |
| Header Value | `turkish-logistics-secret-2024` |
| Events | `messages.upsert` |

## Current Status

| Component | Status |
|-----------|--------|
| Webhook Lambda | Deployed |
| Processor Lambda | Deployed |
| S3 Storage | Deployed |
| SQS Queue | Deployed |
| RDS PostgreSQL | Deployed |
| End-to-End Pipeline | Verified Working |

## Next Steps

1. **WhatsApp Business API**: Connect official WhatsApp Business API for production message receiving
2. **Query API**: Build REST API to query parsed jobs from the database
3. **Dashboard**: Web interface to view and filter logistics jobs
4. **Notifications**: Alert users when jobs match specific criteria
5. **Analytics**: Track job posting trends, popular routes, pricing patterns

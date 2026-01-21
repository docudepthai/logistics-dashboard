# Evolution API Setup Guide

This guide covers setting up Evolution API for WhatsApp integration with the Turkish Logistics Bot.

> **Note**: For production use, WhatsApp Business API is recommended over Evolution API. This guide is primarily for local development and testing.

## Production Webhook (Ready to Use)

The AWS infrastructure is deployed and ready to receive webhook messages:

| Setting | Value |
|---------|-------|
| **Webhook URL** | `https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/webhook` |
| **Header Name** | `x-api-key` |
| **Header Value** | `turkish-logistics-secret-2024` |
| **Events** | `messages.upsert` |

Any WhatsApp API (Evolution API, WhatsApp Business API, etc.) can send webhooks to this endpoint.

## Prerequisites

- Docker and Docker Compose installed
- A WhatsApp account (personal or business)
- Phone with WhatsApp installed for QR code scanning

## Local Development Setup

### 1. Start Evolution API

```bash
# From project root
pnpm docker:evolution
```

This starts two containers:
- **evolution-api**: The WhatsApp API server on port 8080
- **evolution-manager**: Web UI for managing instances on port 3001

### 2. Access Evolution Manager

Open http://localhost:3001 in your browser.

### 3. Create a WhatsApp Instance

Using the Evolution Manager UI:
1. Click "Add Instance"
2. Enter an instance name (e.g., "logistics-dev")
3. Click "Connect"
4. Scan the QR code with WhatsApp on your phone
5. Wait for connection confirmation

Or via API:
```bash
# Create instance
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: your-api-key-change-me" \
  -d '{
    "instanceName": "logistics-dev",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'

# Get QR code
curl http://localhost:8080/instance/connect/logistics-dev \
  -H "apikey: your-api-key-change-me"
```

## Webhook Configuration

Evolution API sends webhook events for all WhatsApp activity. The bot listens for `messages.upsert` events.

### Local Development Webhooks

The docker-compose.evolution.yml configures webhooks to `http://host.docker.internal:3000/webhook`.

For local Lambda testing, use a tool like [LocalStack](https://localstack.cloud/) or [SAM Local](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html).

### Production Webhooks

The production webhook is already deployed. Configure your Evolution API instance to send webhooks:

```bash
# Configure Evolution API webhook (replace YOUR_EVOLUTION_API with your instance URL)
curl -X PUT http://YOUR_EVOLUTION_API:8080/webhook/set/your-instance-name \
  -H "Content-Type: application/json" \
  -H "apikey: your-evolution-api-key" \
  -d '{
    "url": "https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/webhook",
    "headers": {
      "x-api-key": "turkish-logistics-secret-2024"
    },
    "webhookByEvents": true,
    "events": ["MESSAGES_UPSERT"]
  }'
```

### Test the Webhook

Verify the webhook is working by sending a test message:

```bash
curl -X POST "https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/webhook" \
  -H "Content-Type: application/json" \
  -H "x-api-key: turkish-logistics-secret-2024" \
  -d '{
    "event": "messages.upsert",
    "instance": "test",
    "data": {
      "key": {
        "remoteJid": "120363123456789@g.us",
        "fromMe": false,
        "id": "TEST123"
      },
      "pushName": "Test User",
      "message": {
        "conversation": "ISTANBUL - ANKARA 20 ton tekstil TIR ARANIYOR 0532 111 22 33"
      },
      "messageTimestamp": 1704067200
    }
  }'
```

Expected response: `{"message":"Message stored and queued"}`

## Environment Variables

### Evolution API Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `EVOLUTION_API_KEY` | API key for authentication | `your-api-key-change-me` |
| `SERVER_URL` | Public URL of Evolution API | `http://localhost:8080` |
| `WEBHOOK_GLOBAL_URL` | Default webhook URL | `http://host.docker.internal:3000/webhook` |
| `WEBHOOK_EVENTS_MESSAGES_UPSERT` | Enable message events | `true` |
| `WEBHOOK_EVENTS_CONNECTION_UPDATE` | Enable connection events | `true` |
| `WEBHOOK_EVENTS_QRCODE_UPDATED` | Enable QR code events | `true` |

### Bot Lambda Configuration

| Variable | Description |
|----------|-------------|
| `EVOLUTION_WEBHOOK_API_KEY` | Shared secret for webhook authentication |
| `MESSAGE_QUEUE_URL` | SQS queue URL for message processing |
| `RAW_MESSAGES_BUCKET` | S3 bucket for raw message storage |
| `DATABASE_URL` | PostgreSQL connection string |

## Webhook Payload Structure

Evolution API sends the following payload for `messages.upsert`:

```json
{
  "event": "messages.upsert",
  "instance": "logistics-dev",
  "data": {
    "key": {
      "id": "3EB0A1B2C3D4E5F6",
      "remoteJid": "123456789@g.us",
      "fromMe": false,
      "participant": "905551234567@s.whatsapp.net"
    },
    "pushName": "John Doe",
    "message": {
      "conversation": "Istanbul - Ankara yük var. 10 ton. 0555 123 4567"
    },
    "messageType": "conversation",
    "messageTimestamp": 1704067200
  }
}
```

### Key Fields

- `data.key.remoteJid`: Group JID (ends with `@g.us` for groups)
- `data.key.participant`: Sender's phone number (groups only)
- `data.key.fromMe`: Whether message was sent by the connected account
- `data.pushName`: Sender's display name
- `data.message.conversation`: Plain text message content
- `data.message.extendedTextMessage.text`: Formatted text with links/mentions

## Security Recommendations

### API Key Management

1. **Never commit API keys** to version control
2. Use `.env` files for local development:
   ```bash
   # .env
   EVOLUTION_API_KEY=your-secure-random-key
   ```
3. For production, use AWS Secrets Manager (automatically created by CDK stack)

### Webhook Authentication

The webhook Lambda validates incoming requests using the `x-api-key` header:

```typescript
const apiKey = event.headers['x-api-key'];
const expectedApiKey = process.env.EVOLUTION_WEBHOOK_API_KEY;
if (expectedApiKey && apiKey !== expectedApiKey) {
  return response(401, 'Unauthorized');
}
```

Configure the same API key in both Evolution API and AWS Secrets Manager.

## Troubleshooting

### QR Code Not Appearing

1. Check Evolution API logs: `docker logs evolution-api`
2. Verify the instance was created successfully
3. Try disconnecting and reconnecting

### Webhooks Not Received

1. Verify webhook URL is accessible from Evolution API container
2. Check Evolution API logs for webhook errors
3. Test connectivity: `curl -X POST http://your-webhook-url -d '{"test": true}'`

### Message Not Processed

1. Check Lambda CloudWatch logs
2. Verify the message matches filter criteria:
   - Group message (remoteJid ends with `@g.us`)
   - Not sent by the bot (`fromMe: false`)
   - Contains text content

### Connection Drops

WhatsApp connections can drop due to:
- Phone going offline
- Multiple devices connected
- WhatsApp account restrictions

Monitor the `CONNECTION_UPDATE` webhook event and implement reconnection logic as needed.

## Production Deployment

### Hosting Evolution API

For production, deploy Evolution API on:
- **AWS EC2/ECS**: Use the same Docker image with persistent storage
- **DigitalOcean/Hetzner**: Cost-effective VPS options
- **Self-hosted**: Any server with Docker support

Requirements:
- Persistent volume for WhatsApp session data
- Stable internet connection
- SSL/TLS for secure webhook delivery

### High Availability

For mission-critical deployments:
1. Use Redis for session sharing between multiple instances
2. Configure load balancing with sticky sessions
3. Monitor connection health and auto-reconnect

```yaml
# Production docker-compose example
services:
  evolution-api:
    image: atendai/evolution-api:v2.1.1
    environment:
      - DATABASE_ENABLED=true
      - DATABASE_DRIVER=postgresql
      - DATABASE_URL=postgresql://user:pass@db:5432/evolution
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://redis:6379
    deploy:
      replicas: 2
```

## WhatsApp Business API (Recommended for Production)

For production deployments, consider using the official WhatsApp Business API instead of Evolution API:

### Advantages
- **Official Support**: Backed by Meta/WhatsApp
- **Reliability**: Enterprise-grade SLA and uptime
- **Compliance**: Follows WhatsApp Terms of Service
- **Scalability**: Handles high message volumes

### Setup
1. Apply for WhatsApp Business API access through Meta Business Suite
2. Choose a Business Solution Provider (BSP) or host yourself
3. Configure webhook URL: `https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/webhook`
4. Add `x-api-key: turkish-logistics-secret-2024` header to webhook configuration

### Webhook Payload Compatibility
The Turkish Logistics Bot webhook handler accepts both Evolution API and WhatsApp Business API payloads. The key fields are:
- `data.key.remoteJid` - Group/chat identifier
- `data.message.conversation` or `data.message.extendedTextMessage.text` - Message content
- `data.pushName` - Sender name

## Resources

- [Evolution API Documentation](https://doc.evolution-api.com/)
- [Evolution API GitHub](https://github.com/EvolutionAPI/evolution-api)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy/)

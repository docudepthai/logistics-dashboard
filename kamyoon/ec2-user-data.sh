#!/bin/bash
set -e

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create Evolution API directory
mkdir -p /opt/evolution-api
cd /opt/evolution-api

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  evolution-api:
    image: atendai/evolution-api:latest
    container_name: evolution-api
    restart: always
    ports:
      - "8080:8080"
    environment:
      # Server
      - SERVER_URL=http://localhost:8080
      - SERVER_PORT=8080

      # Authentication
      - AUTHENTICATION_API_KEY=turkish-logistics-evolution-key-2024
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true

      # Database (using SQLite for simplicity)
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://postgres:evolution123@postgres:5432/evolution
      - DATABASE_CONNECTION_CLIENT_NAME=evolution

      # Redis for caching
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://redis:6379
      - CACHE_REDIS_PREFIX_KEY=evolution
      - CACHE_LOCAL_ENABLED=false

      # Storage
      - S3_ENABLED=false

      # Webhook global config
      - WEBHOOK_GLOBAL_URL=https://t50lrx3amk.execute-api.eu-central-1.amazonaws.com/prod/webhook
      - WEBHOOK_GLOBAL_ENABLED=true
      - WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false

      # Events to send
      - WEBHOOK_EVENTS_APPLICATION_STARTUP=false
      - WEBHOOK_EVENTS_QRCODE_UPDATED=true
      - WEBHOOK_EVENTS_MESSAGES_SET=true
      - WEBHOOK_EVENTS_MESSAGES_UPSERT=true
      - WEBHOOK_EVENTS_MESSAGES_UPDATE=false
      - WEBHOOK_EVENTS_MESSAGES_DELETE=false
      - WEBHOOK_EVENTS_SEND_MESSAGE=false
      - WEBHOOK_EVENTS_CONTACTS_SET=false
      - WEBHOOK_EVENTS_CONTACTS_UPSERT=false
      - WEBHOOK_EVENTS_CONTACTS_UPDATE=false
      - WEBHOOK_EVENTS_PRESENCE_UPDATE=false
      - WEBHOOK_EVENTS_CHATS_SET=false
      - WEBHOOK_EVENTS_CHATS_UPSERT=false
      - WEBHOOK_EVENTS_CHATS_UPDATE=false
      - WEBHOOK_EVENTS_CHATS_DELETE=false
      - WEBHOOK_EVENTS_GROUPS_UPSERT=false
      - WEBHOOK_EVENTS_GROUPS_UPDATE=false
      - WEBHOOK_EVENTS_GROUP_PARTICIPANTS_UPDATE=false
      - WEBHOOK_EVENTS_CONNECTION_UPDATE=true
      - WEBHOOK_EVENTS_LABELS_EDIT=false
      - WEBHOOK_EVENTS_LABELS_ASSOCIATION=false
      - WEBHOOK_EVENTS_CALL=false
      - WEBHOOK_EVENTS_TYPEBOT_START=false
      - WEBHOOK_EVENTS_TYPEBOT_CHANGE_STATUS=false

      # Instance config
      - CONFIG_SESSION_PHONE_CLIENT=Turkish Logistics Bot
      - CONFIG_SESSION_PHONE_NAME=Chrome

      # QR Code
      - QRCODE_LIMIT=30
      - QRCODE_COLOR=#000000

      # Log
      - LOG_LEVEL=ERROR
      - LOG_COLOR=true
      - LOG_BAILEYS=error

      # Clean store (optional)
      - DEL_INSTANCE=false

    volumes:
      - evolution_instances:/evolution/instances
      - evolution_store:/evolution/store
    depends_on:
      - redis
      - postgres
    networks:
      - evolution-network

  redis:
    image: redis:7-alpine
    container_name: evolution-redis
    restart: always
    volumes:
      - redis_data:/data
    networks:
      - evolution-network

  postgres:
    image: postgres:15-alpine
    container_name: evolution-postgres
    restart: always
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=evolution123
      - POSTGRES_DB=evolution
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - evolution-network

volumes:
  evolution_instances:
  evolution_store:
  redis_data:
  postgres_data:

networks:
  evolution-network:
    driver: bridge
EOF

# Start Evolution API
docker-compose up -d

# Wait for services to start
sleep 30

echo "Evolution API setup complete!"
echo "Access at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8080"
echo "API Key: turkish-logistics-evolution-key-2024"

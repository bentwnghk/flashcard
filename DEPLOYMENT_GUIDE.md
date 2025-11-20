# Deployment Guide - Flashcard App

This guide covers deploying the flashcard application using Docker and GitHub Actions for CI/CD automation.

## Table of Contents
1. [Deployment Options](#deployment-options)
2. [Docker Setup](#docker-setup)
3. [GitHub Actions CI/CD](#github-actions-cicd)
4. [Environment Configuration](#environment-configuration)
5. [Database Migrations](#database-migrations)
6. [Monitoring & Logging](#monitoring--logging)
7. [Scaling & Performance](#scaling--performance)

---

## Deployment Options

### Option 1: Vercel (Recommended for Next.js)
- **Pros**: Zero-config, automatic deployments, edge network, serverless functions
- **Cons**: Vendor lock-in, limited control over infrastructure
- **Best for**: Quick deployment, MVP, small to medium scale

### Option 2: Docker + Cloud Provider (AWS, GCP, Azure)
- **Pros**: Full control, portable, scalable, cost-effective at scale
- **Cons**: More setup required, infrastructure management
- **Best for**: Production, enterprise, custom requirements

### Option 3: Docker + Self-hosted (VPS, Dedicated Server)
- **Pros**: Complete control, predictable costs, data sovereignty
- **Cons**: Manual infrastructure management, scaling complexity
- **Best for**: Budget-conscious, specific compliance requirements

**This guide focuses on Option 2: Docker + GitHub Actions**

---

## Docker Setup

### Project Structure

```
flashcard-app/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── nginx.conf
├── docker-compose.yml
├── docker-compose.prod.yml
└── .dockerignore
```

### Dockerfile

Create `Dockerfile` in the project root:

```dockerfile
# Multi-stage build for optimized production image

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Dockerfile.dev (Development)

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy source code
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

### .dockerignore

```
# Dependencies
node_modules
npm-debug.log

# Next.js
.next
out

# Environment
.env
.env.local
.env.*.local

# Git
.git
.gitignore

# IDE
.vscode
.idea

# Testing
coverage
.nyc_output

# Misc
*.log
.DS_Store
README.md
```

### docker-compose.yml (Development)

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - UNSPLASH_ACCESS_KEY=${UNSPLASH_ACCESS_KEY}
    networks:
      - flashcard-network

networks:
  flashcard-network:
    driver: bridge
```

### docker-compose.prod.yml (Production)

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - UNSPLASH_ACCESS_KEY=${UNSPLASH_ACCESS_KEY}
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - flashcard-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.flashcard.rule=Host(`flashcard.yourdomain.com`)"
      - "traefik.http.routers.flashcard.entrypoints=websecure"
      - "traefik.http.routers.flashcard.tls.certresolver=letsencrypt"

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - app
    networks:
      - flashcard-network

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

networks:
  flashcard-network:
    driver: bridge
```

### nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    upstream nextjs {
        server app:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general_limit:10m rate=100r/s;

    server {
        listen 80;
        server_name flashcard.yourdomain.com;

        # Redirect HTTP to HTTPS
        location / {
            return 301 https://$host$request_uri;
        }

        # Let's Encrypt challenge
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
    }

    server {
        listen 443 ssl http2;
        server_name flashcard.yourdomain.com;

        # SSL certificates
        ssl_certificate /etc/letsencrypt/live/flashcard.yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/flashcard.yourdomain.com/privkey.pem;

        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https:;" always;

        # Gzip compression
        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

        # Client body size limit
        client_max_body_size 10M;

        # API rate limiting
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://nextjs;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Static files caching
        location /_next/static/ {
            proxy_pass http://nextjs;
            proxy_cache_valid 200 365d;
            add_header Cache-Control "public, immutable";
        }

        # All other requests
        location / {
            limit_req zone=general_limit burst=50 nodelay;
            proxy_pass http://nextjs;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

---

## GitHub Actions CI/CD

### .github/workflows/ci.yml (Continuous Integration)

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [develop]

jobs:
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript type check
        run: npm run type-check

  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella

  build:
    name: Build Application
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build
          path: .next
          retention-days: 1

  docker-build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: flashcard-app:test
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### .github/workflows/deploy.yml (Continuous Deployment)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    name: Build and Push Docker Image
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
            NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

  deploy:
    name: Deploy to Server
    runs-on: ubuntu-latest
    needs: build-and-push
    environment:
      name: production
      url: https://flashcard.yourdomain.com

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Deploy to server via SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          port: ${{ secrets.SERVER_PORT }}
          script: |
            # Navigate to app directory
            cd /opt/flashcard-app

            # Pull latest code
            git pull origin main

            # Log in to GitHub Container Registry
            echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin

            # Pull latest image
            docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:main

            # Update environment variables
            cat > .env.production << EOF
            NODE_ENV=production
            NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
            NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
            SUPABASE_SERVICE_ROLE_KEY=${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
            OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}
            UNSPLASH_ACCESS_KEY=${{ secrets.UNSPLASH_ACCESS_KEY }}
            NEXT_PUBLIC_APP_URL=${{ secrets.NEXT_PUBLIC_APP_URL }}
            EOF

            # Stop and remove old containers
            docker-compose -f docker-compose.prod.yml down

            # Start new containers
            docker-compose -f docker-compose.prod.yml up -d

            # Clean up old images
            docker image prune -af

            # Health check
            sleep 10
            curl -f http://localhost:3000/api/health || exit 1

      - name: Notify deployment status
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment to production: ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### .github/workflows/database-migration.yml

```yaml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to run migration'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  migrate:
    name: Run Database Migration
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Supabase CLI
        run: |
          npm install -g supabase

      - name: Run migrations
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
          SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
        run: |
          supabase link --project-ref $SUPABASE_PROJECT_ID
          supabase db push

      - name: Verify migration
        run: |
          # Add verification script here
          echo "Migration completed successfully"
```

---

## Environment Configuration

### GitHub Secrets Setup

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

**Required Secrets**:
```
# Server Access
SERVER_HOST=your-server-ip
SERVER_USER=deploy
SERVER_PORT=22
SSH_PRIVATE_KEY=your-ssh-private-key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ACCESS_TOKEN=your-access-token
SUPABASE_DB_PASSWORD=your-db-password
SUPABASE_PROJECT_ID=your-project-id

# External APIs
OPENAI_API_KEY=sk-xxx
UNSPLASH_ACCESS_KEY=your-unsplash-key

# App Configuration
NEXT_PUBLIC_APP_URL=https://flashcard.yourdomain.com

# Notifications (Optional)
SLACK_WEBHOOK=your-slack-webhook-url

# Container Registry
GITHUB_TOKEN=automatically-provided
```

### Server Setup Script

Create `scripts/setup-server.sh`:

```bash
#!/bin/bash

# Server setup script for Ubuntu 22.04

set -e

echo "🚀 Setting up production server..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create app directory
sudo mkdir -p /opt/flashcard-app
sudo chown $USER:$USER /opt/flashcard-app

# Clone repository
cd /opt/flashcard-app
git clone https://github.com/yourusername/flashcard-app.git .

# Create necessary directories
mkdir -p certbot/conf certbot/www

# Install Certbot for SSL
sudo apt install -y certbot

# Generate SSL certificate
sudo certbot certonly --standalone -d flashcard.yourdomain.com --email your@email.com --agree-tos --non-interactive

# Copy certificates to project
sudo cp -r /etc/letsencrypt/* ./certbot/conf/

# Set up firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Create deploy user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys

echo "✅ Server setup complete!"
echo "Next steps:"
echo "1. Add GitHub Actions secrets"
echo "2. Push to main branch to trigger deployment"
```

---

## Database Migrations

### Migration Strategy

Create `supabase/migrations/` directory structure:

```
supabase/
├── migrations/
│   ├── 20240101000000_initial_schema.sql
│   ├── 20240102000000_add_indexes.sql
│   └── 20240103000000_add_rls_policies.sql
└── seed.sql
```

### Migration Script

Create `scripts/migrate.sh`:

```bash
#!/bin/bash

set -e

echo "🔄 Running database migrations..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Installing Supabase CLI..."
    npm install -g supabase
fi

# Link to project
supabase link --project-ref $SUPABASE_PROJECT_ID

# Run migrations
supabase db push

# Verify migration
supabase db diff

echo "✅ Migrations completed successfully!"
```

### Rollback Script

Create `scripts/rollback.sh`:

```bash
#!/bin/bash

set -e

echo "⚠️  Rolling back database migration..."

# Get migration version to rollback to
MIGRATION_VERSION=$1

if [ -z "$MIGRATION_VERSION" ]; then
    echo "Error: Please provide migration version"
    echo "Usage: ./rollback.sh <migration_version>"
    exit 1
fi

# Rollback
supabase db reset --version $MIGRATION_VERSION

echo "✅ Rollback completed!"
```

---

## Monitoring & Logging

### Health Check Endpoint

Create `app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check database connection
    const { error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error) {
      throw error;
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        api: 'up',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      },
      { status: 503 }
    );
  }
}
```

### Docker Logging Configuration

Add to `docker-compose.prod.yml`:

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Monitoring Script

Create `scripts/monitor.sh`:

```bash
#!/bin/bash

# Simple monitoring script

while true; do
    # Check health endpoint
    HEALTH=$(curl -s http://localhost:3000/api/health)
    STATUS=$(echo $HEALTH | jq -r '.status')
    
    if [ "$STATUS" != "healthy" ]; then
        echo "⚠️  Application unhealthy: $HEALTH"
        # Send alert (e.g., to Slack)
        curl -X POST $SLACK_WEBHOOK -H 'Content-Type: application/json' \
            -d "{\"text\":\"🚨 Flashcard app is unhealthy: $HEALTH\"}"
    else
        echo "✅ Application healthy"
    fi
    
    # Check disk space
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $DISK_USAGE -gt 80 ]; then
        echo "⚠️  Disk usage high: ${DISK_USAGE}%"
    fi
    
    # Check memory
    MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}' | cut -d. -f1)
    if [ $MEM_USAGE -gt 80 ]; then
        echo "⚠️  Memory usage high: ${MEM_USAGE}%"
    fi
    
    sleep 60
done
```

---

## Scaling & Performance

### Horizontal Scaling with Docker Swarm

Initialize swarm:
```bash
docker swarm init
```

Create `docker-stack.yml`:

```yaml
version: '3.8'

services:
  app:
    image: ghcr.io/yourusername/flashcard-app:main
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    environment:
      - NODE_ENV=production
    networks:
      - flashcard-network

  nginx:
    image: nginx:alpine
    deploy:
      replicas: 2
      placement:
        constraints:
          - node.role == manager
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - flashcard-network

networks:
  flashcard-network:
    driver: overlay
```

Deploy stack:
```bash
docker stack deploy -c docker-stack.yml flashcard
```

### Performance Optimization Checklist

- [ ] Enable Next.js output: 'standalone' in next.config.js
- [ ] Implement Redis caching for API responses
- [ ] Use CDN for static assets
- [ ] Enable HTTP/2 in Nginx
- [ ] Implement database connection pooling
- [ ] Set up database read replicas
- [ ] Enable Gzip/Brotli compression
- [ ] Optimize Docker image size (multi-stage builds)
- [ ] Implement rate limiting
- [ ] Set up monitoring and alerting

---

## Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] SSL certificates obtained
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Documentation updated

### Deployment
- [ ] Run database migrations
- [ ] Deploy application
- [ ] Verify health checks
- [ ] Test critical user flows
- [ ] Monitor error rates
- [ ] Check performance metrics

### Post-deployment
- [ ] Verify all features working
- [ ] Monitor logs for errors
- [ ] Check database performance
- [ ] Verify SSL certificate
- [ ] Test backup restoration
- [ ] Update status page

---

## Troubleshooting

### Common Issues

**Container won't start**:
```bash
# Check logs
docker-compose logs app

# Check container status
docker ps -a

# Restart container
docker-compose restart app
```

**Database connection issues**:
```bash
# Test database connection
docker exec -it flashcard-app-app-1 node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('profiles').select('count').then(console.log);
"
```

**High memory usage**:
```bash
# Check container stats
docker stats

# Limit container memory
docker update --memory 512m flashcard-app-app-1
```

---

## Conclusion

This deployment guide provides a production-ready setup using Docker and GitHub Actions. The configuration is scalable, secure, and automated, allowing for continuous deployment with minimal manual intervention.

**Key Benefits**:
- Automated CI/CD pipeline
- Zero-downtime deployments
- Easy rollback capability
- Scalable infrastructure
- Comprehensive monitoring
- Security best practices

For questions or issues, refer to the project documentation or create an issue in the GitHub repository.
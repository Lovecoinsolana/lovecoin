# Lovecoin - Production Deployment Guide

## Architecture Overview

```
                    ┌─────────────┐
                    │   CDN       │
                    │(CloudFront) │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Web App    │    │    API      │    │  S3 Photos  │
│  (Next.js)  │───▶│  (Fastify)  │───▶│             │
│  Port 3000  │    │  Port 3001  │    │             │
└─────────────┘    └──────┬──────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ PostgreSQL  │
                   │  (Managed)  │
                   └─────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 15+
- S3 storage account
- Solana mainnet wallet

### 1. Clone and Install

```bash
git clone https://github.com/your-org/lovecoin.git
cd lovecoin
pnpm install
```

### 2. Configure Environment

Create environment files:

```bash
# API
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with production values

# Web
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local with production values
```

### 3. Database Setup

```bash
cd apps/api
pnpm db:push
```

### 4. Build

```bash
pnpm build
```

### 5. Deploy

See individual deployment guides:
- [API Deployment](apps/api/DEPLOYMENT.md)
- [Web Deployment](apps/web/DEPLOYMENT.md)

## Environment Variables Summary

### API (`apps/api/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| NODE_ENV | Yes | `production` |
| DATABASE_URL | Yes | PostgreSQL connection string with SSL |
| JWT_SECRET | Yes | Secure random string (64+ chars) |
| SOLANA_RPC_URL | Yes | Mainnet RPC endpoint |
| PLATFORM_WALLET_ADDRESS | Yes | Mainnet wallet for payments |
| S3_ACCESS_KEY_ID | Yes | AWS/S3 access key |
| S3_SECRET_ACCESS_KEY | Yes | AWS/S3 secret key |
| S3_BUCKET | Yes | S3 bucket name |
| S3_REGION | Yes | S3 region |
| S3_PUBLIC_URL | No | CDN URL for photos |

### Web (`apps/web/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| NEXT_PUBLIC_API_URL | Yes | Production API URL |
| NEXT_PUBLIC_WS_URL | No | WebSocket URL (defaults to API URL) |
| NEXT_PUBLIC_S3_URL | No | CDN URL for photos |

## Docker Deployment

```bash
# Build and run
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down
```

## Security Checklist

### Before Launch

- [ ] JWT_SECRET is unique and secure (64+ random chars)
- [ ] Database uses SSL connections
- [ ] S3 bucket is properly configured
- [ ] Solana wallet is a mainnet address
- [ ] Rate limiting is configured
- [ ] CORS is configured for your domain
- [ ] HTTPS is enabled on all endpoints
- [ ] WebSocket uses WSS (secure)

### Infrastructure

- [ ] Database backups are configured
- [ ] Monitoring/alerting is set up
- [ ] Error tracking (Sentry) is configured
- [ ] Log aggregation is configured
- [ ] SSL certificates are valid and auto-renewing

### Wallet Security

- [ ] Platform wallet private key is in secure vault
- [ ] Multi-sig or hardware wallet for platform funds
- [ ] Regular withdrawal schedule to cold storage

## Recommended Stack

| Component | Service |
|-----------|---------|
| Database | AWS RDS PostgreSQL, Supabase, Neon |
| Storage | AWS S3, Cloudflare R2 |
| CDN | CloudFront, Cloudflare |
| API Hosting | Railway, Render, Fly.io |
| Web Hosting | Vercel, Netlify |
| Monitoring | Datadog, Sentry |

## Cost Estimation

| Service | Estimated Monthly Cost |
|---------|----------------------|
| Database (managed) | $15-50 |
| S3 Storage (10GB) | $1-5 |
| API Hosting | $10-30 |
| Web Hosting | $0-20 |
| CDN | $0-20 |
| **Total** | **$26-125** |

## Support

For deployment issues, check:
1. Health endpoint: `GET /health`
2. API logs
3. Database connectivity
4. S3 permissions

## Post-Launch

1. Monitor error rates
2. Watch payment transaction success rate
3. Monitor WebSocket connection stability
4. Track photo upload success rate
5. Review rate limit effectiveness

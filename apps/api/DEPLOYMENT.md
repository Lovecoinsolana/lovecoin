# Lovecoin API - Deployment Guide

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (managed service recommended)
- S3 or S3-compatible storage
- Solana mainnet wallet

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Server
NODE_ENV=production
API_PORT=3001
API_HOST=0.0.0.0
API_BASE_URL=https://api.lovecoin.app

# Database
DATABASE_URL=postgresql://user:password@host:5432/lovecoin?sslmode=require

# JWT (generate: openssl rand -base64 64)
JWT_SECRET=your-secure-64-char-random-string
JWT_EXPIRES_IN=7d

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
PLATFORM_WALLET_ADDRESS=your-mainnet-wallet-address

# Pricing (lamports)
VERIFICATION_FEE_LAMPORTS=10000000
MESSAGE_FEE_LAMPORTS=500000
PHOTO_MESSAGE_FEE_LAMPORTS=1000000

# S3 Storage
S3_BUCKET=lovecoin-photos
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-aws-key
S3_SECRET_ACCESS_KEY=your-aws-secret
S3_PUBLIC_URL=https://cdn.lovecoin.app  # Optional CDN
```

## Build & Deploy

### 1. Install dependencies
```bash
pnpm install --frozen-lockfile
```

### 2. Generate Prisma client
```bash
cd apps/api
pnpm db:generate
```

### 3. Run database migrations
```bash
pnpm db:push
```

### 4. Build
```bash
pnpm build
```

### 5. Start
```bash
pnpm start
```

## Docker Deployment

### Build image
```bash
docker build -t lovecoin-api -f apps/api/Dockerfile .
```

### Run container
```bash
docker run -d \
  --name lovecoin-api \
  -p 3001:3001 \
  --env-file apps/api/.env \
  lovecoin-api
```

## Health Check

```bash
curl https://api.lovecoin.app/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-02-04T..."}
```

## Security Checklist

- [ ] JWT_SECRET is 64+ characters, randomly generated
- [ ] DATABASE_URL uses SSL (`?sslmode=require`)
- [ ] SOLANA_NETWORK is `mainnet-beta`
- [ ] S3 credentials are configured
- [ ] HTTPS is enabled (use reverse proxy)
- [ ] Rate limiting is enabled (built-in)
- [ ] CORS is configured if needed

## Recommended Services

| Service | Options |
|---------|---------|
| Database | AWS RDS, Supabase, Neon, PlanetScale |
| Storage | AWS S3, Cloudflare R2, DigitalOcean Spaces |
| Hosting | Railway, Render, Fly.io, AWS ECS |
| CDN | CloudFront, Cloudflare, Fastly |

## Monitoring

Recommended tools:
- Application: Sentry, Datadog
- Logs: Papertrail, LogDNA
- Uptime: Better Uptime, Pingdom

## Scaling Considerations

1. **Database**: Use connection pooling (PgBouncer)
2. **WebSockets**: Use Redis adapter for multi-instance
3. **Storage**: Use CDN for photo delivery
4. **Rate Limiting**: Consider Redis store for distributed rate limiting

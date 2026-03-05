# Photobooth SaaS (인생네컷 style)

A production-grade photobooth application built with Next.js 14, TypeScript, Prisma, and Sharp.

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (for PostgreSQL)

### Setup

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies
npm install

# 3. Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev --name init

# 4. Seed the database (creates admin user + sample data)
npm run db:seed

# 5. Start the dev server
npm run dev
```

Open http://localhost:3000

### Admin Login
- Username: `admin`
- Password: `admin123`
- URL: http://localhost:3000/admin/login

### Production Worker
In production, run the render worker as a separate process:
```bash
npm run worker
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page - theme selection |
| `/camera?person=slug` | Camera capture (4 photos) |
| `/preview` | Crop/zoom/pan editor |
| `/result/[jobId]` | Final result + QR download |
| `/r/[jobId]` | Public download page |
| `/kiosk` | Fullscreen kiosk mode |
| `/admin` | Admin dashboard |
| `/admin/persons` | Manage persons/themes |
| `/admin/frames` | Manage frames |
| `/admin/frames/[id]` | Slot editor |

## Architecture

- **Framework**: Next.js 14 App Router
- **Database**: PostgreSQL + Prisma ORM
- **Image Processing**: Sharp (server-side compositing)
- **Auth**: NextAuth.js (credentials provider)
- **Storage**: Local filesystem (dev) / S3 adapter stub (prod)
- **Queue**: DB-driven render queue with configurable concurrency

## Environment Variables

See `.env.example` for all configuration options.

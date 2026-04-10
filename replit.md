# DropMail - Temporary Email Service

## Overview

A disposable email web application that lets users generate temporary email addresses and read incoming messages in real-time. Built using the DropMail.me GraphQL API. New emails are automatically forwarded to a Telegram channel.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **API framework**: Express 5
- **Validation**: Zod (`zod/v4`)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **External API**: DropMail.me GraphQL API

## Architecture

- Frontend (`artifacts/web`) — React SPA with auto-polling inbox every 4s
- Backend (`artifacts/api-server`) — Express proxy to DropMail.me GraphQL API
- Mail Watcher (`artifacts/api-server/src/lib/mailWatcher.ts`) — polls active sessions every 5s and forwards new emails to Telegram (server-side, works on traditional hosting)
- Telegram forwarding also triggered client-side via `POST /api/notify` (works on Vercel serverless)

## Key Features

- Generate temporary email addresses on demand
- Auto-refresh inbox every 4 seconds for new emails
- View full email content (HTML and text)
- Copy email address to clipboard
- Session persistence via localStorage
- Session expiry countdown timer
- Auto-forward new emails to Telegram channel (works on both Replit and Vercel)

## Vercel Deployment

The project is Vercel-ready:
- `vercel.json` at root configures build and routing
- Frontend built with Vite, served as static files
- API served via Vercel serverless functions (`artifacts/api-server/api/index.ts`)
- Telegram forwarding works via client-triggered `POST /api/notify` (no persistent process needed)

**Required Vercel environment variables:**
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
- `TELEGRAM_CHAT_ID` — Target Telegram channel ID

**Build settings (auto-detected from vercel.json):**
- Install: `pnpm install`
- Build: `pnpm --filter @workspace/web build`
- Output: `artifacts/web/dist/public`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Environment Variables

- `DROPMAIL_AUTH_TOKEN` — DropMail.me API authentication token (optional, used if set)
- `TELEGRAM_BOT_TOKEN` — Telegram bot token for email forwarding
- `TELEGRAM_CHAT_ID` — Target Telegram channel ID (e.g. `-1003756077815`)
- `BASE_PATH` — Base URL path for frontend (default: `/`)
- `PORT` — Port for dev server (default: `3000`)

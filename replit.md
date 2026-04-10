# DropMail - Temporary Email Service

## Overview

A disposable email web application that lets users generate temporary email addresses and read incoming messages in real-time. Built using the DropMail.me GraphQL API.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **API framework**: Express 5
- **Validation**: Zod (`zod/v4`)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **External API**: DropMail.me GraphQL API

## Architecture

- Frontend (`artifacts/web`) — React SPA with dark theme, auto-polling inbox
- Backend (`artifacts/api-server`) — Express proxy to DropMail.me GraphQL API
- The backend proxies all requests to DropMail GraphQL API using `DROPMAIL_AUTH_TOKEN`

## Key Features

- Generate temporary email addresses on demand
- Auto-refresh inbox every 4 seconds for new emails
- View full email content (HTML and text)
- Copy email address to clipboard
- Session persistence via localStorage
- Session expiry countdown timer

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Environment Variables

- `DROPMAIL_AUTH_TOKEN` — DropMail.me API authentication token

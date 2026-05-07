# 3dfy — Image to 3D PWA

Mobile-first PWA where you drop an image and get a downloadable, AR-ready `.glb` 3D model back. Built with **Next.js 15 + Supabase + fal.ai (Tripo3D P1 / H3.1)**.

## Features

- Drag & drop, paste, or use phone camera to upload an image
- Two model tiers:
  - **Tripo P1** — fast, simple ($0.40 / $0.50 with textures)
  - **Tripo H3.1** — higher quality, optional HD textures, detailed geometry, quad mesh ($0.20 – $0.95)
- Webhook-driven queue so long jobs (HD textures, detailed geo) won't time out
- View the result in-browser with `<model-viewer>` plus AR (iOS Quick Look + Android Scene Viewer)
- Per-user history, persisted models in private Supabase Storage
- Installable PWA, offline shell

## Setup

```bash
cp .env.example .env.local   # fill in values
npm install
```

### Supabase

1. Create a Supabase project.
2. Run the migration in `supabase/migrations/0001_init.sql` (SQL editor).
3. Copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into `.env.local`.

### fal.ai

1. Grab an API key at <https://fal.ai/dashboard/keys> and put it in `FAL_KEY`.
2. Generate a strong `WEBHOOK_SECRET` (e.g. `openssl rand -hex 32`).

### Run locally

```bash
npm run dev
```

For local webhook testing, expose your dev server (e.g. `cloudflared tunnel --url http://localhost:3000`) and set `NEXT_PUBLIC_SITE_URL` accordingly.

### Deploy to Vercel

```bash
vercel
```

Set all env vars in the Vercel dashboard. Once deployed, set `NEXT_PUBLIC_SITE_URL` to the production URL.

## Architecture

```
Browser (PWA) ──upload──▶ Supabase Storage (inputs/, private)
     │
     ├── POST /api/generate (signed image URL → fal.queue.submit + webhook)
     │
     │            fal.ai ──webhook──▶ /api/fal-webhook
     │                                       │
     │                                       └─ download .glb → Storage (models/)
     │                                          → update jobs row
     │
     └── Realtime subscription on jobs.id ─▶ render <model-viewer>
```

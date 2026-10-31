# Assorted Coworking ERP

Owner-facing progressive web app (installable on a phone) plus the Supabase backend that powers the public membership induction form at **https://coworking.assorted.group/join** (source in the `assortedcoworking` website repo).

## What it does

- **Induction form → ERP**: the website form posts to the `cw-onboarding-submit` edge function, which creates a member (`pending_payment`) and a signup invoice (first month + refundable deposit), then notifies the member (WhatsApp + email) and the owner.
- **PWA** (`src/`): dashboard (occupancy, MRR, outstanding, collected), members, invoices, payments with receipt upload, expenses, message log, settings (pricing, bank details, billing day).
- **Monthly billing**: on the 28th, `cw-monthly-billing` creates next month's invoice for every active member and sends it by WhatsApp template + email (pg_cron → pg_net → edge function).

## Stack

Vite + React 18 + TypeScript + Tailwind + shadcn/ui, `vite-plugin-pwa`, Supabase (Postgres + Auth + Storage + Edge Functions) on the shared **APT CRM** project (`aliegtwlfphpeyvesyvi`). All tables are prefixed `cw_` and scoped by `tenant_id` with row-level security; owners/staff are linked through `cw_tenant_users`.

## Layout

```
src/                 PWA source
supabase/migrations  SQL applied to the project (kept here for history)
supabase/functions   cw-onboarding-submit, cw-monthly-billing, cw-send-invoice (+ _shared/notify.ts, copied into each function at deploy time)
legacy/              the previous Google Apps Script + Google Sheets implementation (reference only)
```

## Local development

```bash
npm install
cp .env.example .env   # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

## Deploying

- **PWA**: Vercel project linked to this repo (`main` → production). Set the two `VITE_` env vars.
- **Edge functions**: deployed with the Supabase MCP/CLI. Secrets: `WA_ACCESS_TOKEN` (Meta system-user token), `RESEND_API_KEY`, `RESEND_FROM`, `CW_CRON_SECRET`.
- **Cron**: see `supabase/migrations/*_cw_cron.sql`.

## Secrets

Never commit keys. The anon/publishable key is public by design; everything sensitive lives in Supabase edge function secrets.

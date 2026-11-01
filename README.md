# Hearthline

Hearthline is a calm, responsive household-management app for two adults. It combines daily care, weekend capacity planning, calendars, home maintenance, pet care, goals, and a quick-capture inbox in one installable web app.

## Live architecture

- **Frontend:** React + Vite, published by GitHub Actions to GitHub Pages
- **Shared service:** Cloudflare Worker at `https://hearthline-api.cskeeley.workers.dev`
- **Data:** private Cloudflare D1 database
- **Accounts:** exactly one household with a maximum of two permanent accounts
- **Sync:** saved changes are shared automatically and refreshed every few seconds

No Supabase project is used. The app does not request a precise home address.

## First-time setup

1. Open the published app.
2. Enter the one-time private setup code supplied during deployment.
3. Create the first account and household.
4. Open **Settings** and share the household invite code with the second adult.
5. The second adult chooses **Join with code** and creates the final account.

After the first account is created, the private setup route closes. After the second account joins, new account creation closes as well.

## Run locally

```sh
npm install
npm run dev
```

The frontend reads `VITE_API_URL`. For local full-stack development, place the local Worker URL in `.env.local`, put a test `SETUP_TOKEN` in `.dev.vars`, apply the local D1 migration, and run `npm run worker:dev` alongside Vite.

## Deploy

Pushes to `main` publish the frontend through `.github/workflows/deploy-pages.yml`. The Cloudflare Worker and D1 configuration live in `wrangler.jsonc`, `worker/`, and `migrations/`.

```sh
npm run db:migrate:remote
npm run worker:deploy
```

The production `SETUP_TOKEN` is stored as an encrypted Cloudflare Worker secret and is never committed to this repository.

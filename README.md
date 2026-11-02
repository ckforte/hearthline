# Hearthline

Hearthline is a calm, responsive household coordinator for two adults. It keeps Today, one shared Plan, essential pet care, and useful home facts in one installable web app. Quick Add is available everywhere.

## Live architecture

- **Frontend:** React + Vite, published by GitHub Actions to GitHub Pages
- **Shared service:** Cloudflare Worker at `https://hearthline-api.cskeeley.workers.dev`
- **Data:** private Cloudflare D1 database
- **Accounts:** exactly one household with a maximum of two permanent accounts
- **Sync:** section versions prevent stale saves from replacing newer changes; the app shows Saved, Saving, Offline—changes waiting, or Needs attention

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

Run the automated conflict and reconciliation checks with:

```sh
npm test
```

The single test command covers the two-account limit, session cleanup, section-version conflicts, task creation and completion, recurrence, medication and routine confirmation, inbox migration, truthful text-only service records, install/update behavior, and critical mobile layout rules.

The frontend reads `VITE_API_URL`. For local full-stack development, place the local Worker URL in `.env.local`, put a test `SETUP_TOKEN` in `.dev.vars`, apply the local D1 migration, and run `npm run worker:dev` alongside Vite. Signed-in browsers keep the session plus deliberately queued offline changes; signing out clears both and removes any legacy household cache.

## Deploy

Pushes to `main` publish the frontend through `.github/workflows/deploy-pages.yml`. The Cloudflare Worker and D1 configuration live in `wrangler.jsonc`, `worker/`, and `migrations/`.

```sh
npm run db:migrate:remote
npm run worker:deploy
```

The production `SETUP_TOKEN` is stored as an encrypted Cloudflare Worker secret and is never committed to this repository.

## Install, updates, and recovery

- On iPhone or iPad, open Hearthline in Safari and choose **Share → Add to Home Screen**.
- On supported Android and desktop browsers, choose **Install app** from Hearthline Settings or the browser menu.
- The service worker keeps the last opened app shell available offline. Household changes made offline remain queued on that device until synchronization succeeds.
- When a new version is ready, Hearthline shows a refresh action rather than replacing the running app mid-edit.
- **Settings → Export household** downloads a readable JSON backup of the current household state.
- Signing out clears the session, cached household state, and queued changes from that browser. Do not sign out while offline changes still need to synchronize.
- A **Needs attention** state means both people changed the same information. Review the current screen before choosing which version to keep.

## Two-week scope review

Settings contains a shared two-week checklist for recording which core functions were used, which were ignored, repeated missing actions, friction in the daily loop, and at most one next experiment. Shopping remains deliberately unimplemented until both household members record a repeated need for it.

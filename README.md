# Wesomo Child Cancer Foundation Admin Dashboard

A Vercel-hosted admin dashboard that uses Firebase for authentication and Firestore data storage.

## What this includes

- **Audit Reports page** that calls report APIs used by the admin frontend:
  - `POST /reportsSummary`
  - `POST /reportsFundUse`
  - `POST /reportsBeneficiaries`
  - `POST /reportsExport`
- **Firebase Cloud Functions backend** for report APIs:
  - `reportsSummary`
  - `reportsFundUse`
  - `reportsBeneficiaries`
  - `reportsExport`
- **GitHub Actions workflow** (`.github/workflows/deploy-functions.yml`) to deploy Cloud Functions on push to `main` (or manually).
- Report API requests send `Authorization: Bearer <firebase-id-token>`.
- Endpoint paths are configurable from frontend globals and default to:
  - `/reportsSummary`
  - `/reportsFundUse`
  - `/reportsBeneficiaries`
  - `/reportsExport`
- **Clients page** to save/edit/delete client records (`name`, `email`, `phone`, `notes`).
- **Bulk SMS page** to draft campaigns for later Hubtel backend integration.
- **Data Manager page** to browse/edit Firestore collections:
  - `donations`
  - `adminAuditLogs`
  - `adminRecords`
  - `beneficiaryActivities`
  - `beneficiaries`
  - `disbursements`
  - `clients`
  - `bulkSmsCampaigns`
- Top-bar authentication controls (sign in/create trial user/sign out), without a dedicated auth page.
- All dashboard content is hidden until an authenticated user signs in.
- Testing-first Firestore rules: any authenticated user can read/write.

## Setup

1. Put real Firebase web config values in `public/firebase-config.js`.
2. Deploy frontend to Vercel from the project root:

   ```bash
   vercel login
   vercel
   vercel --prod
   ```

3. Deploy Firestore rules separately with Firebase CLI (backend only):

   ```bash
   firebase login
   firebase use --add
   firebase deploy --only "firestore:rules"
   ```

## PowerShell notes

- In PowerShell, keep comma-separated `--only` values in quotes, e.g. `--only "hosting,firestore"`.
- For this repo, avoid unscoped `firebase deploy` (that can deploy all configured Firebase resources).
- Use `firebase deploy --only "firestore:rules"` for rules-only updates, or `firebase deploy --only functions` for the report APIs.

## Notes

- Frontend hosting is expected on Vercel (`vercel.json` sets `public/` as output).
- Firebase is used for Auth + Firestore backend access.
- This setup is intentionally permissive for testing.
- Before production, tighten `firestore.rules` and disable open trial account creation from UI.


## GitHub deployment for functions

1. Add repository secrets:
   - `FIREBASE_SERVICE_ACCOUNT`: JSON for a Firebase service account with Cloud Functions deploy access.
   - `FIREBASE_PROJECT_ID`: Firebase project ID.
2. Push to `main` (or run the workflow manually).
3. Workflow deploys with `firebase deploy --only functions`.

## Local functions deploy

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

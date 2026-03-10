# Wesomo Child Cancer Foundation Admin Dashboard

A Vercel-hosted admin dashboard that uses Firebase for authentication and Firestore data storage.

## What this includes

- **Audit Reports page** that calls report APIs used by the admin frontend:
  - `POST /reportsSummary`
  - `POST /reportsFundUse`
  - `POST /reportsBeneficiaries`
  - `POST /reportsExport`
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
- For this repo, **do not** run `firebase deploy` (that can deploy all configured Firebase resources).
- Use only `firebase deploy --only "firestore:rules"` unless you intentionally add other Firebase products.

## Notes

- Frontend hosting is expected on Vercel (`vercel.json` sets `public/` as output).
- Firebase is used for Auth + Firestore backend access.
- This setup is intentionally permissive for testing.
- Before production, tighten `firestore.rules` and disable open trial account creation from UI.

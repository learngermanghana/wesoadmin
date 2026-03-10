# Wesomo Child Cancer Foundation Admin Dashboard

A Vercel-hosted admin dashboard for auditing, client management, outreach workflows, and Firestore data operations.

## What this includes

- **Audit Reports page** that calls report APIs used by the admin frontend:
  - `POST /api/reportsSummary`
  - `POST /api/reportsFundUse`
  - `POST /api/reportsBeneficiaries`
  - `POST /api/reportsExport`
- Report API requests send `Authorization: Bearer <firebase-id-token>`.
- Endpoint paths are configurable from frontend globals:
  - `window.WESO_REPORTS_BASE_URL` (optional base URL)
  - `window.WESO_REPORTS_SUMMARY_PATH`
  - `window.WESO_REPORTS_FUND_USE_PATH`
  - `window.WESO_REPORTS_BENEFICIARIES_PATH`
  - `window.WESO_REPORTS_EXPORT_PATH`
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

## Frontend setup

1. Put real Firebase web config values in `public/firebase-config.js`.
2. Deploy frontend to Vercel.

## Backend deployment options

### Option A: Vercel API routes (fastest for one platform)

- Create Vercel API routes under `/api`:
  - `/api/reportsSummary`
  - `/api/reportsFundUse`
  - `/api/reportsBeneficiaries`
  - `/api/reportsExport`
- Store backend secrets in Vercel environment variables (`Project Settings -> Environment Variables`).
- Keep default frontend endpoint config (already points to `/api/...`).

### Option B: Firebase Cloud Functions

1. Add a `functions/` backend in this repo (or another backend repo) with handlers for:
   - `reportsSummary`
   - `reportsFundUse`
   - `reportsBeneficiaries`
   - `reportsExport`
2. Deploy functions:

   ```bash
   firebase login
   firebase use wesoamochildcancer
   firebase deploy --only functions
   ```

3. Point frontend to Cloud Functions URL by setting, before `app.js` loads:

   ```html
   <script>
     window.WESO_REPORTS_BASE_URL = "https://<region>-<project>.cloudfunctions.net";
     window.WESO_REPORTS_SUMMARY_PATH = "/reportsSummary";
     window.WESO_REPORTS_FUND_USE_PATH = "/reportsFundUse";
     window.WESO_REPORTS_BENEFICIARIES_PATH = "/reportsBeneficiaries";
     window.WESO_REPORTS_EXPORT_PATH = "/reportsExport";
   </script>
   ```

## Notes

- Firestore rules in this repository are currently testing-oriented.
- Before production, tighten `firestore.rules` and disable open trial account creation from UI.

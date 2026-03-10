# Wesomo Child Cancer Foundation Admin Dashboard

A Firebase Hosting admin dashboard for testing operations, auditing, client management, and outreach workflows.

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
2. Ensure Firebase CLI is logged in:

   ```bash
   firebase login
   ```

3. Deploy Hosting + Firestore rules:

   ```bash
   firebase deploy
   ```

## Notes

- This setup is intentionally permissive for testing.
- Before production, tighten `firestore.rules` and disable open trial account creation from UI.

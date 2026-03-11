import { onRequest, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { normalizeFilters } from "./report-helpers.js";

initializeApp();

const db = getFirestore();

async function verifyBearerToken(req) {
  const authHeader = req.get("authorization") || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new HttpsError("unauthenticated", "Missing Authorization: Bearer <token> header.");
  }

  return getAuth().verifyIdToken(token);
}

function withCorsAndErrors(handler) {
  return onRequest({ cors: true, region: "us-central1" }, async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed. Use POST." });
      return;
    }

    try {
      const decodedToken = await verifyBearerToken(req);
      const filters = normalizeFilters(req.body || {});
      const payload = await handler(filters, decodedToken);
      res.status(200).json(payload);
    } catch (error) {
      logger.error("Report function request failed", error);

      if (error instanceof HttpsError) {
        const status = error.code === "unauthenticated" ? 401 : 400;
        res.status(status).json({ error: error.message, code: error.code });
        return;
      }

      res.status(500).json({ error: "Unexpected server error." });
    }
  });
}

async function loadDisbursements(filters) {
  let query = db
    .collection("disbursements")
    .where("createdAt", ">=", filters.start)
    .where("createdAt", "<=", filters.end);

  if (filters.program) {
    query = query.where("program", "==", filters.program);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function sumMoney(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function buildSummary(filters, disbursements) {
  const totalDisbursed = sumMoney(disbursements, "amount");
  const uniqueBeneficiaries = new Set(disbursements.map((item) => item.beneficiaryId).filter(Boolean));

  return {
    range: { startDate: filters.startDate, endDate: filters.endDate, program: filters.program },
    totals: {
      disbursementCount: disbursements.length,
      totalDisbursed,
      beneficiaryCount: uniqueBeneficiaries.size
    }
  };
}

function buildFundUse(filters, disbursements) {
  const byProgram = disbursements.reduce((acc, item) => {
    const program = item.program || "unknown";
    const amount = Number(item.amount || 0);
    acc[program] = (acc[program] || 0) + amount;
    return acc;
  }, {});

  return {
    range: { startDate: filters.startDate, endDate: filters.endDate, program: filters.program },
    totals: byProgram,
    grandTotal: sumMoney(disbursements, "amount")
  };
}

function buildBeneficiaries(filters, disbursements) {
  const byBeneficiary = disbursements.reduce((acc, item) => {
    const beneficiaryId = item.beneficiaryId || "unknown";
    const amount = Number(item.amount || 0);

    if (!acc[beneficiaryId]) {
      acc[beneficiaryId] = { beneficiaryId, totalAmount: 0, disbursementCount: 0 };
    }

    acc[beneficiaryId].totalAmount += amount;
    acc[beneficiaryId].disbursementCount += 1;
    return acc;
  }, {});

  return {
    range: { startDate: filters.startDate, endDate: filters.endDate, program: filters.program },
    beneficiaries: Object.values(byBeneficiary)
  };
}

function withMeta(payload, auth) {
  return {
    ...payload,
    generatedAt: new Date().toISOString(),
    generatedBy: auth.email || auth.uid
  };
}

export const reportsSummary = withCorsAndErrors(async (filters, auth) => {
  const disbursements = await loadDisbursements(filters);
  return withMeta(buildSummary(filters, disbursements), auth);
});

export const reportsFundUse = withCorsAndErrors(async (filters, auth) => {
  const disbursements = await loadDisbursements(filters);
  return withMeta(buildFundUse(filters, disbursements), auth);
});

export const reportsBeneficiaries = withCorsAndErrors(async (filters, auth) => {
  const disbursements = await loadDisbursements(filters);
  return withMeta(buildBeneficiaries(filters, disbursements), auth);
});

export const reportsExport = withCorsAndErrors(async (filters, auth) => {
  const disbursements = await loadDisbursements(filters);

  return withMeta(
    {
      exportVersion: 1,
      range: { startDate: filters.startDate, endDate: filters.endDate, program: filters.program },
      summary: buildSummary(filters, disbursements),
      fundUse: buildFundUse(filters, disbursements),
      beneficiaries: buildBeneficiaries(filters, disbursements)
    },
    auth
  );
});

export const smsDeliveryWebhook = onRequest({ cors: true, region: "us-central1" }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const { campaignId, status, failureReason, providerMessageId, costGhs } = req.body || {};
  if (!campaignId || !status) {
    res.status(400).json({ error: "campaignId and status are required." });
    return;
  }

  await db.collection("bulkSmsCampaigns").doc(String(campaignId)).set(
    {
      deliveryStatus: status,
      failureReason: failureReason || null,
      providerMessageId: providerMessageId || null,
      costGhs: Number(costGhs || 0),
      callbackAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  await db.collection("adminAuditLogs").add({
    type: "sms_delivery_webhook",
    at: new Date().toISOString(),
    meta: { campaignId, status, failureReason, providerMessageId }
  });

  res.status(200).json({ ok: true });
});

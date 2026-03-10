import { onRequest, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

initializeApp();

const db = getFirestore();

function normalizeFilters(payload = {}) {
  const { startDate, endDate, program } = payload;
  if (!startDate || !endDate) {
    throw new HttpsError("invalid-argument", "startDate and endDate are required.");
  }

  const start = Timestamp.fromDate(new Date(`${startDate}T00:00:00.000Z`));
  const end = Timestamp.fromDate(new Date(`${endDate}T23:59:59.999Z`));

  if (Number.isNaN(start.toMillis()) || Number.isNaN(end.toMillis())) {
    throw new HttpsError("invalid-argument", "Invalid startDate or endDate.");
  }

  if (end.toMillis() < start.toMillis()) {
    throw new HttpsError("invalid-argument", "endDate cannot be before startDate.");
  }

  return {
    start,
    end,
    startDate,
    endDate,
    program: typeof program === "string" && program.trim() ? program.trim() : null
  };
}

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

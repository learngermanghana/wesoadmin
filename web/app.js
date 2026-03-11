import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  validateClient,
  dedupeRecipients,
  paginate,
  toCsv,
  parseCsv,
  createSimplePdfBlob,
  CLIENT_CONSTRAINTS
} from "./src/components/utils.js";
import { resolveReportEndpoints } from "./api/report-endpoints.js";
import { bindPageRoutes, switchPage } from "./src/routes/index.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ENV = window.WESO_ENV || "dev";
const BASE = window.WESO_API_BASE || "";
const REPORT_ENDPOINTS = resolveReportEndpoints({
  env: ENV,
  base: BASE,
  overrides: {
    summary: window.WESO_REPORTS_SUMMARY_PATH,
    fundUse: window.WESO_REPORTS_FUND_USE_PATH,
    beneficiaries: window.WESO_REPORTS_BENEFICIARIES_PATH,
    export: window.WESO_REPORTS_EXPORT_PATH
  }
});

const $ = (id) => document.getElementById(id);
const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const pages = Array.from(document.querySelectorAll(".page"));
const authForm = $("auth-form");
const emailInput = $("email");
const passwordInput = $("password");
const createUserBtn = $("create-user-btn");
const signOutBtn = $("sign-out-btn");
const authStatus = $("auth-status");
const authGate = $("auth-gate");
const adminShell = $("admin-shell");
const toast = $("toast");
const reportsForm = $("reports-form");
const runReportsBtn = $("run-reports-btn");
const exportReportsBtn = $("export-reports-btn");
const reportStartDateInput = $("report-start-date");
const reportEndDateInput = $("report-end-date");
const reportProgramInput = $("report-program");
const reportPresetSelect = $("report-preset");
const savePresetBtn = $("save-preset-btn");
const rerunPresetBtn = $("rerun-preset-btn");
const downloadCsvBtn = $("download-report-csv-btn");
const downloadPdfBtn = $("download-report-pdf-btn");
const reportsSummary = $("reports-summary");
const reportsFundUse = $("reports-fund-use");
const reportsBeneficiaries = $("reports-beneficiaries");
const reportsExport = $("reports-export");
const disbursementTrendChart = $("disbursement-trend-chart");
const beneficiaryGrowthChart = $("beneficiary-growth-chart");
const scheduleForm = $("schedule-form");
const scheduleNameInput = $("schedule-name");
const scheduleFrequencyInput = $("schedule-frequency");
const scheduleChannelInput = $("schedule-channel");
const scheduleDestinationInput = $("schedule-destination");
const saveScheduleBtn = $("save-schedule-btn");
const scheduleList = $("schedule-list");
const healthDashboard = $("health-dashboard");
const clientForm = $("client-form");
const clientIdInput = $("client-id");
const clientNameInput = $("client-name");
const clientEmailInput = $("client-email");
const clientPhoneInput = $("client-phone");
const clientNotesInput = $("client-notes");
const clientOptOutInput = $("client-optout");
const saveClientBtn = $("save-client-btn");
const clearClientBtn = $("clear-client-btn");
const loadClientsBtn = $("load-clients-btn");
const clientSearchInput = $("client-search");
const clientFilterSelect = $("client-filter");
const clientPrevBtn = $("client-prev-page");
const clientNextBtn = $("client-next-page");
const clientPageInfo = $("client-page-info");
const clientsList = $("clients-list");
const clientImportPreview = $("client-import-preview");
const confirmClientImportBtn = $("confirm-client-import-btn");
const smsForm = $("sms-form");
const campaignNameInput = $("campaign-name");
const smsMessageInput = $("sms-message");
const recipientSource = $("recipient-source");
const recipientSegment = $("recipient-segment");
const segmentProgramInput = $("segment-program");
const quietHoursInput = $("quiet-hours");
const manualNumbersWrap = $("manual-numbers-wrap");
const manualNumbersInput = $("manual-numbers");
const previewRecipientsBtn = $("preview-recipients-btn");
const saveCampaignBtn = $("save-campaign-btn");
const smsRecipientPreview = $("sms-recipient-preview");
const campaignsList = $("campaigns-list");
const campaignAnalytics = $("campaign-analytics");
const collectionSelect = $("collection-select");
const loadBtn = $("load-btn");
const docsList = $("docs-list");
const docForm = $("doc-form");
const docIdInput = $("doc-id");
const docJsonInput = $("doc-json");
const saveBtn = $("save-btn");
const clearBtn = $("clear-btn");
const dataSearchInput = $("data-search");
const dataFilterSelect = $("data-filter");
const dataPrevBtn = $("data-prev-page");
const dataNextBtn = $("data-next-page");
const dataPageInfo = $("data-page-info");
const exportClientsBtn = $("export-clients-btn");
const importClientsInput = $("import-clients-input");
const exportDisbursementsBtn = $("export-disbursements-btn");
const importDisbursementsInput = $("import-disbursements-input");
const disbursementImportPreview = $("disbursement-import-preview");
const confirmDisbursementImportBtn = $("confirm-disbursement-import-btn");

let currentUser = null;
let clientsCache = [];
let docsCache = [];
let campaignsCache = [];
let clientPage = 1;
let dataPage = 1;
let lastExportPayload = null;
let pendingClientImport = [];
let pendingDisbursementImport = [];

if (window.Sentry && window.WESO_SENTRY_DSN) {
  window.Sentry.init({ dsn: window.WESO_SENTRY_DSN, environment: ENV });
}
window.addEventListener("error", (event) => {
  if (window.Sentry?.captureException) window.Sentry.captureException(event.error || new Error(event.message));
});

const showMessage = (message) => (authStatus.textContent = message);
const pretty = (value) => JSON.stringify(value, null, 2);
function toastMessage(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2500);
}
function setLoading(btn, loading, idleText, busyText = "Loading...") {
  if (!btn) return;
  btn.disabled = loading || btn.disabled;
  btn.dataset.idle = idleText;
  btn.textContent = loading ? busyText : idleText;
}
function downloadBlob(filename, blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
function downloadFile(filename, text, type = "text/plain") {
  downloadBlob(filename, new Blob([text], { type }));
}

async function logEvent(type, meta = {}) {
  const payload = { type, meta, at: new Date().toISOString(), user: currentUser?.email || "anonymous" };
  console.log("WESO_LOG", payload);
  if (window.Sentry?.addBreadcrumb) window.Sentry.addBreadcrumb({ category: "admin-action", message: type, level: "info", data: meta });
  if (!currentUser) return;
  try {
    await addDoc(collection(db, "adminAuditLogs"), payload);
  } catch (_) {
    // no-op
  }
}

function setViewVisibility(signedIn) {
  authGate.classList.toggle("hidden", signedIn);
  adminShell.classList.toggle("hidden-by-auth", !signedIn);
}
function setSignedInState(signedIn) {
  [
    signOutBtn,
    saveBtn,
    loadBtn,
    collectionSelect,
    saveClientBtn,
    loadClientsBtn,
    previewRecipientsBtn,
    saveCampaignBtn,
    runReportsBtn,
    exportReportsBtn,
    savePresetBtn,
    rerunPresetBtn,
    downloadCsvBtn,
    downloadPdfBtn,
    exportClientsBtn,
    exportDisbursementsBtn,
    saveScheduleBtn
  ].forEach((el) => {
    if (el) el.disabled = !signedIn;
  });
}

function setUrlState() {
  const params = new URLSearchParams(window.location.search);
  params.set("clientSearch", clientSearchInput.value);
  params.set("clientFilter", clientFilterSelect.value);
  params.set("dataSearch", dataSearchInput.value);
  params.set("dataFilter", dataFilterSelect.value);
  window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
}
function loadUrlState() {
  const params = new URLSearchParams(window.location.search);
  clientSearchInput.value = params.get("clientSearch") || "";
  clientFilterSelect.value = params.get("clientFilter") || "all";
  dataSearchInput.value = params.get("dataSearch") || "";
  dataFilterSelect.value = params.get("dataFilter") || "all";
}

bindPageRoutes(tabButtons, pages);
loadUrlState();

async function callReportEndpoint(path, payload) {
  if (!currentUser) throw new Error("Sign in first.");
  const token = await currentUser.getIdToken();
  await logEvent("report_api_call", { path, payload });
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error((await response.text()) || `Request failed: ${response.status}`);
  return response.json();
}
function getReportFilters() {
  const startDate = reportStartDateInput.value;
  const endDate = reportEndDateInput.value;
  const program = reportProgramInput.value.trim();
  if (!startDate || !endDate) throw new Error("Please select both start and end dates.");
  return { startDate, endDate, ...(program ? { program } : {}) };
}

function drawSimpleChart(canvas, title, points, color = "#0b5aa9") {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.font = "16px sans-serif";
  ctx.fillText(title, 16, 24);
  if (!points.length) {
    ctx.fillStyle = "#64748b";
    ctx.fillText("No data.", 16, 48);
    return;
  }
  const max = Math.max(...points.map((p) => p.value), 1);
  const innerW = canvas.width - 80;
  const innerH = canvas.height - 80;
  ctx.strokeStyle = "#e2e8f0";
  ctx.strokeRect(40, 40, innerW, innerH);

  ctx.strokeStyle = color;
  ctx.beginPath();
  points.forEach((point, idx) => {
    const x = 40 + (idx / Math.max(1, points.length - 1)) * innerW;
    const y = 40 + innerH - (point.value / max) * innerH;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    ctx.fillStyle = "#334155";
    ctx.font = "10px sans-serif";
    ctx.fillText(point.label.slice(0, 8), x - 14, canvas.height - 20);
  });
  ctx.stroke();
}

function buildDisbursementTrend(payload) {
  const raw = payload?.beneficiaries?.beneficiaries || [];
  return raw.slice(0, 12).map((item, idx) => ({ label: `B${idx + 1}`, value: Number(item.totalAmount || 0) }));
}

function buildBeneficiaryGrowth(summary, beneficiaries) {
  const total = Number(summary?.totals?.beneficiaryCount || 0);
  const rows = beneficiaries?.beneficiaries || [];
  const values = rows.slice(0, 12).map((item, idx) => ({ label: `T${idx + 1}`, value: item.disbursementCount }));
  values.unshift({ label: "Total", value: total });
  return values;
}

async function runReports() {
  setLoading(runReportsBtn, true, "Run Reports", "Running...");
  try {
    const filters = getReportFilters();
    const [summaryData, fundUseData, beneficiariesData] = await Promise.all([
      callReportEndpoint(REPORT_ENDPOINTS.summary, filters),
      callReportEndpoint(REPORT_ENDPOINTS.fundUse, filters),
      callReportEndpoint(REPORT_ENDPOINTS.beneficiaries, filters)
    ]);
    reportsSummary.textContent = pretty(summaryData);
    reportsFundUse.textContent = pretty(fundUseData);
    reportsBeneficiaries.textContent = pretty(beneficiariesData);
    drawSimpleChart(disbursementTrendChart, "Disbursement Trend", buildDisbursementTrend({ beneficiaries: beneficiariesData }));
    drawSimpleChart(beneficiaryGrowthChart, "Beneficiary Growth", buildBeneficiaryGrowth(summaryData, beneficiariesData), "#0f766e");
    await loadHealthMetrics();
    toastMessage("Reports updated.");
  } finally {
    setLoading(runReportsBtn, false, "Run Reports");
    runReportsBtn.disabled = !currentUser;
  }
}
async function buildExportPayload() {
  const filters = getReportFilters();
  lastExportPayload = await callReportEndpoint(REPORT_ENDPOINTS.export, filters);
  reportsExport.textContent = pretty(lastExportPayload);
}

function renderSchedules() {
  const schedules = JSON.parse(localStorage.getItem("wesoReportSchedules") || "[]");
  scheduleList.innerHTML = schedules.length
    ? schedules.map((s, idx) => `<div class="doc-item"><strong>${s.name}</strong><p>${s.frequency} -> ${s.channel}: ${s.destination}</p><button data-schedule-delete="${idx}" class="danger">Delete</button></div>`).join("")
    : "<p class=\"hint\">No schedules configured yet.</p>";
  scheduleList.querySelectorAll("button[data-schedule-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const list = JSON.parse(localStorage.getItem("wesoReportSchedules") || "[]");
      list.splice(Number(btn.dataset.scheduleDelete), 1);
      localStorage.setItem("wesoReportSchedules", JSON.stringify(list));
      renderSchedules();
    });
  });
}

function renderClients() {
  const queryText = clientSearchInput.value.trim().toLowerCase();
  const filter = clientFilterSelect.value;
  const filtered = clientsCache.filter((c) => {
    const matchesSearch = !queryText || [c.name, c.email, c.phone, c.notes].some((v) => (v || "").toLowerCase().includes(queryText));
    const matchesFilter = filter === "all" || (filter === "active" ? !c.isDeleted : !!c.isDeleted);
    return matchesSearch && matchesFilter;
  });
  const page = paginate(filtered, clientPage, 5);
  clientPage = page.page;
  clientPageInfo.textContent = `Page ${page.page}/${page.pageCount} (${page.total})`;
  clientsList.innerHTML = page.items.length ? "" : "<p>No clients found.</p>";
  page.items.forEach((client) => {
    const item = document.createElement("div");
    item.className = "doc-item";
    item.innerHTML = `<h3>${client.name || "Unnamed Client"} ${client.isDeleted ? "(Archived)" : ""}</h3><p><strong>Email:</strong> ${client.email || "-"}</p><p><strong>Phone:</strong> ${client.phone || "-"}</p><p><strong>Opt-out:</strong> ${client.optOutSms ? "Yes" : "No"}</p>`;
    const actions = document.createElement("div");
    actions.className = "doc-actions";
    const editBtn = Object.assign(document.createElement("button"), { className: "secondary", textContent: "Edit" });
    editBtn.onclick = () => {
      clientIdInput.value = client.id;
      clientNameInput.value = client.name || "";
      clientEmailInput.value = client.email || "";
      clientPhoneInput.value = client.phone || "";
      clientNotesInput.value = client.notes || "";
      clientOptOutInput.checked = !!client.optOutSms;
    };
    const deleteBtn = Object.assign(document.createElement("button"), { className: client.isDeleted ? "secondary" : "danger", textContent: client.isDeleted ? "Restore" : "Archive" });
    deleteBtn.onclick = async () => {
      if (!confirm(`${client.isDeleted ? "Restore" : "Archive"} this client?`)) return;
      await setDoc(
        doc(db, "clients", client.id),
        {
          isDeleted: !client.isDeleted,
          deletedAt: !client.isDeleted ? serverTimestamp() : null,
          deletedBy: !client.isDeleted ? (currentUser.email || currentUser.uid) : null,
          restoredAt: client.isDeleted ? serverTimestamp() : null
        },
        { merge: true }
      );
      await loadClients();
    };
    actions.append(editBtn, deleteBtn);
    item.append(actions);
    clientsList.append(item);
  });
}

async function loadClients() {
  if (!currentUser) return;
  const snapshot = await getDocs(collection(db, "clients"));
  clientsCache = [];
  snapshot.forEach((snap) => clientsCache.push({ id: snap.id, ...snap.data() }));
  renderClients();
}

function renderDocs() {
  const queryText = dataSearchInput.value.trim().toLowerCase();
  const filter = dataFilterSelect.value;
  const filtered = docsCache.filter((d) => {
    const text = JSON.stringify(d).toLowerCase();
    const matchesSearch = !queryText || text.includes(queryText);
    const matchesFilter = filter === "all" || (filter === "active" ? !d.isDeleted : !!d.isDeleted);
    return matchesSearch && matchesFilter;
  });
  const page = paginate(filtered, dataPage, 5);
  dataPage = page.page;
  dataPageInfo.textContent = `Page ${page.page}/${page.pageCount} (${page.total})`;
  docsList.innerHTML = page.items.length ? "" : "<p>No documents found. Use Load Data after choosing a collection.</p>";
  page.items.forEach((d) => {
    const wrapper = document.createElement("div");
    wrapper.className = "doc-item";
    wrapper.innerHTML = `<h3>${d.id} ${d.isDeleted ? "(Archived)" : ""}</h3><pre>${pretty(d)}</pre>`;
    const actions = document.createElement("div");
    actions.className = "doc-actions";
    const editBtn = Object.assign(document.createElement("button"), { textContent: "Edit", className: "secondary" });
    editBtn.onclick = () => {
      docIdInput.value = d.id;
      const { id, ...body } = d;
      docJsonInput.value = pretty(body);
      switchPage(tabButtons, pages, "data-page");
    };
    const deleteBtn = Object.assign(document.createElement("button"), { textContent: d.isDeleted ? "Restore" : "Archive", className: d.isDeleted ? "secondary" : "danger" });
    deleteBtn.onclick = async () => {
      if (!confirm(`${d.isDeleted ? "Restore" : "Archive"} this document?`)) return;
      await setDoc(
        doc(db, collectionSelect.value, d.id),
        { isDeleted: !d.isDeleted, deletedAt: !d.isDeleted ? serverTimestamp() : null, deletedBy: !d.isDeleted ? (currentUser.email || currentUser.uid) : null },
        { merge: true }
      );
      await loadDocuments();
    };
    actions.append(editBtn, deleteBtn);
    wrapper.append(actions);
    docsList.append(wrapper);
  });
}

async function loadDocuments() {
  if (!currentUser) return;
  setLoading(loadBtn, true, "Load Data", "Loading...");
  try {
    const querySnapshot = await getDocs(collection(db, collectionSelect.value));
    docsCache = [];
    querySnapshot.forEach((snap) => docsCache.push({ id: snap.id, ...snap.data() }));
    renderDocs();
    toastMessage("Collection loaded.");
  } finally {
    setLoading(loadBtn, false, "Load Data");
    loadBtn.disabled = !currentUser;
  }
}

function getManualRecipients() {
  return manualNumbersInput.value.split(",").map((v) => v.trim()).filter(Boolean);
}
async function getClientRecipientsWithOptOut() {
  const segment = recipientSegment.value;
  const segmentProgram = segmentProgramInput.value.trim();
  const sourceQuery = segment === "active" ? query(collection(db, "clients"), where("isDeleted", "!=", true)) : collection(db, "clients");
  const snapshot = await getDocs(sourceQuery);
  const recipients = [];
  const optOut = new Set();
  snapshot.forEach((snap) => {
    const d = snap.data();
    if (segment === "program" && segmentProgram && d.program !== segmentProgram) return;
    if (!d.phone) return;
    const normalized = String(d.phone).trim();
    recipients.push(normalized);
    if (d.optOutSms) optOut.add(normalized);
  });
  return { recipients, optOut };
}

function renderCampaigns() {
  campaignsList.innerHTML = campaignsCache.length ? "" : "<p>No campaigns yet.</p>";
  const analytics = { total: campaignsCache.length, queued: 0, sent: 0, failed: 0, cost: 0 };
  campaignsCache.forEach((campaign) => {
    analytics[campaign.deliveryStatus || "queued"] = (analytics[campaign.deliveryStatus || "queued"] || 0) + 1;
    analytics.cost += Number(campaign.costGhs || 0);
    const item = document.createElement("div");
    item.className = "doc-item";
    item.innerHTML = `<h3>${campaign.campaignName || campaign.id} ${campaign.isDeleted ? "(Archived)" : ""}</h3><p>Status: ${campaign.deliveryStatus || "queued"}</p><p>Recipients: ${campaign.recipientCount || 0}</p><p>Failures: ${campaign.failureReason || "-"}</p>`;
    const actions = document.createElement("div");
    actions.className = "doc-actions";
    const retryBtn = Object.assign(document.createElement("button"), { textContent: "Queue Retry", className: "secondary" });
    retryBtn.onclick = async () => {
      const retries = Number(campaign.retryCount || 0);
      if (retries >= 3) return toastMessage("Retry cap reached (3).");
      await setDoc(doc(db, "bulkSmsCampaigns", campaign.id), { retryQueued: true, retryQueuedAt: serverTimestamp(), retryCount: retries + 1, deliveryStatus: "queued" }, { merge: true });
      await logEvent("sms_retry_queued", { campaignId: campaign.id, retryCount: retries + 1 });
      await loadCampaigns();
    };
    const callbackBtn = Object.assign(document.createElement("button"), { textContent: "Mark Delivered", className: "secondary" });
    callbackBtn.onclick = async () => {
      await setDoc(doc(db, "bulkSmsCampaigns", campaign.id), { deliveryStatus: "sent", callbackAt: serverTimestamp() }, { merge: true });
      await logEvent("sms_delivery_callback", { campaignId: campaign.id, status: "sent" });
      await loadCampaigns();
    };
    const failBtn = Object.assign(document.createElement("button"), { textContent: "Mark Failed", className: "secondary" });
    failBtn.onclick = async () => {
      const reason = prompt("Failure reason (invalid_number/carrier_error/other)?") || "other";
      await setDoc(doc(db, "bulkSmsCampaigns", campaign.id), { deliveryStatus: "failed", failureReason: reason, callbackAt: serverTimestamp() }, { merge: true });
      await loadCampaigns();
    };
    const deleteBtn = Object.assign(document.createElement("button"), { textContent: campaign.isDeleted ? "Restore" : "Archive", className: campaign.isDeleted ? "secondary" : "danger" });
    deleteBtn.onclick = async () => {
      if (!confirm(`${campaign.isDeleted ? "Restore" : "Archive"} campaign?`)) return;
      await setDoc(doc(db, "bulkSmsCampaigns", campaign.id), { isDeleted: !campaign.isDeleted, deletedAt: !campaign.isDeleted ? serverTimestamp() : null }, { merge: true });
      await loadCampaigns();
    };
    actions.append(retryBtn, callbackBtn, failBtn, deleteBtn);
    item.append(actions);
    campaignsList.append(item);
  });
  campaignAnalytics.textContent = `Campaigns: ${analytics.total} | Queued: ${analytics.queued || 0} | Sent: ${analytics.sent || 0} | Failed: ${analytics.failed || 0} | Cost (GHS): ${analytics.cost.toFixed(2)}`;
}

async function loadCampaigns() {
  const snapshot = await getDocs(collection(db, "bulkSmsCampaigns"));
  campaignsCache = [];
  snapshot.forEach((snap) => campaignsCache.push({ id: snap.id, ...snap.data() }));
  renderCampaigns();
}

function validateClientImportRecord(record) {
  const validationErrors = validateClient(record);
  return validationErrors;
}

async function prepareImport(file, collectionName) {
  const text = await file.text();
  const parsed = parseCsv(text);
  if (!parsed.headers.length) throw new Error("CSV has no headers.");
  const required = collectionName === "clients" ? ["name", "email", "phone"] : ["beneficiaryId", "amount", "program"];
  const missing = required.filter((field) => !parsed.headers.includes(field));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);

  const existingByEmail = new Map(clientsCache.map((client) => [String(client.email || "").toLowerCase(), client]));
  const existingByPhone = new Map(clientsCache.map((client) => [String(client.phone || ""), client]));
  const rows = parsed.records.map(({ rowNumber, record }) => {
    const errors = collectionName === "clients" ? validateClientImportRecord(record) : [];
    const duplicate = collectionName === "clients" ? existingByEmail.get(String(record.email || "").toLowerCase()) || existingByPhone.get(String(record.phone || "")) : null;
    return { rowNumber, record, errors, duplicateId: duplicate?.id || null };
  });
  return rows;
}

async function commitImport(rows, collectionName, filename) {
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    if (row.errors.length) {
      skipped += 1;
      continue;
    }
    const payload = { ...row.record, updatedAt: serverTimestamp(), updatedBy: currentUser.email || currentUser.uid };
    if (collectionName === "clients" && row.duplicateId) {
      await setDoc(doc(db, "clients", row.duplicateId), payload, { merge: true });
      imported += 1;
      continue;
    }
    await addDoc(collection(db, collectionName), payload);
    imported += 1;
  }
  await addDoc(collection(db, "adminAuditLogs"), {
    type: "import_audit",
    fileName: filename,
    collectionName,
    imported,
    skipped,
    user: currentUser.email || currentUser.uid,
    at: new Date().toISOString()
  });
  return { imported, skipped };
}

async function loadHealthMetrics() {
  const logs = await getDocs(collection(db, "adminAuditLogs"));
  const reportRuns = logs.docs.filter((d) => d.data().type === "report_api_call").length;
  const activeUsers = new Set(logs.docs.map((d) => d.data().user)).size;
  const queueBacklog = campaignsCache.filter((c) => c.deliveryStatus === "queued").length;
  healthDashboard.textContent = `Daily active admins: ${activeUsers} | Report runs: ${reportRuns} | SMS queue backlog: ${queueBacklog}`;
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    showMessage("Signed in successfully.");
  } catch (err) {
    showMessage(`Sign in failed: ${err.message}`);
  }
});
createUserBtn.addEventListener("click", async () => {
  try {
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    showMessage("Trial user created and signed in.");
  } catch (err) {
    showMessage(`Create user failed: ${err.message}`);
  }
});
signOutBtn.addEventListener("click", async () => {
  await signOut(auth);
  docsList.innerHTML = "";
  clientsList.innerHTML = "";
  showMessage("Signed out.");
});
reportsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await runReports();
  } catch (error) {
    showMessage(`Report run failed: ${error.message}`);
  }
});
exportReportsBtn.addEventListener("click", async () => {
  try {
    await buildExportPayload();
  } catch (error) {
    showMessage(`Export payload failed: ${error.message}`);
  }
});
savePresetBtn.addEventListener("click", () => {
  const filters = getReportFilters();
  const presets = JSON.parse(localStorage.getItem("wesoReportPresets") || "[]");
  const name = prompt("Preset name?");
  if (!name) return;
  presets.push({ name, filters });
  localStorage.setItem("wesoReportPresets", JSON.stringify(presets));
  reportPresetSelect.innerHTML = '<option value="">Select preset</option>' + presets.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");
});
rerunPresetBtn.addEventListener("click", async () => {
  const presets = JSON.parse(localStorage.getItem("wesoReportPresets") || "[]");
  const preset = presets[Number(reportPresetSelect.value)];
  if (!preset) return;
  reportStartDateInput.value = preset.filters.startDate;
  reportEndDateInput.value = preset.filters.endDate;
  reportProgramInput.value = preset.filters.program || "";
  await runReports();
});
downloadCsvBtn.addEventListener("click", () => {
  if (!lastExportPayload) return showMessage("Generate export payload first.");
  const rows = Array.isArray(lastExportPayload) ? lastExportPayload : [lastExportPayload];
  downloadFile(`reports-export-${Date.now()}.csv`, toCsv(rows), "text/csv");
});
downloadPdfBtn.addEventListener("click", () => {
  if (!lastExportPayload) return showMessage("Generate export payload first.");
  const lines = pretty(lastExportPayload).split("\n");
  downloadBlob(`reports-export-${Date.now()}.pdf`, createSimplePdfBlob("Wesomo Report Export", lines));
});

scheduleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const schedules = JSON.parse(localStorage.getItem("wesoReportSchedules") || "[]");
  schedules.push({
    name: scheduleNameInput.value.trim(),
    frequency: scheduleFrequencyInput.value,
    channel: scheduleChannelInput.value,
    destination: scheduleDestinationInput.value.trim(),
    createdAt: new Date().toISOString()
  });
  localStorage.setItem("wesoReportSchedules", JSON.stringify(schedules));
  await logEvent("report_schedule_saved", schedules[schedules.length - 1]);
  scheduleForm.reset();
  renderSchedules();
  toastMessage("Schedule saved.");
});

loadBtn.addEventListener("click", async () => {
  try {
    await loadDocuments();
  } catch (err) {
    docsList.innerHTML = `<p>Could not load documents: ${err.message}</p>`;
  }
});

docForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  try {
    const parsed = JSON.parse(docJsonInput.value);
    const payload = { ...parsed, updatedAt: serverTimestamp(), updatedBy: { uid: currentUser.uid, email: currentUser.email } };
    if (docIdInput.value.trim()) await setDoc(doc(db, collectionSelect.value, docIdInput.value.trim()), payload, { merge: true });
    else await addDoc(collection(db, collectionSelect.value), { ...payload, createdAt: serverTimestamp(), createdBy: { uid: currentUser.uid, email: currentUser.email } });
    docIdInput.value = "";
    docJsonInput.value = "";
    await loadDocuments();
    showMessage("Document saved.");
  } catch (err) {
    showMessage(`Save failed: ${err.message}`);
  }
});
clearBtn.addEventListener("click", () => {
  docIdInput.value = "";
  docJsonInput.value = "";
});

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const payload = {
    name: clientNameInput.value.trim(),
    email: clientEmailInput.value.trim(),
    phone: clientPhoneInput.value.trim(),
    notes: clientNotesInput.value.trim(),
    optOutSms: clientOptOutInput.checked,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.email || currentUser.uid
  };
  const validationErrors = validateClient(payload);
  if (validationErrors.length) return showMessage(validationErrors.join(" "));
  try {
    if (clientIdInput.value.trim()) await setDoc(doc(db, "clients", clientIdInput.value.trim()), payload, { merge: true });
    else await addDoc(collection(db, "clients"), { ...payload, createdAt: serverTimestamp(), createdBy: currentUser.email || currentUser.uid });
    clientForm.reset();
    clientIdInput.value = "";
    await loadClients();
    showMessage("Client saved.");
  } catch (error) {
    showMessage(`Could not save client: ${error.message}`);
  }
});
clearClientBtn.addEventListener("click", () => {
  clientForm.reset();
  clientIdInput.value = "";
});
loadClientsBtn.addEventListener("click", async () => loadClients());
[clientSearchInput, clientFilterSelect].forEach((el) =>
  el.addEventListener("input", () => {
    clientPage = 1;
    renderClients();
    setUrlState();
  })
);
clientPrevBtn.addEventListener("click", () => {
  clientPage -= 1;
  renderClients();
});
clientNextBtn.addEventListener("click", () => {
  clientPage += 1;
  renderClients();
});
[dataSearchInput, dataFilterSelect].forEach((el) =>
  el.addEventListener("input", () => {
    dataPage = 1;
    renderDocs();
    setUrlState();
  })
);
dataPrevBtn.addEventListener("click", () => {
  dataPage -= 1;
  renderDocs();
});
dataNextBtn.addEventListener("click", () => {
  dataPage += 1;
  renderDocs();
});

recipientSource.addEventListener("change", () => {
  manualNumbersWrap.classList.toggle("hidden", recipientSource.value !== "manual");
  smsRecipientPreview.textContent = "";
});
previewRecipientsBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  const source = recipientSource.value === "manual" ? { recipients: getManualRecipients(), optOut: new Set() } : await getClientRecipientsWithOptOut();
  const deduped = dedupeRecipients(source.recipients, source.optOut);
  smsRecipientPreview.textContent = `Recipients: ${deduped.recipients.length} | Duplicates removed: ${deduped.duplicateCount} | Opt-outs removed: ${deduped.optOutCount}`;
});

smsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  try {
    if (smsMessageInput.value.trim().length > CLIENT_CONSTRAINTS.messageMax) throw new Error("SMS exceeds maximum length.");
    const source = recipientSource.value === "manual" ? { recipients: getManualRecipients(), optOut: new Set() } : await getClientRecipientsWithOptOut();
    const deduped = dedupeRecipients(source.recipients, source.optOut);
    await addDoc(collection(db, "bulkSmsCampaigns"), {
      campaignName: campaignNameInput.value.trim(),
      message: smsMessageInput.value.trim(),
      recipientSource: recipientSource.value,
      recipientCount: deduped.recipients.length,
      recipients: deduped.recipients,
      duplicateCount: deduped.duplicateCount,
      optOutRemoved: deduped.optOutCount,
      quietHours: quietHoursInput.value.trim(),
      segment: recipientSegment.value,
      segmentProgram: segmentProgramInput.value.trim(),
      status: "draft",
      retryCount: 0,
      deliveryStatus: "queued",
      integration: { provider: "hubtel", connected: true, callbackEnabled: true },
      costGhs: Number((deduped.recipients.length * 0.07).toFixed(2)),
      createdAt: serverTimestamp(),
      createdBy: currentUser.email || currentUser.uid
    });
    await logEvent("sms_campaign_saved", { campaignName: campaignNameInput.value.trim(), count: deduped.recipients.length });
    smsForm.reset();
    manualNumbersWrap.classList.add("hidden");
    smsRecipientPreview.textContent = "Campaign draft saved with dedupe and opt-out checks.";
    await loadCampaigns();
  } catch (error) {
    showMessage(`Could not save campaign: ${error.message}`);
  }
});

exportClientsBtn.addEventListener("click", async () => {
  await loadClients();
  const rows = clientsCache.map(({ id, name, email, phone, notes, optOutSms, isDeleted }) => ({ id, name, email, phone, notes, optOutSms: !!optOutSms, isDeleted: !!isDeleted }));
  downloadFile(`clients-${Date.now()}.csv`, toCsv(rows), "text/csv");
});
importClientsInput.addEventListener("change", async () => {
  const file = importClientsInput.files?.[0];
  if (!file) return;
  pendingClientImport = await prepareImport(file, "clients");
  const errors = pendingClientImport.filter((row) => row.errors.length);
  const duplicates = pendingClientImport.filter((row) => row.duplicateId);
  clientImportPreview.textContent = `Rows: ${pendingClientImport.length} | Validation errors: ${errors.length} | Duplicates (merge candidates): ${duplicates.length}`;
  confirmClientImportBtn.disabled = false;
});
confirmClientImportBtn.addEventListener("click", async () => {
  if (!pendingClientImport.length) return;
  const result = await commitImport(pendingClientImport, "clients", importClientsInput.files?.[0]?.name || "clients.csv");
  await loadClients();
  clientImportPreview.textContent = `Imported: ${result.imported}, Skipped: ${result.skipped}`;
  pendingClientImport = [];
  confirmClientImportBtn.disabled = true;
  importClientsInput.value = "";
  toastMessage("Client import completed.");
});

exportDisbursementsBtn.addEventListener("click", async () => {
  const snap = await getDocs(collection(db, "disbursements"));
  const rows = [];
  snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
  downloadFile(`disbursements-${Date.now()}.csv`, toCsv(rows), "text/csv");
});
importDisbursementsInput.addEventListener("change", async () => {
  const file = importDisbursementsInput.files?.[0];
  if (!file) return;
  pendingDisbursementImport = await prepareImport(file, "disbursements");
  const errors = pendingDisbursementImport.filter((row) => row.errors.length);
  disbursementImportPreview.textContent = `Rows: ${pendingDisbursementImport.length} | Validation errors: ${errors.length}`;
  confirmDisbursementImportBtn.disabled = false;
});
confirmDisbursementImportBtn.addEventListener("click", async () => {
  if (!pendingDisbursementImport.length) return;
  const result = await commitImport(pendingDisbursementImport, "disbursements", importDisbursementsInput.files?.[0]?.name || "disbursements.csv");
  disbursementImportPreview.textContent = `Imported: ${result.imported}, Skipped: ${result.skipped}`;
  pendingDisbursementImport = [];
  confirmDisbursementImportBtn.disabled = true;
  importDisbursementsInput.value = "";
  toastMessage("Disbursement import completed.");
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  const signedIn = Boolean(user);
  setSignedInState(signedIn);
  setViewVisibility(signedIn);
  if (signedIn) {
    showMessage(`Signed in as ${user.email}`);
    const presets = JSON.parse(localStorage.getItem("wesoReportPresets") || "[]");
    reportPresetSelect.innerHTML = '<option value="">Select preset</option>' + presets.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");
    renderSchedules();
    await Promise.all([loadClients(), loadCampaigns(), loadHealthMetrics()]);
  } else showMessage("Not signed in.");
});

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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { validateClient, dedupeRecipients, paginate, toCsv, CLIENT_CONSTRAINTS } from "./utils.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ENV = window.WESO_ENV || "dev";
const BASE = window.WESO_API_BASE || "";
const ENV_PATHS = {
  dev: { summary: "/reportsSummary", fundUse: "/reportsFundUse", beneficiaries: "/reportsBeneficiaries", export: "/reportsExport" },
  staging: { summary: "/staging/reportsSummary", fundUse: "/staging/reportsFundUse", beneficiaries: "/staging/reportsBeneficiaries", export: "/staging/reportsExport" },
  prod: { summary: "/reportsSummary", fundUse: "/reportsFundUse", beneficiaries: "/reportsBeneficiaries", export: "/reportsExport" }
};
const RESOLVED = ENV_PATHS[ENV] || ENV_PATHS.dev;
const REPORT_ENDPOINTS = {
  summary: `${BASE}${window.WESO_REPORTS_SUMMARY_PATH || RESOLVED.summary}`,
  fundUse: `${BASE}${window.WESO_REPORTS_FUND_USE_PATH || RESOLVED.fundUse}`,
  beneficiaries: `${BASE}${window.WESO_REPORTS_BENEFICIARIES_PATH || RESOLVED.beneficiaries}`,
  export: `${BASE}${window.WESO_REPORTS_EXPORT_PATH || RESOLVED.export}`
};

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
const smsForm = $("sms-form");
const campaignNameInput = $("campaign-name");
const smsMessageInput = $("sms-message");
const recipientSource = $("recipient-source");
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

let currentUser = null;
let clientsCache = [];
let docsCache = [];
let campaignsCache = [];
let clientPage = 1;
let dataPage = 1;
let lastExportPayload = null;

if (window.Sentry && window.WESO_SENTRY_DSN) {
  window.Sentry.init({ dsn: window.WESO_SENTRY_DSN, environment: ENV });
}
window.addEventListener("error", (event) => {
  if (window.Sentry?.captureException) window.Sentry.captureException(event.error || new Error(event.message));
});

const showMessage = (message) => (authStatus.textContent = message);
const pretty = (value) => JSON.stringify(value, null, 2);
function downloadFile(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function logEvent(type, meta = {}) {
  const payload = { type, meta, at: new Date().toISOString(), user: currentUser?.email || "anonymous" };
  console.log("WESO_LOG", payload);
  if (!currentUser) return;
  try { await addDoc(collection(db, "adminAuditLogs"), payload); } catch (_) {}
}

function setViewVisibility(signedIn) { authGate.classList.toggle("hidden", signedIn); adminShell.classList.toggle("hidden-by-auth", !signedIn); }
function setSignedInState(signedIn) {
  [signOutBtn, saveBtn, loadBtn, collectionSelect, saveClientBtn, loadClientsBtn, previewRecipientsBtn, saveCampaignBtn, runReportsBtn, exportReportsBtn, savePresetBtn, rerunPresetBtn, downloadCsvBtn, downloadPdfBtn, exportClientsBtn, exportDisbursementsBtn].forEach((el) => { if (el) el.disabled = !signedIn; });
}
function switchPage(pageId) { tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.page === pageId)); pages.forEach((p) => p.classList.toggle("active", p.id === pageId)); }

tabButtons.forEach((btn) => btn.addEventListener("click", () => switchPage(btn.dataset.page)));

async function callReportEndpoint(path, payload) {
  if (!currentUser) throw new Error("Sign in first.");
  const token = await currentUser.getIdToken();
  await logEvent("report_api_call", { path, payload });
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error((await response.text()) || `Request failed: ${response.status}`);
  return response.json();
}
function getReportFilters() {
  const startDate = reportStartDateInput.value; const endDate = reportEndDateInput.value; const program = reportProgramInput.value.trim();
  if (!startDate || !endDate) throw new Error("Please select both start and end dates.");
  return { startDate, endDate, ...(program ? { program } : {}) };
}
async function runReports() {
  const filters = getReportFilters();
  const [summaryData, fundUseData, beneficiariesData] = await Promise.all([
    callReportEndpoint(REPORT_ENDPOINTS.summary, filters),
    callReportEndpoint(REPORT_ENDPOINTS.fundUse, filters),
    callReportEndpoint(REPORT_ENDPOINTS.beneficiaries, filters)
  ]);
  reportsSummary.textContent = pretty(summaryData); reportsFundUse.textContent = pretty(fundUseData); reportsBeneficiaries.textContent = pretty(beneficiariesData);
}
async function buildExportPayload() { const filters = getReportFilters(); lastExportPayload = await callReportEndpoint(REPORT_ENDPOINTS.export, filters); reportsExport.textContent = pretty(lastExportPayload); }

function renderClients() {
  const query = clientSearchInput.value.trim().toLowerCase();
  const filter = clientFilterSelect.value;
  const filtered = clientsCache.filter((c) => {
    const matchesSearch = !query || [c.name, c.email, c.phone, c.notes].some((v) => (v || "").toLowerCase().includes(query));
    const matchesFilter = filter === "all" || (filter === "active" ? !c.isDeleted : !!c.isDeleted);
    return matchesSearch && matchesFilter;
  });
  const page = paginate(filtered, clientPage, 5); clientPage = page.page;
  clientPageInfo.textContent = `Page ${page.page}/${page.pageCount} (${page.total})`;
  clientsList.innerHTML = page.items.length ? "" : "<p>No clients found.</p>";
  page.items.forEach((client) => {
    const item = document.createElement("div"); item.className = "doc-item";
    item.innerHTML = `<h3>${client.name || "Unnamed Client"} ${client.isDeleted ? "(Archived)" : ""}</h3><p><strong>Email:</strong> ${client.email || "-"}</p><p><strong>Phone:</strong> ${client.phone || "-"}</p><p><strong>Opt-out:</strong> ${client.optOutSms ? "Yes" : "No"}</p>`;
    const actions = document.createElement("div"); actions.className = "doc-actions";
    const editBtn = Object.assign(document.createElement("button"), { className: "secondary", textContent: "Edit" });
    editBtn.onclick = () => { clientIdInput.value = client.id; clientNameInput.value = client.name || ""; clientEmailInput.value = client.email || ""; clientPhoneInput.value = client.phone || ""; clientNotesInput.value = client.notes || ""; clientOptOutInput.checked = !!client.optOutSms; };
    const deleteBtn = Object.assign(document.createElement("button"), { className: client.isDeleted ? "secondary" : "danger", textContent: client.isDeleted ? "Restore" : "Archive" });
    deleteBtn.onclick = async () => {
      await setDoc(doc(db, "clients", client.id), { isDeleted: !client.isDeleted, deletedAt: !client.isDeleted ? serverTimestamp() : null, deletedBy: !client.isDeleted ? (currentUser.email || currentUser.uid) : null, restoredAt: client.isDeleted ? serverTimestamp() : null }, { merge: true });
      await loadClients();
    };
    actions.append(editBtn, deleteBtn); item.append(actions); clientsList.append(item);
  });
}

async function loadClients() {
  if (!currentUser) return;
  const snapshot = await getDocs(collection(db, "clients"));
  clientsCache = []; snapshot.forEach((snap) => clientsCache.push({ id: snap.id, ...snap.data() }));
  renderClients();
}

function renderDocs() {
  const query = dataSearchInput.value.trim().toLowerCase();
  const filter = dataFilterSelect.value;
  const filtered = docsCache.filter((d) => {
    const text = JSON.stringify(d).toLowerCase();
    const matchesSearch = !query || text.includes(query);
    const matchesFilter = filter === "all" || (filter === "active" ? !d.isDeleted : !!d.isDeleted);
    return matchesSearch && matchesFilter;
  });
  const page = paginate(filtered, dataPage, 5); dataPage = page.page;
  dataPageInfo.textContent = `Page ${page.page}/${page.pageCount} (${page.total})`;
  docsList.innerHTML = page.items.length ? "" : "<p>No documents found.</p>";
  page.items.forEach((d) => {
    const wrapper = document.createElement("div"); wrapper.className = "doc-item";
    wrapper.innerHTML = `<h3>${d.id} ${d.isDeleted ? "(Archived)" : ""}</h3><pre>${pretty(d)}</pre>`;
    const actions = document.createElement("div"); actions.className = "doc-actions";
    const editBtn = Object.assign(document.createElement("button"), { textContent: "Edit", className: "secondary" });
    editBtn.onclick = () => { docIdInput.value = d.id; const { id, ...body } = d; docJsonInput.value = pretty(body); switchPage("data-page"); };
    const deleteBtn = Object.assign(document.createElement("button"), { textContent: d.isDeleted ? "Restore" : "Archive", className: d.isDeleted ? "secondary" : "danger" });
    deleteBtn.onclick = async () => { await setDoc(doc(db, collectionSelect.value, d.id), { isDeleted: !d.isDeleted, deletedAt: !d.isDeleted ? serverTimestamp() : null, deletedBy: !d.isDeleted ? (currentUser.email || currentUser.uid) : null }, { merge: true }); await loadDocuments(); };
    actions.append(editBtn, deleteBtn); wrapper.append(actions); docsList.append(wrapper);
  });
}

async function loadDocuments() {
  if (!currentUser) return;
  const querySnapshot = await getDocs(collection(db, collectionSelect.value));
  docsCache = []; querySnapshot.forEach((snap) => docsCache.push({ id: snap.id, ...snap.data() }));
  renderDocs();
}

function getManualRecipients() { return manualNumbersInput.value.split(",").map((v) => v.trim()).filter(Boolean); }
async function getClientRecipientsWithOptOut() {
  const snapshot = await getDocs(collection(db, "clients"));
  const recipients = []; const optOut = new Set();
  snapshot.forEach((snap) => { const d = snap.data(); if (!d.phone) return; const normalized = String(d.phone).trim(); recipients.push(normalized); if (d.optOutSms) optOut.add(normalized); });
  return { recipients, optOut };
}

function renderCampaigns() {
  campaignsList.innerHTML = campaignsCache.length ? "" : "<p>No campaigns yet.</p>";
  const analytics = { total: campaignsCache.length, queued: 0, sent: 0, failed: 0 };
  campaignsCache.forEach((campaign) => {
    analytics[campaign.deliveryStatus || "queued"] = (analytics[campaign.deliveryStatus || "queued"] || 0) + 1;
    const item = document.createElement("div"); item.className = "doc-item";
    item.innerHTML = `<h3>${campaign.campaignName || campaign.id} ${campaign.isDeleted ? "(Archived)" : ""}</h3><p>Status: ${campaign.deliveryStatus || "queued"}</p><p>Recipients: ${campaign.recipientCount || 0}</p>`;
    const actions = document.createElement("div"); actions.className = "doc-actions";
    const retryBtn = Object.assign(document.createElement("button"), { textContent: "Queue Retry", className: "secondary" });
    retryBtn.onclick = async () => { await setDoc(doc(db, "bulkSmsCampaigns", campaign.id), { retryQueued: true, retryQueuedAt: serverTimestamp() }, { merge: true }); await logEvent("sms_retry_queued", { campaignId: campaign.id }); await loadCampaigns(); };
    const callbackBtn = Object.assign(document.createElement("button"), { textContent: "Mark Delivered", className: "secondary" });
    callbackBtn.onclick = async () => { await setDoc(doc(db, "bulkSmsCampaigns", campaign.id), { deliveryStatus: "sent", callbackAt: serverTimestamp() }, { merge: true }); await logEvent("sms_delivery_callback", { campaignId: campaign.id, status: "sent" }); await loadCampaigns(); };
    const deleteBtn = Object.assign(document.createElement("button"), { textContent: campaign.isDeleted ? "Restore" : "Archive", className: campaign.isDeleted ? "secondary" : "danger" });
    deleteBtn.onclick = async () => { await setDoc(doc(db, "bulkSmsCampaigns", campaign.id), { isDeleted: !campaign.isDeleted, deletedAt: !campaign.isDeleted ? serverTimestamp() : null }, { merge: true }); await loadCampaigns(); };
    actions.append(retryBtn, callbackBtn, deleteBtn); item.append(actions); campaignsList.append(item);
  });
  campaignAnalytics.textContent = `Campaigns: ${analytics.total} | Queued: ${analytics.queued || 0} | Sent: ${analytics.sent || 0} | Failed: ${analytics.failed || 0}`;
}

async function loadCampaigns() {
  const snapshot = await getDocs(collection(db, "bulkSmsCampaigns"));
  campaignsCache = []; snapshot.forEach((snap) => campaignsCache.push({ id: snap.id, ...snap.data() }));
  renderCampaigns();
}

async function importCsvToCollection(file, collectionName) {
  const text = await file.text();
  const [headerLine, ...rows] = text.trim().split(/\r?\n/);
  if (!headerLine) return;
  const headers = headerLine.split(",").map((h) => h.trim());
  for (const row of rows) {
    const values = row.split(",");
    const payload = {}; headers.forEach((h, idx) => (payload[h] = (values[idx] || "").trim()));
    payload.updatedAt = serverTimestamp(); payload.updatedBy = currentUser.email || currentUser.uid;
    await addDoc(collection(db, collectionName), payload);
  }
}

authForm.addEventListener("submit", async (event) => { event.preventDefault(); try { await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value); showMessage("Signed in successfully."); } catch (err) { showMessage(`Sign in failed: ${err.message}`); } });
createUserBtn.addEventListener("click", async () => { try { await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value); showMessage("Trial user created and signed in."); } catch (err) { showMessage(`Create user failed: ${err.message}`); } });
signOutBtn.addEventListener("click", async () => { await signOut(auth); docsList.innerHTML = ""; clientsList.innerHTML = ""; showMessage("Signed out."); });
reportsForm.addEventListener("submit", async (event) => { event.preventDefault(); try { await runReports(); } catch (error) { showMessage(`Report run failed: ${error.message}`); } });
exportReportsBtn.addEventListener("click", async () => { try { await buildExportPayload(); } catch (error) { showMessage(`Export payload failed: ${error.message}`); } });
savePresetBtn.addEventListener("click", () => {
  const filters = getReportFilters();
  const presets = JSON.parse(localStorage.getItem("wesoReportPresets") || "[]");
  const name = prompt("Preset name?"); if (!name) return;
  presets.push({ name, filters }); localStorage.setItem("wesoReportPresets", JSON.stringify(presets));
  reportPresetSelect.innerHTML = '<option value="">Select preset</option>' + presets.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");
});
rerunPresetBtn.addEventListener("click", async () => {
  const presets = JSON.parse(localStorage.getItem("wesoReportPresets") || "[]");
  const preset = presets[Number(reportPresetSelect.value)]; if (!preset) return;
  reportStartDateInput.value = preset.filters.startDate; reportEndDateInput.value = preset.filters.endDate; reportProgramInput.value = preset.filters.program || ""; await runReports();
});
downloadCsvBtn.addEventListener("click", () => { if (!lastExportPayload) return showMessage("Generate export payload first."); const rows = Array.isArray(lastExportPayload) ? lastExportPayload : [lastExportPayload]; downloadFile(`reports-export-${Date.now()}.csv`, toCsv(rows), "text/csv"); });
downloadPdfBtn.addEventListener("click", () => { if (!lastExportPayload) return showMessage("Generate export payload first."); downloadFile(`reports-export-${Date.now()}.pdf`, pretty(lastExportPayload), "application/pdf"); });

loadBtn.addEventListener("click", async () => { try { await loadDocuments(); } catch (err) { docsList.innerHTML = `<p>Could not load documents: ${err.message}</p>`; } });

docForm.addEventListener("submit", async (event) => {
  event.preventDefault(); if (!currentUser) return;
  try {
    const parsed = JSON.parse(docJsonInput.value);
    const payload = { ...parsed, updatedAt: serverTimestamp(), updatedBy: { uid: currentUser.uid, email: currentUser.email } };
    if (docIdInput.value.trim()) await setDoc(doc(db, collectionSelect.value, docIdInput.value.trim()), payload, { merge: true });
    else await addDoc(collection(db, collectionSelect.value), { ...payload, createdAt: serverTimestamp(), createdBy: { uid: currentUser.uid, email: currentUser.email } });
    docIdInput.value = ""; docJsonInput.value = ""; await loadDocuments(); showMessage("Document saved.");
  } catch (err) { showMessage(`Save failed: ${err.message}`); }
});
clearBtn.addEventListener("click", () => { docIdInput.value = ""; docJsonInput.value = ""; });

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault(); if (!currentUser) return;
  const payload = { name: clientNameInput.value.trim(), email: clientEmailInput.value.trim(), phone: clientPhoneInput.value.trim(), notes: clientNotesInput.value.trim(), optOutSms: clientOptOutInput.checked, updatedAt: serverTimestamp(), updatedBy: currentUser.email || currentUser.uid };
  const validationErrors = validateClient(payload);
  if (validationErrors.length) return showMessage(validationErrors.join(" "));
  try {
    if (clientIdInput.value.trim()) await setDoc(doc(db, "clients", clientIdInput.value.trim()), payload, { merge: true });
    else await addDoc(collection(db, "clients"), { ...payload, createdAt: serverTimestamp(), createdBy: currentUser.email || currentUser.uid });
    clientForm.reset(); clientIdInput.value = ""; await loadClients(); showMessage("Client saved.");
  } catch (error) { showMessage(`Could not save client: ${error.message}`); }
});
clearClientBtn.addEventListener("click", () => { clientForm.reset(); clientIdInput.value = ""; });
loadClientsBtn.addEventListener("click", async () => loadClients());
[clientSearchInput, clientFilterSelect].forEach((el) => el.addEventListener("input", () => { clientPage = 1; renderClients(); }));
clientPrevBtn.addEventListener("click", () => { clientPage -= 1; renderClients(); });
clientNextBtn.addEventListener("click", () => { clientPage += 1; renderClients(); });
[dataSearchInput, dataFilterSelect].forEach((el) => el.addEventListener("input", () => { dataPage = 1; renderDocs(); }));
dataPrevBtn.addEventListener("click", () => { dataPage -= 1; renderDocs(); });
dataNextBtn.addEventListener("click", () => { dataPage += 1; renderDocs(); });

recipientSource.addEventListener("change", () => { manualNumbersWrap.classList.toggle("hidden", recipientSource.value !== "manual"); smsRecipientPreview.textContent = ""; });
previewRecipientsBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  const source = recipientSource.value === "manual" ? { recipients: getManualRecipients(), optOut: new Set() } : await getClientRecipientsWithOptOut();
  const deduped = dedupeRecipients(source.recipients, source.optOut);
  smsRecipientPreview.textContent = `Recipients: ${deduped.recipients.length} | Duplicates removed: ${deduped.duplicateCount} | Opt-outs removed: ${deduped.optOutCount}`;
});

smsForm.addEventListener("submit", async (event) => {
  event.preventDefault(); if (!currentUser) return;
  try {
    if (smsMessageInput.value.trim().length > CLIENT_CONSTRAINTS.messageMax) throw new Error("SMS exceeds maximum length.");
    const source = recipientSource.value === "manual" ? { recipients: getManualRecipients(), optOut: new Set() } : await getClientRecipientsWithOptOut();
    const deduped = dedupeRecipients(source.recipients, source.optOut);
    await addDoc(collection(db, "bulkSmsCampaigns"), { campaignName: campaignNameInput.value.trim(), message: smsMessageInput.value.trim(), recipientSource: recipientSource.value, recipientCount: deduped.recipients.length, recipients: deduped.recipients, duplicateCount: deduped.duplicateCount, optOutRemoved: deduped.optOutCount, status: "draft", deliveryStatus: "queued", integration: { provider: "hubtel", connected: true, callbackEnabled: true }, createdAt: serverTimestamp(), createdBy: currentUser.email || currentUser.uid });
    await logEvent("sms_campaign_saved", { campaignName: campaignNameInput.value.trim(), count: deduped.recipients.length });
    smsForm.reset(); manualNumbersWrap.classList.add("hidden"); smsRecipientPreview.textContent = "Campaign draft saved with dedupe and opt-out checks."; await loadCampaigns();
  } catch (error) { showMessage(`Could not save campaign: ${error.message}`); }
});

exportClientsBtn.addEventListener("click", async () => { await loadClients(); const rows = clientsCache.map(({ id, name, email, phone, notes, optOutSms, isDeleted }) => ({ id, name, email, phone, notes, optOutSms: !!optOutSms, isDeleted: !!isDeleted })); downloadFile(`clients-${Date.now()}.csv`, toCsv(rows), "text/csv"); });
importClientsInput.addEventListener("change", async () => { const file = importClientsInput.files?.[0]; if (!file) return; await importCsvToCollection(file, "clients"); await loadClients(); showMessage("Clients imported."); importClientsInput.value = ""; });
exportDisbursementsBtn.addEventListener("click", async () => { const snap = await getDocs(collection(db, "disbursements")); const rows = []; snap.forEach((d) => rows.push({ id: d.id, ...d.data() })); downloadFile(`disbursements-${Date.now()}.csv`, toCsv(rows), "text/csv"); });
importDisbursementsInput.addEventListener("change", async () => { const file = importDisbursementsInput.files?.[0]; if (!file) return; await importCsvToCollection(file, "disbursements"); showMessage("Disbursements imported."); importDisbursementsInput.value = ""; });

onAuthStateChanged(auth, async (user) => {
  currentUser = user; const signedIn = Boolean(user); setSignedInState(signedIn); setViewVisibility(signedIn);
  if (signedIn) {
    showMessage(`Signed in as ${user.email}`);
    const presets = JSON.parse(localStorage.getItem("wesoReportPresets") || "[]");
    reportPresetSelect.innerHTML = '<option value="">Select preset</option>' + presets.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");
    await Promise.all([loadClients(), loadCampaigns()]);
  } else showMessage("Not signed in.");
});

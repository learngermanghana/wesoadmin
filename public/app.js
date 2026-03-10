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
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const REPORTS_BASE_URL = (window.WESO_REPORTS_BASE_URL || "").replace(/\/$/, "");

function resolveReportEndpoint(pathKey, defaultPath) {
  const configuredPath = window[pathKey] || defaultPath;
  if (/^https?:\/\//.test(configuredPath)) return configuredPath;
  return `${REPORTS_BASE_URL}${configuredPath}`;
}

const REPORT_ENDPOINTS = {
  summary: resolveReportEndpoint("WESO_REPORTS_SUMMARY_PATH", "/api/reportsSummary"),
  fundUse: resolveReportEndpoint("WESO_REPORTS_FUND_USE_PATH", "/api/reportsFundUse"),
  beneficiaries: resolveReportEndpoint("WESO_REPORTS_BENEFICIARIES_PATH", "/api/reportsBeneficiaries"),
  export: resolveReportEndpoint("WESO_REPORTS_EXPORT_PATH", "/api/reportsExport")
};

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const pages = Array.from(document.querySelectorAll(".page"));
const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const createUserBtn = document.getElementById("create-user-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const authStatus = document.getElementById("auth-status");
const authGate = document.getElementById("auth-gate");
const adminShell = document.getElementById("admin-shell");

const reportsForm = document.getElementById("reports-form");
const runReportsBtn = document.getElementById("run-reports-btn");
const exportReportsBtn = document.getElementById("export-reports-btn");
const reportStartDateInput = document.getElementById("report-start-date");
const reportEndDateInput = document.getElementById("report-end-date");
const reportProgramInput = document.getElementById("report-program");
const reportsSummary = document.getElementById("reports-summary");
const reportsFundUse = document.getElementById("reports-fund-use");
const reportsBeneficiaries = document.getElementById("reports-beneficiaries");
const reportsExport = document.getElementById("reports-export");

const clientForm = document.getElementById("client-form");
const clientIdInput = document.getElementById("client-id");
const clientNameInput = document.getElementById("client-name");
const clientEmailInput = document.getElementById("client-email");
const clientPhoneInput = document.getElementById("client-phone");
const clientNotesInput = document.getElementById("client-notes");
const saveClientBtn = document.getElementById("save-client-btn");
const clearClientBtn = document.getElementById("clear-client-btn");
const loadClientsBtn = document.getElementById("load-clients-btn");
const clientsList = document.getElementById("clients-list");

const smsForm = document.getElementById("sms-form");
const campaignNameInput = document.getElementById("campaign-name");
const smsMessageInput = document.getElementById("sms-message");
const recipientSource = document.getElementById("recipient-source");
const manualNumbersWrap = document.getElementById("manual-numbers-wrap");
const manualNumbersInput = document.getElementById("manual-numbers");
const previewRecipientsBtn = document.getElementById("preview-recipients-btn");
const saveCampaignBtn = document.getElementById("save-campaign-btn");
const smsRecipientPreview = document.getElementById("sms-recipient-preview");

const collectionSelect = document.getElementById("collection-select");
const loadBtn = document.getElementById("load-btn");
const docsList = document.getElementById("docs-list");
const docForm = document.getElementById("doc-form");
const docIdInput = document.getElementById("doc-id");
const docJsonInput = document.getElementById("doc-json");
const saveBtn = document.getElementById("save-btn");
const clearBtn = document.getElementById("clear-btn");

let currentUser = null;

function showMessage(message) {
  authStatus.textContent = message;
}


function setViewVisibility(signedIn) {
  if (signedIn) {
    authGate.classList.add("hidden");
    adminShell.classList.remove("hidden-by-auth");
  } else {
    authGate.classList.remove("hidden");
    adminShell.classList.add("hidden-by-auth");
  }
}

function setSignedInState(signedIn) {
  signOutBtn.disabled = !signedIn;
  saveBtn.disabled = !signedIn;
  loadBtn.disabled = !signedIn;
  collectionSelect.disabled = !signedIn;
  saveClientBtn.disabled = !signedIn;
  loadClientsBtn.disabled = !signedIn;
  previewRecipientsBtn.disabled = !signedIn;
  saveCampaignBtn.disabled = !signedIn;
  runReportsBtn.disabled = !signedIn;
  exportReportsBtn.disabled = !signedIn;
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function switchPage(pageId) {
  tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.page === pageId));
  pages.forEach((page) => page.classList.toggle("active", page.id === pageId));
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchPage(btn.dataset.page));
});

async function callReportEndpoint(path, payload) {
  if (!currentUser) throw new Error("Sign in first.");
  const token = await currentUser.getIdToken();
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json();
}

function getReportFilters() {
  const startDate = reportStartDateInput.value;
  const endDate = reportEndDateInput.value;
  const program = reportProgramInput.value.trim();

  if (!startDate || !endDate) {
    throw new Error("Please select both start and end dates.");
  }

  return {
    startDate,
    endDate,
    ...(program ? { program } : {})
  };
}

async function runReports() {
  const filters = getReportFilters();
  reportsSummary.textContent = "Loading summary...";
  reportsFundUse.textContent = "Loading fund use...";
  reportsBeneficiaries.textContent = "Loading beneficiaries...";

  const [summaryData, fundUseData, beneficiariesData] = await Promise.all([
    callReportEndpoint(REPORT_ENDPOINTS.summary, filters),
    callReportEndpoint(REPORT_ENDPOINTS.fundUse, filters),
    callReportEndpoint(REPORT_ENDPOINTS.beneficiaries, filters)
  ]);

  reportsSummary.textContent = pretty(summaryData);
  reportsFundUse.textContent = pretty(fundUseData);
  reportsBeneficiaries.textContent = pretty(beneficiariesData);
}

async function buildExportPayload() {
  const filters = getReportFilters();
  reportsExport.textContent = "Building export payload...";
  const exportData = await callReportEndpoint(REPORT_ENDPOINTS.export, filters);
  reportsExport.textContent = pretty(exportData);
}

async function loadDocuments() {
  if (!currentUser) return;
  const colName = collectionSelect.value;
  docsList.innerHTML = "Loading...";

  const querySnapshot = await getDocs(collection(db, colName));
  const docs = [];
  querySnapshot.forEach((snap) => docs.push({ id: snap.id, ...snap.data() }));

  if (docs.length === 0) {
    docsList.innerHTML = "<p>No documents found.</p>";
    return;
  }

  docsList.innerHTML = "";
  docs.forEach((d) => {
    const wrapper = document.createElement("div");
    wrapper.className = "doc-item";

    const title = document.createElement("h3");
    title.textContent = d.id;

    const pre = document.createElement("pre");
    pre.textContent = pretty(d);

    const actions = document.createElement("div");
    actions.className = "doc-actions";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.className = "secondary";
    editBtn.onclick = () => {
      docIdInput.value = d.id;
      const { id, ...body } = d;
      docJsonInput.value = pretty(body);
      switchPage("data-page");
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "danger";
    deleteBtn.onclick = async () => {
      if (!confirm(`Delete document '${d.id}' from ${colName}?`)) return;
      await deleteDoc(doc(db, colName, d.id));
      await loadDocuments();
    };

    actions.append(editBtn, deleteBtn);
    wrapper.append(title, pre, actions);
    docsList.append(wrapper);
  });
}

async function loadClients() {
  if (!currentUser) return;
  clientsList.innerHTML = "Loading clients...";
  const snapshot = await getDocs(collection(db, "clients"));
  const docs = [];
  snapshot.forEach((snap) => docs.push({ id: snap.id, ...snap.data() }));

  if (docs.length === 0) {
    clientsList.innerHTML = "<p>No clients yet.</p>";
    return;
  }

  clientsList.innerHTML = "";
  docs.forEach((client) => {
    const item = document.createElement("div");
    item.className = "doc-item";
    item.innerHTML = `<h3>${client.name || "Unnamed Client"}</h3>
      <p><strong>Email:</strong> ${client.email || "-"}</p>
      <p><strong>Phone:</strong> ${client.phone || "-"}</p>
      <p><strong>Notes:</strong> ${client.notes || "-"}</p>`;

    const actions = document.createElement("div");
    actions.className = "doc-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "secondary";
    editBtn.textContent = "Edit";
    editBtn.onclick = () => {
      clientIdInput.value = client.id;
      clientNameInput.value = client.name || "";
      clientEmailInput.value = client.email || "";
      clientPhoneInput.value = client.phone || "";
      clientNotesInput.value = client.notes || "";
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = async () => {
      if (!confirm(`Delete client '${client.name || client.id}'?`)) return;
      await deleteDoc(doc(db, "clients", client.id));
      await loadClients();
    };

    actions.append(editBtn, deleteBtn);
    item.append(actions);
    clientsList.append(item);
  });
}

function getManualRecipients() {
  return manualNumbersInput.value
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function getClientRecipients() {
  const snapshot = await getDocs(collection(db, "clients"));
  const recipients = [];
  snapshot.forEach((snap) => {
    const phone = snap.data().phone;
    if (phone) recipients.push(phone);
  });
  return recipients;
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
  reportsSummary.textContent = "Run reports to see output.";
  reportsFundUse.textContent = "Run reports to see output.";
  reportsBeneficiaries.textContent = "Run reports to see output.";
  reportsExport.textContent = 'Click "Build Export Payload" to generate data.';
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

  const colName = collectionSelect.value;
  try {
    const parsed = JSON.parse(docJsonInput.value);
    const payload = {
      ...parsed,
      updatedAt: serverTimestamp(),
      updatedBy: {
        uid: currentUser.uid,
        email: currentUser.email
      }
    };

    if (docIdInput.value.trim()) {
      await setDoc(doc(db, colName, docIdInput.value.trim()), payload, { merge: true });
    } else {
      await addDoc(collection(db, colName), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: {
          uid: currentUser.uid,
          email: currentUser.email
        }
      });
    }

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
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.email || currentUser.uid
  };

  try {
    if (clientIdInput.value.trim()) {
      await setDoc(doc(db, "clients", clientIdInput.value.trim()), payload, { merge: true });
    } else {
      await addDoc(collection(db, "clients"), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: currentUser.email || currentUser.uid
      });
    }

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

loadClientsBtn.addEventListener("click", async () => {
  await loadClients();
});

recipientSource.addEventListener("change", () => {
  manualNumbersWrap.classList.toggle("hidden", recipientSource.value !== "manual");
  smsRecipientPreview.textContent = "";
});

previewRecipientsBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  const recipients =
    recipientSource.value === "manual" ? getManualRecipients() : await getClientRecipients();
  smsRecipientPreview.textContent = `Recipients: ${recipients.length}`;
});

smsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  try {
    const recipients =
      recipientSource.value === "manual" ? getManualRecipients() : await getClientRecipients();

    await addDoc(collection(db, "bulkSmsCampaigns"), {
      campaignName: campaignNameInput.value.trim(),
      message: smsMessageInput.value.trim(),
      recipientSource: recipientSource.value,
      recipientCount: recipients.length,
      recipients,
      status: "draft",
      integration: {
        provider: "hubtel",
        connected: false,
        note: "Pending backend integration"
      },
      createdAt: serverTimestamp(),
      createdBy: currentUser.email || currentUser.uid
    });

    smsForm.reset();
    manualNumbersWrap.classList.add("hidden");
    smsRecipientPreview.textContent = "Campaign draft saved. Ready for Hubtel backend integration.";
  } catch (error) {
    showMessage(`Could not save campaign: ${error.message}`);
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  const signedIn = Boolean(user);
  setSignedInState(signedIn);
  setViewVisibility(signedIn);
  if (signedIn) {
    showMessage(`Signed in as ${user.email}`);
    await loadClients();
  } else {
    showMessage("Not signed in.");
  }
});

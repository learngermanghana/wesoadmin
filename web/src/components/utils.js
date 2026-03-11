export const CLIENT_CONSTRAINTS = {
  nameMax: 120,
  emailMax: 120,
  phoneMin: 10,
  phoneMax: 16,
  notesMax: 500,
  messageMax: 320
};

export function validateClient(payload) {
  const errors = [];
  if (!payload.name?.trim()) errors.push("Client name is required.");
  if (!payload.email?.trim()) {
    errors.push("Client email is required.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
    errors.push("Client email format is invalid.");
  }

  const phone = payload.phone?.trim() || "";
  if (!phone) {
    errors.push("Client phone is required.");
  } else if (!/^\+?[0-9]{10,16}$/.test(phone)) {
    errors.push("Phone must be 10-16 digits and may start with +.");
  }

  if ((payload.name || "").length > CLIENT_CONSTRAINTS.nameMax) errors.push("Client name is too long.");
  if ((payload.email || "").length > CLIENT_CONSTRAINTS.emailMax) errors.push("Client email is too long.");
  if (phone && (phone.length < CLIENT_CONSTRAINTS.phoneMin || phone.length > CLIENT_CONSTRAINTS.phoneMax)) {
    errors.push("Client phone length is invalid.");
  }
  if ((payload.notes || "").length > CLIENT_CONSTRAINTS.notesMax) errors.push("Client notes are too long.");

  return errors;
}

export function dedupeRecipients(rawRecipients, optOutSet = new Set()) {
  const normalized = rawRecipients
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const seen = new Set();
  const recipients = [];
  let duplicateCount = 0;
  let optOutCount = 0;

  normalized.forEach((number) => {
    const key = number.replace(/\s+/g, "");
    if (optOutSet.has(key)) {
      optOutCount += 1;
      return;
    }
    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }
    seen.add(key);
    recipients.push(key);
  });

  return { recipients, duplicateCount, optOutCount };
}

export function paginate(items, page = 1, pageSize = 5) {
  const safePageSize = Math.max(1, pageSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * safePageSize;
  return {
    page: currentPage,
    pageSize: safePageSize,
    pageCount,
    total,
    items: items.slice(start, start + safePageSize)
  };
}

export function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escapeValue = (value) => {
    const str = value == null ? "" : String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeValue(row[header])).join(","));
  });
  return `${lines.join("\n")}\n`;
}

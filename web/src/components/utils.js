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

export function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((field) => field.trim() !== "")) rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((field) => field.trim() !== "")) rows.push(row);

  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((cells, rowIndex) => {
    const record = {};
    headers.forEach((header, colIndex) => {
      record[header] = (cells[colIndex] || "").trim();
    });
    return { rowNumber: rowIndex + 2, record };
  });

  return { headers, records };
}

export function createSimplePdfBlob(title, lines) {
  const safe = (text) => String(text).replace(/[()\\]/g, "");
  const pageLines = [safe(title), "", ...lines.map(safe)].slice(0, 40);
  const content = pageLines.map((line, idx) => `BT /F1 11 Tf 40 ${790 - idx * 18} Td (${line}) Tj ET`).join("\n");
  const stream = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj
${stream}
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000066 00000 n 
0000000123 00000 n 
0000000249 00000 n 
0000000325 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
${325 + stream.length + 12}
%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

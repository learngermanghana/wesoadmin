import { HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeFiltersData } from "./filter-utils.js";

export function normalizeFilters(payload = {}) {
  try {
    const normalized = normalizeFiltersData(payload);
    return {
      ...normalized,
      start: Timestamp.fromDate(normalized.start),
      end: Timestamp.fromDate(normalized.end)
    };
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message);
  }
}

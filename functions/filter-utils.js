export function normalizeFiltersData(payload = {}) {
  const { startDate, endDate, program } = payload;
  if (!startDate || !endDate) {
    throw new Error("startDate and endDate are required.");
  }

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid startDate or endDate.");
  }

  if (end.getTime() < start.getTime()) {
    throw new Error("endDate cannot be before startDate.");
  }

  return {
    start,
    end,
    startDate,
    endDate,
    program: typeof program === "string" && program.trim() ? program.trim() : null
  };
}

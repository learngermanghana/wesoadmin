const ENV_PATHS = {
  dev: { summary: "/reportsSummary", fundUse: "/reportsFundUse", beneficiaries: "/reportsBeneficiaries", export: "/reportsExport" },
  staging: { summary: "/staging/reportsSummary", fundUse: "/staging/reportsFundUse", beneficiaries: "/staging/reportsBeneficiaries", export: "/staging/reportsExport" },
  prod: { summary: "/reportsSummary", fundUse: "/reportsFundUse", beneficiaries: "/reportsBeneficiaries", export: "/reportsExport" }
};

export function resolveReportEndpoints({ env = "dev", base = "", overrides = {} } = {}) {
  const resolved = ENV_PATHS[env] || ENV_PATHS.dev;
  return {
    summary: `${base}${overrides.summary || resolved.summary}`,
    fundUse: `${base}${overrides.fundUse || resolved.fundUse}`,
    beneficiaries: `${base}${overrides.beneficiaries || resolved.beneficiaries}`,
    export: `${base}${overrides.export || resolved.export}`
  };
}

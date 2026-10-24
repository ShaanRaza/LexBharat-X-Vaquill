// Display names of the regulator / body slugs (query values stay the raw slugs). PURE.
export const DEPARTMENT_LABELS = {
  sebi: "SEBI", rbi: "RBI", mca: "MCA", dgft: "DGFT", trai: "TRAI", moefcc: "MoEFCC", cpcb: "CPCB", irdai: "IRDAI", dfs: "DFS", cbic: "CBIC",
  "law-commission": "Law Commission", "trib-ibbi": "IBBI (tribunal-filed)", "trib-gst-aar": "GST AAR (tribunal-filed)", "trib-cat": "CAT (tribunal-filed)", "trib-tdsat": "TDSAT (tribunal-filed)", "trib-aptel": "APTEL (tribunal-filed)",
};
export const departmentLabel = (slug) => DEPARTMENT_LABELS[slug] ?? null;
/** Regulator, Law Commission and tribunal-filed instruments have ids that start REG_. */
export const isRegulatorId = (actId) => typeof actId === "string" && actId.startsWith("REG_");

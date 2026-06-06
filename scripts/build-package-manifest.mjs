import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const targetPages = 1000;

const publicRegisterPath = path.join(repoRoot, "data", "source-register.json");
const privateDrivePath = path.join(repoRoot, "private", "google-drive-intake.json");
const clintonMeetingControlsPath = path.join(repoRoot, "data", "clinton-library-meeting-controls.json");
const coverageMatrixPath = path.join(repoRoot, "..", "Clinton-NATO-European-Security", "reports", "coverage-matrix.json");
const promotionQueuePath = path.join(repoRoot, "..", "Clinton-NATO-European-Security", "reports", "promotion-queue.json");
const hardGapTriagePath = path.join(repoRoot, "..", "Clinton-NATO-European-Security", "reports", "hard-gap-pdf-triage.json");

const topicRules = [
  ["nato-expansion", 24, /nato\s+expansion|nato\s+enlargement|expansion\s+of\s+nato|enlargement\s+of\s+nato|(expand|expanding|expanded|enlarge|enlarging|enlarged)\s+nato/i],
  ["accession", 18, /nato\s+accession|protocols?\s+of\s+accession|accession\s+to\s+nato|new\s+nato\s+members/i],
  ["madrid-summit", 16, /madrid\s+summit|nato\s+summit.{0,80}madrid|madrid.{0,80}nato\s+summit/i],
  ["nato-russia", 16, /nato[-/ ]russia|russia.{0,80}nato|nato.{0,80}russia|founding\s+act|permanent\s+joint\s+council|\bpjc\b/i],
  ["open-door-map", 14, /open\s+door|membership\s+action\s+plan|\bmap\b|first\s+round|second\s+round/i],
  ["pfp", 12, /partnership\s+for\s+peace|\bpfp\b/i],
  ["ratification", 12, /senate\s+ratification|ratification\s+of\s+the\s+protocols?|protocols?\s+of\s+accession/i],
  ["nac-usnato", 10, /north\s+atlantic\s+council|\bnac\b|\busnato\b/i],
  ["architecture", 8, /european\s+security|new\s+european\s+security\s+architecture|nato[-/ ]eu|\besdi\b|strategic\s+concept/i],
  ["cfe-osce", 7, /\bcfe\b|conventional\s+forces\s+in\s+europe|\bosce\b|\bcsce\b/i],
  ["candidate-states", 10, /(poland|polish|hungary|hungarian|czech|slovak|slovakia|slovenia|romanian?|baltic|latvia|lithuania|estonia|ukraine).{0,100}\bnato\b|\bnato\b.{0,100}(poland|polish|hungary|hungarian|czech|slovak|slovakia|slovenia|romanian?|baltic|latvia|lithuania|estonia|ukraine)/i]
];

const softNoiseRule = /\b(bosnia|kosovo|haiti|rwanda|albania|macedonian|former yugoslavia|croatia|sfor|ifor|kfor|unprofor)\b/i;
const rescuerRule = /nato\s+expansion|nato\s+enlargement|nato[-/ ]russia|partnership\s+for\s+peace|\bpfp\b|accession|madrid|founding\s+act|open\s+door|\bcfe\b|\bosce\b|\bcsce\b|\besdi\b|ratification/i;

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(relativePath, value) {
  const target = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(relativePath, value) {
  const target = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}

function recordText(record) {
  return [
    record.title,
    record.documentType,
    record.sourceClass,
    record.sourceNote,
    record.notes,
    ...(record.topics || []),
    ...(record.people || []),
    ...(record.countries || []),
    record.nscSoc?.committee
  ].filter(Boolean).join(" ");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function markdownEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function linkFor(record) {
  const url = record.sourceUrl || record.pdfUrl;
  return url ? `[open](${url})` : "";
}

function yearInScope(record) {
  return Number(record.year) >= 1993 && Number(record.year) <= 2000;
}

function isNscOrSoc(record, text) {
  return Boolean(record.nscSoc?.isNscRecord || record.nscSoc?.isSummaryOfConclusions || /summary of conclusions|summaries of conclusions|principals committee|deputies committee|\bnsc\b|minutes/i.test(text));
}

function scoreRecord(record) {
  const text = recordText(record);
  const themes = [];
  const reasons = [];
  let score = 0;

  for (const [theme, weight, pattern] of topicRules) {
    if (pattern.test(text)) {
      score += weight;
      themes.push(theme);
      reasons.push(theme);
    }
  }

  const nscSoc = isNscOrSoc(record, text);
  if (nscSoc && themes.length) {
    score += 14;
    themes.push("nsc-soc");
    reasons.push("NSC/SOC relevance");
  }
  if (/memcon|telcon|memorandum of conversation|memorandum of telephone conversation/i.test(record.documentType || record.title)) {
    score += 7;
    reasons.push("conversation record");
  }
  if (record.inclusionStatus === "include-candidate") {
    score += 8;
    reasons.push("upstream include candidate");
  }
  if (hardGapLocalIds.has(record.id) || hardGapPdfUrls.has(record.pdfUrl || "")) {
    score += 28;
    themes.push("strobe-hard-gap");
    reasons.push("upstream Strobe hard-gap triage");
  }
  if (record.sourceClass === "state-foia") {
    score += 4;
    reasons.push("State FOIA primary source");
  }
  if (record.sourceClass === "clinton-digital-library" || record.sourceClass === "clinton-library-mdr") {
    score += 5;
    reasons.push("Clinton Library primary source");
  }
  if (record.sourceClass === "nara-catalog") {
    score += 5;
    reasons.push("NARA Catalog primary source");
  }
  if (record.sourceClass === "nara-scout-lead" || /scout lead/i.test(record.documentType || "")) {
    score -= 100;
    reasons.push("file-unit lead needs promotion");
  }
  if (record.sourceClass === "clinton-library-mdr-packet" || /packet control/i.test(record.documentType || "")) {
    score -= 100;
    reasons.push("packet needs document-level extraction");
  }
  if (!record.pdfUrl) {
    score -= 40;
    reasons.push("no package PDF URL");
  }
  if (!Number(record.pageCount)) {
    score -= 60;
    reasons.push("no verified page count");
  }
  if (!yearInScope(record)) {
    score -= 80;
    reasons.push("date outside 1993-2000 or unverified");
  }
  if (softNoiseRule.test(text) && !rescuerRule.test(text)) {
    score -= 30;
    reasons.push("crisis-only signal");
  }

  return {
    score,
    themes: [...new Set(themes)],
    reasons: [...new Set(reasons)],
    nscSoc,
    packageReady: score > 0 &&
      Boolean(record.pdfUrl) &&
      Number(record.pageCount) > 0 &&
      yearInScope(record) &&
      record.sourceClass !== "nara-scout-lead" &&
      record.sourceClass !== "clinton-library-mdr-packet"
  };
}

function sortCandidates(a, b) {
  return b.package.score - a.package.score ||
    Number(b.package.nscSoc) - Number(a.package.nscSoc) ||
    String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99")) ||
    String(a.title).localeCompare(String(b.title));
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function themeCounts(items) {
  const counts = {};
  for (const item of items) {
    for (const theme of item.package.themes) {
      counts[theme] = (counts[theme] || 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function driveQueryCounts(items) {
  const counts = {};
  for (const item of items) {
    const key = item.query || "unlabeled Drive intake";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function table(rows, headers) {
  return [
    headers.join(" | "),
    headers.map(() => "---").join(" | "),
    ...rows.map((row) => headers.map((header) => markdownEscape(row[header])).join(" | "))
  ].join("\n");
}

const publicRecords = readJson(publicRegisterPath, []);
const privateDriveItems = readJson(privateDrivePath, []);
const clintonMeetingControls = readJson(clintonMeetingControlsPath, []);
const coverageMatrix = readJson(coverageMatrixPath, { rows: [] });
const upstreamPromotionQueue = readJson(promotionQueuePath, { rows: [] });
const hardGapTriage = readJson(hardGapTriagePath, { rows: [] });
const hardGapLocalIds = new Set((hardGapTriage.rows || []).map((row) => `clinton-nato-${row.record_id}`));
const hardGapPdfUrls = new Set((hardGapTriage.rows || []).map((row) => row.pdf_url).filter(Boolean));
const promotedClintonDocs = publicRecords.filter((record) => record.upstream?.workspace === "live-clinton-library-document-extraction");
const evaluated = publicRecords.map((record) => ({ ...record, package: scoreRecord(record) }));
const candidates = evaluated.filter((record) => record.package.packageReady).sort(sortCandidates);
const attentionQueue = evaluated
  .filter((record) => record.package.nscSoc && record.package.themes.length)
  .sort(sortCandidates);
const promotionQueue = evaluated
  .filter((record) => record.sourceClass === "nara-scout-lead" && record.package.themes.length)
  .sort(sortCandidates);
const packetExtractionQueue = evaluated
  .filter((record) => record.sourceClass === "clinton-library-mdr-packet")
  .sort(sortCandidates);
const officialPacketPageTotal = packetExtractionQueue.reduce((sum, record) => sum + Number(record.pageCount || 0), 0);
const gapRows = (coverageMatrix.rows || [])
  .filter((row) => row.status === "gap" || Number(row.document_records || 0) < Number(row.direct_document_minimum || 0))
  .slice(0, 12);
const hardGapRows = (hardGapTriage.rows || [])
  .slice(0, 20);

function pageTotal(records) {
  return records.reduce((sum, record) => sum + Number(record.pageCount || 0), 0);
}

function assignPackagePages(records) {
  let pageCursor = 0;
  return records.map((record, index) => {
    const pageCount = Number(record.pageCount || 0);
    const output = {
      ...record,
      package: {
        ...record.package,
        packageOrder: index + 1,
        pageStart: pageCursor + 1,
        pageEnd: pageCursor + pageCount
      }
    };
    pageCursor += pageCount;
    return output;
  });
}

let selectedPageTotal = 0;
const selectedRaw = [];
for (const record of candidates) {
  if (selectedPageTotal >= targetPages) break;
  selectedRaw.push(record);
  selectedPageTotal += Number(record.pageCount);
}

let exactPageAdjustment = null;
if (selectedPageTotal > targetPages) {
  const overflow = selectedPageTotal - targetPages;
  const selectedRawIds = new Set(selectedRaw.map((record) => record.id));
  const deferredForSwap = candidates.filter((record) => !selectedRawIds.has(record.id));
  let bestSwap = null;

  selectedRaw.forEach((selectedRecord, removeIndex) => {
    const neededPages = Number(selectedRecord.pageCount) - overflow;
    if (neededPages <= 0) return;
    for (const addRecord of deferredForSwap) {
      if (Number(addRecord.pageCount) !== neededPages) continue;
      const scoreLoss = selectedRecord.package.score - addRecord.package.score;
      const candidateSwap = { selectedRecord, addRecord, removeIndex, scoreLoss };
      if (!bestSwap ||
          scoreLoss < bestSwap.scoreLoss ||
          (scoreLoss === bestSwap.scoreLoss && selectedRecord.package.score < bestSwap.selectedRecord.package.score) ||
          (scoreLoss === bestSwap.scoreLoss && selectedRecord.package.score === bestSwap.selectedRecord.package.score && removeIndex > bestSwap.removeIndex)) {
        bestSwap = candidateSwap;
      }
    }
  });

  if (bestSwap) {
    selectedRaw.splice(bestSwap.removeIndex, 1, bestSwap.addRecord);
    selectedRaw.sort(sortCandidates);
    selectedPageTotal = pageTotal(selectedRaw);
    exactPageAdjustment = {
      removed: {
        id: bestSwap.selectedRecord.id,
        title: bestSwap.selectedRecord.title,
        pageCount: bestSwap.selectedRecord.pageCount,
        relevanceScore: bestSwap.selectedRecord.package.score
      },
      added: {
        id: bestSwap.addRecord.id,
        title: bestSwap.addRecord.title,
        pageCount: bestSwap.addRecord.pageCount,
        relevanceScore: bestSwap.addRecord.package.score
      },
      scoreLoss: bestSwap.scoreLoss,
      reason: `One-record swap to hit the ${targetPages}-page target exactly.`
    };
  }
}

const selected = assignPackagePages(selectedRaw);
const selectedIds = new Set(selected.map((record) => record.id));
const deferred = candidates.filter((record) => !selectedIds.has(record.id));
const deferredIds = new Set(deferred.map((record) => record.id));
const evaluatedById = new Map(evaluated.map((record) => [record.id, record]));
const evaluatedByPdfUrl = new Map(evaluated.filter((record) => record.pdfUrl).map((record) => [record.pdfUrl, record]));
const selectedPublic = selected.map((record) => ({
  id: record.id,
  packageOrder: record.package.packageOrder,
  packagePageStart: record.package.pageStart,
  packagePageEnd: record.package.pageEnd,
  date: record.date,
  year: record.year,
  title: record.title,
  documentType: record.documentType,
  sourceClass: record.sourceClass,
  sourceUrl: record.sourceUrl,
  pdfUrl: record.pdfUrl,
  sourcePages: record.sourcePages || "",
  pageCount: record.pageCount,
  sourceNote: record.sourceNote,
  inclusionStatus: record.inclusionStatus,
  verificationStatus: record.verificationStatus,
  themes: record.package.themes,
  relevanceScore: record.package.score,
  relevanceReasons: record.package.reasons,
  nscSoc: record.nscSoc
}));

const hardGapStatus = hardGapRows.map((row) => {
  const record = evaluatedById.get(`clinton-nato-${row.record_id}`) ||
    evaluatedById.get(row.record_id) ||
    evaluatedByPdfUrl.get(row.pdf_url);
  const selectedForPackage = Boolean(record && selectedIds.has(record.id));
  const packageReady = Boolean(record?.package.packageReady);
  let packageStatus = "not ingested";
  if (selectedForPackage) packageStatus = "selected";
  else if (record && deferredIds.has(record.id)) packageStatus = "package-ready deferred";
  else if (record && packageReady) packageStatus = "package-ready outside preview";
  else if (record) packageStatus = "not package-ready";

  return {
    order: row.triage_order,
    recordId: row.record_id,
    localRecordId: record?.id || "",
    packageStatus,
    packageSelected: selectedForPackage,
    packageReady,
    promotionLane: row.promotion_lane,
    directGapCredit: row.direct_gap_credit,
    recommendedDecision: row.recommended_decision,
    date: row.date,
    title: row.title,
    pageCount: row.page_count || null,
    pdfUrl: row.pdf_url || "",
    relevanceScore: record?.package.score ?? null,
    themes: record?.package.themes || [],
    relevanceReasons: record?.package.reasons || []
  };
});
const hardGapSelectedCount = hardGapStatus.filter((row) => row.packageStatus === "selected").length;
const hardGapDeferredCount = hardGapStatus.filter((row) => row.packageStatus === "package-ready deferred" || row.packageStatus === "package-ready outside preview").length;
const hardGapNotReadyCount = hardGapStatus.length - hardGapSelectedCount - hardGapDeferredCount;

const manifest = {
  generatedAt: new Date().toISOString(),
  targetPages,
  selectedPageTotal,
  selectedCount: selected.length,
  candidateCount: candidates.length,
  candidatePageTotal: candidates.reduce((sum, record) => sum + Number(record.pageCount || 0), 0),
  nscSocCandidateCount: attentionQueue.length,
  naraScoutPromotionLeadCount: promotionQueue.length,
  clintonLibraryPacketControlCount: packetExtractionQueue.length,
  clintonLibraryPacketControlPages: officialPacketPageTotal,
  privateGoogleDriveIntakeCount: privateDriveItems.length,
  hardGapStrobeTriageCount: hardGapStatus.length,
  hardGapStrobeSelectedCount: hardGapSelectedCount,
  hardGapStrobeDeferredCount: hardGapDeferredCount,
  exactPageAdjustment,
  sourceClassCounts: countBy(selected, (record) => record.sourceClass),
  yearCounts: countBy(selected, (record) => String(record.year || "unknown")),
  themeCounts: themeCounts(selected),
  selected: selectedPublic,
  deferredCandidatePreview: deferred.slice(0, 120).map((record) => ({
    id: record.id,
    date: record.date,
    title: record.title,
    documentType: record.documentType,
    sourceClass: record.sourceClass,
    pageCount: record.pageCount,
    sourceUrl: record.sourceUrl,
    pdfUrl: record.pdfUrl,
    themes: record.package.themes,
    relevanceScore: record.package.score
  })),
  nscSocAttentionQueue: attentionQueue.slice(0, 160).map((record) => ({
    id: record.id,
    date: record.date,
    title: record.title,
    documentType: record.documentType,
    sourceClass: record.sourceClass,
    pageCount: record.pageCount || null,
    sourceUrl: record.sourceUrl,
    pdfUrl: record.pdfUrl,
    themes: record.package.themes,
    relevanceScore: record.package.score,
    packageSelected: selectedIds.has(record.id)
  })),
  naraScoutPromotionQueue: promotionQueue.slice(0, 120).map((record) => ({
    id: record.id,
    title: record.title,
    sourceUrl: record.sourceUrl,
    themes: record.package.themes,
    relevanceScore: record.package.score,
    nextAction: "Promote this file-unit lead only after source-image inspection identifies document dates, page spans, markings, and source-note provenance."
  })),
  hardGapStrobeStatus: hardGapStatus,
  clintonLibraryPacketExtractionQueue: packetExtractionQueue.map((record) => ({
    id: record.id,
    date: record.date,
    title: record.title,
    pageCount: record.pageCount,
    sourceUrl: record.sourceUrl,
    pdfUrl: record.pdfUrl,
    themes: record.package.themes,
    relevanceScore: record.package.score,
    nscSoc: record.nscSoc,
    nextAction: "Split this official MDR packet into document-level rows with dates, page spans, markings, and duplicate controls before package selection."
  }))
};

writeJson("data/package-manifest.json", manifest);

const csvHeaders = [
  "packageOrder",
  "packagePageStart",
  "packagePageEnd",
  "date",
  "pageCount",
  "title",
  "documentType",
  "sourceClass",
  "themes",
  "sourceUrl",
  "pdfUrl",
  "sourceNote"
];
writeText("data/package-manifest.csv", `${csvHeaders.join(",")}\n${selectedPublic.map((record) => csvHeaders.map((header) => {
  const value = Array.isArray(record[header]) ? record[header].join("; ") : record[header];
  return csvEscape(value);
}).join(",")).join("\n")}\n`);

const selectedRows = selectedPublic.map((record) => ({
  "#": record.packageOrder,
  Pages: `${record.packagePageStart}-${record.packagePageEnd}`,
  Date: record.date,
  Count: record.pageCount,
  Record: record.title,
  Source: record.sourceClass,
  Themes: record.themes.join(", "),
  Link: linkFor(record)
}));

const nscRows = manifest.nscSocAttentionQueue.slice(0, 80).map((record) => ({
  Date: record.date,
  Selected: record.packageSelected ? "yes" : "no",
  Pages: record.pageCount || "",
  Record: record.title,
  Source: record.sourceClass,
  Themes: record.themes.join(", "),
  Link: linkFor(record)
}));

const deferredRows = manifest.deferredCandidatePreview.slice(0, 60).map((record) => ({
  Date: record.date,
  Score: record.relevanceScore,
  Pages: record.pageCount,
  Record: record.title,
  Source: record.sourceClass,
  Themes: record.themes.join(", "),
  Link: linkFor(record)
}));

const scoutRows = manifest.naraScoutPromotionQueue.slice(0, 60).map((record) => ({
  Score: record.relevanceScore,
  Record: record.title,
  Themes: record.themes.join(", "),
  Link: linkFor(record)
}));

const packetRows = manifest.clintonLibraryPacketExtractionQueue.map((record) => ({
  Date: record.date,
  Pages: record.pageCount,
  Record: record.title,
  Link: linkFor(record),
  Action: record.nextAction
}));

const promotedRows = promotedClintonDocs.map((record) => ({
  Date: record.date,
  Pages: record.sourcePages,
  Count: record.pageCount,
  Record: record.title,
  Packet: record.upstream?.packetIdentifier || "",
  Link: linkFor(record)
}));

const meetingControlRows = clintonMeetingControls.map((record) => ({
  Date: record.date,
  Pages: record.pageCount || "",
  Record: record.title,
  Committee: record.committee || "",
  Packet: record.packetIdentifier || "",
  Status: record.releaseStatus || "",
  Restriction: record.restriction || "",
  Link: linkFor(record)
}));

const exhaustionRows = [
  { Lane: "Selected package records", Count: manifest.selectedCount, Pages: manifest.selectedPageTotal, Status: "assembled locally" },
  { Lane: "Package-ready public candidates", Count: manifest.candidateCount, Pages: manifest.candidatePageTotal, Status: "available for reselection" },
  { Lane: "NSC/SOC/minutes attention queue", Count: manifest.nscSocCandidateCount, Pages: "", Status: "special review lane" },
  { Lane: "Strobe FOIA hard-gap triage rows", Count: manifest.hardGapStrobeTriageCount, Pages: hardGapStatus.reduce((sum, record) => sum + Number(record.pageCount || 0), 0), Status: `${hardGapSelectedCount} selected; ${hardGapDeferredCount} package-ready deferred; ${hardGapNotReadyCount} not ready or not ingested` },
  { Lane: "Clinton Library promoted document rows", Count: promotedClintonDocs.length, Pages: promotedClintonDocs.reduce((sum, record) => sum + Number(record.pageCount || 0), 0), Status: "document-level rows" },
  { Lane: "Clinton Library withheld meeting/SOC controls", Count: clintonMeetingControls.length, Pages: clintonMeetingControls.reduce((sum, record) => sum + Number(record.pageCount || 0), 0), Status: "not package-eligible; retrieval/redaction leads" },
  { Lane: "Clinton Library MDR packet controls", Count: manifest.clintonLibraryPacketControlCount, Pages: manifest.clintonLibraryPacketControlPages, Status: "needs document-level extraction" },
  { Lane: "NARA Scout promotion leads", Count: manifest.naraScoutPromotionLeadCount, Pages: "", Status: "needs source-image inspection" },
  { Lane: "Private Google Drive matching clues", Count: manifest.privateGoogleDriveIntakeCount, Pages: "", Status: "ignored local intake only" }
];

const gapSignalRows = gapRows.map((row) => ({
  Gap: row.label || row.id,
  Total: row.total_records ?? "",
  Documents: row.document_records ?? "",
  Minimum: row.direct_document_minimum ?? "",
  Action: row.next_action || ""
}));

const hardGapRowsForReport = hardGapStatus.map((row) => ({
  Order: row.order,
  Package: row.packageStatus,
  Score: row.relevanceScore ?? "",
  Record: row.title,
  Pages: row.pageCount || "",
  Decision: row.recommendedDecision || "",
  Link: row.pdfUrl ? `[open](${row.pdfUrl})` : ""
}));

const driveRows = Object.entries(driveQueryCounts(privateDriveItems)).map(([Query, Count]) => ({ Query, Count }));

writeText("reports/package-manifest.md", `# Bernstein 1000-Page Package Manifest

Generated: ${manifest.generatedAt}

This is the focused package candidate set for Professor Barton Bernstein. It is
separate from the broader public source register: records here are selected for
direct relevance to NATO expansion/enlargement, accession, NATO-Russia, Madrid,
Partnership for Peace, NATO open-door policy, CFE/OSCE/ESDI architecture, or
closely related NSC/meeting records.

## Status

- Target pages: ${targetPages}
- Selected pages: ${selectedPageTotal}
- Selected records: ${selected.length}
- Package-ready public candidates: ${candidates.length}
- Package-ready public candidate pages: ${manifest.candidatePageTotal}
- NSC/Summaries/minutes attention candidates: ${attentionQueue.length}
- Strobe FOIA hard-gap triage rows: ${hardGapStatus.length} (${hardGapSelectedCount} selected, ${hardGapDeferredCount} package-ready deferred)
- NARA Scout promotion leads: ${promotionQueue.length}
- Clinton Library MDR packet controls: ${packetExtractionQueue.length}
- Clinton Library packet-control pages awaiting extraction: ${officialPacketPageTotal}
- Private Google Drive intake items, not published as provenance: ${privateDriveItems.length}
- Exact-page adjustment: ${exactPageAdjustment ? `removed "${exactPageAdjustment.removed.title}" (${exactPageAdjustment.removed.pageCount} pages) and added "${exactPageAdjustment.added.title}" (${exactPageAdjustment.added.pageCount} pages)` : "not needed"}

## Selected Source Classes

${table(Object.entries(manifest.sourceClassCounts).map(([Source, Count]) => ({ Source, Count })), ["Source", "Count"])}

## Selected Themes

${table(Object.entries(manifest.themeCounts).map(([Theme, Count]) => ({ Theme, Count })), ["Theme", "Count"])}

## Selected 1000-Page Set

${table(selectedRows, ["#", "Pages", "Date", "Count", "Record", "Source", "Themes", "Link"])}

## NSC, Minutes, And Summaries Attention Queue

${table(nscRows, ["Date", "Selected", "Pages", "Record", "Source", "Themes", "Link"])}
`);

writeText("reports/package-gap-audit.md", `# Package Gap Audit

Generated: ${manifest.generatedAt}

## What This Pass Proves

- The public repo now has a focused 1000-page candidate package, not only a broad
  NATO/European-security source register.
- The package manifest selects only public records with a PDF URL, a page count,
  and an event date in 1993-2000.
- NSC, Principals Committee, Deputies Committee, minutes, and Summaries of
  Conclusions receive special queueing when they also carry a NATO expansion or
  allied-security signal.
- Official Clinton Library MDR packets are now represented as packet controls,
  but are blocked from automatic selection until split into document-level rows.
- Private Google Drive items are used for local matching only and are not
  exposed as public provenance.

## What Remains Before Calling The Whole Goal Complete

- Re-run the local download/assembly recipe after any package-manifest change
  and keep the assembled PDF and source PDFs out of Git.
- Split the official Clinton Library MDR packet controls into document-level
  rows before treating their 1,844 pages as selected package evidence.
- Inspect repeated release packets and any page-range records to avoid duplicate
  packet pages when the same public PDF contains many separate records.
- Promote high-value NARA Scout file-unit leads only after image-level review.
- Verify whether Clinton Library has additional declassified NATO expansion
  MDR items not yet present in the local upstream source register.
- Reconcile private Google Drive copies to official public sources or keep them
  as private researcher working copies.

## Deferred Public Candidates

${table(deferredRows, ["Date", "Score", "Pages", "Record", "Source", "Themes", "Link"])}

## Strobe FOIA Hard-Gap Triage

${hardGapRowsForReport.length ? table(hardGapRowsForReport, ["Order", "Package", "Score", "Record", "Pages", "Decision", "Link"]) : "No upstream hard-gap triage rows were available in this build environment."}

## NARA Scout Promotion Queue

${table(scoutRows, ["Score", "Record", "Themes", "Link"])}
`);

writeText("reports/source-exhaustion-audit.md", `# Source Exhaustion Audit

Generated: ${manifest.generatedAt}

This audit tracks whether the Bernstein NATO expansion package is exhausting
the major declassified source lanes, not merely reaching 1000 pages.

## Current Coverage Lanes

${table(exhaustionRows, ["Lane", "Count", "Pages", "Status"])}

## Clinton Library Promoted Document Rows

${promotedRows.length ? table(promotedRows, ["Date", "Pages", "Count", "Record", "Packet", "Link"]) : "No Clinton Library packet documents have been promoted in this build yet."}

## Clinton Library Withheld Meeting And SOC Controls

These rows are not package-ready declassified documents. They are explicit
retrieval and redaction-status controls for NSC/PC/DC minutes and Summaries of
Conclusions found in packet withdrawal sheets.

${meetingControlRows.length ? table(meetingControlRows, ["Date", "Pages", "Record", "Committee", "Packet", "Status", "Restriction", "Link"]) : "No Clinton Library meeting-control rows have been curated in this build yet."}

## Clinton Library MDR Packet Controls

These official packets are public and page-counted, but they remain controls
until individual documents are promoted with actual dates, source pages,
markings, and duplicate checks.

${table(packetRows, ["Date", "Pages", "Record", "Link", "Action"])}

## Known Gap Signals From Upstream FRUS Workbench

${gapSignalRows.length ? table(gapSignalRows, ["Gap", "Total", "Documents", "Minimum", "Action"]) : "No upstream coverage-matrix gap rows were available in this build environment."}

## Hard-Gap Source Leads

${hardGapRowsForReport.length ? table(hardGapRowsForReport, ["Order", "Package", "Score", "Record", "Pages", "Decision", "Link"]) : "No upstream hard-gap triage rows were available in this build environment."}

## Private Drive Matching Clues

Private Google Drive hits are counted only as local matching clues. They are not
published as public provenance.

${driveRows.length ? table(driveRows, ["Query", "Count"]) : "No private Drive intake was present in this build environment."}

## Current Next Actions

- Promote Clinton Library PC/DC and NATO-expansion MDR packets into
  document-level rows, starting with 2015-0768-M, 2015-0770-M, 2017-0193-M,
  and 2015-0772-M.
- Promote NARA Scout leads only after source-image inspection supplies actual
  document dates, page spans, markings, and source-note paths.
- Keep the ${hardGapDeferredCount} package-ready Strobe hard-gap rows visible for
  any reselection if later Clinton Library or NARA image review displaces lower
  value State FOIA rows.
- Keep Drive copies private unless each one is matched to an official public
  source.
`);

writeJson("data/source-exhaustion-audit.json", {
  generatedAt: manifest.generatedAt,
  lanes: exhaustionRows,
  clintonLibraryPacketControls: manifest.clintonLibraryPacketExtractionQueue,
  clintonLibraryMeetingControls: clintonMeetingControls,
  clintonLibraryPromotedDocuments: promotedClintonDocs.map((record) => ({
    id: record.id,
    date: record.date,
    title: record.title,
    pageCount: record.pageCount,
    sourcePages: record.sourcePages,
    sourceUrl: record.sourceUrl,
    pdfUrl: record.pdfUrl,
    packetIdentifier: record.upstream?.packetIdentifier || ""
  })),
  upstreamCoverageGapSignals: gapRows.map((row) => ({
    id: row.id,
    label: row.label,
    totalRecords: row.total_records,
    documentRecords: row.document_records,
    directDocumentMinimum: row.direct_document_minimum,
    status: row.status,
    nextAction: row.next_action
  })),
  hardGapSourceLeads: hardGapStatus,
  privateDriveIntake: {
    count: privateDriveItems.length,
    queryCounts: driveQueryCounts(privateDriveItems),
    publicMetadataPublished: false
  },
  upstreamPromotionQueue: {
    candidateCount: upstreamPromotionQueue.candidateCount || null,
    scoutLeadCount: upstreamPromotionQueue.scoutLeadCount || null,
    sourceLeadCount: upstreamPromotionQueue.sourceLeadCount || null
  }
});

console.log(`Selected ${selected.length} records and ${selectedPageTotal} pages from ${candidates.length} package-ready public candidates.`);

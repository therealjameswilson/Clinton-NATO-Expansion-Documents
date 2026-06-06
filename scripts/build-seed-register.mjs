import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(repoRoot, "..");
const clintonRecordsPath = path.join(workspaceRoot, "Clinton-NATO-European-Security", "data", "records.json");
const strobeManifestPath = path.join(workspaceRoot, "strobe-talbott-foia", "data", "manifest.json");
const strobeTextRoot = path.join(workspaceRoot, "strobe-talbott-foia");
const privateDrivePath = path.join(repoRoot, "private", "google-drive-intake.json");
const packetControlsPath = path.join(repoRoot, "data", "clinton-library-packet-controls.json");
const promotedDocumentsPath = path.join(repoRoot, "data", "clinton-library-promoted-documents.json");

const keywordWeights = [
  ["summary of conclusions", 10],
  ["summaries of conclusions", 10],
  ["principals committee", 9],
  ["deputies committee", 9],
  [" nsc ", 8],
  ["nato expansion", 10],
  ["nato enlargement", 10],
  ["enlargement", 7],
  ["accession", 7],
  ["madrid summit", 8],
  ["washington summit", 7],
  ["nato-russia", 8],
  ["founding act", 8],
  ["partnership for peace", 7],
  [" pfp ", 6],
  ["open door", 6],
  ["north atlantic council", 7],
  [" usnato ", 7],
  [" nac ", 6],
  [" cfe ", 5],
  [" osce ", 5],
  [" csce ", 5],
  [" esdi ", 5],
  ["nato-eu", 5],
  ["european security", 5],
  ["poland", 3],
  ["hungary", 3],
  ["czech", 3],
  ["baltic", 3],
  ["ukraine", 3],
  ["yeltsin", 4],
  ["talbott", 4],
  ["vershbow", 4],
  ["flanagan", 4],
  ["pifer", 3],
  ["fried", 3]
];

const coreTopicKeywords = [
  "nato",
  "nato expansion",
  "nato enlargement",
  "enlargement",
  "accession",
  "madrid summit",
  "washington summit",
  "nato-russia",
  "founding act",
  "partnership for peace",
  "pfp",
  "open door",
  "north atlantic council",
  "usnato",
  "nac",
  "cfe",
  "osce",
  "csce",
  "esdi",
  "nato-eu",
  "european security"
];

const strongTopicPatterns = [
  /nato\s+(expansion|enlargement|accession|summit|ministerial|strategy|policy)/i,
  /(expand|expanding|expanded|enlarge|enlarging|enlarged)\s+nato/i,
  /nato[-/ ]russia/i,
  /nato[-/ ]eu/i,
  /partnership for peace/i,
  /\bpfp\b/i,
  /founding act/i,
  /open door/i,
  /north atlantic council/i,
  /european security/i,
  /\bcfe\b/i,
  /\bosce\b/i,
  /\bcsce\b/i,
  /\besdi\b/i,
  /(poland|hungary|czech|slovenia|romania|baltic|ukraine).{0,80}\bnato\b/i,
  /\bnato\b.{0,80}(poland|hungary|czech|slovenia|romania|baltic|ukraine)/i
];

const sourcePriority = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3
};

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

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return [String(value)];
}

function yearFromDate(date) {
  const match = String(date || "").match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function normalizedText(value) {
  return ` ${String(value || "").toLowerCase().replace(/\s+/g, " ")} `;
}

function scoreText(value) {
  const text = normalizedText(value);
  let score = 0;
  const reasons = [];
  for (const [keyword, weight] of keywordWeights) {
    if (text.includes(keyword)) {
      score += weight;
      reasons.push(keyword.trim());
    }
  }
  return { score, reasons };
}

function hasCoreTopic(value) {
  const text = normalizedText(value);
  return coreTopicKeywords.some((keyword) => {
    if (keyword.length <= 5) return text.includes(` ${keyword} `);
    return text.includes(keyword);
  });
}

function hasStrongTopic(value) {
  return strongTopicPatterns.some((pattern) => pattern.test(value));
}

function sourceClassFor(record) {
  const text = [record.id, record.catalogUrl, record.pdfUrl, record.sourceNote, record.naid].join(" ");
  if (/nara-scout/i.test(record.id) || /Scout Lead/i.test(record.type)) return "nara-scout-lead";
  if (/foia\.state\.gov|Department of State, FOIA/i.test(text)) return "state-foia";
  if (/catalog\.archives\.gov|National Archives Catalog|NAID/i.test(text)) return "nara-catalog";
  if (/clinton\.presidentiallibraries\.us/i.test(text)) return "clinton-digital-library";
  if (/clintonlibrary\.gov/i.test(text)) return "clinton-library-mdr";
  return "frus-upstream-lead";
}

function committeeFor(text) {
  if (/principals committee/i.test(text)) return "Principals Committee";
  if (/deputies committee/i.test(text)) return "Deputies Committee";
  if (/\bNSC\b/i.test(text)) return "NSC";
  if (/interagency/i.test(text)) return "Interagency";
  return "";
}

function nscSocFor(text, priority) {
  const isSoc = /summar(?:y|ies) of conclusions/i.test(text);
  const isNsc = /\bNSC\b|principals committee|deputies committee|interagency/i.test(text);
  return {
    isNscRecord: Boolean(isNsc),
    isSummaryOfConclusions: Boolean(isSoc),
    committee: committeeFor(text),
    queuePriority: isSoc || priority === "P0" ? "front-of-queue" : isNsc ? "review" : ""
  };
}

function inclusionStatusFor(record) {
  const decision = String(record.selectionDecision || "").toLowerCase();
  if (/include/.test(decision)) return "include-candidate";
  if (/context/.test(decision)) return "context-candidate";
  if (/duplicate/.test(decision)) return "duplicate-control";
  if (/exclude/.test(decision)) return "exclude";
  if (/scout lead|source lead/i.test(record.type || "")) return "pending-promotion";
  return "unreviewed";
}

function verificationStatusFor(record) {
  if (/scout lead|source lead/i.test(record.type || "")) return "metadata-only";
  if (record.sourceNoteStatus === "Draft") return "draft-provenance";
  if (record.pageCount) return "ready-for-page-count";
  return "source-image-needed";
}

function priorityFor(record, score, reasons, text) {
  const type = String(record.type || record.documentType || "");
  const isSoc = /summar(?:y|ies) of conclusions/i.test(text);
  const isNsc = /\bNSC\b|principals committee|deputies committee/i.test(text);
  const coreTopic = hasCoreTopic(text);
  if (isSoc || (isNsc && score >= 10)) return "P0";
  if (/Memcon|Telcon/i.test(type) && score >= 10) return "P0";
  if (score >= 18 && coreTopic) return "P0";
  if (score >= 10) return "P1";
  if (score >= 5) return "P2";
  return reasons.length ? "P3" : "P3";
}

function titleHasPackageSignal(title) {
  return /\b(NATO|NAC|USNATO|Russia|Yeltsin|Kozyrev|Riyurikov|Rurikov|Poland|Polish|Hungary|Czech|Slovakia|Slovenia|Romania|Baltic|Ukraine|European|Bosnia|Kosovo|CFE|OSCE|CSCE|ESDI)\b/i.test(title || "");
}

function titleLooksOffTopic(title) {
  return /\b(Haiti|Rwanda|Pakistan|Panama|Korea|India|narcotics|drug|Uzbekistan|Kyrgyzstan|Tajikistan)\b/i.test(title || "");
}

function normalizeClintonRecord(record) {
  const fullText = [
    record.title,
    record.documentTitle,
    record.subjectLine,
    record.sourceNote,
    record.sourceNoteAddendum,
    asArray(record.topics).join(" "),
    asArray(record.frusTopics).join(" "),
    asArray(record.persons).join(" "),
    asArray(record.participants).join(" "),
    asArray(record.countries).join(" ")
  ].join(" ");
  const { score, reasons } = scoreText(fullText);
  const priority = priorityFor(record, score, reasons, fullText);
  const sourceClass = sourceClassFor(record);
  const pageCount = Number.isFinite(Number(record.pageCount)) ? Number(record.pageCount) : null;

  return {
    id: `clinton-nato-${record.id}`,
    title: record.documentTitle || record.title,
    date: record.sortDate || record.date || "",
    year: yearFromDate(record.sortDate || record.date),
    documentType: record.type || "Record",
    sourceClass,
    sourceUrl: record.catalogUrl || record.pdfUrl || "",
    pdfUrl: record.pdfUrl || "",
    sourceNote: record.sourceNote || "",
    sourceNoteStatus: record.sourceNoteStatus || "",
    sourcePages: record.sourcePages || "",
    pageCount,
    pageCountStatus: pageCount ? "known" : "unknown",
    priority,
    priorityReasons: [...new Set(reasons)].slice(0, 8),
    topics: [...new Set([...asArray(record.topics), ...asArray(record.frusTopics), record.chapter?.name].filter(Boolean))],
    people: [...new Set([...asArray(record.persons), ...asArray(record.participants)].filter(Boolean))],
    countries: asArray(record.countries),
    nscSoc: nscSocFor(fullText, priority),
    inclusionStatus: inclusionStatusFor(record),
    verificationStatus: verificationStatusFor(record),
    upstream: {
      workspace: "Clinton-NATO-European-Security",
      id: record.id
    },
    notes: record.sourceNoteAddendum || record.compilerNotes || ""
  };
}

function normalizeStrobeRecord(record) {
  if (/^SC$/i.test(record.document_type || "") || /schedule/i.test(record.title || "")) return null;
  const textFile = record.text_path ? path.join(strobeTextRoot, record.text_path) : "";
  const text = fs.existsSync(textFile) ? fs.readFileSync(textFile, "utf8").slice(0, 12000) : "";
  const fullText = [record.title, record.case_number, record.from_field, record.to_field, text].join(" ");
  const { score, reasons } = scoreText(fullText);
  if (!hasCoreTopic(fullText)) return null;
  if (!hasStrongTopic([record.title, text.slice(0, 8000)].join(" "))) return null;
  if (score < 7) return null;

  const priority = priorityFor(record, score, reasons, fullText);
  const adjustedPriority = titleLooksOffTopic(record.title) && !titleHasPackageSignal(record.title) && priority === "P0" ? "P2" : priority;
  const pageCount = Number.isFinite(Number(record.page_count)) ? Number(record.page_count) : null;
  const release = record.release_status || record.raw_release_status || "";
  const sourceNote = `Source: Department of State, FOIA Virtual Reading Room, Case ${record.case_number || "unknown"}, Doc No. ${record.id}. ${release}.`;

  return {
    id: `state-foia-${record.id}`,
    title: record.title || record.id,
    date: record.date || "",
    year: yearFromDate(record.date),
    documentType: record.document_type || "State FOIA record",
    sourceClass: "state-foia",
    sourceUrl: record.source_pdf_url || "",
    pdfUrl: record.source_pdf_url || "",
    sourceNote,
    sourceNoteStatus: "Draft",
    sourcePages: "",
    pageCount,
    pageCountStatus: pageCount ? "known" : "unknown",
    priority: adjustedPriority,
    priorityReasons: [...new Set(reasons)].slice(0, 8),
    topics: [...new Set(reasons)].slice(0, 8),
    people: [],
    countries: [],
    nscSoc: nscSocFor(fullText, adjustedPriority),
    inclusionStatus: "unreviewed",
    verificationStatus: pageCount ? "ready-for-page-count" : "source-image-needed",
    upstream: {
      workspace: "strobe-talbott-foia",
      id: record.id,
      caseNumber: record.case_number || "",
      manifestPath: "data/manifest.json"
    },
    notes: `Imported from the local Strobe Talbott FOIA manifest. Public package selection still needs document-level review and duplicate control. Relevance score: ${score}.`
  };
}

function normalizePrivateDriveItem(item) {
  const fullText = [item.title, item.mime_type, item.query, item.notes].join(" ");
  const { score, reasons } = scoreText(fullText);
  const priority = score >= 10 ? "P1" : "P2";
  return {
    id: `drive-private-${item.id || item.title}`.replace(/[^a-zA-Z0-9._-]+/g, "-"),
    title: item.title || "Private Drive item",
    date: "",
    year: null,
    documentType: item.mime_type || "Google Drive item",
    sourceClass: "google-drive-private-intake",
    sourceUrl: "",
    pdfUrl: "",
    sourceNote: "Private Google Drive intake. Match to an official public source before public provenance use.",
    sourceNoteStatus: "Private intake",
    sourcePages: "",
    pageCount: null,
    pageCountStatus: "unknown",
    priority,
    priorityReasons: [...new Set(reasons)].slice(0, 8),
    topics: [...new Set(reasons)].slice(0, 8),
    people: [],
    countries: [],
    nscSoc: nscSocFor(fullText, priority),
    inclusionStatus: "pending-promotion",
    verificationStatus: "metadata-only",
    upstream: {
      workspace: "private-google-drive",
      id: item.id || ""
    },
    notes: "Private metadata is not written to public reports."
  };
}

function dedupe(records) {
  const seen = new Set();
  const output = [];
  for (const record of records) {
    const key = [record.sourceUrl || record.pdfUrl, record.title, record.date].join("|").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(record);
  }
  return output;
}

function sortRecords(records) {
  return records.sort((a, b) => {
    const priorityDelta = sourcePriority[a.priority] - sourcePriority[b.priority];
    if (priorityDelta) return priorityDelta;
    const dateDelta = String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99"));
    if (dateDelta) return dateDelta;
    return a.title.localeCompare(b.title);
  });
}

function countBy(records, field) {
  const counts = {};
  for (const record of records) {
    const key = record[field] || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function markdownTable(rows, headers) {
  const escape = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    headers.join(" | "),
    headers.map(() => "---").join(" | "),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(" | "))
  ].join("\n");
}

function buildAssemblyPlan(records) {
  const candidates = records
    .filter((record) => record.pageCount && record.inclusionStatus !== "exclude")
    .sort((a, b) => {
      const priorityDelta = sourcePriority[a.priority] - sourcePriority[b.priority];
      if (priorityDelta) return priorityDelta;
      const nscDelta = Number(Boolean(b.nscSoc?.isNscRecord || b.nscSoc?.isSummaryOfConclusions)) - Number(Boolean(a.nscSoc?.isNscRecord || a.nscSoc?.isSummaryOfConclusions));
      if (nscDelta) return nscDelta;
      return String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99"));
    });

  let pages = 0;
  const selected = [];
  for (const record of candidates) {
    if (pages >= 1000) break;
    selected.push(record);
    pages += record.pageCount;
  }

  return { pages, selected };
}

function sourceLink(record) {
  const url = record.sourceUrl || record.pdfUrl;
  if (!url) return "";
  return `[open](${url})`;
}

const clintonRecords = readJson(clintonRecordsPath, []).map(normalizeClintonRecord);
const strobeRecords = readJson(strobeManifestPath, []).map(normalizeStrobeRecord).filter(Boolean);
const packetControls = readJson(packetControlsPath, []);
const promotedDocuments = readJson(promotedDocumentsPath, []);
const privateDriveRecords = readJson(privateDrivePath, []).map(normalizePrivateDriveItem);

const publicRecords = sortRecords(dedupe([...clintonRecords, ...strobeRecords, ...packetControls, ...promotedDocuments]));
const allLocalRecords = sortRecords(dedupe([...publicRecords, ...privateDriveRecords]));
const assembly = buildAssemblyPlan(publicRecords);
const nscQueue = publicRecords.filter((record) => record.nscSoc?.isNscRecord || record.nscSoc?.isSummaryOfConclusions);

writeJson("data/source-register.json", publicRecords);
writeJson("data/upstream-summary.json", {
  generatedAt: new Date().toISOString(),
  publicRecordCount: publicRecords.length,
  localPrivateDriveIntakeCount: privateDriveRecords.length,
  allLocalRecordCount: allLocalRecords.length,
  knownPublicPages: publicRecords.reduce((sum, record) => sum + (record.pageCount || 0), 0),
  nscSocCount: nscQueue.length,
  p0Count: publicRecords.filter((record) => record.priority === "P0").length,
  sourceClassCounts: countBy(publicRecords, "sourceClass"),
  priorityCounts: countBy(publicRecords, "priority"),
  inclusionStatusCounts: countBy(publicRecords, "inclusionStatus")
});

const sourceRows = Object.entries(countBy(publicRecords, "sourceClass")).map(([Source, Count]) => ({ Source, Count }));
const priorityRows = Object.entries(countBy(publicRecords, "priority")).map(([Priority, Count]) => ({ Priority, Count }));
const statusRows = Object.entries(countBy(publicRecords, "inclusionStatus")).map(([Status, Count]) => ({ Status, Count }));

writeText("reports/upstream-ingest-audit.md", `# Upstream Ingest Audit

Generated: ${new Date().toISOString()}

## Inputs

- Clinton NATO workbench: ${fs.existsSync(clintonRecordsPath) ? clintonRecordsPath : "missing"}
- Strobe Talbott FOIA manifest: ${fs.existsSync(strobeManifestPath) ? strobeManifestPath : "missing"}
- Private Google Drive intake: ${fs.existsSync(privateDrivePath) ? "present locally but excluded from public register" : "not present"}

## Public Register

- Public records: ${publicRecords.length}
- Known public pages: ${publicRecords.reduce((sum, record) => sum + (record.pageCount || 0), 0)}
- NSC/Summaries of Conclusions flags: ${nscQueue.length}
- P0 records: ${publicRecords.filter((record) => record.priority === "P0").length}

## Source Classes

${markdownTable(sourceRows, ["Source", "Count"])}

## Priorities

${markdownTable(priorityRows, ["Priority", "Count"])}

## Inclusion Status

${markdownTable(statusRows, ["Status", "Count"])}

## Notes

Private Google Drive hits are intentionally excluded from public files. They can
seed local matching work, but public provenance should point to Clinton Library,
NARA Catalog, State FOIA, Office of the Historian, or another public official
source.
`);

writeText("reports/nsc-soc-priority-queue.md", `# NSC and Summaries of Conclusions Priority Queue

Generated: ${new Date().toISOString()}

Records flagged here contain NSC, Principals Committee, Deputies Committee,
interagency, meeting-minutes, or Summary of Conclusions language. They are the
front of the Barton Bernstein package review queue.

${markdownTable(nscQueue.slice(0, 160).map((record) => ({
  Date: record.date,
  Priority: record.priority,
  Type: record.documentType,
  Record: record.title,
  Committee: record.nscSoc?.committee || "",
  Pages: record.pageCount || "",
  Source: record.sourceClass,
  Link: sourceLink(record)
})), ["Date", "Priority", "Type", "Record", "Committee", "Pages", "Source", "Link"])}
`);

writeText("reports/assembly-plan.md", `# 1000-Page Assembly Plan

Generated: ${new Date().toISOString()}

Current selected page budget: ${assembly.pages} pages across ${assembly.selected.length}
records. This is an automated first pass, not a final scholarly selection.

Selection order favors P0 records, NSC/Summaries of Conclusions, memcons,
telcons, State FOIA records with page counts, and records already carrying
document-level metadata. File-unit leads do not count toward the page budget
until promoted to document-level records.

${markdownTable(assembly.selected.map((record, index) => ({
  "#": index + 1,
  Date: record.date,
  Priority: record.priority,
  Pages: record.pageCount,
  Record: record.title,
  Type: record.documentType,
  Source: record.sourceClass,
  Link: sourceLink(record)
})), ["#", "Date", "Priority", "Pages", "Record", "Type", "Source", "Link"])}
`);

console.log(`Wrote ${publicRecords.length} public records, ${nscQueue.length} NSC/SOC flags, ${assembly.pages} planned pages.`);

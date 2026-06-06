import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const version = "2.0";
const registerPath = path.join(repoRoot, "data", "source-register.json");

const candidateStates = [
  "poland",
  "polish",
  "hungary",
  "hungarian",
  "czech",
  "slovak",
  "slovakia",
  "slovenia",
  "slovenian",
  "romania",
  "romanian",
  "baltic",
  "latvia",
  "latvian",
  "lithuania",
  "lithuanian",
  "estonia",
  "estonian",
  "visegrad"
].join("|");
const membershipTerms = [
  "membership",
  "accession",
  "candidacy",
  "candidate",
  "admission",
  "admit",
  "join",
  "joining",
  "invite",
  "inviting",
  "invitation",
  "enlargement",
  "expansion",
  "open door",
  "new member"
].join("|");

const directRules = [
  [
    "nato-expansion",
    /nato\s+(?:expansion|enlargement)|(?:expansion|enlargement)\s+of\s+nato|(?:expand|expanding|expanded|enlarge|enlarging|enlarged)\s+nato/i
  ],
  [
    "membership-accession",
    /nato\s+(?:membership|accession|candidacy|admission)|(?:membership|accession|candidacy|admission|join(?:ing)?|admi(?:t|ssion))\s+(?:in|to|for)\s+nato|new\s+nato\s+members?/i
  ],
  [
    "invitation-round",
    /inviting?\s+(?:partners|countries|states)|which\s+countries\s+to\s+support|new\s+members?|first\s+round|second\s+round|name\s+names|set\s+a\s+date/i
  ],
  [
    "open-door-map",
    /open\s+door|membership\s+action\s+plan|\bmap\b/i
  ],
  [
    "ratification-accession",
    /ratification\s+of\s+nato\s+enlargement|ratification\s+of\s+the\s+protocols?|protocols?\s+of\s+accession|senate\s+ratification/i
  ],
  [
    "candidate-membership",
    new RegExp(`(${candidateStates}).{0,120}(${membershipTerms}).{0,40}nato|nato.{0,120}(${candidateStates}).{0,120}(${membershipTerms})|(${membershipTerms}).{0,80}nato.{0,120}(${candidateStates})`, "i")
  ]
];

const manualExclusions = new Map([
  [
    "clinton-library-doc-2013-0804-m-nato-adaptation-gibraltar-1998-01-22",
    "NATO internal adaptation, ESDI, CJTF, Strategic Concept, and Gibraltar command-structure issue; the Open Door phrase appears only in a note about adjacent documents."
  ]
]);

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

function table(rows, headers) {
  return [
    headers.join(" | "),
    headers.map(() => "---").join(" | "),
    ...rows.map((row) => headers.map((header) => markdownEscape(row[header])).join(" | "))
  ].join("\n");
}

function directText(record) {
  return [
    record.title,
    record.documentType,
    record.sourceNote,
    record.notes
  ].filter(Boolean).join(" ");
}

function metadataText(record) {
  return [
    ...(record.priorityReasons || []),
    ...(record.topics || []),
    ...(record.people || []),
    ...(record.countries || [])
  ].filter(Boolean).join(" ");
}

function matchRules(text) {
  return directRules
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);
}

function isDocumentRecord(record) {
  if (!record || typeof record !== "object") return false;
  const year = Number(record.year);
  const pageCount = Number(record.pageCount);
  if (!Number.isFinite(year) || year < 1993 || year > 2000) return false;
  if (!Number.isFinite(pageCount) || pageCount <= 0) return false;
  if (!record.pdfUrl || !/^https?:\/\//.test(record.pdfUrl)) return false;
  if (record.sourceClass === "clinton-library-mdr-packet" || record.sourceClass === "nara-scout-lead") return false;
  if (record.documentType === "Context") return false;
  if (record.inclusionStatus === "exclude" || record.inclusionStatus === "duplicate-control") return false;
  return true;
}

function laneFor(record, matches) {
  const text = directText(record).toLowerCase();
  if (/which countries|inviting partners|decision on new members|deciding which|whether|name names|set a date|not yet|now is not the time|hard questions|new members/.test(text)) {
    return "whether/whom/when";
  }
  if (/ratification|protocols|costs|military implications|strategy|timelines|game plan|getting from here to there|communications plan|congressional|senate/.test(text)) {
    return "how/process";
  }
  if (/open door|membership action plan|second round|first round/.test(text) || matches.includes("open-door-map")) {
    return "future rounds/open door";
  }
  if (new RegExp(candidateStates, "i").test(text) && /membership|accession|candidacy|join|invite|enlargement|expansion|open door/.test(text)) {
    return "candidate-state cases";
  }
  if (/russia|yeltsin|nato-russia|founding act|chirac|kohl|allied|consensus|cost-sharing/.test(text)) {
    return "constraints/diplomacy";
  }
  return "core expansion policy";
}

function sortRecords(a, b) {
  return String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99")) ||
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

function assignVersionPages(records) {
  let pageCursor = 0;
  return records.map((record, index) => {
    const pageCount = Number(record.pageCount || 0);
    const output = {
      ...record,
      versionOrder: index + 1,
      versionPageStart: pageCursor + 1,
      versionPageEnd: pageCursor + pageCount
    };
    pageCursor += pageCount;
    return output;
  });
}

const publicRecords = readJson(registerPath, []).filter((record) => record && typeof record === "object");
const documentRecords = publicRecords.filter(isDocumentRecord);

const coreRows = [];
const reviewCandidates = [];
const manualExcluded = [];

for (const record of documentRecords) {
  if (manualExclusions.has(record.id)) {
    manualExcluded.push({
      id: record.id,
      date: record.date,
      title: record.title,
      documentType: record.documentType,
      sourceClass: record.sourceClass,
      pageCount: record.pageCount,
      reason: manualExclusions.get(record.id)
    });
    continue;
  }

  const directMatches = matchRules(directText(record));
  if (directMatches.length) {
    coreRows.push({
      ...record,
      version2: {
        confidence: "direct",
        lane: laneFor(record, directMatches),
        matches: directMatches,
        rationale: `Direct title, source-note, or curated-note match: ${directMatches.join(", ")}.`
      }
    });
    continue;
  }

  const metadataMatches = matchRules(metadataText(record));
  if (metadataMatches.length) {
    reviewCandidates.push({
      id: record.id,
      date: record.date,
      title: record.title,
      documentType: record.documentType,
      sourceClass: record.sourceClass,
      sourceUrl: record.sourceUrl,
      pdfUrl: record.pdfUrl,
      pageCount: record.pageCount,
      matches: metadataMatches,
      reason: "Expansion signal appears only in topic, priority, people, or country metadata; inspect source text before moving into v2 core."
    });
  }
}

const selected = assignVersionPages(coreRows.sort(sortRecords));
const selectedPageTotal = selected.reduce((sum, record) => sum + Number(record.pageCount || 0), 0);
const nscSocCount = selected.filter((record) => record.nscSoc?.isNscRecord || record.nscSoc?.isSummaryOfConclusions).length;
const reviewPageTotal = reviewCandidates.reduce((sum, record) => sum + Number(record.pageCount || 0), 0);

const manifest = {
  version,
  generatedAt: new Date().toISOString(),
  title: "Version 2.0: Explicit NATO Membership Expansion Dossier",
  scope: "Public, page-counted document rows in which policymakers explicitly discuss whether, whom, when, or how to expand NATO's member states.",
  preservedBaseline: {
    rootSite: "./",
    packageManifest: "data/package-manifest.json",
    packageCsv: "data/package-manifest.csv"
  },
  inclusionRules: [
    "Include public document-level rows with a PDF URL, known page count, and 1993-2000 date.",
    "Exclude packet controls, NARA Scout file-unit leads, context-only public-paper controls, duplicate controls, and excluded rows.",
    "Require direct title, source-note, or curated-note language for NATO expansion/enlargement, NATO membership or accession, invitations/new members, open-door/future-round decisions, accession-protocol ratification, or candidate-state membership/admission."
  ],
  excludedSignals: [
    "General NATO-Russia, Partnership for Peace, CFE, Bosnia, Kosovo, or European-security records without direct member-expansion language.",
    "Metadata-only hits are kept in a review queue, not the v2 core."
  ],
  selectedCount: selected.length,
  selectedPageTotal,
  nscSocCount,
  reviewCandidateCount: reviewCandidates.length,
  reviewCandidatePageTotal: reviewPageTotal,
  manualExcluded,
  sourceClassCounts: countBy(selected, (record) => record.sourceClass),
  laneCounts: countBy(selected, (record) => record.version2.lane),
  matchCounts: countBy(selected.flatMap((record) => record.version2.matches), (match) => match),
  selected: selected.map((record) => ({
    id: record.id,
    versionOrder: record.versionOrder,
    versionPageStart: record.versionPageStart,
    versionPageEnd: record.versionPageEnd,
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
    priority: record.priority,
    priorityReasons: record.priorityReasons || [],
    topics: record.topics || [],
    people: record.people || [],
    countries: record.countries || [],
    nscSoc: record.nscSoc || {},
    version2: record.version2
  })),
  reviewCandidates: reviewCandidates.sort(sortRecords)
};

writeJson("data/version-2-explicit-expansion.json", manifest);

const csvHeaders = [
  "versionOrder",
  "versionPageStart",
  "versionPageEnd",
  "date",
  "pageCount",
  "title",
  "documentType",
  "sourceClass",
  "lane",
  "matches",
  "sourceUrl",
  "pdfUrl",
  "sourceNote"
];
writeText("data/version-2-explicit-expansion.csv", `${csvHeaders.join(",")}\n${manifest.selected.map((record) => csvHeaders.map((header) => {
  let value = record[header];
  if (header === "lane") value = record.version2.lane;
  if (header === "matches") value = record.version2.matches.join("; ");
  return csvEscape(value);
}).join(",")).join("\n")}\n`);

const selectedRows = manifest.selected.map((record) => ({
  "#": record.versionOrder,
  Pages: `${record.versionPageStart}-${record.versionPageEnd}`,
  Date: record.date,
  Count: record.pageCount,
  Lane: record.version2.lane,
  Record: record.title,
  Source: record.sourceClass,
  Match: record.version2.matches.join(", "),
  Link: linkFor(record)
}));

const reviewRows = manifest.reviewCandidates.map((record) => ({
  Date: record.date,
  Pages: record.pageCount,
  Record: record.title,
  Source: record.sourceClass,
  Match: record.matches.join(", "),
  Link: linkFor(record)
}));

writeText("reports/version-2-explicit-expansion.md", `# Version 2.0: Explicit NATO Membership Expansion Dossier

Generated: ${manifest.generatedAt}

This version preserves the original 1000-page Bernstein package and isolates a
narrower dossier: document-level public records in which policymakers explicitly
talk about whether, whom, when, or how to expand NATO's member states.

## Status

- Version: ${version}
- Core isolated records: ${manifest.selectedCount}
- Core isolated pages: ${manifest.selectedPageTotal}
- NSC/SOC/minutes-flagged core records: ${manifest.nscSocCount}
- Metadata-only review candidates: ${manifest.reviewCandidateCount}
- Metadata-only review candidate pages: ${manifest.reviewCandidatePageTotal}
- Manual scope exclusions: ${manifest.manualExcluded.length}

## Inclusion Rules

${manifest.inclusionRules.map((rule) => `- ${rule}`).join("\n")}

## Excluded Or Deferred Signals

${manifest.excludedSignals.map((rule) => `- ${rule}`).join("\n")}

## Source Classes

${table(Object.entries(manifest.sourceClassCounts).map(([Source, Count]) => ({ Source, Count })), ["Source", "Count"])}

## Decision Lanes

${table(Object.entries(manifest.laneCounts).map(([Lane, Count]) => ({ Lane, Count })), ["Lane", "Count"])}

## Match Types

${table(Object.entries(manifest.matchCounts).map(([Match, Count]) => ({ Match, Count })), ["Match", "Count"])}

## Version 2.0 Core Set

${table(selectedRows, ["#", "Pages", "Date", "Count", "Lane", "Record", "Source", "Match", "Link"])}

## Metadata-Only Review Queue

These rows retain a broader expansion signal from topic, priority, person, or
country metadata, but are not part of the v2.0 core until the source text is
inspected or the title/curated notes are upgraded.

${reviewRows.length ? table(reviewRows, ["Date", "Pages", "Record", "Source", "Match", "Link"]) : "No metadata-only review candidates."}

## Manual Scope Exclusions

${manifest.manualExcluded.length ? table(manifest.manualExcluded.map((record) => ({
  Date: record.date,
  Pages: record.pageCount,
  Record: record.title,
  Source: record.sourceClass,
  Reason: record.reason
})), ["Date", "Pages", "Record", "Source", "Reason"]) : "No manual scope exclusions."}
`);

console.log(`Wrote v${version} explicit-expansion dossier: ${manifest.selectedCount} records, ${manifest.selectedPageTotal} pages, ${manifest.reviewCandidateCount} review candidates.`);

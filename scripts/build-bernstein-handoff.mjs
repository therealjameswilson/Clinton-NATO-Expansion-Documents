import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const version2Path = path.join(repoRoot, "data", "version-2-explicit-expansion.json");
const packageManifestPath = path.join(repoRoot, "data", "package-manifest.json");
const meetingControlsPath = path.join(repoRoot, "data", "clinton-library-meeting-controls.json");

const profileSources = [
  {
    id: "stanford-history-profile",
    label: "Stanford Department of History profile",
    url: "https://history.stanford.edu/people/barton-bernstein",
    packageUse: "Identifies Bernstein as Professor of History, Emeritus and anchors the handoff to a professional historian rather than a general reader."
  },
  {
    id: "stanford-cisac-history-for-ir",
    label: "Stanford CISAC event biography",
    url: "https://cisac.fsi.stanford.edu/events/doing_history_for_ir__interpreting_the_abomb_decision_using_documents_to_construct_and_understand_history",
    packageUse: "Highlights his long Stanford career, IR and International Policy Studies roles, and crisis-decisionmaking teaching."
  },
  {
    id: "belfer-essence-review",
    label: "International Security / Belfer review essay page",
    url: "https://www.belfercenter.org/publication/understanding-decisionmaking-us-foreign-policy-and-cuban-missile-crisis-review-essay",
    packageUse: "Connects the handoff to decisionmaking models, organizational process, bureaucratic politics, and skepticism about retrospective explanatory closure."
  }
];

const profileSignals = [
  {
    signal: "Professor of History, Emeritus at Stanford",
    sourceId: "stanford-history-profile",
    handoffImplication: "Keep the package source-first, with document-level provenance, gaps, and audit trails visible."
  },
  {
    signal: "Taught decisionmaking in international crises, including the A-bomb, Korean War, and Cuban Missile Crisis",
    sourceId: "stanford-cisac-history-for-ir",
    handoffImplication: "Prioritize records that expose choices, alternatives, sequencing, and crisis-style decision process."
  },
  {
    signal: "Engaged the rational actor, organizational process, and bureaucratic-politics models in reviewing Essence of Decision",
    sourceId: "belfer-essence-review",
    handoffImplication: "Tag documents for presidential choice, interagency process, allied bargaining, and bureaucratic politics."
  }
];

const researchQuestions = [
  "What alternatives were on the table before NATO expansion hardened into policy?",
  "Where did presidential choice enter, and what was delegated to interagency or allied bargaining?",
  "How did Russian reactions shape, constrain, or mainly frame U.S. decisions?",
  "Which records expose bureaucratic process rather than retrospective public rationale?",
  "What did policymakers defer while deciding the first round: the Baltics, a second round, dates, or an open-door formula?",
  "Where are the missing minutes and Summaries of Conclusions, and what do withdrawal sheets imply about remaining evidentiary gaps?"
];

const startHereIds = [
  "clinton-library-doc-2017-0193-m-concept-strategy",
  "clinton-library-doc-2017-0193-m-hard-questions",
  "clinton-library-doc-2015-0755-m-moving-toward-nato-expansion-1994-10-04",
  "clinton-library-doc-2015-0772-m-moving-toward-nato-expansion-1994-10-14",
  "clinton-library-doc-2015-0772-m-european-security-architecture-nato-expansion-russia-1994-12-22",
  "clinton-library-doc-2015-0792-m-nato-expansion-getting-there-1995-01-25",
  "nara-iscap-2016-156-doc-11-clinton-yeltsin-moscow-1995-05-10",
  "clinton-library-doc-2015-0772-m-lake-european-security-nato-enlargement-1995-06-16",
  "clinton-library-doc-2015-0770-m-nato-enlargement-game-plan",
  "clinton-library-doc-2015-0792-m-copenhagen-seminar-baltic-nato-1996-10-01",
  "clinton-library-doc-2015-0755-m-lake-chirac-1996-11-01",
  "clinton-library-doc-2015-0772-m-inviting-partners-madrid-1997-04-15",
  "clinton-library-doc-2015-0772-m-madrid-membership-decision-1997-06-09",
  "clinton-library-doc-2015-0771-m-nato-enlargement-us-decision-new-members-1997-06-13",
  "clinton-library-doc-2015-0772-m-second-round-open-door-1997-06-23",
  "clinton-library-doc-2015-0755-m-ratification-strategy-1997-12-17",
  "clinton-library-doc-2013-0804-m-open-door-policy-1998-01-21",
  "clinton-library-doc-2015-0772-m-committee-expand-nato-dinner-1998-02-09"
];

const readingPathDefs = [
  {
    id: "decision-core",
    title: "Start Here: Decision Core",
    focus: "A compact first pass through alternatives, strategy, Russia, first-round selection, open-door deferral, and ratification.",
    docIds: startHereIds
  },
  {
    id: "alternatives-hard-questions",
    title: "Alternatives and Hard Questions",
    focus: "Records that most directly expose whether, when, and why expansion should move from possibility to decision.",
    docIds: [
      "clinton-library-doc-2017-0193-m-concept-strategy",
      "clinton-library-doc-2017-0193-m-hard-questions",
      "clinton-library-doc-2015-0755-m-moving-toward-nato-expansion-1994-10-04",
      "clinton-library-doc-2015-0792-m-nato-expansion-getting-there-1995-01-25",
      "clinton-library-doc-2015-0792-m-copenhagen-seminar-baltic-nato-1996-10-01",
      "clinton-library-doc-2015-0772-m-madrid-membership-decision-1997-06-09",
      "clinton-library-doc-2015-0772-m-second-round-open-door-1997-06-23"
    ]
  },
  {
    id: "russia-constraint",
    title: "Russia and Constraint",
    focus: "How policymakers linked enlargement, Russia, NATO-Russia architecture, allied diplomacy, and Yeltsin-era bargaining.",
    docIds: [
      "clinton-library-doc-2015-0772-m-european-security-architecture-nato-expansion-russia-1994-12-22",
      "clinton-library-doc-2015-0792-m-nato-expansion-getting-there-1995-01-25",
      "nara-iscap-2016-156-doc-11-clinton-yeltsin-moscow-1995-05-10",
      "clinton-library-doc-2015-0772-m-lake-european-security-nato-enlargement-1995-06-16",
      "clinton-library-doc-2015-0755-m-lake-chirac-1996-11-01",
      "clinton-library-doc-2015-0772-m-second-round-open-door-1997-06-23"
    ]
  },
  {
    id: "bureaucratic-process",
    title: "Bureaucratic and Interagency Process",
    focus: "Game plans, strategy papers, briefing materials, and committee-controlled records useful for organizational-process and bureaucratic-politics questions.",
    docIds: [
      "clinton-library-doc-2017-0193-m-hard-questions",
      "clinton-library-doc-2015-0772-m-moving-toward-nato-expansion-1994-10-14",
      "clinton-library-doc-2015-0792-m-nato-expansion-getting-there-1995-01-25",
      "clinton-library-doc-2015-0772-m-lake-european-security-nato-enlargement-1995-06-16",
      "clinton-library-doc-2015-0770-m-nato-enlargement-game-plan",
      "clinton-library-doc-2015-0772-m-inviting-partners-madrid-1997-04-15",
      "clinton-library-doc-2015-0755-m-ratification-strategy-1997-12-17"
    ]
  },
  {
    id: "madrid-first-round",
    title: "Madrid Choice and First Round",
    focus: "The specific 1997 decision over whom to invite and how to hold allied consensus together.",
    docIds: [
      "clinton-library-doc-2015-0772-m-inviting-partners-madrid-1997-04-15",
      "clinton-library-doc-2015-0772-m-madrid-membership-decision-1997-06-09",
      "clinton-library-doc-2015-0771-m-nato-enlargement-us-decision-new-members-1997-06-13",
      "clinton-library-doc-2015-0772-m-second-round-open-door-1997-06-23",
      "clinton-library-doc-2015-0772-m-committee-expand-nato-dinner-1998-02-09"
    ]
  },
  {
    id: "open-door-deferral",
    title: "Open Door and Deferred Decisions",
    focus: "Second-round timing, Baltic membership, MAP/open-door language, and the politics of not closing future options.",
    docIds: [
      "clinton-library-doc-2015-0792-m-copenhagen-seminar-baltic-nato-1996-10-01",
      "clinton-library-doc-2015-0772-m-second-round-open-door-1997-06-23",
      "clinton-library-doc-2013-0804-m-open-door-policy-1998-01-21"
    ]
  },
  {
    id: "ratification-public-case",
    title: "Ratification and Public Justification",
    focus: "The post-decision case to Congress, allied governments, invited states, and elite public-facing constituencies.",
    docIds: [
      "clinton-library-doc-2015-0755-m-ratification-strategy-1997-12-17",
      "clinton-library-doc-2015-0772-m-committee-expand-nato-dinner-1998-02-09"
    ]
  }
];

const tagDefinitions = [
  {
    id: "alternatives",
    label: "Alternatives",
    text: "substantive",
    pattern: /\b(hard questions?|alternatives?|options?|whether|not yet|set a date|name names|next steps|getting from here to there|concept|strategy|why)\b/i
  },
  {
    id: "presidential-choice",
    label: "Presidential Choice",
    text: "title",
    pattern: /\b(president|clinton|yeltsin|chirac|lake meeting|one-on-one|deciding which|decision on new members|support for nato membership)\b/i
  },
  {
    id: "bureaucratic-process",
    label: "Bureaucratic Process",
    text: "process",
    pattern: /\b(interagency|principals|deputies|summary of conclusions|minutes|game plan|strategy|ratification|talking points|briefing|memo|paper|meeting|c-p-l|getting from here to there)\b/i
  },
  {
    id: "russia-constraint",
    label: "Russia Constraint",
    text: "substantive",
    pattern: /\b(russia|russian|yeltsin|nato-russia|founding act|moscow|primakov|kozyrev)\b/i
  },
  {
    id: "allied-politics",
    label: "Allied Politics",
    text: "substantive",
    pattern: /\b(allied|allies|consensus|chirac|france|french|german|germany|uk|british|copenhagen|madrid|nac|minister|foreign ministers|kohl|major|blair|nato summit)\b/i
  },
  {
    id: "candidate-selection",
    label: "Candidate Selection",
    text: "substantive",
    pattern: /\b(poland|polish|hungary|hungarian|czech|visegrad|slovak|sloven|romania|baltic|latvia|lithuania|estonia|candidate|which countries|new members|inviting partners|membership)\b/i
  },
  {
    id: "open-door-deferral",
    label: "Open Door Deferral",
    text: "substantive",
    pattern: /\b(open door|second round|future round|membership action plan|\bmap\b|baltic|not yet|set a date|name names)\b/i
  },
  {
    id: "ratification-public-case",
    label: "Ratification Public Case",
    text: "substantive",
    pattern: /\b(ratification|senate|public|communications|committee to expand|costs|protocols|congressional|dinner)\b/i
  }
];

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
  if (!rows.length) return "No rows.";
  return [
    headers.join(" | "),
    headers.map(() => "---").join(" | "),
    ...rows.map((row) => headers.map((header) => markdownEscape(row[header])).join(" | "))
  ].join("\n");
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function textFor(record) {
  return [
    record.title,
    record.documentType,
    record.sourceClass,
    record.sourceNote,
    record.version2?.lane,
    ...(record.version2?.matches || []),
    ...(record.priorityReasons || []),
    ...(record.topics || []),
    ...(record.people || []),
    ...(record.countries || [])
  ].filter(Boolean).join(" ");
}

function substantiveTextFor(record) {
  return [
    record.title,
    record.documentType,
    record.version2?.lane,
    ...(record.version2?.matches || []),
    ...(record.priorityReasons || []),
    ...(record.topics || []),
    ...(record.countries || [])
  ].filter(Boolean).join(" ");
}

function titleTextFor(record) {
  return [
    record.title,
    record.documentType,
    record.version2?.lane,
    ...(record.version2?.matches || [])
  ].filter(Boolean).join(" ");
}

function processTextFor(record) {
  return [
    record.title,
    record.documentType,
    record.version2?.lane,
    ...(record.version2?.matches || []),
    ...(record.priorityReasons || [])
  ].filter(Boolean).join(" ");
}

function tagsFor(record) {
  const texts = {
    substantive: substantiveTextFor(record),
    title: titleTextFor(record),
    process: processTextFor(record)
  };
  const tags = tagDefinitions.filter((tag) => tag.pattern.test(texts[tag.text] || texts.substantive)).map((tag) => tag.id);
  if (record.nscSoc?.isNscRecord || record.nscSoc?.isSummaryOfConclusions) {
    if (!tags.includes("bureaucratic-process")) tags.push("bureaucratic-process");
  }
  if (record.version2?.lane === "whether/whom/when" && !tags.includes("alternatives")) tags.push("alternatives");
  if (record.version2?.lane === "future rounds/open door" && !tags.includes("open-door-deferral")) tags.push("open-door-deferral");
  return tags;
}

function tagLabels(tagIds) {
  return tagIds.map((id) => tagDefinitions.find((tag) => tag.id === id)?.label || id);
}

function scoreRecord(record, tags) {
  let score = 0;
  if (startHereIds.includes(record.id)) score += 100;
  if (record.nscSoc?.isNscRecord || record.nscSoc?.isSummaryOfConclusions) score += 25;
  if (record.version2?.lane === "whether/whom/when") score += 24;
  if (record.version2?.lane === "how/process") score += 18;
  if (record.version2?.lane === "constraints/diplomacy") score += 14;
  if (record.version2?.lane === "future rounds/open door") score += 12;
  const tagScores = {
    alternatives: 22,
    "presidential-choice": 20,
    "bureaucratic-process": 18,
    "russia-constraint": 16,
    "candidate-selection": 14,
    "open-door-deferral": 12,
    "allied-politics": 10,
    "ratification-public-case": 8
  };
  for (const tag of tags) score += tagScores[tag] || 0;
  return score;
}

function noteFor(record, tags) {
  const labels = tagLabels(tags);
  if (record.version2?.lane === "whether/whom/when") {
    return "Best read for choice architecture: whether to expand, whom to invite, or when to name names.";
  }
  if (tags.includes("russia-constraint") && tags.includes("presidential-choice")) {
    return "Useful for weighing presidential diplomacy against Russia-related constraint and alliance strategy.";
  }
  if (tags.includes("bureaucratic-process")) {
    return "Useful for reconstructing process, staff work, sequencing, and the institutional path to decision.";
  }
  if (tags.includes("open-door-deferral")) {
    return "Useful for tracking what policymakers preserved, postponed, or refused to decide in the first round.";
  }
  if (tags.includes("ratification-public-case")) {
    return "Useful for comparing internal rationale with the post-decision public and congressional case.";
  }
  if (labels.length) return `Useful for ${labels.slice(0, 3).join(", ").toLowerCase()} questions.`;
  return "Useful as a source-controlled explicit-expansion record in the v2.0 corpus.";
}

function questionFor(record, tags) {
  if (record.version2?.lane === "whether/whom/when") return researchQuestions[0];
  if (tags.includes("presidential-choice")) return researchQuestions[1];
  if (tags.includes("russia-constraint")) return researchQuestions[2];
  if (tags.includes("bureaucratic-process")) return researchQuestions[3];
  if (tags.includes("open-door-deferral")) return researchQuestions[4];
  return researchQuestions[5];
}

function compactRecord(record) {
  const tags = tagsFor(record);
  const pathIds = readingPathDefs
    .filter((readingPath) => readingPath.docIds.includes(record.id))
    .map((readingPath) => readingPath.id);
  return {
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
    priority: record.priority,
    priorityReasons: record.priorityReasons || [],
    topics: record.topics || [],
    people: record.people || [],
    countries: record.countries || [],
    nscSoc: record.nscSoc || {},
    version2: record.version2,
    bernstein: {
      isStartHere: startHereIds.includes(record.id),
      pathIds,
      tags,
      tagLabels: tagLabels(tags),
      score: scoreRecord(record, tags),
      note: noteFor(record, tags),
      question: questionFor(record, tags)
    }
  };
}

function pathRecords(readingPath, recordsById) {
  return readingPath.docIds
    .map((id) => recordsById.get(id))
    .filter(Boolean)
    .map((record) => ({
      id: record.id,
      date: record.date,
      title: record.title,
      pageCount: record.pageCount,
      lane: record.version2?.lane || "",
      tags: record.bernstein.tags,
      score: record.bernstein.score,
      sourceUrl: record.sourceUrl,
      pdfUrl: record.pdfUrl
    }));
}

function gapReason(control) {
  const committee = control.committee || "NSC";
  const restriction = control.restriction ? ` (${control.restriction})` : "";
  return `${committee} ${control.documentType || "record"} remains ${control.releaseStatus || "unreleased"}${restriction}; treat as a decision-process gap before closing the evidentiary account.`;
}

const version2 = readJson(version2Path, {});
const packageManifest = readJson(packageManifestPath, {});
const meetingControls = readJson(meetingControlsPath, []);
const records = (version2.selected || []).map(compactRecord);
const recordsById = new Map(records.map((record) => [record.id, record]));
const readingPaths = readingPathDefs.map((readingPath) => ({
  id: readingPath.id,
  title: readingPath.title,
  focus: readingPath.focus,
  records: pathRecords(readingPath, recordsById)
}));
const startHere = startHereIds.map((id) => recordsById.get(id)).filter(Boolean);
const topRecords = [...records]
  .sort((a, b) => b.bernstein.score - a.bernstein.score || Number(a.versionOrder || 0) - Number(b.versionOrder || 0))
  .slice(0, 30);
const withheldMeetingControls = meetingControls
  .map((control) => ({
    id: control.id,
    packetIdentifier: control.packetIdentifier,
    date: control.date,
    year: control.year,
    committee: control.committee,
    documentType: control.documentType,
    title: control.title,
    folderTitle: control.folderTitle,
    pageCount: control.pageCount,
    releaseStatus: control.releaseStatus,
    restriction: control.restriction,
    withdrawalSheetPages: control.withdrawalSheetPages,
    sourceUrl: control.sourceUrl,
    pdfUrl: control.pdfUrl,
    notes: control.notes,
    bernsteinReason: gapReason(control)
  }))
  .sort((a, b) => String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99")));

const tagCounts = countBy(records.flatMap((record) => record.bernstein.tags), (tag) => tag);
const pathCounts = Object.fromEntries(readingPaths.map((readingPath) => [readingPath.title, readingPath.records.length]));

const handoff = {
  version: "2.0-bernstein",
  generatedAt: new Date().toISOString(),
  title: "Barton Bernstein Handoff: Clinton NATO Expansion Decisionmaking Desk",
  scope: "Personalized layer over version 2.0, isolating documents where policymakers explicitly discuss whether and how to expand NATO's member states and surfacing decisionmaking, alternatives, bureaucratic process, Russia constraints, and withheld NSC/SOC evidence gaps.",
  publicSite: "https://therealjameswilson.github.io/Clinton-NATO-Expansion-Documents/bernstein/",
  profileSources,
  profileSignals,
  researchQuestions,
  preservedBaselines: {
    version1Tag: "v1.0",
    version2Tag: "v2.0",
    originalPackageRecords: packageManifest.selectedCount || packageManifest.selected?.length || 0,
    originalPackagePages: packageManifest.selectedPageTotal || 0,
    version2Records: version2.selectedCount || records.length,
    version2Pages: version2.selectedPageTotal || records.reduce((sum, record) => sum + Number(record.pageCount || 0), 0)
  },
  metrics: {
    records: records.length,
    pages: records.reduce((sum, record) => sum + Number(record.pageCount || 0), 0),
    startHereRecords: startHere.length,
    nscSocRecords: records.filter((record) => record.nscSoc?.isNscRecord || record.nscSoc?.isSummaryOfConclusions).length,
    withheldMeetingControls: withheldMeetingControls.length,
    topRecords: topRecords.length
  },
  tagDefinitions: tagDefinitions.map(({ id, label }) => ({ id, label })),
  tagCounts,
  pathCounts,
  readingPaths,
  startHere,
  topRecords,
  withheldMeetingControls,
  records
};

writeJson("data/bernstein-handoff.json", handoff);

const csvHeaders = [
  "score",
  "startHere",
  "date",
  "versionOrder",
  "versionPages",
  "pageCount",
  "lane",
  "tags",
  "question",
  "bernsteinNote",
  "title",
  "documentType",
  "sourceClass",
  "sourceUrl",
  "pdfUrl",
  "sourceNote"
];
writeText("data/bernstein-handoff.csv", `${csvHeaders.join(",")}\n${records.map((record) => csvHeaders.map((header) => {
  let value = record[header];
  if (header === "score") value = record.bernstein.score;
  if (header === "startHere") value = record.bernstein.isStartHere ? "yes" : "no";
  if (header === "versionPages") value = `${record.versionPageStart}-${record.versionPageEnd}`;
  if (header === "lane") value = record.version2?.lane || "";
  if (header === "tags") value = record.bernstein.tagLabels.join("; ");
  if (header === "question") value = record.bernstein.question;
  if (header === "bernsteinNote") value = record.bernstein.note;
  return csvEscape(value);
}).join(",")).join("\n")}\n`);

const profileRows = profileSignals.map((signal) => {
  const source = profileSources.find((item) => item.id === signal.sourceId);
  return {
    Signal: signal.signal,
    "Handoff Use": signal.handoffImplication,
    Source: source ? `[${source.label}](${source.url})` : signal.sourceId
  };
});

const pathRows = readingPaths.map((readingPath) => ({
  Path: readingPath.title,
  Records: readingPath.records.length,
  Focus: readingPath.focus
}));

const startRows = startHere.map((record, index) => ({
  "#": index + 1,
  Date: record.date,
  Pages: `${record.versionPageStart}-${record.versionPageEnd}`,
  Count: record.pageCount,
  Lane: record.version2?.lane || "",
  Tags: record.bernstein.tagLabels.join("; "),
  Record: record.title,
  Link: linkFor(record)
}));

const topRows = topRecords.map((record, index) => ({
  Rank: index + 1,
  Score: record.bernstein.score,
  Date: record.date,
  Lane: record.version2?.lane || "",
  Tags: record.bernstein.tagLabels.slice(0, 4).join("; "),
  Record: record.title,
  "Why Bernstein": record.bernstein.note,
  Link: linkFor(record)
}));

const gapRows = withheldMeetingControls.map((control) => ({
  Date: control.date,
  Committee: control.committee,
  Record: control.title,
  Packet: control.packetIdentifier,
  Pages: control.withdrawalSheetPages,
  Status: [control.releaseStatus, control.restriction].filter(Boolean).join(" / "),
  "Why It Matters": control.bernsteinReason,
  Link: linkFor(control)
}));

writeText("reports/bernstein-handoff.md", `# Barton Bernstein Handoff: Clinton NATO Expansion Decisionmaking Desk

Generated: ${handoff.generatedAt}

This is a personalized layer over version 2.0. It keeps the 1000-page baseline
and the v2.0 explicit-expansion dossier intact, then reorganizes the v2.0 core
for Professor Barton Bernstein around decisionmaking, alternatives, process,
Russia-related constraint, allied bargaining, and withheld NSC/SOC evidence
gaps.

## Profile Basis

${table(profileRows, ["Signal", "Handoff Use", "Source"])}

## Package Metrics

- Handoff version: ${handoff.version}
- Version 1.0 baseline package: ${handoff.preservedBaselines.originalPackageRecords} records / ${handoff.preservedBaselines.originalPackagePages} pages
- Version 2.0 explicit-expansion core: ${handoff.preservedBaselines.version2Records} records / ${handoff.preservedBaselines.version2Pages} pages
- Bernstein start-here sequence: ${handoff.metrics.startHereRecords} records
- NSC/SOC-flagged explicit-expansion records: ${handoff.metrics.nscSocRecords}
- Withheld meeting controls emphasized as evidence gaps: ${handoff.metrics.withheldMeetingControls}

## Research Questions

${researchQuestions.map((question) => `- ${question}`).join("\n")}

## Reading Paths

${table(pathRows, ["Path", "Records", "Focus"])}

## Start Here Sequence

${table(startRows, ["#", "Date", "Pages", "Count", "Lane", "Tags", "Record", "Link"])}

## Top Bernstein-Weighted Records

These are not a claim about historical importance. They are a triage ranking
for Bernstein-style questions about choice, process, alternatives, and
evidentiary gaps.

${table(topRows, ["Rank", "Score", "Date", "Lane", "Tags", "Record", "Why Bernstein", "Link"])}

## Withheld Minutes and Summaries of Conclusions

These controls remain outside the public document-level v2.0 core because the
controlled item is withheld or represented by withdrawal-sheet metadata. They
are surfaced here because they are exactly the kind of process evidence a
decisionmaking-focused historian would want to chase before declaring the
record complete.

${table(gapRows, ["Date", "Committee", "Record", "Packet", "Pages", "Status", "Why It Matters", "Link"])}

## Public Handoff Files

- Reading desk: [bernstein/](../bernstein/)
- Structured JSON: [data/bernstein-handoff.json](../data/bernstein-handoff.json)
- CSV export: [data/bernstein-handoff.csv](../data/bernstein-handoff.csv)
- Version 2.0 source dossier: [data/version-2-explicit-expansion.json](../data/version-2-explicit-expansion.json)
`);

console.log(`Wrote Bernstein handoff: ${records.length} records, ${startHere.length} start-here records, ${withheldMeetingControls.length} withheld controls.`);

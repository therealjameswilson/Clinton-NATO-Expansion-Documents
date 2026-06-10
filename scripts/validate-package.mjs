import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const registerPath = path.join(repoRoot, "data", "source-register.json");
const packageManifestPath = path.join(repoRoot, "data", "package-manifest.json");
const version2ManifestPath = path.join(repoRoot, "data", "version-2-explicit-expansion.json");
const bernsteinHandoffPath = path.join(repoRoot, "data", "bernstein-handoff.json");
const historiographyPrintManifestPath = path.join(repoRoot, "data", "historiography-print-manifest.json");
const sourceExhaustionPath = path.join(repoRoot, "data", "source-exhaustion-audit.json");
const clintonMeetingControlsPath = path.join(repoRoot, "data", "clinton-library-meeting-controls.json");
const requiredReports = [
  "reports/upstream-ingest-audit.md",
  "reports/nsc-soc-priority-queue.md",
  "reports/assembly-plan.md",
  "reports/package-manifest.md",
  "reports/package-gap-audit.md",
  "reports/package-local-build-audit.md",
  "reports/source-exhaustion-audit.md",
  "reports/version-2-explicit-expansion.md",
  "reports/bernstein-handoff.md",
  "reports/bernstein-print-package.md"
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const records = JSON.parse(fs.readFileSync(registerPath, "utf8"));
const packageManifest = JSON.parse(fs.readFileSync(packageManifestPath, "utf8"));
const version2Manifest = JSON.parse(fs.readFileSync(version2ManifestPath, "utf8"));
const bernsteinHandoff = JSON.parse(fs.readFileSync(bernsteinHandoffPath, "utf8"));
const historiographyPrintManifest = JSON.parse(fs.readFileSync(historiographyPrintManifestPath, "utf8"));
const sourceExhaustion = JSON.parse(fs.readFileSync(sourceExhaustionPath, "utf8"));
const clintonMeetingControls = JSON.parse(fs.readFileSync(clintonMeetingControlsPath, "utf8"));

if (!Array.isArray(records)) fail("source-register.json must be an array");
if (records.length < 100) fail(`expected at least 100 seed records, found ${records.length}`);

const ids = new Set();
for (const record of records) {
  for (const field of ["id", "title", "sourceClass", "inclusionStatus", "verificationStatus", "priority"]) {
    if (!record[field]) fail(`record ${record.id || "(missing id)"} is missing ${field}`);
  }
  if (ids.has(record.id)) fail(`duplicate id: ${record.id}`);
  ids.add(record.id);
  if (record.sourceUrl && !/^https?:\/\//.test(record.sourceUrl)) fail(`non-http sourceUrl for ${record.id}`);
  if (record.pdfUrl && !/^https?:\/\//.test(record.pdfUrl)) fail(`non-http pdfUrl for ${record.id}`);
  if (record.sourceClass === "google-drive-private-intake") fail(`private Drive item leaked into public register: ${record.id}`);
}

const nscSocCount = records.filter((record) => record.nscSoc?.isNscRecord || record.nscSoc?.isSummaryOfConclusions).length;
if (nscSocCount < 10) fail(`expected at least 10 NSC/SOC records, found ${nscSocCount}`);

const knownPages = records.reduce((sum, record) => sum + (Number(record.pageCount) || 0), 0);
if (knownPages < 1000) fail(`expected at least 1000 known pages across seed register, found ${knownPages}`);
const packetControls = records.filter((record) => record.sourceClass === "clinton-library-mdr-packet");
if (packetControls.length < 5) fail(`expected Clinton Library packet controls, found ${packetControls.length}`);
const promotedClintonDocs = records.filter((record) => record.upstream?.workspace === "live-clinton-library-document-extraction");
if (promotedClintonDocs.length < 2) fail(`expected promoted Clinton Library document rows, found ${promotedClintonDocs.length}`);

if (packageManifest.targetPages !== 1000) fail(`package target must be 1000 pages, found ${packageManifest.targetPages}`);
if (packageManifest.selectedPageTotal !== packageManifest.targetPages) fail(`package manifest selected ${packageManifest.selectedPageTotal} pages, expected exactly ${packageManifest.targetPages}`);
if (!Array.isArray(packageManifest.selected) || packageManifest.selected.length < 50) fail("package manifest selected set is unexpectedly small");
for (const record of packageManifest.selected || []) {
  if (!record.pdfUrl || !/^https?:\/\//.test(record.pdfUrl)) fail(`package record missing public PDF URL: ${record.id}`);
  if (!Number(record.pageCount)) fail(`package record missing page count: ${record.id}`);
  if (Number(record.year) < 1993 || Number(record.year) > 2000) fail(`package record outside 1993-2000: ${record.id}`);
  if (record.sourceClass === "nara-scout-lead") fail(`NARA Scout lead entered package selection without promotion: ${record.id}`);
  if (record.sourceClass === "clinton-library-mdr-packet") fail(`Clinton Library packet control entered package selection without extraction: ${record.id}`);
  const text = [record.title, record.sourceNote, ...(record.themes || [])].join(" ").toLowerCase();
  if (!/(nato|accession|madrid|founding act|partnership for peace|pfp|open door|open-door|cfe|osce|csce|esdi|european security|architecture|ratification|candidate-states|nato-russia|nac-usnato|nsc-soc)/.test(text)) {
    fail(`package record lacks NATO expansion/security relevance marker: ${record.id}`);
  }
}
if ((packageManifest.nscSocCandidateCount || 0) < 10) fail(`expected NSC/SOC attention queue, found ${packageManifest.nscSocCandidateCount}`);
if ((packageManifest.clintonLibraryPacketControlCount || 0) < 5) fail(`expected Clinton Library packet extraction queue, found ${packageManifest.clintonLibraryPacketControlCount}`);
if (version2Manifest.version !== "2.0") fail(`expected version 2.0 manifest, found ${version2Manifest.version}`);
if (!Array.isArray(version2Manifest.selected) || version2Manifest.selected.length < 50) fail("version 2.0 selected set is unexpectedly small");
if (version2Manifest.selectedCount !== version2Manifest.selected.length) fail("version 2.0 selectedCount does not match selected array length");
if ((version2Manifest.selectedPageTotal || 0) < 250) fail(`version 2.0 page total is unexpectedly low: ${version2Manifest.selectedPageTotal}`);
if (!Array.isArray(version2Manifest.reviewCandidates)) fail("version 2.0 review queue is missing");
for (const record of version2Manifest.selected || []) {
  if (!record.pdfUrl || !/^https?:\/\//.test(record.pdfUrl)) fail(`version 2.0 record missing public PDF URL: ${record.id}`);
  if (!Number(record.pageCount)) fail(`version 2.0 record missing page count: ${record.id}`);
  if (Number(record.year) < 1993 || Number(record.year) > 2000) fail(`version 2.0 record outside 1993-2000: ${record.id}`);
  if (record.sourceClass === "nara-scout-lead") fail(`NARA Scout lead entered version 2.0 without promotion: ${record.id}`);
  if (record.sourceClass === "clinton-library-mdr-packet") fail(`Clinton Library packet control entered version 2.0 without extraction: ${record.id}`);
  if (!record.version2?.matches?.length) fail(`version 2.0 record lacks direct expansion match: ${record.id}`);
}
if (bernsteinHandoff.version !== "2.0-bernstein") fail(`expected Bernstein handoff version 2.0-bernstein, found ${bernsteinHandoff.version}`);
if (!Array.isArray(bernsteinHandoff.profileSources) || bernsteinHandoff.profileSources.length < 3) fail("Bernstein handoff missing profile sources");
for (const source of bernsteinHandoff.profileSources || []) {
  if (!source.url || !/^https?:\/\//.test(source.url)) fail(`Bernstein profile source missing public URL: ${source.id || source.label}`);
}
if (!Array.isArray(bernsteinHandoff.profileSignals) || bernsteinHandoff.profileSignals.length < 3) fail("Bernstein handoff missing profile signals");
if (!Array.isArray(bernsteinHandoff.researchQuestions) || bernsteinHandoff.researchQuestions.length < 5) fail("Bernstein handoff missing research questions");
if (!Array.isArray(bernsteinHandoff.records) || bernsteinHandoff.records.length !== version2Manifest.selected.length) {
  fail(`Bernstein handoff record count ${bernsteinHandoff.records?.length || 0} does not match v2.0 ${version2Manifest.selected.length}`);
}
if (!Array.isArray(bernsteinHandoff.startHere) || bernsteinHandoff.startHere.length < 10) fail("Bernstein handoff start-here sequence is unexpectedly small");
if (!Array.isArray(bernsteinHandoff.readingPaths) || bernsteinHandoff.readingPaths.length < 5) fail("Bernstein handoff missing reading paths");
if (!Array.isArray(bernsteinHandoff.withheldMeetingControls) || bernsteinHandoff.withheldMeetingControls.length < 5) {
  fail("Bernstein handoff missing withheld meeting/SOC controls");
}
for (const record of bernsteinHandoff.records || []) {
  if (!record.bernstein?.tags?.length) fail(`Bernstein record lacks tags: ${record.id}`);
  if (!Number.isFinite(Number(record.bernstein?.score))) fail(`Bernstein record lacks numeric score: ${record.id}`);
  if (!record.bernstein?.note) fail(`Bernstein record lacks handoff note: ${record.id}`);
}
if (historiographyPrintManifest.version !== "print-1.0") {
  fail(`expected historiography print manifest print-1.0, found ${historiographyPrintManifest.version}`);
}
if (!Array.isArray(historiographyPrintManifest.printPolicy) || historiographyPrintManifest.printPolicy.length < 3) {
  fail("historiography print manifest missing print policy");
}
if (!historiographyPrintManifest.primaryDocumentPackage?.localPath?.startsWith("private/")) {
  fail("historiography print manifest primary package must point to ignored private path");
}
if (!Array.isArray(historiographyPrintManifest.includedFullText) || historiographyPrintManifest.includedFullText.length < 10) {
  fail("historiography print manifest included full-text set is unexpectedly small");
}
if (!Array.isArray(historiographyPrintManifest.citationOnly) || historiographyPrintManifest.citationOnly.length < 10) {
  fail("historiography print manifest citation-only set is unexpectedly small");
}
const printIds = new Set();
for (const item of historiographyPrintManifest.includedFullText || []) {
  if (!item.id || printIds.has(item.id)) fail(`bad or duplicate print manifest id: ${item.id}`);
  printIds.add(item.id);
  if (!Number(item.order)) fail(`print manifest item missing order: ${item.id}`);
  if (!item.authors || !item.title || !item.citation) fail(`print manifest item missing citation fields: ${item.id}`);
  if (!item.rightsMode) fail(`print manifest item missing rightsMode: ${item.id}`);
  if (!Number(item.expectedPages)) fail(`print manifest item missing expected pages: ${item.id}`);
  if (!item.pdfUrl && !item.localPath) fail(`print manifest item missing pdfUrl/localPath: ${item.id}`);
  if (item.localPath && !item.rightsMode.includes("local")) fail(`print manifest local item lacks local rights mode: ${item.id}`);
}
for (const requiredId of [
  "trachtenberg-project-muse-non-extension-2021",
  "goldgeier-shifrinson-evaluating-nato-enlargement-2020",
  "shifrinson-deal-or-no-deal-2016",
  "kramer-myth-no-nato-enlargement-pledge-2009"
]) {
  if (!printIds.has(requiredId)) fail(`historiography print manifest missing required item: ${requiredId}`);
}
for (const item of historiographyPrintManifest.citationOnly || []) {
  if (!item.id || !item.authors || !item.title || !item.citation || !item.url || !item.accessNote) {
    fail(`citation-only print manifest item missing fields: ${item.id || "(missing id)"}`);
  }
}
if (!Array.isArray(sourceExhaustion.clintonLibraryPacketControls) || sourceExhaustion.clintonLibraryPacketControls.length < 5) {
  fail("source-exhaustion audit missing Clinton Library packet controls");
}
if (!Array.isArray(sourceExhaustion.clintonLibraryPromotedDocuments) || sourceExhaustion.clintonLibraryPromotedDocuments.length < 2) {
  fail("source-exhaustion audit missing promoted Clinton Library document rows");
}
if (!Array.isArray(clintonMeetingControls) || clintonMeetingControls.length < 5) {
  fail(`expected Clinton Library meeting/SOC controls, found ${clintonMeetingControls.length}`);
}
if (!Array.isArray(sourceExhaustion.clintonLibraryMeetingControls) || sourceExhaustion.clintonLibraryMeetingControls.length !== clintonMeetingControls.length) {
  fail("source-exhaustion audit missing Clinton Library meeting/SOC controls");
}

for (const relativePath of requiredReports) {
  const reportPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(reportPath)) fail(`missing report: ${relativePath}`);
  const reportText = fs.readFileSync(reportPath, "utf8");
  if (reportText.includes("Run `npm run build`")) fail(`stale report: ${relativePath}`);
  if (relativePath === "reports/bernstein-print-package.md") {
    if (!reportText.includes("Primary-document order: chronological by document date")) {
      fail("print package report no longer records chronological primary-document order");
    }
    if (!reportText.includes("Chronological order violations after rebuild: 0")) {
      fail("print package report does not verify zero chronological order violations");
    }
    if (!reportText.includes("Generated per-document annotation sheets: 178")) {
      fail("print package report does not verify one generated annotation sheet per primary record");
    }
    if (!reportText.includes("Official source-packet annotation/control/withdrawal pages included:")) {
      fail("print package report does not record official annotation/control/withdrawal page inclusion");
    }
  }
}

if (!process.exitCode) {
  console.log(`Validated ${records.length} records, ${nscSocCount} NSC/SOC flags, ${knownPages} known pages, ${packageManifest.selectedPageTotal} selected package pages, ${version2Manifest.selectedCount} v2.0 records, ${bernsteinHandoff.records.length} Bernstein handoff records, and ${historiographyPrintManifest.includedFullText.length} print historiography PDFs.`);
}

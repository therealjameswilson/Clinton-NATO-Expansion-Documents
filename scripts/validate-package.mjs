import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const registerPath = path.join(repoRoot, "data", "source-register.json");
const packageManifestPath = path.join(repoRoot, "data", "package-manifest.json");
const sourceExhaustionPath = path.join(repoRoot, "data", "source-exhaustion-audit.json");
const requiredReports = [
  "reports/upstream-ingest-audit.md",
  "reports/nsc-soc-priority-queue.md",
  "reports/assembly-plan.md",
  "reports/package-manifest.md",
  "reports/package-gap-audit.md",
  "reports/package-local-build-audit.md",
  "reports/source-exhaustion-audit.md"
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const records = JSON.parse(fs.readFileSync(registerPath, "utf8"));
const packageManifest = JSON.parse(fs.readFileSync(packageManifestPath, "utf8"));
const sourceExhaustion = JSON.parse(fs.readFileSync(sourceExhaustionPath, "utf8"));

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
if (!Array.isArray(sourceExhaustion.clintonLibraryPacketControls) || sourceExhaustion.clintonLibraryPacketControls.length < 5) {
  fail("source-exhaustion audit missing Clinton Library packet controls");
}
if (!Array.isArray(sourceExhaustion.clintonLibraryPromotedDocuments) || sourceExhaustion.clintonLibraryPromotedDocuments.length < 2) {
  fail("source-exhaustion audit missing promoted Clinton Library document rows");
}

for (const relativePath of requiredReports) {
  const reportPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(reportPath)) fail(`missing report: ${relativePath}`);
  const reportText = fs.readFileSync(reportPath, "utf8");
  if (reportText.includes("Run `npm run build`")) fail(`stale report: ${relativePath}`);
}

if (!process.exitCode) {
  console.log(`Validated ${records.length} records, ${nscSocCount} NSC/SOC flags, ${knownPages} known pages, and ${packageManifest.selectedPageTotal} selected package pages.`);
}

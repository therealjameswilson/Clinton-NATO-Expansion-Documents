import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const registerPath = path.join(repoRoot, "data", "source-register.json");
const requiredReports = [
  "reports/upstream-ingest-audit.md",
  "reports/nsc-soc-priority-queue.md",
  "reports/assembly-plan.md"
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const records = JSON.parse(fs.readFileSync(registerPath, "utf8"));

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

for (const relativePath of requiredReports) {
  const reportPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(reportPath)) fail(`missing report: ${relativePath}`);
  const reportText = fs.readFileSync(reportPath, "utf8");
  if (reportText.includes("Run `npm run build`")) fail(`stale report: ${relativePath}`);
}

if (!process.exitCode) {
  console.log(`Validated ${records.length} records, ${nscSocCount} NSC/SOC flags, ${knownPages} known pages.`);
}


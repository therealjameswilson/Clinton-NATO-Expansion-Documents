import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(repoRoot, "data", "package-manifest.json");
const outputRoot = path.join(repoRoot, "private", "package-pdfs");
const sourceRoot = path.join(outputRoot, "sources");
const packagePdfPath = path.join(outputRoot, "clinton-nato-expansion-bernstein-1000-page-package.pdf");
const localAuditPath = path.join(repoRoot, "reports", "package-local-build-audit.md");
const dryRun = process.argv.includes("--dry-run");
const assemble = process.argv.includes("--assemble");

function safeName(value) {
  return String(value || "record").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

function pageRange(record) {
  const pages = String(record.sourcePages || "").trim();
  if (!pages) return "1-z";
  if (/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(pages)) return pages.replace(/,/g, ",");
  return "1-z";
}

async function download(url, target) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(target, Buffer.from(arrayBuffer));
}

function markdownEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function table(rows, headers) {
  return [
    headers.join(" | "),
    headers.map(() => "---").join(" | "),
    ...rows.map((row) => headers.map((header) => markdownEscape(row[header])).join(" | "))
  ].join("\n");
}

function pdfInfo(filePath) {
  const text = execFileSync("pdfinfo", [filePath], { encoding: "utf8" });
  const pages = Number(text.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
  const fileSizeBytes = Number(text.match(/^File size:\s+(\d+)\s+bytes/m)?.[1] || 0);
  const pdfVersion = text.match(/^PDF version:\s+(.+)$/m)?.[1] || "";
  return { pages, fileSizeBytes, pdfVersion };
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
fs.mkdirSync(sourceRoot, { recursive: true });

const audit = [];
const qpdfArgs = ["--warning-exit-0", "--empty", "--pages"];
for (const record of manifest.selected) {
  const url = record.pdfUrl || record.sourceUrl;
  const filename = `${String(record.packageOrder).padStart(3, "0")}-${safeName(record.id)}.pdf`;
  const target = path.join(sourceRoot, filename);
  const range = pageRange(record);
  const item = {
    packageOrder: record.packageOrder,
    id: record.id,
    title: record.title,
    url,
    localPath: path.relative(repoRoot, target),
    pageRange: range,
    expectedPages: record.pageCount,
    status: "pending"
  };

  if (!url || !/^https?:\/\//i.test(url)) {
    item.status = "skipped";
    item.error = "No public HTTP(S) PDF URL";
  } else if (dryRun) {
    item.status = "dry-run";
  } else {
    try {
      if (!fs.existsSync(target)) await download(url, target);
      item.status = "downloaded";
      item.bytes = fs.statSync(target).size;
      qpdfArgs.push(target, range);
    } catch (error) {
      item.status = "error";
      item.error = error.message;
    }
  }
  audit.push(item);
}
qpdfArgs.push("--", packagePdfPath);

fs.writeFileSync(path.join(outputRoot, "download-audit.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  dryRun,
  assemble,
  packagePdfPath: path.relative(repoRoot, packagePdfPath),
  items: audit
}, null, 2)}\n`);

fs.writeFileSync(path.join(outputRoot, "qpdf-assemble.sh"), `#!/usr/bin/env bash
set -euo pipefail
qpdf ${qpdfArgs.map((arg) => `'${String(arg).replace(/'/g, "'\\''")}'`).join(" ")}
`);
fs.chmodSync(path.join(outputRoot, "qpdf-assemble.sh"), 0o755);

if (assemble && !dryRun) {
  const downloaded = audit.filter((item) => item.status === "downloaded");
  if (downloaded.length !== manifest.selected.length) {
    throw new Error(`Refusing to assemble: downloaded ${downloaded.length} of ${manifest.selected.length} records.`);
  }
  execFileSync("qpdf", qpdfArgs, { stdio: "inherit" });
  execFileSync("qpdf", ["--warning-exit-0", "--check", packagePdfPath], { stdio: "inherit" });
  const info = pdfInfo(packagePdfPath);
  const sourceBytes = downloaded.reduce((sum, item) => sum + Number(item.bytes || 0), 0);
  const issueRows = audit
    .filter((item) => item.status !== "downloaded")
    .map((item) => ({
      "#": item.packageOrder,
      Status: item.status,
      Record: item.title,
      Detail: item.error || ""
    }));

  fs.mkdirSync(path.dirname(localAuditPath), { recursive: true });
  fs.writeFileSync(localAuditPath, `# Local Package Build Audit

Generated: ${new Date().toISOString()}

This audit records a local private build of the Bernstein NATO expansion package.
The assembled PDF and downloaded source PDFs live under \`private/\`, which is
ignored by Git; the public repository keeps the manifest, links, and build
recipe.

## Result

- Manifest generated: ${manifest.generatedAt}
- Selected records: ${manifest.selectedCount}
- Expected selected pages: ${manifest.selectedPageTotal}
- Downloaded source PDFs: ${downloaded.length}
- Downloaded source bytes: ${sourceBytes}
- Assembled PDF pages: ${info.pages}
- Assembled PDF bytes: ${info.fileSizeBytes}
- Assembled PDF version: ${info.pdfVersion}
- Local assembled path: \`${path.relative(repoRoot, packagePdfPath)}\`
- Integrity check: \`qpdf --warning-exit-0 --check\` found no syntax or stream encoding errors.

## Notes

- \`qpdf --warning-exit-0\` is intentional. A small number of archival PDFs can
  emit repairable cross-reference warnings during assembly even when the final
  file validates and \`pdfinfo\` reads the expected page count.
- Re-run \`npm run download:package -- --assemble\` after any manifest change.
- Do not commit files under \`private/\`.

## Download Issues

${issueRows.length ? table(issueRows, ["#", "Status", "Record", "Detail"]) : "No download errors in this local build."}
`);
}

const counts = audit.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({ outputRoot: path.relative(repoRoot, outputRoot), counts, packagePdfPath: path.relative(repoRoot, packagePdfPath) }, null, 2));

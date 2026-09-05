import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const auditPath = path.join(repoRoot, "private", "print-package", "print-package-audit.json");
const sourcePdfPath = path.join(repoRoot, "private", "print-package", "bernstein-nato-expansion-print-packet.pdf");
const deliveryParent = path.join(repoRoot, "private", "delivery");
const deliveryRoot = path.join(deliveryParent, "bernstein-nato-expansion-print-send-package");
const workingRoot = path.join(deliveryParent, "bernstein-nato-expansion-print-send-working");
const volumeRoot = path.join(deliveryRoot, "volumes");
const manifestCsvPath = path.join(deliveryRoot, "00_manifest.csv");
const readmePath = path.join(deliveryRoot, "00_README_print_and_send.md");
const deliveryReportPath = path.join(repoRoot, "reports", "bernstein-print-send-package.md");
const dataPath = path.join(workingRoot, "delivery-package-data.json");
const rendererPath = path.join(repoRoot, "scripts", "render-delivery-package-documents.py");
const fullCopyPath = path.join(deliveryRoot, "00_full_packet_2457_pages.pdf");
const coverMemoPath = path.join(deliveryRoot, "00_cover_memo_to_professor_bernstein.pdf");
const instructionsPath = path.join(deliveryRoot, "00_print_shop_instructions.pdf");
const zipPath = path.join(deliveryParent, "bernstein-nato-expansion-print-send-package.zip");
const bundledPython = "/Users/jameswilson/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const python = process.env.PRINT_PACKAGE_PYTHON || (fs.existsSync(bundledPython) ? bundledPython : "python3");

function fail(message) {
  throw new Error(message);
}

function ensureTool(name) {
  try {
    execFileSync("sh", ["-lc", `command -v ${name}`], { stdio: "ignore" });
  } catch {
    fail(`Missing required command-line tool: ${name}`);
  }
}

function pdfInfo(filePath) {
  const text = execFileSync("pdfinfo", [filePath], { encoding: "utf8" });
  return {
    pages: Number(text.match(/^Pages:\s+(\d+)/m)?.[1] || 0),
    fileSizeBytes: Number(text.match(/^File size:\s+(\d+)\s+bytes/m)?.[1] || 0),
    pdfVersion: text.match(/^PDF version:\s+(.+)$/m)?.[1] || ""
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows) {
  fs.writeFileSync(filePath, rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n");
}

function pagesToRange(pages) {
  const values = [...new Set(pages)].sort((a, b) => a - b);
  const parts = [];
  let start = null;
  let previous = null;
  for (const page of values) {
    if (start === null) {
      start = page;
      previous = page;
    } else if (page === previous + 1) {
      previous = page;
    } else {
      parts.push(start === previous ? String(start) : `${start}-${previous}`);
      start = page;
      previous = page;
    }
  }
  if (start !== null) parts.push(start === previous ? String(start) : `${start}-${previous}`);
  return parts.join(",");
}

function safeFileName(value) {
  return String(value || "volume")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 150);
}

function primaryBundles(audit) {
  let page = Number(audit.frontMatterPages) + 2;
  return audit.primary.records.map((record) => {
    const bundlePages = 1 + Number(record.officialAnnotationPages || 0) + Number(record.documentPages || 0);
    const item = {
      ...record,
      bundlePages,
      fullStart: page,
      fullEnd: page + bundlePages - 1
    };
    page += bundlePages;
    return item;
  });
}

function buildPrimaryVolumes(audit) {
  const targetPages = 380;
  const bundles = primaryBundles(audit);
  const groups = [];
  let current = [];
  let pages = 0;
  for (const bundle of bundles) {
    if (current.length && pages + bundle.bundlePages > targetPages) {
      groups.push(current);
      current = [];
      pages = 0;
    }
    current.push(bundle);
    pages += bundle.bundlePages;
  }
  if (current.length) groups.push(current);

  return groups.map((group, index) => {
    const first = group[0];
    const last = group.at(-1);
    const packetStart = index === 0 ? 1 : first.fullStart;
    const packetEnd = last.fullEnd;
    const recordRange = `${String(first.chronologicalOrder).padStart(3, "0")}-${String(last.chronologicalOrder).padStart(3, "0")}`;
    return {
      section: "Primary documents",
      title: index === 0
        ? `Primary Documents, Part ${index + 1}: Front Matter and Records ${recordRange}`
        : `Primary Documents, Part ${index + 1}: Records ${recordRange}`,
      packetStart,
      packetEnd,
      packetPageRange: `${packetStart}-${packetEnd}`,
      contentPages: packetEnd - packetStart + 1,
      dateSpan: `${first.date} to ${last.date}`,
      recordRange,
      note: "Primary records are arranged chronologically. Each record begins with a generated annotation sheet, followed by official source-packet annotation/control/withdrawal pages when detected, then retained document text."
    };
  });
}

function buildHistoriographyVolumes(audit, nextNumber) {
  const histStart = Number(audit.frontMatterPages) + 1 + Number(audit.primary.pages) + 1;
  let page = histStart;
  const entries = audit.includedFullText.map((item) => {
    const contentPages = Number(item.pages) + 1;
    const entry = {
      ...item,
      packetStart: page,
      packetEnd: page + contentPages - 1,
      contentPages
    };
    page += contentPages;
    return entry;
  });

  const shortEntries = entries.slice(0, 11);
  const openDoor = entries[11];
  if (!openDoor) fail("Expected Hamilton/Spohr Open Door historiography entry.");
  const openDoorFirstEnd = openDoor.packetStart + Math.ceil(openDoor.contentPages / 2) - 1;
  return [
    {
      section: "Historiography",
      title: "Historiography, Part 1: Goldgeier, Shifrinson, Kramer, Sarotte, Trachtenberg, and ISSF",
      packetStart: shortEntries[0].packetStart,
      packetEnd: shortEntries.at(-1).packetEnd,
      packetPageRange: `${shortEntries[0].packetStart}-${shortEntries.at(-1).packetEnd}`,
      contentPages: shortEntries.at(-1).packetEnd - shortEntries[0].packetStart + 1,
      dateSpan: "1999-2021 historiography",
      recordRange: "Historiography 001-011",
      note: "This volume contains the shorter appended historiographical pieces and their divider sheets."
    },
    {
      section: "Historiography",
      title: "Historiography, Part 2: Hamilton and Spohr, Open Door, Part 1 of 2",
      packetStart: openDoor.packetStart,
      packetEnd: openDoorFirstEnd,
      packetPageRange: `${openDoor.packetStart}-${openDoorFirstEnd}`,
      contentPages: openDoorFirstEnd - openDoor.packetStart + 1,
      dateSpan: "2019",
      recordRange: "Historiography 012, first half",
      note: "This volume begins the Hamilton/Spohr Open Door book section and includes the original section divider."
    },
    {
      section: "Historiography",
      title: "Historiography, Part 3: Hamilton and Spohr, Open Door, Part 2 of 2",
      packetStart: openDoorFirstEnd + 1,
      packetEnd: openDoor.packetEnd,
      packetPageRange: `${openDoorFirstEnd + 1}-${openDoor.packetEnd}`,
      contentPages: openDoor.packetEnd - openDoorFirstEnd,
      dateSpan: "2019",
      recordRange: "Historiography 012, second half",
      note: "This volume continues the Hamilton/Spohr Open Door book section."
    }
  ].map((volume, index) => ({ ...volume, number: nextNumber + index }));
}

function extractRange(inputPath, outputPath, pageRange) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  execFileSync("qpdf", [
    "--warning-exit-0",
    "--empty",
    "--pages",
    inputPath,
    pageRange,
    "--",
    outputPath
  ], { stdio: "ignore" });
}

function mergePdfs(inputs, outputPath) {
  execFileSync("pdfunite", inputs.concat(outputPath), { stdio: "ignore" });
}

function renderReadme(data) {
  const volumeRows = data.volumes.map((volume) => (
    `| ${String(volume.number).padStart(2, "0")} | ${volume.title} | ${volume.packetPageRange} | ${volume.finalPages} | ${volume.fileName} |`
  )).join("\n");
  return `# Barton Bernstein NATO Expansion Print/Send Package

Generated: ${data.generatedAt}

This folder contains a print-ready delivery package for Professor Barton Bernstein.

## Print Order

1. Print \`00_cover_memo_to_professor_bernstein.pdf\`.
2. Print \`00_print_shop_instructions.pdf\` for the print shop or sender.
3. Print and bind the numbered PDFs in \`volumes/\` in numeric order.
4. Use \`00_manifest.csv\` as the file checklist.

The full single-file packet is included as \`00_full_packet_2457_pages.pdf\` for archival/reference use. The numbered volumes are the recommended physical print set.

## Summary

- Full packet pages: ${data.finalPages}
- Primary section pages: ${data.primaryPages}
- Retained primary document pages: ${data.retainedDocumentPages}
- Sparse/nontext primary document pages removed: ${data.removedSparseDocumentPages}
- Generated annotation sheets: ${data.generatedAnnotationPages}
- Official annotation/control/withdrawal pages: ${data.officialAnnotationPages}
- Chronology violations: ${data.chronologyViolations}
- Volume count: ${data.volumeCount}

## Volumes

| Volume | Contents | Packet pages | PDF pages | File |
| --- | --- | --- | ---: | --- |
${volumeRows}
`;
}

function renderReport(data) {
  const volumeRows = data.volumes.map((volume) => ({
    Volume: String(volume.number).padStart(2, "0"),
    Contents: volume.title,
    "Packet Pages": volume.packetPageRange,
    "PDF Pages": volume.finalPages,
    File: `private/delivery/bernstein-nato-expansion-print-send-package/volumes/${volume.fileName}`
  }));
  const headers = ["Volume", "Contents", "Packet Pages", "PDF Pages", "File"];
  const table = [
    headers.join(" | "),
    headers.map(() => "---").join(" | "),
    ...volumeRows.map((row) => headers.map((header) => String(row[header] ?? "").replace(/\|/g, "\\|")).join(" | "))
  ].join("\n");
  return `# Bernstein Print/Send Delivery Package

Generated: ${data.generatedAt}

This report records the local print/send package created from the filtered Barton Bernstein NATO expansion print packet.

## Local Deliverables

- Delivery folder: \`private/delivery/bernstein-nato-expansion-print-send-package\`
- Zip archive: \`private/delivery/bernstein-nato-expansion-print-send-package.zip\`
- Cover memo: \`private/delivery/bernstein-nato-expansion-print-send-package/00_cover_memo_to_professor_bernstein.pdf\`
- Print instructions: \`private/delivery/bernstein-nato-expansion-print-send-package/00_print_shop_instructions.pdf\`
- Full packet copy: \`private/delivery/bernstein-nato-expansion-print-send-package/00_full_packet_2457_pages.pdf\`
- Manifest CSV: \`private/delivery/bernstein-nato-expansion-print-send-package/00_manifest.csv\`

## Packet Summary

- Full packet pages: ${data.finalPages}
- Primary section pages: ${data.primaryPages}
- Original selected primary document pages: ${data.originalDocumentPages}
- Retained primary document pages: ${data.retainedDocumentPages}
- Sparse/nontext primary document pages removed: ${data.removedSparseDocumentPages}
- Generated annotation sheets: ${data.generatedAnnotationPages}
- Official annotation/control/withdrawal pages: ${data.officialAnnotationPages}
- Chronology violations: ${data.chronologyViolations}
- Volume count: ${data.volumeCount}

## Volume Manifest

${table}

## Rebuild

\`\`\`bash
npm run package:send
\`\`\`
`;
}

async function main() {
  for (const tool of ["pdfinfo", "qpdf", "pdfunite", "zip"]) ensureTool(tool);
  if (!fs.existsSync(auditPath)) fail("Missing print-package audit. Run npm run build:print -- --skip-download first.");
  if (!fs.existsSync(sourcePdfPath)) fail("Missing print packet PDF. Run npm run build:print -- --skip-download first.");

  const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  const info = pdfInfo(sourcePdfPath);
  if (info.pages !== Number(audit.finalPages)) {
    fail(`Print packet page mismatch: pdfinfo found ${info.pages}, audit says ${audit.finalPages}`);
  }

  fs.rmSync(deliveryRoot, { recursive: true, force: true });
  fs.rmSync(workingRoot, { recursive: true, force: true });
  fs.mkdirSync(volumeRoot, { recursive: true });
  fs.mkdirSync(workingRoot, { recursive: true });
  fs.copyFileSync(sourcePdfPath, fullCopyPath);

  const primaryVolumes = buildPrimaryVolumes(audit);
  const histVolumes = buildHistoriographyVolumes(audit, primaryVolumes.length + 1);
  const volumes = [...primaryVolumes, ...histVolumes].map((volume, index) => {
    const number = index + 1;
    const fileName = `${String(number).padStart(2, "0")}_${safeFileName(volume.title)}.pdf`;
    return {
      ...volume,
      number,
      fileName,
      outputPath: path.join(volumeRoot, fileName),
      contentPath: path.join(workingRoot, `${String(number).padStart(2, "0")}-content.pdf`),
      coverPath: path.join(workingRoot, `${String(number).padStart(2, "0")}-cover.pdf`)
    };
  });

  const data = {
    generatedAt: new Date().toISOString(),
    generatedDate: new Date().toISOString().slice(0, 10),
    sourcePdfPath,
    deliveryRoot,
    zipPath,
    coverMemoPath,
    instructionsPath,
    fullCopyPath,
    finalPages: audit.finalPages,
    primaryPages: audit.primary.pages,
    originalDocumentPages: audit.primary.originalDocumentPages,
    retainedDocumentPages: audit.primary.documentPages,
    removedSparseDocumentPages: audit.primary.removedSparseDocumentPages,
    generatedAnnotationPages: audit.primary.generatedAnnotationPages,
    officialAnnotationPages: audit.primary.officialAnnotationPages,
    chronologyViolations: audit.primary.sortedViolations,
    volumeCount: volumes.length,
    volumes
  };
  writeJson(dataPath, data);
  execFileSync(python, [rendererPath, dataPath], { stdio: "inherit" });

  for (const volume of volumes) {
    extractRange(sourcePdfPath, volume.contentPath, volume.packetPageRange);
    mergePdfs([volume.coverPath, volume.contentPath], volume.outputPath);
    const volumeInfo = pdfInfo(volume.outputPath);
    volume.finalPages = volumeInfo.pages;
    volume.fileSizeBytes = volumeInfo.fileSizeBytes;
  }

  writeJson(dataPath, data);
  const csvRows = [
    ["volume", "contents", "packet_pages", "pdf_pages", "file"],
    ...volumes.map((volume) => [
      String(volume.number).padStart(2, "0"),
      volume.title,
      volume.packetPageRange,
      volume.finalPages,
      `volumes/${volume.fileName}`
    ])
  ];
  writeCsv(manifestCsvPath, csvRows);
  fs.writeFileSync(readmePath, renderReadme(data));
  fs.mkdirSync(path.dirname(deliveryReportPath), { recursive: true });
  fs.writeFileSync(deliveryReportPath, renderReport(data));

  fs.rmSync(zipPath, { force: true });
  execFileSync("zip", ["-qr", zipPath, path.basename(deliveryRoot)], { cwd: deliveryParent, stdio: "ignore" });
  const zipBytes = fs.statSync(zipPath).size;
  fs.rmSync(workingRoot, { recursive: true, force: true });

  console.log(JSON.stringify({
    deliveryRoot: path.relative(repoRoot, deliveryRoot),
    zipPath: path.relative(repoRoot, zipPath),
    zipBytes,
    volumeCount: volumes.length,
    finalPages: audit.finalPages,
    volumePages: volumes.map((volume) => ({
      volume: volume.number,
      pages: volume.finalPages,
      packetPages: volume.packetPageRange,
      file: `volumes/${volume.fileName}`
    }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

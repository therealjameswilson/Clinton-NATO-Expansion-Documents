import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(repoRoot, "data", "historiography-print-manifest.json");
const bernsteinPath = path.join(repoRoot, "data", "bernstein-handoff.json");
const packageManifestPath = path.join(repoRoot, "data", "package-manifest.json");
const renderScriptPath = path.join(repoRoot, "scripts", "render-print-frontmatter.py");
const renderPrimaryAnnotationScriptPath = path.join(repoRoot, "scripts", "render-primary-annotation-sheets.py");
const outputRoot = path.join(repoRoot, "private", "print-package");
const sourceRoot = path.join(outputRoot, "sources");
const workingRoot = path.join(outputRoot, "working");
const dividerRoot = path.join(workingRoot, "dividers");
const packageSourceRoot = path.join(repoRoot, "private", "package-pdfs", "sources");
const reportPath = path.join(repoRoot, "reports", "bernstein-print-package.md");
const auditPath = path.join(outputRoot, "print-package-audit.json");
const frontmatterDataPath = path.join(workingRoot, "frontmatter-data.json");
const primaryAnnotationInputPath = path.join(workingRoot, "primary-annotation-input.json");
const frontmatterPdfPath = path.join(workingRoot, "000-frontmatter.pdf");
const chronologicalPrimaryRoot = path.join(workingRoot, "primary-chronological");
const primaryAnnotationRoot = path.join(workingRoot, "primary-annotation-sheets");
const officialAnnotationRoot = path.join(workingRoot, "primary-official-annotation-sheets");
const primaryDocumentRoot = path.join(workingRoot, "primary-documents");
const chronologicalPrimaryPdfPath = path.join(workingRoot, "primary-documents-chronological.pdf");
const normalizedChronologicalPrimaryPdfPath = path.join(workingRoot, "primary-documents-chronological.normalized.pdf");
const finalPdfPath = path.join(outputRoot, "bernstein-nato-expansion-print-packet.pdf");
const normalizedFinalPdfPath = path.join(outputRoot, "bernstein-nato-expansion-print-packet.normalized.pdf");
const dryRun = process.argv.includes("--dry-run");
const skipDownload = process.argv.includes("--skip-download");
const bundledPython = "/Users/jameswilson/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const python = process.env.PRINT_PACKAGE_PYTHON || (fs.existsSync(bundledPython) ? bundledPython : "python3");

function fail(message) {
  throw new Error(message);
}

function safeName(value) {
  return String(value || "item")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 130);
}

function packageSourceSafeName(value) {
  return String(value || "record")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
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
  return {
    pages: Number(text.match(/^Pages:\s+(\d+)/m)?.[1] || 0),
    fileSizeBytes: Number(text.match(/^File size:\s+(\d+)\s+bytes/m)?.[1] || 0),
    pdfVersion: text.match(/^PDF version:\s+(.+)$/m)?.[1] || "",
    title: text.match(/^Title:\s+(.+)$/m)?.[1] || ""
  };
}

async function download(url, target) {
  const response = await fetch(url);
  if (!response.ok) fail(`${response.status} ${response.statusText} for ${url}`);
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(target, Buffer.from(arrayBuffer));
}

function normalizePdf(inputPath, outputPath) {
  execFileSync("qpdf", ["--warning-exit-0", "--object-streams=generate", inputPath, outputPath], { stdio: "inherit" });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function relative(filePath) {
  return path.relative(repoRoot, filePath);
}

function ensureTool(name) {
  try {
    execFileSync("sh", ["-lc", `command -v ${name}`], { stdio: "ignore" });
  } catch {
    fail(`Missing required command-line tool: ${name}`);
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function selectedSourcePath(record) {
  return path.join(packageSourceRoot, `${String(record.packageOrder).padStart(3, "0")}-${packageSourceSafeName(record.id)}.pdf`);
}

const sourcePathByUrl = new Map();

async function ensureSelectedSource(record) {
  const key = record.pdfUrl || record.sourceUrl || record.id;
  if (sourcePathByUrl.has(key)) return sourcePathByUrl.get(key);
  const target = selectedSourcePath(record);
  if (fs.existsSync(target)) {
    sourcePathByUrl.set(key, target);
    return target;
  }
  const url = record.pdfUrl || record.sourceUrl;
  if (!url || !/^https?:\/\//i.test(url)) {
    fail(`Missing local source PDF and public PDF URL for selected record: ${record.id}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await download(url, target);
  sourcePathByUrl.set(key, target);
  return target;
}

function recordDateKey(record) {
  return [
    record.date || "9999-99-99",
    String(record.packageOrder || "").padStart(5, "0"),
    record.title || "",
    record.id || ""
  ];
}

function compareRecordsByDate(a, b) {
  const left = recordDateKey(a);
  const right = recordDateKey(b);
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] < right[i]) return -1;
    if (left[i] > right[i]) return 1;
  }
  return 0;
}

function countDateOrderViolations(records) {
  let violations = 0;
  let previous = null;
  for (const record of records) {
    if (previous && compareRecordsByDate(previous, record) > 0) violations += 1;
    previous = record;
  }
  return violations;
}

function packagePageRange(record) {
  if (!Number(record.packagePageStart) || !Number(record.packagePageEnd)) {
    fail(`Package record lacks page span: ${record.id}`);
  }
  return `${record.packagePageStart}-${record.packagePageEnd}`;
}

function sourcePageRange(record) {
  const pages = String(record.sourcePages || "").trim();
  if (!pages) return "1-z";
  const match = pages.match(/\d+(?:-\d+)?(?:\s*,\s*\d+(?:-\d+)?)*/);
  if (!match) return "1-z";
  return match[0].replace(/\s+/g, "");
}

function firstPageFromRange(range) {
  const match = String(range || "").match(/\d+/);
  return match ? Number(match[0]) : 1;
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

const pageTextCache = new Map();

function pageText(filePath, page) {
  const key = `${filePath}#${page}`;
  if (pageTextCache.has(key)) return pageTextCache.get(key);
  let text = "";
  try {
    text = execFileSync("pdftotext", ["-f", String(page), "-l", String(page), filePath, "-"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500
    });
  } catch {
    text = "";
  }
  pageTextCache.set(key, text);
  return text;
}

function isWithdrawalOrMarkerPage(text) {
  return /Withdrawal\/Redaction Sheet|Withdrawal Sheet|Redaction Sheet|DOCUMENT NO\. AND TYPE|MR MARKER|Case Number:|This is not a textual record|Folder Title|Original OA\/ID Number/i.test(text);
}

function isRoutingOrControlPage(text) {
  return /RECORD ID:|ACTION DATA SUMMARY REPORT|NSC\/RMO PROFILE|DOCLOG|DOC ACTION OFFICER|National Security Council\s+The White House|RECEIVED:\s+\d|SOURCE REF:|KEYWORDS:/i.test(text);
}

function isOfficialAnnotationPage(text) {
  return isWithdrawalOrMarkerPage(text) || isRoutingOrControlPage(text);
}

function findOfficialAnnotationPages(sourcePdf, startPage) {
  const immediate = [];
  for (let page = startPage - 1; page >= Math.max(1, startPage - 8); page -= 1) {
    if (!isOfficialAnnotationPage(pageText(sourcePdf, page))) break;
    immediate.unshift(page);
  }
  if (immediate.length) return immediate;

  let lastBlock = [];
  let currentBlock = [];
  for (let page = Math.max(1, startPage - 80); page < startPage; page += 1) {
    if (isWithdrawalOrMarkerPage(pageText(sourcePdf, page))) {
      currentBlock.push(page);
    } else if (currentBlock.length) {
      lastBlock = currentBlock;
      currentBlock = [];
    }
  }
  if (currentBlock.length) lastBlock = currentBlock;
  return lastBlock;
}

function annotationNoteFor(record, officialPages) {
  if (officialPages.length) {
    return `This generated sheet is followed by official source-packet annotation/control material extracted from PDF page(s) ${pagesToRange(officialPages)}, then by the selected document text.`;
  }
  return "No separate official withdrawal/control sheet was detected immediately before or in the current source-packet block for this record. This generated sheet supplies the package provenance before the selected document text.";
}

async function buildChronologicalPrimary(primaryLocalPath, packageManifest) {
  const selected = packageManifest.selected || [];
  if (!selected.length) fail("Package manifest has no selected primary documents.");
  fs.rmSync(chronologicalPrimaryRoot, { recursive: true, force: true });
  fs.mkdirSync(chronologicalPrimaryRoot, { recursive: true });
  fs.rmSync(primaryAnnotationRoot, { recursive: true, force: true });
  fs.mkdirSync(primaryAnnotationRoot, { recursive: true });
  fs.rmSync(officialAnnotationRoot, { recursive: true, force: true });
  fs.mkdirSync(officialAnnotationRoot, { recursive: true });
  fs.rmSync(primaryDocumentRoot, { recursive: true, force: true });
  fs.mkdirSync(primaryDocumentRoot, { recursive: true });

  const originalOrderViolations = countDateOrderViolations(selected);
  const records = [...selected].sort(compareRecordsByDate);
  const sortedViolations = countDateOrderViolations(records);
  if (sortedViolations) fail(`Chronological sort still has ${sortedViolations} date-order violations.`);

  const slices = [];
  const chronology = [];
  const annotationInputs = [];
  let generatedAnnotationPages = 0;
  let officialAnnotationPages = 0;
  let detectedOfficialAnnotationRecords = 0;
  let missingOfficialAnnotationRecords = 0;
  const missingOfficialAnnotationBySourceClass = new Map();
  let documentPages = 0;
  for (const [index, record] of records.entries()) {
    const order = String(index + 1).padStart(3, "0");
    const range = sourcePageRange(record);
    const useBaselineDocumentSlice = record.sourceClass === "state-foia";
    const selectedSourcePdf = useBaselineDocumentSlice ? "" : await ensureSelectedSource(record);
    const documentSourcePdf = useBaselineDocumentSlice ? primaryLocalPath : selectedSourcePdf;
    const documentRange = useBaselineDocumentSlice ? packagePageRange(record) : range;
    const startPage = firstPageFromRange(range);
    const officialPages = useBaselineDocumentSlice
      ? []
      : findOfficialAnnotationPages(selectedSourcePdf, startPage);
    const generatedAnnotationPath = path.join(primaryAnnotationRoot, `${order}-${safeName(record.id)}.annotation.pdf`);
    const officialAnnotationPath = path.join(officialAnnotationRoot, `${order}-${safeName(record.id)}.official-annotation.pdf`);
    const documentPath = path.join(primaryDocumentRoot, `${order}-${safeName(record.id)}.document.pdf`);

    annotationInputs.push({
      outputPath: generatedAnnotationPath,
      chronologicalOrder: index + 1,
      originalPackageOrder: record.packageOrder,
      id: record.id,
      date: record.date,
      title: record.title,
      documentPages: record.pageCount,
      sourceClass: record.sourceClass,
      sourcePages: useBaselineDocumentSlice ? `${range} (document text extracted from baseline package pages ${documentRange})` : range,
      officialAnnotationPages: officialPages.length ? pagesToRange(officialPages) : "not detected in source PDF",
      officialAnnotationStatus: officialPages.length ? "official source-packet sheet(s) included after this generated annotation sheet" : "generated provenance sheet only",
      sourceUrl: record.sourceUrl || "",
      pdfUrl: record.pdfUrl || "",
      sourceNote: record.sourceNote || "",
      annotationNote: annotationNoteFor(record, officialPages)
    });
    generatedAnnotationPages += 1;

    slices.push(generatedAnnotationPath);

    let officialAnnotationRange = "";
    let officialAnnotationPageCount = 0;
    if (officialPages.length) {
      officialAnnotationRange = pagesToRange(officialPages);
      execFileSync("qpdf", [
        "--warning-exit-0",
        "--empty",
        "--pages",
        selectedSourcePdf,
        officialAnnotationRange,
        "--",
        officialAnnotationPath
      ], { stdio: "ignore" });
      const officialInfo = pdfInfo(officialAnnotationPath);
      officialAnnotationPageCount = officialInfo.pages;
      officialAnnotationPages += officialAnnotationPageCount;
      detectedOfficialAnnotationRecords += 1;
      slices.push(officialAnnotationPath);
    } else {
      missingOfficialAnnotationRecords += 1;
      const sourceClass = record.sourceClass || "unknown";
      missingOfficialAnnotationBySourceClass.set(sourceClass, (missingOfficialAnnotationBySourceClass.get(sourceClass) || 0) + 1);
    }

    execFileSync("qpdf", [
      "--warning-exit-0",
      "--empty",
      "--pages",
      documentSourcePdf,
      documentRange,
      "--",
      documentPath
    ], { stdio: "ignore" });
    const sliceInfo = pdfInfo(documentPath);
    if (sliceInfo.pages !== Number(record.pageCount)) {
      fail(`Chronological slice page mismatch for ${record.id}: expected ${record.pageCount}, got ${sliceInfo.pages}`);
    }
    documentPages += sliceInfo.pages;
    slices.push(documentPath);
    chronology.push({
      chronologicalOrder: index + 1,
      originalPackageOrder: record.packageOrder,
      id: record.id,
      date: record.date,
      title: record.title,
      documentPages: record.pageCount,
      generatedAnnotationPages: 1,
      officialAnnotationPages: officialAnnotationPageCount,
      officialAnnotationSourcePages: officialAnnotationRange || "",
      sourcePdfPages: useBaselineDocumentSlice ? documentRange : range,
      sourcePackagePages: packagePageRange(record),
      sourceClass: record.sourceClass
    });
  }

  writeJson(primaryAnnotationInputPath, annotationInputs);
  execFileSync(python, [renderPrimaryAnnotationScriptPath, primaryAnnotationInputPath], { stdio: "inherit" });

  execFileSync("pdfunite", slices.concat(chronologicalPrimaryPdfPath), { stdio: "inherit" });
  normalizePdf(chronologicalPrimaryPdfPath, normalizedChronologicalPrimaryPdfPath);
  fs.renameSync(normalizedChronologicalPrimaryPdfPath, chronologicalPrimaryPdfPath);
  execFileSync("qpdf", ["--warning-exit-0", "--check", chronologicalPrimaryPdfPath], { stdio: "inherit" });
  const info = pdfInfo(chronologicalPrimaryPdfPath);
  const expectedPages = documentPages + generatedAnnotationPages + officialAnnotationPages;
  if (info.pages !== expectedPages) {
    fail(`Chronological primary page mismatch: expected ${expectedPages}, got ${info.pages}`);
  }

  return {
    path: chronologicalPrimaryPdfPath,
    info,
    records: chronology,
    originalOrderViolations,
    sortedViolations,
    firstDate: chronology[0]?.date || "",
    lastDate: chronology.at(-1)?.date || "",
    documentPages,
    generatedAnnotationPages,
    officialAnnotationPages,
    detectedOfficialAnnotationRecords,
    missingOfficialAnnotationRecords,
    missingOfficialAnnotationBySourceClass: Object.fromEntries([...missingOfficialAnnotationBySourceClass.entries()].sort()),
    totalPrimaryPages: info.pages
  };
}

async function main() {
  for (const tool of ["pdfinfo", "qpdf", "pdfunite", "pdftotext"]) ensureTool(tool);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const handoff = JSON.parse(fs.readFileSync(bernsteinPath, "utf8"));
  const packageManifest = JSON.parse(fs.readFileSync(packageManifestPath, "utf8"));
  const primaryLocalPath = path.join(repoRoot, manifest.primaryDocumentPackage.localPath);
  if (!fs.existsSync(primaryLocalPath)) {
    fail(`Missing primary package at ${manifest.primaryDocumentPackage.localPath}. Run npm run download:package -- --assemble first.`);
  }

  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.rmSync(workingRoot, { recursive: true, force: true });
  fs.mkdirSync(workingRoot, { recursive: true });
  fs.mkdirSync(dividerRoot, { recursive: true });

  const primaryInfo = pdfInfo(primaryLocalPath);
  if (primaryInfo.pages !== manifest.primaryDocumentPackage.expectedPages) {
    fail(`Primary package page mismatch: expected ${manifest.primaryDocumentPackage.expectedPages}, got ${primaryInfo.pages}`);
  }

  const included = [];
  for (const item of manifest.includedFullText) {
    const order = String(item.order).padStart(3, "0");
    const sourceFileName = `${order}-${safeName(item.id)}.pdf`;
    const sourcePath = path.join(sourceRoot, sourceFileName);
    const normalizedPath = path.join(workingRoot, `${order}-${safeName(item.id)}.normalized.pdf`);
    const entry = {
      ...item,
      sourcePath,
      normalizedPath,
      status: "pending"
    };

    if (dryRun) {
      entry.status = item.pdfUrl ? "dry-run-download" : "dry-run-local";
    } else if (item.sourceType === "user-provided-pdf" || item.localPath) {
      if (!fs.existsSync(item.localPath)) fail(`Missing local PDF for ${item.id}: ${item.localPath}`);
      fs.copyFileSync(item.localPath, sourcePath);
      entry.status = "copied-local";
    } else if (item.pdfUrl) {
      if (!skipDownload || !fs.existsSync(sourcePath)) await download(item.pdfUrl, sourcePath);
      entry.status = skipDownload && fs.existsSync(sourcePath) ? "reused-download" : "downloaded";
    } else {
      fail(`No pdfUrl or localPath for included full-text item ${item.id}`);
    }

    if (!dryRun) {
      const sourceInfo = pdfInfo(sourcePath);
      entry.pages = sourceInfo.pages;
      entry.fileSizeBytes = sourceInfo.fileSizeBytes;
      entry.pdfVersion = sourceInfo.pdfVersion;
      if (Number(item.expectedPages) && sourceInfo.pages !== Number(item.expectedPages)) {
        fail(`Page mismatch for ${item.id}: expected ${item.expectedPages}, got ${sourceInfo.pages}`);
      }
      normalizePdf(sourcePath, normalizedPath);
      const normalizedInfo = pdfInfo(normalizedPath);
      entry.normalizedPages = normalizedInfo.pages;
      entry.normalizedFileSizeBytes = normalizedInfo.fileSizeBytes;
      if (normalizedInfo.pages !== sourceInfo.pages) {
        fail(`Normalized page mismatch for ${item.id}: ${sourceInfo.pages} became ${normalizedInfo.pages}`);
      }
    }
    included.push(entry);
  }

  if (dryRun) {
    writeJson(auditPath, {
      generatedAt: new Date().toISOString(),
      dryRun: true,
      finalPdfPath: relative(finalPdfPath),
      primary: {
        ...manifest.primaryDocumentPackage,
        pages: primaryInfo.pages,
        localPath: manifest.primaryDocumentPackage.localPath
      },
      included: included.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        expectedPages: item.expectedPages,
        pdfUrl: item.pdfUrl,
        localPath: item.localPath
      }))
    });
    console.log(JSON.stringify({ dryRun: true, outputRoot: relative(outputRoot), included: included.length }, null, 2));
    return;
  }

  const chronologicalPrimary = await buildChronologicalPrimary(primaryLocalPath, packageManifest);

  const frontmatterData = {
    manifest,
    handoff,
    packageManifest: {
      generatedAt: packageManifest.generatedAt,
      selectedCount: packageManifest.selectedCount,
      selectedPageTotal: packageManifest.selectedPageTotal
    },
    primary: {
      ...manifest.primaryDocumentPackage,
      pages: chronologicalPrimary.info.pages,
      fileSizeBytes: chronologicalPrimary.info.fileSizeBytes,
      baselineLocalPath: manifest.primaryDocumentPackage.localPath,
      localPath: relative(chronologicalPrimary.path),
      orderMode: "chronological-by-document-date",
      recordCount: chronologicalPrimary.records.length,
      firstDate: chronologicalPrimary.firstDate,
      lastDate: chronologicalPrimary.lastDate,
      originalOrderViolations: chronologicalPrimary.originalOrderViolations,
      sortedViolations: chronologicalPrimary.sortedViolations,
      documentPages: chronologicalPrimary.documentPages,
      generatedAnnotationPages: chronologicalPrimary.generatedAnnotationPages,
      officialAnnotationPages: chronologicalPrimary.officialAnnotationPages,
      detectedOfficialAnnotationRecords: chronologicalPrimary.detectedOfficialAnnotationRecords,
      missingOfficialAnnotationRecords: chronologicalPrimary.missingOfficialAnnotationRecords,
      missingOfficialAnnotationBySourceClass: chronologicalPrimary.missingOfficialAnnotationBySourceClass
    },
    included: included.map((item) => ({
      id: item.id,
      order: item.order,
      authors: item.authors,
      year: item.year,
      title: item.title,
      citation: item.citation,
      pageUrl: item.pageUrl,
      repositoryUrl: item.repositoryUrl,
      pdfUrl: item.pdfUrl,
      sourceType: item.sourceType,
      rightsMode: item.rightsMode,
      expectedPages: item.expectedPages,
      pages: item.pages,
      whyForBernstein: item.whyForBernstein
    })),
    citationOnly: manifest.citationOnly
  };
  writeJson(frontmatterDataPath, frontmatterData);
  execFileSync(python, [renderScriptPath, frontmatterDataPath, frontmatterPdfPath, dividerRoot], { stdio: "inherit" });

  const frontmatterInfo = pdfInfo(frontmatterPdfPath);
  frontmatterData.final = {
    frontMatterPages: frontmatterInfo.pages,
    generatedAt: new Date().toISOString()
  };
  writeJson(frontmatterDataPath, frontmatterData);
  execFileSync(python, [renderScriptPath, frontmatterDataPath, frontmatterPdfPath, dividerRoot], { stdio: "inherit" });

  const mergeInputs = [
    frontmatterPdfPath,
    path.join(dividerRoot, "000-primary-documents-divider.pdf"),
    chronologicalPrimary.path
  ];
  for (const item of included) {
    mergeInputs.push(path.join(dividerRoot, `${String(item.order).padStart(3, "0")}-${item.id}-divider.pdf`));
    mergeInputs.push(item.normalizedPath);
  }

  execFileSync("pdfunite", mergeInputs.concat(finalPdfPath), { stdio: "inherit" });
  normalizePdf(finalPdfPath, normalizedFinalPdfPath);
  fs.renameSync(normalizedFinalPdfPath, finalPdfPath);
  execFileSync("qpdf", ["--warning-exit-0", "--check", finalPdfPath], { stdio: "inherit" });

  const finalInfo = pdfInfo(finalPdfPath);
  const textProbe = execFileSync("pdftotext", ["-f", "1", "-l", "8", finalPdfPath, "-"], { encoding: "utf8" });
  const expectedPages = frontmatterInfo.pages + 1 + chronologicalPrimary.info.pages + included.reduce((sum, item) => sum + 1 + Number(item.pages || 0), 0);
  if (finalInfo.pages !== expectedPages) {
    fail(`Final page mismatch: expected ${expectedPages}, got ${finalInfo.pages}`);
  }
  if (!/Barton Bernstein Offline Print Packet/.test(textProbe)) {
    fail("Front-matter text probe failed; expected cover text was not found.");
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    manifestVersion: manifest.version,
    finalPdfPath: relative(finalPdfPath),
    finalPages: finalInfo.pages,
    finalBytes: finalInfo.fileSizeBytes,
    finalPdfVersion: finalInfo.pdfVersion,
    expectedPages,
    frontMatterPages: frontmatterInfo.pages,
    primary: {
      id: manifest.primaryDocumentPackage.id,
      pages: chronologicalPrimary.info.pages,
      fileSizeBytes: chronologicalPrimary.info.fileSizeBytes,
      baselineLocalPath: manifest.primaryDocumentPackage.localPath,
      localPath: relative(chronologicalPrimary.path),
      orderMode: "chronological-by-document-date",
      recordCount: chronologicalPrimary.records.length,
      firstDate: chronologicalPrimary.firstDate,
      lastDate: chronologicalPrimary.lastDate,
      originalOrderViolations: chronologicalPrimary.originalOrderViolations,
      sortedViolations: chronologicalPrimary.sortedViolations,
      documentPages: chronologicalPrimary.documentPages,
      generatedAnnotationPages: chronologicalPrimary.generatedAnnotationPages,
      officialAnnotationPages: chronologicalPrimary.officialAnnotationPages,
      detectedOfficialAnnotationRecords: chronologicalPrimary.detectedOfficialAnnotationRecords,
      missingOfficialAnnotationRecords: chronologicalPrimary.missingOfficialAnnotationRecords,
      missingOfficialAnnotationBySourceClass: chronologicalPrimary.missingOfficialAnnotationBySourceClass,
      records: chronologicalPrimary.records
    },
    includedFullText: included.map((item) => ({
      id: item.id,
      order: item.order,
      authors: item.authors,
      year: item.year,
      title: item.title,
      pages: item.pages,
      fileSizeBytes: item.fileSizeBytes,
      sourcePath: relative(item.sourcePath),
      normalizedPath: relative(item.normalizedPath),
      status: item.status,
      pdfUrl: item.pdfUrl,
      pageUrl: item.pageUrl,
      sourceType: item.sourceType,
      rightsMode: item.rightsMode
    })),
    citationOnlyCount: manifest.citationOnly.length,
    checks: [
      "pdfinfo read final PDF",
      "qpdf --warning-exit-0 --check found no fatal syntax or stream errors",
      "pdftotext first-eight-page probe found cover text"
    ]
  };
  writeJson(auditPath, audit);

  const includedRows = audit.includedFullText.map((item) => ({
    "#": item.order,
    Author: `${item.authors} (${item.year})`,
    Pages: item.pages,
    Title: item.title,
    "Access Mode": item.rightsMode
  }));
  const citationRows = manifest.citationOnly.map((item) => ({
    Author: `${item.authors} (${item.year})`,
    Title: item.title,
    Note: item.accessNote,
    URL: item.url
  }));
  const sourceRows = audit.includedFullText.map((item) => ({
    ID: item.id,
    "Page URL": item.pageUrl || "",
    "PDF URL": item.pdfUrl || "local user-provided PDF"
  }));
  const missingAnnotationBreakdown = Object.entries(audit.primary.missingOfficialAnnotationBySourceClass || {})
    .map(([sourceClass, count]) => `${sourceClass}: ${count}`)
    .join("; ") || "none";

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `# Bernstein Offline Print Package

Generated: ${audit.generatedAt}

This report records the local print build for Professor Barton Bernstein. The
public repository tracks the manifest, source URLs, and scripts. The merged PDF
and downloaded article PDFs remain under ignored \`private/\`.

## Result

- Local print PDF: \`${audit.finalPdfPath}\`
- Final pages: ${audit.finalPages}
- Final bytes: ${audit.finalBytes}
- Front-matter pages: ${audit.frontMatterPages}
- Primary-section pages: ${audit.primary.pages}
- Primary document-text pages: ${audit.primary.documentPages}
- Generated per-document annotation sheets: ${audit.primary.generatedAnnotationPages}
- Official source-packet annotation/control/withdrawal pages included: ${audit.primary.officialAnnotationPages}
- Primary records with detected official sheets: ${audit.primary.detectedOfficialAnnotationRecords}
- Primary records with generated provenance sheet only: ${audit.primary.missingOfficialAnnotationRecords}
- Generated-only source-class breakdown: ${missingAnnotationBreakdown}
- Primary-document order: chronological by document date (${audit.primary.firstDate} to ${audit.primary.lastDate})
- Primary-document order check: ${audit.primary.sortedViolations} chronological violations after rebuild; ${audit.primary.originalOrderViolations} date-order reversals in the prior package-order sequence
- Full-text historiography PDFs appended: ${audit.includedFullText.length}
- Citation-only historiography entries: ${audit.citationOnlyCount}
- Integrity checks: ${audit.checks.join("; ")}

## Primary Document Order

The print build keeps the same 178 selected primary records and 1000 pages of
document text. It then rebuilds the primary section chronologically. Each
record is printed as a mini-bundle: a generated package annotation sheet,
official source-packet annotation/control/withdrawal sheet pages when detected,
and the selected document text. This makes the primary-document section usable
offline without separating a document from its provenance sheet.

- Chronological primary PDF: \`${audit.primary.localPath}\`
- Baseline source PDF: \`${audit.primary.baselineLocalPath}\`
- Document-text pages: ${audit.primary.documentPages}
- Generated annotation sheets: ${audit.primary.generatedAnnotationPages}
- Official source-packet annotation/control/withdrawal pages: ${audit.primary.officialAnnotationPages}
- Generated-only source-class breakdown: ${missingAnnotationBreakdown}
- First primary document date: ${audit.primary.firstDate}
- Last primary document date: ${audit.primary.lastDate}
- Chronological order violations after rebuild: ${audit.primary.sortedViolations}
- Date-order reversals in the prior package-order sequence: ${audit.primary.originalOrderViolations}

## Full-Text Historiography Appended Locally

${table(includedRows, ["#", "Author", "Pages", "Title", "Access Mode"])}

## Located but Not Reproduced in Full

${table(citationRows, ["Author", "Title", "Note", "URL"])}

## Source URLs Used for Local PDF Assembly

${table(sourceRows, ["ID", "Page URL", "PDF URL"])}

## Rebuild

\`\`\`bash
npm run build:print
\`\`\`

The command expects the existing primary-document PDF at
\`${manifest.primaryDocumentPackage.localPath}\` and the user-provided Project
MUSE article at
\`${manifest.includedFullText.find((item) => item.id === "trachtenberg-project-muse-non-extension-2021")?.localPath}\`.

To refresh only from already downloaded historiography sources:

\`\`\`bash
npm run build:print -- --skip-download
\`\`\`

Shell reproduction of the final merge order is stored locally at:
\`${relative(path.join(workingRoot, "merge-order.sh"))}\`.
`);

  fs.writeFileSync(path.join(workingRoot, "merge-order.sh"), `#!/usr/bin/env bash
set -euo pipefail
pdfunite ${mergeInputs.map(shellQuote).join(" ")} ${shellQuote(finalPdfPath)}
qpdf --warning-exit-0 --object-streams=generate ${shellQuote(finalPdfPath)} ${shellQuote(normalizedFinalPdfPath)}
mv ${shellQuote(normalizedFinalPdfPath)} ${shellQuote(finalPdfPath)}
qpdf --warning-exit-0 --check ${shellQuote(finalPdfPath)}
`);
  fs.chmodSync(path.join(workingRoot, "merge-order.sh"), 0o755);

  console.log(JSON.stringify({
    outputRoot: relative(outputRoot),
    finalPdfPath: audit.finalPdfPath,
    finalPages: audit.finalPages,
    includedFullText: audit.includedFullText.length,
    citationOnly: audit.citationOnlyCount
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

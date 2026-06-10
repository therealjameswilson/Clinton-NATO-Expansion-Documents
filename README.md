# Clinton NATO Expansion Documents

Public research workbench for a 1000-page declassified primary-document package
for Professor Barton Bernstein on NATO expansion during the Clinton
administration, 1993-2000.

The repo starts from the FRUS-assistant pattern used in the companion Clinton
and Bush workbenches: source registers first, visible provenance separated from
research metadata, explicit promotion queues for file-unit leads, and repeatable
validation before any document packet is treated as selection-ready.

## Scope

Target corpus:

- Presidential and Vice Presidential memcons and telcons.
- NSC, Principals Committee, Deputies Committee, and interagency records.
- Summaries of Conclusions and meeting minutes.
- Clinton Library MDR/FOIA releases and Digital Library records.
- NARA Catalog and NARA Scout file-unit leads that can be promoted to
  document-level records.
- Department of State FOIA Virtual Reading Room records, including the Strobe
  Talbott FOIA release.
- Relevant public FRUS, Public Papers, and official chronology controls.
- Private Google Drive copies and notes, used as local working inputs only
  unless a public official source is verified.

## Current Public Source Spine

- FRUS status page for `1993-2000, Volume XVII, North Atlantic Treaty
  Organization; European Security`: <https://history.state.gov/historicaldocuments/status-of-the-series>
- FRUS series standards: <https://history.state.gov/historicaldocuments/about-frus>
- Clinton Library memcons and telcons:
  <https://www.clintonlibrary.gov/research/memcons-and-telcons>
- Clinton Digital Library NATO Expansion MDR item 2017-0193-M:
  <https://clinton.presidentiallibraries.us/items/show/118731>
- Clinton Library digitized records:
  <https://www.clintonlibrary.gov/research/search-digitized-records>
- National Archives Catalog: <https://catalog.archives.gov/>
- Department of State FOIA Virtual Reading Room: <https://foia.state.gov/>
- Strobe Talbott FOIA workbench:
  <https://therealjameswilson.github.io/strobe-talbott-foia/manifest.html>

## Repository Layout

- `data/source-register.json` - generated seed register for public leads and
  document records.
- `data/source-register.schema.json` - minimum record contract.
- `reports/upstream-ingest-audit.md` - ingest counts and source-lane audit.
- `reports/nsc-soc-priority-queue.md` - NSC minutes and Summaries of
  Conclusions priority queue.
- `reports/assembly-plan.md` - current page-budget plan toward the 1000-page
  package.
- `data/package-manifest.json` and `data/package-manifest.csv` - focused
  1000-page Bernstein package manifest.
- `data/version-2-explicit-expansion.json` and
  `data/version-2-explicit-expansion.csv` - version 2.0 dossier isolating
  document rows where policymakers explicitly discuss whether, whom, when, or
  how to expand NATO membership.
- `data/bernstein-handoff.json` and `data/bernstein-handoff.csv` - version
  2.0 personalization layer for Professor Bernstein, with decisionmaking tags,
  start-here records, reading paths, and withheld NSC/SOC evidence gaps.
- `data/historiography-print-manifest.json` - offline print manifest for the
  attached Project MUSE article and public historiography by Goldgeier,
  Shifrinson, Kramer, Sarotte, Trachtenberg, and related scholars.
- `data/clinton-library-packet-controls.json` - official Clinton Library MDR
  packet controls awaiting document-level extraction.
- `data/clinton-library-promoted-documents.json` - document-level rows promoted
  from Clinton Library MDR packets after page-boundary inspection.
- `data/nara-promoted-documents.json` - document-level rows promoted from NARA
  Scout leads after source-image inspection.
- `data/source-exhaustion-audit.json` - structured source-lane and gap audit.
- `reports/package-manifest.md` - readable selected package sequence.
- `reports/package-gap-audit.md` - remaining gaps before final handoff.
- `reports/package-local-build-audit.md` - local private PDF assembly result
  for the selected 1000-page package.
- `reports/source-exhaustion-audit.md` - public audit of source lanes still
  requiring extraction or promotion.
- `reports/version-2-explicit-expansion.md` - readable version 2.0 manifest,
  rule set, and review queue.
- `reports/bernstein-handoff.md` - profile-basis report and Bernstein
  reading-path handoff.
- `reports/bernstein-print-package.md` - local offline PDF build audit,
  including full-text historiography included locally and citation-only pieces
  located but not reproduced.
- `scripts/build-seed-register.mjs` - imports the existing Clinton NATO
  workbench and the local Strobe Talbott FOIA manifest.
- `scripts/build-package-manifest.mjs` - builds the focused package manifest
  from the committed public register.
- `scripts/build-version-2.mjs` - builds the narrower version 2.0 explicit
  membership-expansion dossier from the committed public register.
- `scripts/build-bernstein-handoff.mjs` - builds the Professor Bernstein
  decisionmaking desk from the version 2.0 dossier and meeting-control audit.
- `scripts/build-print-package.mjs` - builds the ignored local offline print
  PDF by merging the 1000-page primary-document package, the Project MUSE
  attachment, and public historiography PDFs.
- `scripts/download-package-pdfs.mjs` - local-only downloader/assembler for the
  selected public PDFs under ignored `private/package-pdfs/`.
- `scripts/validate-package.mjs` - validates the generated register and
  reports.
- `private/` - ignored local intake for Google Drive exports or researcher
  notes that should not be published.

## Build

```bash
npm run build
npm run build:v2
npm run build:bernstein
npm test
```

The public build works from the committed source register and regenerates the
focused Bernstein package manifest. To refresh the broader source register from
local sibling workspaces, run:

```bash
npm run refresh:source-register
npm run build
npm run build:v2
npm run build:bernstein
npm test
```

The source-register refresh reads sibling workspaces when present:

- `../Clinton-NATO-European-Security/data/records.json`
- `../strobe-talbott-foia/data/manifest.json`
- optional `private/google-drive-intake.json`

The public register stores official links and working provenance. Private Drive
links remain local until each item is matched to a public declassified source or
the user explicitly approves publication of that metadata.

To download the selected public PDFs locally and prepare a merge command:

```bash
npm run download:package -- --dry-run
npm run download:package
```

To assemble the ignored local PDF package after downloads succeed:

```bash
npm run download:package -- --assemble
```

The assembly command writes the combined PDF and downloaded sources under
ignored `private/package-pdfs/` and refreshes the public local-build audit.

## Offline Print Packet for Barton Bernstein

Professor Bernstein should be able to read the package without using the
internet. After the primary 1000-page PDF exists locally, build the print packet
with:

```bash
npm run build:print
```

The command expects:

- `private/package-pdfs/clinton-nato-expansion-bernstein-1000-page-package.pdf`
- `/Users/jameswilson/Downloads/project_muse_781047.pdf`

It writes:

- `private/print-package/bernstein-nato-expansion-print-packet.pdf`
- `private/print-package/print-package-audit.json`
- `reports/bernstein-print-package.md`

The merged PDF and downloaded article PDFs are intentionally ignored by Git.
The public repo keeps the source manifest and rebuild instructions. Web-only,
paywalled, or access-controlled historiography is listed in the printed front
matter with citations and access notes instead of being reproduced in full.

The print build preserves the same 178 selected primary records and uses the
same 1000 selected document-text pages as its baseline. Before final assembly,
it removes primary-document pages that are not annotation/provenance material
and do not meet the 30% extracted-text coverage rule. Each record is rebuilt
chronologically as a mini-bundle: generated package annotation sheet, official
source-packet annotation/control/withdrawal pages when detected, then retained
document text.

## Editorial Rules

1. Treat `Source:` text as publication-shaped provenance. Keep URLs, Catalog
   controls, page-count notes, and verification reminders in structured fields.
2. Flag NSC minutes, Principals Committee records, Deputies Committee records,
   and Summaries of Conclusions as priority material.
3. Promote Scout/NARA file-unit leads only after document-level inspection:
   actual date, title, page span, release status, classification/handling, and
   source image.
4. Treat Clinton Library MDR packets as packet controls until split into
   document-level rows with page spans and markings.
5. Count pages only from verified source images or trusted release metadata.
6. Defer duplicate public copies to the most canonical official source.

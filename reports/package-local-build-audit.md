# Local Package Build Audit

Generated: 2026-06-06T05:27:43.399Z

This audit records a local private build of the Bernstein NATO expansion package.
The assembled PDF and downloaded source PDFs live under `private/`, which is
ignored by Git; the public repository keeps the manifest, links, and build
recipe.

## Result

- Manifest generated: 2026-06-06T05:26:05.750Z
- Selected records: 176
- Expected selected pages: 1000
- Downloaded source PDFs: 176
- Downloaded source bytes: 1487086351
- Assembled PDF pages: 1000
- Assembled PDF bytes: 60028812
- Assembled PDF version: 1.7
- Local assembled path: `private/package-pdfs/clinton-nato-expansion-bernstein-1000-page-package.pdf`
- Integrity check: `qpdf --warning-exit-0 --check` found no syntax or stream encoding errors.

## Notes

- `qpdf --warning-exit-0` is intentional. A small number of archival PDFs can
  emit repairable cross-reference warnings during assembly even when the final
  file validates and `pdfinfo` reads the expected page count.
- The assembled package is normalized with `qpdf --object-streams=generate`
  before the final integrity check to clear repairable stream warnings inherited
  from archival source PDFs.
- Re-run `npm run download:package -- --assemble` after any manifest change.
- Do not commit files under `private/`.

## Download Issues

No download errors in this local build.

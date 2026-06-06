# Local Package Build Audit

Generated: 2026-06-06T07:18:35.911Z

This audit records a local private build of the Bernstein NATO expansion package.
The assembled PDF and downloaded source PDFs live under `private/`, which is
ignored by Git; the public repository keeps the manifest, links, and build
recipe.

## Result

- Manifest generated: 2026-06-06T07:11:27.529Z
- Selected records: 178
- Expected selected pages: 1000
- Downloaded source PDFs: 178
- Assembled slice PDFs: 178
- Downloaded source bytes: 1792072479
- Assembled PDF pages: 1000
- Assembled PDF bytes: 56166317
- Assembled PDF version: 1.7
- Local assembled path: `private/package-pdfs/clinton-nato-expansion-bernstein-1000-page-package.pdf`
- Integrity check: `qpdf --warning-exit-0 --check` found no syntax or stream encoding errors.

## Notes

- The build first extracts one slice PDF per selected manifest row, then joins
  those slices with `pdfunite`. This avoids malformed resource dictionaries
  that some archival Clinton Library PDFs can produce during one-shot qpdf
  assembly.
- The assembled package is normalized with `qpdf --object-streams=generate`
  after `pdfunite` and before the final integrity check.
- `qpdf --warning-exit-0` remains intentional. Some archival PDFs can emit
  repairable warnings even when the final file validates and `pdfinfo` reads
  the expected page count.
- Re-run `npm run download:package -- --assemble` after any manifest change.
- Do not commit files under `private/`.

## Download Issues

No download errors in this local build.

---
name: figure-technical-audit
description: Inspect scientific figure files and calculate evidence-based format, size, resolution, text-layer, and export checks. Use for PNG/JPEG/PDF figure preflight when the result must distinguish measured facts, conditional checks, missing inputs, and failures.
license: MIT
---

# Figure Technical Audit

Inspect the actual file before asking a model to comment on it. Preserve measurements as immutable evidence. Return structured findings with `rule_id`, `status`, `severity`, `measurement`, `evidence`, `source`, and `missing_inputs`.

## Rules

- Calculate effective resolution from pixel width and user-supplied final width; DPI metadata alone is insufficient.
- Distinguish vector, raster, and mixed PDF content. A PDF wrapper around a screenshot is not pure vector artwork.
- Do not infer exact point size from a screenshot. OCR boxes can support a legibility concern, not a precise font measurement.
- Apply journal requirements only when the user selected the journal, submission stage, and figure type and the rule has a current source.
- Treat unsupported files and parser errors as `执行失败`, never as pass.
- If a required value is missing, return `信息不足` or `待人工确认`; do not guess.

## Output

Each check is one item. Valid statuses: `通过`, `发现问题`, `待人工确认`, `信息不足`, `不适用`, `执行失败`. Severity is `高`, `中`, or `建议`. Include exact measurements and a normalized region only when it is measured or reliably located.

## Acceptance examples

- The same image at two target widths produces different effective resolution findings.
- A missing target width does not create a hard DPI failure.
- A corrupted file yields a readable execution failure.

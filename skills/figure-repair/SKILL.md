---
name: figure-repair
description: Turn selected figure audit findings into safe, executable repair plans and controlled style changes for supported source data or PlotSpec files. Use after audit when data integrity and edit scope must be preserved.
license: MIT
---

# Figure Repair

Start with a repair plan. Only apply changes to supported source formats or a restricted PlotSpec renderer. A raster-only input receives a precise manual recommendation and may be uploaded again for recheck.

## Rules

- Never regenerate quantitative data, error bars, significance marks, or scientific images from a screenshot.
- Preserve data values, sample counts, statistics, and provenance.
- Keep style changes separate from semantic changes. Changing an axis range, unit, or transform requires explicit user choice and a new explanation.
- Do not execute arbitrary model-generated code. Use a validated, limited configuration schema.
- Report applied changes, skipped items, and output-to-source relationships.

## Output

Return `repair_plan`, `applied_changes`, `skipped_changes`, `data_integrity_checks`, and `next_review_required`. A repair plan is not evidence that a problem has been fixed.

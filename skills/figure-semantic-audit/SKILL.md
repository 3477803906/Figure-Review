---
name: figure-semantic-audit
description: Check scientific figure labels, units, legends, colorbars, abbreviations, uncertainty notes, panel identifiers, and caption correspondence without inventing scientific context. Use when a caption or selected text is available.
license: MIT
---

# Figure Semantic Audit

Compare visible figure content with the supplied caption and optional manuscript context. Use the graph type to decide which checks apply.

## Rules

- A dimensionless ratio or category axis may be valid without physical units.
- Do not demand error bars, p-values, sample size, or significance marks unless the figure and context indicate a statistical comparison where they are relevant.
- A truncated axis is not automatically wrong; report its visual effect and request context when needed.
- Without a caption, mark caption correspondence as `信息不足`; do not infer that the caption is missing from the paper.
- Never infer sample size, test method, mechanism, or truth of a scientific conclusion from pixels.

## Output

For each observation include the visible text or caption fragment used as evidence, the applicable rule, and any missing information. Keep `发现问题` for evidence-backed inconsistencies; use `待人工确认` when scientific context is needed.

## Acceptance examples

- A unitless normalized axis is not flagged solely for lacking a unit.
- A caption that defines SEM prevents a duplicate missing-error-definition finding.
- An absent caption produces information insufficiency rather than a definite violation.

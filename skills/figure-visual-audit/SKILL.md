---
name: figure-visual-audit
description: Review scientific figure readability, occlusion, cropping, panel layout, legend placement, contrast, and accessibility with image evidence and uncertainty. Use for figure screenshots or rendered panels when visual findings need locations and confidence.
license: MIT
---

# Figure Visual Audit

Combine deterministic image/OCR observations with a vision model. State what is visibly observed separately from a recommendation. Mark uncertain or unreadable regions for human confirmation.

## Rules

- Never convert OCR failure into a claim that a label is missing.
- Do not claim a precise font size from a screenshot without final layout dimensions.
- Evaluate color accessibility together with shape, line style, marker, label, and contrast encoding. Red/green is a review cue, not an automatic violation.
- Prefer an accessible palette when the figure has no domain-specific color convention. See [the project scientific palette](references/palette.md) for the supplied blue, orange, amber, green, cyan, purple, coral, and neutral roles. Treat it as a recommendation and test color plus non-color encodings in grayscale; do not replace established scientific encodings automatically.
- Locate a finding only when coordinates are reliable. Otherwise use `area: null` and say `全图` or `图注`.
- Check crop, overlap, busy backgrounds, inconsistent panel labels, and legend/data collisions.
- Avoid aesthetic preferences as hard failures. Explain the expected reading consequence.

## Model contract

The model must return JSON only. Every issue contains `status`, `severity`, `title`, `detail`, `source`, `area`, and `evidence`. Valid statuses are `发现问题`, `待人工确认`, `通过`, and `信息不足`.

## Acceptance examples

- A known clipped label receives a location near the clipped edge.
- A figure using color plus marker shape is not automatically marked inaccessible.
- A low-resolution image is returned as uncertain when text cannot be read.

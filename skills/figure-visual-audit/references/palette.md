# Scientific figure palette reference

These colors are a project palette inspired by the supplied Nature-style examples. They are suggestions, not an official universal Nature palette and not a requirement for every figure.

## Semantic roles

| Role | Preferred | Alternatives | Use |
| --- | --- | --- | --- |
| Primary blue | `#4682BE` | `#3E73B5`, `#3B82F6` | Main series or focal method |
| Accent orange | `#E25822` | `#DD6E29`, `#F57900` | Comparison, highlight, alert |
| Warning amber | `#F3B734` | `#F1B744`, `#F3C412` | Caution or attention |
| Success green | `#4EAF62` | `#4CAF50`, `#4DAF4A` | Improvement or pass state |
| Information cyan | `#5BC0DE` | `#5BC0BE` | Secondary series or information |
| Purple | `#805AA6` | `#9467BD`, `#8E44AD` | A distinct category when needed |
| Coral pink | `#F07896` | `#ED7D8B` | Secondary categorical distinction |
| Neutral gray | `#78828C` | `#606060`, `#BDC3C7` | Baselines, grid, inactive elements |
| Light blue fill | `#9ECAE1` |  | Low-emphasis area fill |

## Selection rules

- Use no more than 5–6 strong hues in one figure. Put additional baselines in neutral gray.
- Use color with a redundant encoding such as marker, line style, direct label, or pattern only when needed for accessibility.
- Do not use red/green as the only distinction. The green/orange pair is preferable to red/green for directional comparisons, but still needs a non-color cue.
- Use light colors mainly for fills or backgrounds; do not use them for small text or thin lines.
- Check the final figure in grayscale and at final print size. A palette choice is a recommendation only when the underlying scientific convention permits it.
- Do not claim that a color passes accessibility solely because it appears in this list. Contrast depends on the background, line width, size, and neighboring colors.

## Suggested chart presets

### Categorical comparison

`#4682BE`, `#E25822`, `#4EAF62`, `#805AA6`, `#5BC0DE`

### Highlighted method versus baselines

Focal method `#4682BE` or `#E25822`; all baselines `#78828C` with different markers or line styles.

### Directional result

Improvement `#4EAF62`, degradation `#E25822`, unchanged `#78828C`; always add text, arrows, or marker changes.

### Heatmap or continuous scale

Do not interpolate this categorical list. Use a perceptually ordered map such as `viridis`, `cividis`, or a domain-appropriate sequential scale.

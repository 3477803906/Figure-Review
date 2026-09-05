---
name: figure-recheck
description: Re-run the same figure audit standard on a revised figure and compare issue states. Use after a user uploads a new version so resolved, persistent, new, and unverifiable findings remain evidence-based.
license: MIT
---

# Figure Recheck

Use the same standard version and record both file hashes. Run the applicable checks again; do not mark a problem resolved from a repair plan alone.

## States

- `已解决`: old finding no longer has supporting evidence in the new result.
- `仍存在`: the same finding remains supported.
- `新出现`: the new result contains a finding absent from the old result.
- `无法验证`: the new file, model, or evidence cannot support a comparison.

Different model or standard versions must be disclosed. Do not attribute a changed result to visual improvement without comparable evidence.

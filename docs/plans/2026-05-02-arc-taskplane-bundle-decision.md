# Taskplane Bundling and Upstream Hook Decision

## Evidence Reviewed

- Exporter script: `scripts/export-arc-taskplane.mjs`
- Exporter tests: `tests/taskplane-adapter-export.test.mjs`
- Guidance tests: `tests/taskplane-adapter-guidance.test.mjs`
- README Taskplane adapter guidance
- One Taskplane export smoke result, including packet paths under `taskplane-tasks/arc/piarc-0390.02o47j/`:
  - `taskplane-tasks/arc/piarc-0390.02o47j/CONTEXT.md`
  - `taskplane-tasks/arc/piarc-0390.02o47j/piarc-0390.02o47j.5-evaluate-taskplane-bundling-and-upstream-hook-decision-after-spike-evidence/PROMPT.md`

## Options

| Option | Pros | Cons | Decision |
|---|---|---|---|
| Keep Taskplane optional | Small package surface; validates adapter seam first | Requires local Taskplane install/load | Recommended |
| Propose upstream hooks | Keeps Taskplane upstream; adds cleaner Arc metadata/completion seams | Requires upstream coordination | Defer until real Taskplane execution evidence |
| Fork Taskplane | Maximum Arc-specific control | High maintenance burden; risks turning Arc into a Taskplane distribution | Not recommended; last resort only |
| Bundle Taskplane | Best out-of-box UX if the spike proves value | Larger package and possible duplicate command/tool surface | Not recommended yet |

## Recommendation

Recommended path: Keep Taskplane optional.

Rationale: The script-first adapter, tests, docs, and dry-run export seam are proven, but no real Taskplane `/orch-plan` or `/orch` execution has been integrated yet. Keeping Taskplane optional preserves a smaller package/runtime surface while leaving room to propose upstream hooks after more real batch evidence. Forking remains a last resort, and bundling should wait until a successful real Taskplane execution and integration justify the larger command/tool surface.

## Follow-up Issues Created

- None yet.

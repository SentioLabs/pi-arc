# Pi Arc Package

Arc issue tracker integration for [Pi](https://pi.dev): packaged Arc skills, prompt templates, session context injection, workflow command aliases, and bundled checklist support via `@juicesharp/rpiv-todo`.

This package is a Pi-native port of the Claude Code Arc plugin at `../agent-nexus/claude-marketplace/plugins/arc`.

## What is included

- **Prompt templates** for common Arc CLI workflows:
  - `/arc-create`
  - `/arc-list`
  - `/arc-ready`
  - `/arc-show`
  - `/arc-update`
  - `/arc-close`
  - `/arc-docs`
  - and more under `prompts/`
- **Skills** for Arc workflows:
  - `/skill:arc` — general Arc reference
  - `/skill:arc-brainstorm`
  - `/skill:arc-plan`
  - `/skill:arc-build`
  - `/skill:arc-debug`
  - `/skill:arc-review`
  - `/skill:arc-verify`
  - `/skill:arc-finish`
- **Extension commands**:
  - `/arc-onboard` — run `arc onboard`
  - `/arc-which` — run `arc which`
  - `/arc-prime` — show cached `arc prime` context
  - `/arc-refresh` — refresh cached `arc prime` context
  - `/arc-subagents-sync [project|user]` — generate Arc specialist definitions for `pi-subagents`
  - `/arc-plan`, `/arc-build`, `/arc-review`, etc. — friendly aliases for the corresponding skills
- **Session context injection**:
  - On session start, the extension runs `arc prime` and injects its output into the system prompt as `<arc-context>`.
  - Before compaction, the extension refreshes `arc prime`.
- **Bundled `@juicesharp/rpiv-todo` integration** (auto-installed + auto-loaded):
  - `todo` tool for managing in-session checklist items.
  - `/todos` command for a quick checklist view/workflow.
  - Persistent overlay widget for visible, session-level task progress.
- **`ask_user_question` tool**:
  - Presents Arc workflow decisions in a rich Pi selector UI so users can move with arrow keys and press Enter instead of typing numbered answers.
  - Falls back to manual numbered options when Pi is running without an interactive UI.
- **`arc_agent` tool**:
  - Runs bundled Arc specialist prompts from `agents/*.md` in fresh Pi subprocesses.
  - Supports `builder`, `code-reviewer`, `doc-writer`, `evaluator`, `issue-manager`, and `spec-reviewer`.
  - Resolves Arc model tiers (`small`, `standard`, `large`) to concrete Pi models so orchestrators can right-size subagent dispatches.
  - Current limitation: `isolation: "worktree"` is recognized but not implemented yet.
- **Optional `pi-subagents` companion support**:
  - Run `/arc-subagents-sync` to generate Arc specialist agents (`arc-builder`, `arc-doc-writer`, `arc-spec-reviewer`, `arc-code-reviewer`, `arc-evaluator`, `arc-issue-manager`) in project or user scope.
  - Arc workflow skills document where the `subagent` tool is a better fit when `pi-subagents` is installed.
  - Use Arc specialists for Arc gates (especially spec review). Do not substitute generic `worker`/`reviewer` agents, which can drift from Arc prompts and model policy.
  - Use `subagent({ action: "list" })`, `/agents`, and `/subagents-status` after sync to confirm availability.
  - Keep `arc_agent` as the self-contained fallback when Arc `pi-subagents` definitions are unavailable.
  - Claude-style team deployment is intentionally not ported to Pi.

## Prerequisites

- Pi installed.
- The `arc` CLI available on `PATH`.
- An Arc project initialized or registered for the working directory:

```bash
arc init
# or
arc onboard
```

The package fails gracefully when `arc` is unavailable or the current directory is not an Arc project.

## Install via git

Install globally from the private git repository:

```bash
pi install git:git@github.com:sentiolabs/pi-arc
```

Install into the current project's `.pi/settings.json` instead of global settings:

```bash
pi install -l git:git@github.com:sentiolabs/pi-arc
```

Pin to a branch, tag, or commit ref:

```bash
pi install git:git@github.com:sentiolabs/pi-arc@main
pi install git:git@github.com:sentiolabs/pi-arc@v0.8.0
```

Test without installing permanently:

```bash
pi -e git:git@github.com:sentiolabs/pi-arc
```

HTTPS works too if your Git credentials are configured:

```bash
pi install https://github.com/sentiolabs/pi-arc
```

## Install locally

From a local checkout:

```bash
pi install -l .
```

Use temporary installation for testing:

```bash
pi -e .
```

## Usage

Start Pi in an Arc-enabled project and run:

```text
/arc-onboard
/arc-ready
/arc-create "Fix login bug" --type bug --priority 1
/arc-show <issue-id>
/arc-plan <plan-id>
/arc-build <epic-id>
/arc-finish
```

You can also invoke skills directly:

```text
/skill:arc
/skill:arc-plan
/skill:arc-build
```

## Arc vs `todo` boundary

Use Arc for persistent, auditable issue tracking across sessions (`arc create`, `arc update`, dependencies, plans, and closure history). Use bundled `rpiv-todo` (`todo` tool + `/todos` + overlay) for visible, in-session checklists while you execute the current workflow.

## Arc model tiers

Arc subagents use Pi-native model tiers so the orchestrator can choose a right-sized model per dispatch:

| Tier | Default concrete model | Typical use |
|---|---|---|
| `small` | `openai-codex/gpt-5.4-mini` | CLI issue operations, docs, mechanical edits |
| `standard` | `openai-codex/gpt-5.3-codex` | Normal contained implementation/review |
| `large` | `openai-codex/gpt-5.5` | Complex, cross-cutting, or security-sensitive work |

Override the defaults in `~/.pi/agent/settings.json` or project `.pi/settings.json`:

```json
{
  "arc": {
    "modelTiers": {
      "small": "openai-codex/gpt-5.4-mini",
      "standard": "openai-codex/gpt-5.3-codex",
      "large": "openai-codex/gpt-5.5"
    }
  }
}
```

For compatibility, `arc_agent` still maps legacy aliases: `haiku` → `small`, `sonnet` → `standard`, `opus` → `large`.

## Sync Arc specialists into `pi-subagents`

Use `/arc-subagents-sync` to generate Arc specialist agent files from this package's bundled prompts:

- `arc-builder`
- `arc-doc-writer`
- `arc-spec-reviewer`
- `arc-code-reviewer`
- `arc-evaluator`
- `arc-issue-manager`

By default, files are written to project scope (`<cwd>/.pi/agents/`). Pass `user` or `--user` to write to `~/.pi/agent/agents/` instead.

Generated files include a marker comment so reruns can safely update Arc-managed files while preserving manual edits in user-authored files.

After syncing, verify agent registration:

```text
subagent({ action: "list" })
/agents
/subagents-status
```

For Arc gates (especially spec compliance), use Arc specialists (`arc-spec-reviewer`, etc.) instead of generic `worker`/`reviewer` agents.

## Naming differences from the Claude plugin

Claude plugin commands used names like `/arc:create`. Pi prompt templates are filename-based, so this package uses hyphenated names:

| Claude plugin | Pi package |
|---|---|
| `/arc:create` | `/arc-create` |
| `/arc:list` | `/arc-list` |
| `/arc:ready` | `/arc-ready` |
| `/arc:show` | `/arc-show` |
| `/arc:plan` | `/arc-plan` or `/skill:arc-plan` |
| `/arc:build` | `/arc-build` or `/skill:arc-build` |

## Current implementation status

Implemented:

- Pi package manifest
- Prompt template migration with `/arc-*` names
- Skill migration with collision-safe `arc-*` skill names
- Arc context extension (`arc prime` cache + system prompt injection)
- Workflow command aliases
- Bundled agent prompt references under `agents/`
- Pi-native `ask_user_question` custom tool for interactive workflow decisions
- Pi-native `arc_agent` custom tool for sequential subagent execution
- `/arc-subagents-sync` command for generating Arc specialist `pi-subagents` definitions
- Optional guidance for using `pi-subagents` for worktree-isolated evaluator runs and independent parallel builder batches

Not yet implemented:

- Native `arc_agent` worktree isolation for parallel Arc builders.
- Arc issue autocomplete in the Pi editor.

Intentionally not ported:

- Claude-style team deployment. Pi does not provide Claude's persistent team/task primitives.

## Development

Regenerate migrated resources from the source Claude plugin:

```bash
python3 scripts/migrate-arc-plugin.py
```

Smoke test:

```bash
PI_OFFLINE=1 pi -e . --list-models
```

Useful checks:

```bash
rg '/arc:' skills prompts
rg 'TaskCreate|TodoWrite|AskUserQuestion|Claude Code' skills prompts
```

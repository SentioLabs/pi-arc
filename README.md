# Pi Arc Package

Arc issue tracker integration for [Pi](https://pi.dev): packaged Arc skills, prompt templates, session context injection, and workflow command aliases.

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
  - `/skill:arc-team-dispatch`
- **Extension commands**:
  - `/arc-onboard` — run `arc onboard`
  - `/arc-which` — run `arc which`
  - `/arc-prime` — show cached `arc prime` context
  - `/arc-refresh` — refresh cached `arc prime` context
  - `/arc-plan`, `/arc-build`, `/arc-review`, etc. — friendly aliases for the corresponding skills
- **Session context injection**:
  - On session start, the extension runs `arc prime` and injects its output into the system prompt as `<arc-context>`.
  - Before compaction, the extension refreshes `arc prime`.
- **`arc_agent` tool**:
  - Runs bundled Arc specialist prompts from `agents/*.md` in fresh Pi subprocesses.
  - Supports `builder`, `code-reviewer`, `doc-writer`, `evaluator`, `issue-manager`, and `spec-reviewer`.
  - Current limitation: `isolation: "worktree"` is recognized but not implemented yet.

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
- Pi-native `arc_agent` custom tool for sequential subagent execution

Not yet implemented:

- Worktree isolation for parallel Arc builders.
- Arc issue autocomplete in the Pi editor.

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

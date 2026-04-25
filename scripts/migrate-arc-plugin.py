#!/usr/bin/env python3
from pathlib import Path
import shutil
import re

REPO_ROOT = Path(__file__).resolve().parents[1]
ARC_ROOT = REPO_ROOT
SRC = (REPO_ROOT / "../agent-nexus/claude-marketplace/plugins/arc").resolve()

if not SRC.exists():
    raise SystemExit(f"Source plugin not found: {SRC}")

ARC_ROOT.mkdir(parents=True, exist_ok=True)

# Clean generated Arc resource directories only. Keep package.json, README, and extension edits.
for name in ["prompts", "skills", "agents"]:
    p = ARC_ROOT / name
    if p.exists():
        shutil.rmtree(p)
    p.mkdir(parents=True, exist_ok=True)

# Static source files.
for name in ["CHANGELOG.md", "version.txt"]:
    src = SRC / name
    if src.exists():
        shutil.copy2(src, ARC_ROOT / name)

for f in sorted((SRC / "commands").glob("*.md")):
    dest_name = f"arc-{f.name}"
    text = f.read_text()
    text = re.sub(r"/arc:([a-zA-Z0-9_-]+)", r"/arc-\1", text)
    text = text.replace("Claude Code", "Pi")
    text = text.replace("Claude", "Pi")
    text = text.replace("SessionStart and PreCompact hooks", "the Pi arc extension on session start and before compaction")
    text = text.replace("When to use arc vs TodoWrite", "When to use arc vs ephemeral in-session checklists")
    (ARC_ROOT / "prompts" / dest_name).write_text(text)

skill_map = {
    "arc": "arc",
    "brainstorm": "arc-brainstorm",
    "build": "arc-build",
    "debug": "arc-debug",
    "finish": "arc-finish",
    "plan": "arc-plan",
    "review": "arc-review",
    "team-dispatch": "arc-team-dispatch",
    "verify": "arc-verify",
}

def transform_text(text: str) -> str:
    # Slash command references.
    text = re.sub(r"/arc:([a-zA-Z0-9_-]+)", lambda m: f"/arc-{m.group(1)}", text)
    for old, new in skill_map.items():
        if old != "arc":
            text = text.replace(f"/skill:{old}", f"/skill:{new}")

    # Harness naming and Claude-specific tool names.
    text = text.replace("Claude Code", "Pi")
    text = text.replace("Claude", "Pi")
    text = text.replace("TaskCreate/TaskUpdate", "an explicit checklist in the conversation")
    text = text.replace("TaskCreate", "an explicit checklist")
    text = text.replace("TodoWrite", "an explicit checklist")
    text = text.replace("AskUserQuestion tool", "user prompt with numbered options")
    text = text.replace("AskUserQuestion", "user prompt with numbered options")

    # Subagent migration.
    text = text.replace("Use the Agent tool with subagent_type=\"arc:issue-manager\":", "Use the arc_agent tool with agent=\"issue-manager\":")
    text = text.replace("Agent(subagent_type=\"arc:builder\", model=\"haiku\", prompt=\"...\")", "arc_agent(agent=\"builder\", model=\"haiku\", task=\"...\")")
    text = text.replace("Agent(subagent_type=\"arc:builder\", prompt=\"...\")", "arc_agent(agent=\"builder\", task=\"...\")")
    text = text.replace("Agent(subagent_type=\"arc:builder\", model=\"opus\", prompt=\"...\")", "arc_agent(agent=\"builder\", model=\"opus\", task=\"...\")")
    text = text.replace("Agent(subagent_type=\"arc:builder\", isolation=\"worktree\", prompt=\"Task 1...\")", "arc_agent(agent=\"builder\", isolation=\"worktree\", task=\"Task 1...\")")
    text = text.replace("Agent(subagent_type=\"arc:builder\", isolation=\"worktree\", prompt=\"Task 2...\")", "arc_agent(agent=\"builder\", isolation=\"worktree\", task=\"Task 2...\")")
    text = text.replace("Agent(subagent_type=\"arc:builder\", isolation=\"worktree\", prompt=\"Task 3...\")", "arc_agent(agent=\"builder\", isolation=\"worktree\", task=\"Task 3...\")")
    text = text.replace("Agent dispatch", "arc_agent dispatch")
    text = text.replace("Agent tool", "arc_agent tool")
    text = text.replace("Use the Agent", "Use arc_agent")

    # Relative paths after skill directory renames.
    text = text.replace("../build/", "../arc-build/")
    text = text.replace("../review/", "../arc-review/")
    return text

for src_dir in sorted((SRC / "skills").iterdir()):
    if not src_dir.is_dir():
        continue
    old_name = src_dir.name
    new_name = skill_map.get(old_name, f"arc-{old_name}")
    dest_dir = ARC_ROOT / "skills" / new_name
    shutil.copytree(src_dir, dest_dir)
    skill_file = dest_dir / "SKILL.md"
    if skill_file.exists():
        text = skill_file.read_text()
        text = re.sub(r"(?m)^name:\s*.+$", f"name: {new_name}", text, count=1)
        text = transform_text(text)
        skill_file.write_text(text)
    for md in dest_dir.rglob("*.md"):
        if md.name == "SKILL.md":
            continue
        md.write_text(transform_text(md.read_text()))

# Current Pi package limitation: replace Claude team automation with safe Pi guidance.
(ARC_ROOT / "skills" / "arc-team-dispatch" / "SKILL.md").write_text("""---
name: arc-team-dispatch
description: Inspect arc team labels and prepare a role-based execution plan. Use when the user asks to deploy a team, spawn teammates, parallelize an epic, or distribute arc tasks by teammate labels. Current Pi package limitation: actual parallel team spawning is not implemented; this skill prepares a sequential/role-grouped dispatch plan instead.
---

# Arc Team Dispatch

Arc can group epic child issues by `teammate:<role>` labels. The Claude plugin used Claude team/subagent primitives for parallel execution. This Pi package does **not** yet implement full team spawning or worktree-isolated parallel agents, so this skill converts the team graph into a safe role-grouped execution plan and then proceeds sequentially unless the user explicitly wants to handle parallelism outside Pi.

## When to Invoke

- User says "deploy team", "create agent team from arc", "spawn teammates from arc"
- User wants to parallelize work on an arc epic across multiple roles
- User asks what teammate labels exist or how an epic should be distributed

## Workflow

### 1. Gather Team Context

Run:

```bash
arc team context <epic-id> --json
```

If the user has not specified an epic, help them find one:

```bash
arc list --type=epic --status=open
```

### 2. Present Team Composition

Summarize roles and issues and explain that automatic parallel team spawning is not implemented yet.

Ask the user which path they want:

1. Run sequentially by role in this session
2. Print prompts for separate Pi sessions/worktrees
3. Stop after showing the team plan

### 3. Sequential Role Execution

For sequential execution:

1. Order roles by dependency readiness and priority.
2. For each role, list ready issues first.
3. For each issue:
   - `arc show <issue-id>`
   - `arc update <issue-id> --take`
   - Dispatch `arc_agent(agent="builder", task="...")` or `arc_agent(agent="doc-writer", task="...")` for `docs-only` issues.
   - Verify the result.
   - Close the issue only after verification passes.

Use `/skill:arc-build <epic-id>` for the detailed build loop when appropriate.

## Rules

- Do not claim that Pi has spawned a real agent team unless a future extension actually implements it.
- Do not use `isolation: "worktree"` with `arc_agent` in the current package; it is not implemented.
- Prefer sequential execution when unsure.
- Preserve arc dependencies: never start a blocked issue until its blockers are closed.
- Close arc issues only after evidence-based verification.
""")

# Patch arc-build to reflect current sequential-only arc_agent behavior.
build_skill = ARC_ROOT / "skills" / "arc-build" / "SKILL.md"
text = build_skill.read_text()
text = text.replace(
    "### Parallel\n\nMultiple tasks dispatched simultaneously using `isolation: \"worktree\"`. Use this **only** when ALL of these are true:\n- 3+ independent tasks remain\n- No shared files between any tasks in the batch\n- No `blocks`/`blockedBy` dependencies between tasks in the batch\n- Each task's scope is clearly defined with no ambiguity\n\n**When NOT to use parallel**: overlapping files, task dependencies, uncertainty about scope, fewer than 3 tasks. Default to sequential — the cost of serial execution is time; the cost of a bad parallel merge is data loss.",
    "### Parallel\n\nParallel worktree dispatch is **not available in the current Pi package**. The `arc_agent` tool currently supports sequential subprocess execution only and will reject `isolation: \"worktree\"`.\n\nDefault to sequential execution for all tasks until worktree isolation is implemented.",
)
text = text.replace(
    "By default, use sequential dispatch. For independent tasks, see [Parallel Dispatch Protocol](#parallel-dispatch-protocol) below.",
    "Use sequential dispatch. Parallel worktree dispatch is reserved for a future package version.",
)
text = text.replace(
    "When dispatched, use `isolation: \"worktree\"` and the existing `evaluator` agent. The evaluator can run **in parallel with Step 6** (code quality review) since they examine orthogonal concerns:",
    "When dispatched, run the `evaluator` agent sequentially after Step 6. Parallel evaluator execution is reserved for a future package version:",
)
text = text.replace(
    "When dispatching alongside the evaluator, update the code quality reviewer's `## Evaluator Status` to `active`.",
    "When you plan to run the evaluator after code review, set the code quality reviewer's `## Evaluator Status` to `active`; otherwise set it to `not dispatched`.",
)
text = text.replace(
    "## Parallel Dispatch Protocol\n\nWhen you have identified a batch of truly independent tasks (see [Dispatch Modes](#dispatch-modes)), switch from the sequential loop to this protocol:",
    "## Parallel Dispatch Protocol (Future)\n\nParallel worktree dispatch is not implemented in this Pi package yet. Do not use this protocol until `arc_agent` supports `isolation: \"worktree\"`.",
)
text = text.replace(
    "All parallel arc_agent tool calls with `isolation: \"worktree\"` **must happen in the same orchestrator message**. This ensures they all branch from the same HEAD.\n\n```\n# In a single response, dispatch all parallel tasks:\narc_agent(agent=\"builder\", isolation=\"worktree\", task=\"Task 1...\")\narc_agent(agent=\"builder\", isolation=\"worktree\", task=\"Task 2...\")\narc_agent(agent=\"builder\", isolation=\"worktree\", task=\"Task 3...\")\n```\n\n**Never** dispatch worktree agents across multiple turns — HEAD may move between turns, causing stale branches.",
    "When this feature exists, all parallel arc_agent tool calls with `isolation: \"worktree\"` must happen in the same orchestrator message so they branch from the same HEAD.\n\nUntil then, run tasks sequentially with `arc_agent(agent=\"builder\", task=\"...\")`.",
)
build_skill.write_text(text)

# Copy agents as bundled prompts for arc_agent.
for f in sorted((SRC / "agents").glob("*.md")):
    text = transform_text(f.read_text())
    text = text.replace("  - Bash", "  - bash")
    text = text.replace("  - Read", "  - read")
    text = text.replace("  - Write", "  - write")
    text = text.replace("  - Edit", "  - edit")
    text = text.replace("  - Glob", "  - find")
    text = text.replace("  - Grep", "  - grep")
    (ARC_ROOT / "agents" / f.name).write_text(text)

print(f"Migrated arc plugin resources from {SRC}")
print(f"Package root: {ARC_ROOT}")
print(f"Prompts: {len(list((ARC_ROOT / 'prompts').glob('*.md')))}")
print(f"Skills: {len(list((ARC_ROOT / 'skills').glob('*/SKILL.md')))}")
print(f"Agents: {len(list((ARC_ROOT / 'agents').glob('*.md')))}")

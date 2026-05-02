#!/usr/bin/env python3
import argparse
from pathlib import Path
import shutil
import re

REPO_ROOT = Path(__file__).resolve().parents[1]
ARC_ROOT = REPO_ROOT
DEFAULT_SRC = (REPO_ROOT / "../agent-nexus/claude-marketplace/plugins/arc").resolve()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Regenerate pi-arc resources from the Claude Arc plugin source.",
    )
    parser.add_argument(
        "source",
        nargs="?",
        help=f"Path to the Claude Arc plugin source directory. Defaults to {DEFAULT_SRC}.",
    )
    parser.add_argument(
        "--source",
        dest="source_option",
        metavar="SOURCE",
        help="Path to the Claude Arc plugin source directory (option form).",
    )
    return parser.parse_args()


def resolve_source_path(args: argparse.Namespace) -> Path:
    if args.source and args.source_option:
        raise SystemExit("Pass the source path either positionally or with --source, not both.")
    raw_source = args.source_option or args.source
    if raw_source:
        return Path(raw_source).expanduser().resolve()
    return DEFAULT_SRC


def validate_source(src: Path) -> None:
    expected_paths = [
        "commands",
        "skills",
        "agents",
        ".claude-plugin/plugin.json",
    ]
    missing = [rel for rel in expected_paths if not (src / rel).exists()]
    if missing:
        missing_text = "\n".join(f"- {rel}" for rel in missing)
        raise SystemExit(
            f"Source plugin does not look like the Claude Arc plugin: {src}\n"
            f"Missing expected paths:\n{missing_text}"
        )


ARGS = parse_args()
SRC = resolve_source_path(ARGS)
validate_source(SRC)

ARC_ROOT.mkdir(parents=True, exist_ok=True)

# Clean generated Arc resource directories only. Keep package.json, README, and extension edits.
for name in ["prompts", "skills", "agents"]:
    p = ARC_ROOT / name
    if p.exists():
        shutil.rmtree(p)
    p.mkdir(parents=True, exist_ok=True)

# Release metadata is managed by this npm package and Release Please.
# Do not copy the source Claude plugin changelog or legacy version.txt.

for f in sorted((SRC / "commands").glob("*.md")):
    dest_name = f"arc-{f.name}"
    text = f.read_text()
    text = re.sub(r"/arc:([a-zA-Z0-9_-]+)", r"/arc-\1", text)
    text = text.replace("Claude Code", "Pi")
    text = text.replace("Claude", "Pi")
    text = text.replace("SessionStart and PreCompact hooks", "the Pi arc extension on session start and before compaction")
    text = re.sub(r"When to use arc vs TodoWrite", "When to use arc vs the bundled `todo` checklist workflow", text, flags=re.IGNORECASE)
    text = re.sub(r"todowrite vs arc", "todo checklist vs arc", text, flags=re.IGNORECASE)
    text = re.sub(r"TodoWrite", "the bundled `todo` checklist", text, flags=re.IGNORECASE)
    text = re.sub(r"TaskCreate/TaskUpdate", "the bundled `todo` checklist", text, flags=re.IGNORECASE)
    text = re.sub(r"TaskCreate", "the bundled `todo` checklist", text, flags=re.IGNORECASE)
    (ARC_ROOT / "prompts" / dest_name).write_text(text)

skill_map = {
    "arc": "arc",
    "brainstorm": "arc-brainstorm",
    "build": "arc-build",
    "debug": "arc-debug",
    "finish": "arc-finish",
    "plan": "arc-plan",
    "review": "arc-review",
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
    text = re.sub(r"TaskCreate/TaskUpdate tracks workflow progress in the CLI", "the bundled `todo` checklist tracks in-session workflow progress in the CLI", text, flags=re.IGNORECASE)
    text = re.sub(r"Create a TodoWrite checklist", "Create a checklist using the bundled `todo` tool (or `/todos`)", text, flags=re.IGNORECASE)
    text = re.sub(r"`TaskCreate`", "the bundled `todo` checklist (via `todo` tool / `/todos`)", text, flags=re.IGNORECASE)
    text = re.sub(r"TaskCreate/TaskUpdate", "the bundled `todo` checklist", text, flags=re.IGNORECASE)
    text = re.sub(r"TaskCreate", "the bundled `todo` checklist", text, flags=re.IGNORECASE)
    text = re.sub(r"TodoWrite", "the bundled `todo` checklist", text, flags=re.IGNORECASE)
    text = text.replace("AskUserQuestion tool", "`ask_user_question` tool")
    text = text.replace("AskUserQuestion", "`ask_user_question`")

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
    # Claude's team-dispatch skill depends on Claude-only persistent team
    # primitives (TeamCreate/TaskCreate/TaskUpdate/Agent team_name). Pi does
    # not provide equivalent semantics, so do not package a misleading skill.
    if old_name == "team-dispatch":
        continue
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

# Patch generated skills for Pi-specific execution semantics.
def patch_file(rel: str, replacements: list[tuple[str, str]]) -> None:
    path = ARC_ROOT / rel
    text = path.read_text()
    for old, new in replacements:
        if old not in text:
            raise RuntimeError(f"Expected text not found while patching {rel}: {old[:80]!r}")
        text = text.replace(old, new)
    path.write_text(text)

patch_file("prompts/arc-team.md", [
    (
        "description: Agent team operations",
        "description: Show arc teammate-label context",
    ),
    (
        "Manage agent team operations with `arc team`.",
        "Show teammate-label planning context with `arc team`.\n\nPi does not support Claude-style team deployment. Use this command only to inspect `teammate:*` issue groupings; implementation remains orchestrated through `/arc-build`.",
    ),
    (
        "**Related commands:**\n- `arc prime --role=lead` — Team lead context output\n- `arc prime --role=frontend` — Teammate-specific context (or use `ARC_TEAMMATE_ROLE` env var)",
        "**Related commands:**\n- `arc prime --role=lead` — Lead-oriented context output\n- `arc prime --role=frontend` — Role-filtered context (or use `ARC_TEAMMATE_ROLE` env var)",
    ),
])

patch_file("skills/arc/SKILL.md", [
    (
        "After `plan`, choose:\n- **Single-agent + subagents**: Invoke `implement`. Main agent orchestrates, subagents do TDD. Best for sequential tasks.\n- **Agentic team**: Add `teammate:*` labels, invoke `arc team-deploy`. Best for parallel multi-role work.",
        "After `plan`, choose:\n- **Single-agent + subagents**: Invoke `implement`. Main agent orchestrates, subagents do TDD. Best for sequential tasks.\n- **Parallel Arc build**: For independent task batches, `implement` can use worktree-isolated `pi-subagents` runs when that companion package and Arc agent definitions are available. This is not Claude-style team deployment; the orchestrator still owns verification, patch application, issue closure, and handoff.",
    ),
])

patch_file("skills/arc-plan/SKILL.md", [
    (
        "- Team preparation (teammate labels) is optional — only if user chooses team execution",
        "- `teammate:*` labels may be used as planning metadata, but Pi does not support Claude-style team deployment. Use `/arc-build` for orchestrated sequential work or independent `pi-subagents` parallel batches when available.",
    ),
])

patch_file("skills/arc-review/SKILL.md", [
    (
        "## Contexts\n\nThis skill works in both execution models:\n\n| Context | How review works |\n|---------|-----------------|\n| **Single-agent** | Main agent dispatches `code-reviewer` subagent |\n| **Team mode** | Team lead dispatches QA teammate or `code-reviewer` subagent |",
        "## Contexts\n\nThis skill works in orchestrated Arc execution:\n\n| Context | How review works |\n|---------|-----------------|\n| **Sequential build** | Main agent dispatches `code-reviewer` subagent after the builder reports completion |\n| **Parallel patch batch** | Main agent applies each accepted patch to the main worktree, then dispatches `code-reviewer` against the applied diff |",
    ),
])

patch_file("skills/arc-finish/SKILL.md", [
    (
        "| Session Type | Behavior |\n|-------------|----------|\n| **Single-agent** | Full protocol above |\n| **Team lead** | Verify teammate work → close arc issues → team cleanup → commit → push |\n| **Teammate** | Commit → push (team lead handles arc close and coordination) |",
        "| Session Type | Behavior |\n|-------------|----------|\n| **Single-agent** | Full protocol above |\n| **Parallel subagent patches** | Apply/review accepted patches → verify → close arc issues → commit → push |",
    ),
])

patch_file("skills/arc-build/SKILL.md", [
    (
        "Every arc_agent dispatch can override the subagent's frontmatter model via the `model:` parameter. Use this to match model tier to task complexity. The default floor per agent is set in frontmatter — use these overrides to downgrade for trivial tasks or escalate for complex ones.",
        "Every Arc subagent dispatch can override the subagent's frontmatter model via the `model:` parameter. Use this to match model tier to task complexity. The default floor per agent is set in frontmatter — use these overrides to downgrade for trivial tasks or escalate for complex ones.\n\nPrefer the `subagent` tool from `pi-subagents` when it is available **and** Arc agent definitions such as `arc-builder` are installed. If Arc specialist definitions are missing, run `/arc-subagents-sync` (project default) or `/arc-subagents-sync user`, then re-check with `subagent({ action: \"list\" })`. Otherwise use the bundled `arc_agent` fallback. `arc_agent` is self-contained and sequential only; `pi-subagents` adds chains, async runs, and worktree-isolated parallel patch generation.",
    ),
    (
        "```text\narc_agent(agent=\"builder\", model=\"haiku\", task=\"...\")       # mechanical\narc_agent(agent=\"builder\", task=\"...\")                      # standard (sonnet)\narc_agent(agent=\"builder\", model=\"opus\", task=\"...\")        # complex\n```",
        "```text\n# Self-contained fallback:\narc_agent(agent=\"builder\", model=\"haiku\", task=\"...\")       # mechanical\narc_agent(agent=\"builder\", task=\"...\")                      # standard (sonnet)\narc_agent(agent=\"builder\", model=\"opus\", task=\"...\")        # complex\n\n# Preferred when pi-subagents Arc agents are installed:\nsubagent({ agent: \"arc-builder\", task: \"...\", model: \"haiku\", context: \"fresh\" })\nsubagent({ agent: \"arc-builder\", task: \"...\", context: \"fresh\" })\nsubagent({ agent: \"arc-builder\", task: \"...\", model: \"opus\", context: \"fresh\" })\n```",
    ),
    (
        "### Parallel\n\nMultiple tasks dispatched simultaneously using `isolation: \"worktree\"`. Use this **only** when ALL of these are true:\n- 3+ independent tasks remain\n- No shared files between any tasks in the batch\n- No `blocks`/`blockedBy` dependencies between tasks in the batch\n- Each task's scope is clearly defined with no ambiguity\n\n**When NOT to use parallel**: overlapping files, task dependencies, uncertainty about scope, fewer than 3 tasks. Default to sequential — the cost of serial execution is time; the cost of a bad parallel merge is data loss.",
        "### Parallel\n\nParallel worktree dispatch is available **only** through the optional `pi-subagents` companion package, not through `arc_agent`. Use it only when ALL of these are true:\n- `pi-subagents` is installed and the `subagent` tool is available\n- Arc agent definitions such as `arc-builder` / `arc-doc-writer` are installed for `pi-subagents`\n- 3+ independent tasks remain, or one high-risk evaluator needs a disposable worktree\n- No shared files between any builder/doc-writer tasks in the batch\n- No `blocks`/`blockedBy` dependencies between tasks in the batch\n- Each task's scope is clearly defined with no ambiguity\n\n`pi-subagents` worktree mode returns per-task patch files and cleans up temporary worktrees. It does **not** automatically merge changes into the main working tree. The orchestrator must inspect, apply, verify, commit, and close each patch/task explicitly.\n\n**When NOT to use parallel**: missing `subagent` tool, missing Arc agent definitions, overlapping files, task dependencies, uncertainty about scope, or fewer than 3 implementation tasks. Default to sequential — the cost of serial execution is time; the cost of a bad parallel patch merge is data loss.",
    ),
    (
        "By default, use sequential dispatch. For independent tasks, see [Parallel Dispatch Protocol](#parallel-dispatch-protocol) below.",
        "By default, use sequential dispatch. For independent batches with `pi-subagents` available, see [Parallel Patch Protocol](#parallel-patch-protocol) below.",
    ),
    (
        "Use the template at `./doc-writer-prompt.md`. Fill placeholder `{TASK_ID}`. For docs-only work, the agent default (`haiku`) is correct — omit `model:` unless the docs task is unusually complex.\n\n**Otherwise** — spawn an `builder` subagent:\n\nUse the template at `./builder-prompt.md`. Fill placeholders (`{TASK_ID}`, `{PRE_TASK_SHA}`, `{DESIGN_EXCERPT}`) and apply Model Selection guidance (see `## Model Selection` above) for the dispatch `model:`.",
        "Use the template at `./doc-writer-prompt.md`. Fill placeholder `{TASK_ID}`. For docs-only work, the agent default (`haiku`) is correct — omit `model:` unless the docs task is unusually complex.\n\nDispatch preference:\n- If `subagent` is available and `arc-doc-writer` is installed: `subagent({ agent: \"arc-doc-writer\", task: \"<filled prompt>\", context: \"fresh\" })`\n- If `subagent` is available but Arc specialists are missing: run `/arc-subagents-sync`, verify with `subagent({ action: \"list\" })`, then retry.\n- Otherwise: `arc_agent(agent=\"doc-writer\", task=\"<filled prompt>\")`\n\n**Otherwise** — spawn an `builder` subagent:\n\nUse the template at `./builder-prompt.md`. Fill placeholders (`{TASK_ID}`, `{PRE_TASK_SHA}`, `{DESIGN_EXCERPT}`) and apply Model Selection guidance (see `## Model Selection` above) for the dispatch `model:`.\n\nDispatch preference:\n- If `subagent` is available and `arc-builder` is installed: `subagent({ agent: \"arc-builder\", task: \"<filled prompt>\", model: \"<tier-if-needed>\", context: \"fresh\" })`\n- If `subagent` is available but Arc specialists are missing: run `/arc-subagents-sync`, verify with `subagent({ action: \"list\" })`, then retry.\n- Otherwise: `arc_agent(agent=\"builder\", task=\"<filled prompt>\", model=\"<tier-if-needed>\")`",
    ),
    (
        "Use the template at `./spec-reviewer-prompt.md`. Fill placeholders (`{TASK_ID}`, `{BASE_SHA}`, `{HEAD_SHA}`). Spec review is a focused comparison task — the agent default is appropriate; omit `model:` unless the spec is unusually large or ambiguous.",
        "Use the template at `./spec-reviewer-prompt.md`. Fill placeholders (`{TASK_ID}`, `{BASE_SHA}`, `{HEAD_SHA}`). Spec review is a focused comparison task — the Arc `standard` tier is appropriate unless the spec is unusually large or ambiguous.\n\nDispatch preference:\n- If `subagent` is available and `arc-spec-reviewer` is installed: `subagent({ agent: \"arc-spec-reviewer\", task: \"<filled prompt>\", model: \"openai-codex/gpt-5.3-codex\", context: \"fresh\" })`\n- If `subagent` is available but Arc specialists are missing: run `/arc-subagents-sync`, verify with `subagent({ action: \"list\" })`, then retry.\n- Otherwise: `arc_agent(agent=\"spec-reviewer\", task=\"<filled prompt>\")`\n\nDo **not** substitute the generic `worker` or `reviewer` agent for spec compliance gates. Generic `pi-subagents` agents are not Arc specialists, and manually passing an Anthropic model bypasses Arc's Pi-native model tier policy. If Arc `pi-subagents` definitions are unavailable, use the bundled `arc_agent` fallback.",
    ),
    (
        "When dispatched, use `isolation: \"worktree\"` and the existing `evaluator` agent. The evaluator can run **in parallel with Step 6** (code quality review) since they examine orthogonal concerns:",
        "When `pi-subagents` is available, dispatch the evaluator through a one-task worktree-isolated parallel run. This gives it a disposable repository copy so it can write acceptance tests and add temporary dependencies without dirtying the main worktree:\n\n```ts\nsubagent({\n  tasks: [\n    { agent: \"arc-evaluator\", task: \"<filled evaluator prompt>\", model: \"opus\" }\n  ],\n  worktree: true,\n  concurrency: 1,\n  context: \"fresh\"\n})\n```\n\nIf `pi-subagents` or `arc-evaluator` is not available, fall back to sequential `arc_agent(agent=\"evaluator\", model=\"opus\", task=\"<filled evaluator prompt>\")` and ensure the evaluator does not leave uncommitted artifacts in the main worktree.",
    ),
    (
        "When dispatching alongside the evaluator, update the code quality reviewer's `## Evaluator Status` to `active`.",
        "When you plan to run the evaluator, set the code quality reviewer's `## Evaluator Status` to `active`; otherwise set it to `not dispatched`.",
    ),
    (
        "## Parallel Dispatch Protocol\n\nWhen you have identified a batch of truly independent tasks (see [Dispatch Modes](#dispatch-modes)), switch from the sequential loop to this protocol:",
        "## Parallel Patch Protocol\n\nUse this protocol only with `pi-subagents` worktree mode. Do **not** use `arc_agent(isolation=\"worktree\")`; `arc_agent` intentionally remains sequential-only.",
    ),
    (
        "All parallel arc_agent tool calls with `isolation: \"worktree\"` **must happen in the same orchestrator message**. This ensures they all branch from the same HEAD.\n\n```\n# In a single response, dispatch all parallel tasks:\narc_agent(agent=\"builder\", isolation=\"worktree\", task=\"Task 1...\")\narc_agent(agent=\"builder\", isolation=\"worktree\", task=\"Task 2...\")\narc_agent(agent=\"builder\", isolation=\"worktree\", task=\"Task 3...\")\n```\n\n**Never** dispatch worktree agents across multiple turns — HEAD may move between turns, causing stale branches.",
        "Dispatch all parallel tasks in one `subagent` tool call so they branch from the same `PARALLEL_BASE`:\n\n```ts\nsubagent({\n  tasks: [\n    { agent: \"arc-builder\", task: \"<filled builder prompt for task 1>\", model: \"sonnet\" },\n    { agent: \"arc-builder\", task: \"<filled builder prompt for task 2>\", model: \"sonnet\" },\n    { agent: \"arc-doc-writer\", task: \"<filled doc-writer prompt for task 3>\", model: \"haiku\" }\n  ],\n  worktree: true,\n  concurrency: 3,\n  context: \"fresh\"\n})\n```\n\n`pi-subagents` returns diff stats and a `Full patches: <dir>` path. Temporary worktrees are cleaned up; the patches are the handoff artifact.",
    ),
    (
        "- Never proceed after parallel merge without verifying commit history against the recorded HEAD anchor",
        "- Never use parallel patch mode unless `pi-subagents` and Arc `pi-subagents` agent definitions are available\n- Never apply more than one parallel patch at a time; apply, verify, review, commit, and close each task independently\n- Never proceed after a parallel patch batch without verifying commit history against the recorded HEAD anchor",
    ),
])


# The replacement above adjusts the dispatch example, but the original Claude
# protocol still describes automatic worktree merge semantics. Pi-subagents
# returns patch files instead, so replace the whole protocol body.
build_path = ARC_ROOT / "skills" / "arc-build" / "SKILL.md"
text = build_path.read_text()
start = text.index("## Parallel Patch Protocol")
end = text.index("\n## When to Invoke Debug", start)
text = text[:start] + """## Parallel Patch Protocol

Use this protocol only with `pi-subagents` worktree mode. Do **not** use `arc_agent(isolation=\"worktree\")`; `arc_agent` intentionally remains sequential-only.

### P1. Commit Checkpoint

Before switching to parallel, ensure all sequential work is committed and pushed:

```bash
git status          # Must be clean — no unstaged or uncommitted changes
git log -3          # Verify recent sequential commits are present
git push            # Establish a recovery point on the remote
```

**Hard gate**: Do NOT proceed if `git status` shows uncommitted changes.

### P2. Record HEAD Anchor

```bash
PARALLEL_BASE=$(git rev-parse HEAD)
echo \"Parallel base: $PARALLEL_BASE\"
```

This is the baseline all temporary worktrees will branch from. Record it — you'll need it for verification after patch application.

### P3. Verify Independence

For each task in the planned parallel batch:

```bash
arc show <task-id>
```

Confirm:
- No `blocks`/`blockedBy` relationships between tasks in this batch
- No overlapping file paths in task descriptions
- Each task has a clearly scoped, non-ambiguous specification
- Each task can be validated independently after its patch is applied

If any task fails these checks, remove it from the parallel batch and handle it sequentially after.

### P4. Dispatch with `pi-subagents`

Dispatch all parallel tasks in one `subagent` tool call so they branch from the same `PARALLEL_BASE`:

```ts
subagent({
  tasks: [
    { agent: \"arc-builder\", task: \"<filled builder prompt for task 1>\", model: \"sonnet\" },
    { agent: \"arc-builder\", task: \"<filled builder prompt for task 2>\", model: \"sonnet\" },
    { agent: \"arc-doc-writer\", task: \"<filled doc-writer prompt for task 3>\", model: \"haiku\" }
  ],
  worktree: true,
  concurrency: 3,
  context: \"fresh\"
})
```

`pi-subagents` returns diff stats and a `Full patches: <dir>` path. Temporary worktrees are cleaned up; the patches are the handoff artifact.

### P5. Apply and Verify Patches One at a Time

For each returned patch:

```bash
git status --short                    # Must be clean before applying each patch
git apply --3way <patch-file>          # Apply one patch
git diff --stat                       # Inspect applied changes
```

Then run that task through the normal post-implementation gates:
1. Fresh project/task tests — do not trust the subagent report alone.
2. Spec compliance review.
3. Code quality review.
4. Optional high-risk evaluator.
5. Commit the accepted patch.
6. Close the corresponding arc issue.

If a patch fails to apply cleanly or verification fails:
- Do not close the task.
- Revert the partial application (`git apply -R` if possible, or reset with user approval if needed).
- Re-dispatch that task sequentially with the failure details.

### P6. Batch-Level Verification

After all accepted patches are applied and committed, verify the batch:

```bash
# 1. Check work since the recorded anchor
git log --oneline $PARALLEL_BASE..HEAD

# 2. Verify prior sequential commits are still in history
git log --oneline HEAD | head -20

# 3. Run full test suite
make test    # or project-specific test command
```

**If sequential commits are missing** → STOP. Do not continue. Recover from reflog:

```bash
git reflog
git log --oneline <reflog-ref>
# Cherry-pick or reset as appropriate — ask user if unsure
```

### P7. Resume Sequential

After successful verification, return to the normal orchestration loop (step 1) for any remaining tasks.\n""" + text[end:]
build_path.write_text(text)


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

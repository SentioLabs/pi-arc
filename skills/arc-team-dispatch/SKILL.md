---
name: arc-team-dispatch
description: "Inspect arc team labels and prepare a role-based execution plan. Use when the user asks to deploy a team, spawn teammates, parallelize an epic, or distribute arc tasks by teammate labels. Current Pi package limitation: actual parallel team spawning is not implemented; this skill prepares a sequential/role-grouped dispatch plan instead."
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

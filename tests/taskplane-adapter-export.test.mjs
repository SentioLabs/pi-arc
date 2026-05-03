import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTaskplaneContext,
  buildTaskplanePrompt,
  extractFileScope,
  extractValidationCommand,
  formatTaskplaneDependencies,
} from '../scripts/export-arc-taskplane.mjs';

const scriptPath = fileURLToPath(new URL('../scripts/export-arc-taskplane.mjs', import.meta.url));

function issueDescription({ files = ['scripts/export-arc-taskplane.mjs'], testCommand = 'node --test tests/taskplane-adapter-export.test.mjs' } = {}) {
  return `## Summary
Export child task.

## Files
${files.map((file) => `- Modify: \`${file}\``).join('\n')}

## Test Command
\`${testCommand}\`
`;
}

function createArcFixture(t, issues) {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'arc-export-fixture-'));
  const arcPath = path.join(fixtureDir, 'arc');
  writeFileSync(arcPath, `#!/usr/bin/env node
const issues = ${JSON.stringify(issues)};
const [, , command, id, jsonFlag] = process.argv;
if (command !== 'show' || jsonFlag !== '--json') {
  console.error('Unexpected arc args: ' + process.argv.slice(2).join(' '));
  process.exit(2);
}
if (!Object.hasOwn(issues, id)) {
  console.error('Missing fixture issue: ' + id);
  process.exit(3);
}
process.stdout.write(JSON.stringify(issues[id]));
`, { mode: 0o755 });

  t.after(() => rmSync(fixtureDir, { recursive: true, force: true }));

  return {
    env: {
      ...process.env,
      PATH: `${fixtureDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  };
}

const epic = { id: 'piarc-0390.epic01', title: 'Spike optional Taskplane adapter' };
const issue = {
  id: 'piarc-0390.epic01.2',
  title: 'Add exporter script',
  status: 'open',
  description: `## Summary
Add exporter.

## Files
- Create: \`scripts/export-arc-taskplane.mjs\`
- Create: \`tests/taskplane-adapter-export.test.mjs\`

## Test Command
\`node --test tests/taskplane-adapter-export.test.mjs\`
`,
};

test('extractFileScope reads Arc task Files entries', () => {
  assert.deepEqual(extractFileScope(issue.description), [
    'scripts/export-arc-taskplane.mjs',
    'tests/taskplane-adapter-export.test.mjs',
  ]);
});

test('extractValidationCommand reads Test Command entries', () => {
  assert.equal(extractValidationCommand(issue.description), 'node --test tests/taskplane-adapter-export.test.mjs');
});

test('formatTaskplaneDependencies renders Taskplane folder names', () => {
  assert.deepEqual(formatTaskplaneDependencies([
    { id: 'piarc-0390.epic01.1', title: 'Foundation contract' },
  ]), ['piarc-0390.epic01.1-foundation-contract']);
});

test('buildTaskplanePrompt includes Arc mapping, file scope, validation, and closure note', () => {
  const prompt = buildTaskplanePrompt({
    epic,
    issue,
    exportedDependencies: [{ id: 'piarc-0390.epic01.1', title: 'Foundation contract' }],
    designPath: 'docs/plans/2026-05-02-arc-taskplane-adapter-spike.md',
  });

  assert.match(prompt, /^# Task: piarc-0390\.epic01\.2 — Add exporter script/m);
  assert.match(prompt, /## Arc Mapping/);
  assert.match(prompt, /- Arc Issue: `piarc-0390\.epic01\.2`/);
  assert.match(prompt, /- Parent Epic: `piarc-0390\.epic01`/);
  assert.match(prompt, /- Arc Exported By: `@sentiolabs\/pi-arc`/);
  assert.match(prompt, /## Dependencies\n- piarc-0390\.epic01\.1-foundation-contract/);
  assert.match(prompt, /## Context to Read First\n- `docs\/plans\/2026-05-02-arc-taskplane-adapter-spike.md`/);
  assert.match(prompt, /## File Scope\n- `scripts\/export-arc-taskplane\.mjs`/);
  assert.match(prompt, /Run `node --test tests\/taskplane-adapter-export\.test\.mjs`/);
  assert.match(prompt, /Taskplane `.DONE` does not close Arc/);
});

test('buildTaskplaneContext records tracked packet policy and Arc closure protocol', () => {
  const context = buildTaskplaneContext({
    epic,
    selectedIssues: [issue],
    satisfiedExternalDependencies: [{ id: 'piarc-0390.closed01', title: 'Closed prerequisite' }],
  });

  assert.match(context, /^# Arc Taskplane Export Context/m);
  assert.match(context, /Packet root: `taskplane-tasks\/arc`/);
  assert.match(context, /Generated packets are branch-visible spike artifacts/);
  assert.match(context, /Taskplane `.DONE` does not close Arc/);
  assert.match(context, /piarc-0390\.closed01 — Closed prerequisite/);
});

test('exporter module does not expose direct-run main function', async () => {
  const exporterModule = await import('../scripts/export-arc-taskplane.mjs');

  assert.equal(Object.hasOwn(exporterModule, 'main'), false);
});

test('direct CLI with missing epic ID prints usage and explicitly exits 1', () => {
  const result = spawnSync(process.execPath, ['--trace-exit', scriptPath], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: node scripts\/export-arc-taskplane\.mjs <epic-id>/);
  assert.match(result.stderr, /WARNING: Exited the environment with code 1/);
});

test('CLI export reads closed external dependencies into context', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'arc-export-root-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const closedDependency = { id: 'piarc-0390.external.closed', title: 'Closed external prerequisite', status: 'closed' };
  const selectedChild = {
    id: issue.id,
    title: issue.title,
    status: 'open',
    description: issueDescription(),
    dependencies: [
      { issue_id: issue.id, depends_on_id: closedDependency.id, type: 'blocks' },
    ],
  };
  const { env } = createArcFixture(t, {
    [epic.id]: {
      ...epic,
      status: 'open',
      dependents: [
        { issue_id: selectedChild.id, depends_on_id: epic.id, type: 'parent-child' },
      ],
    },
    [selectedChild.id]: selectedChild,
    [closedDependency.id]: closedDependency,
  });

  const result = spawnSync(process.execPath, [scriptPath, epic.id, '--root', root], { encoding: 'utf8', env });

  assert.equal(result.status, 0, result.stderr);
  const exportRoot = path.join(root, epic.id);
  const stdoutLines = result.stdout.trim().split(/\r?\n/);
  assert.ok(stdoutLines.includes(`/orch-plan ${exportRoot}`), result.stdout);
  assert.ok(stdoutLines.includes(`/orch ${exportRoot}`), result.stdout);
  const context = readFileSync(path.join(root, epic.id, 'CONTEXT.md'), 'utf8');
  assert.ok(context.includes(`Packet root: \`${root}\``));
  assert.match(context, /piarc-0390\.external\.closed — Closed external prerequisite/);
});

test('CLI dry-run prints planned paths without creating files', (t) => {
  const parentDir = mkdtempSync(path.join(tmpdir(), 'arc-export-dry-run-parent-'));
  const root = path.join(parentDir, 'dry-run-root');
  t.after(() => rmSync(parentDir, { recursive: true, force: true }));

  const selectedChild = {
    id: issue.id,
    title: issue.title,
    status: 'open',
    description: issueDescription(),
    dependencies: [],
  };
  const { env } = createArcFixture(t, {
    [epic.id]: {
      ...epic,
      status: 'open',
      dependents: [
        { issue_id: selectedChild.id, depends_on_id: epic.id, type: 'parent-child' },
      ],
    },
    [selectedChild.id]: selectedChild,
  });

  const result = spawnSync(process.execPath, [scriptPath, epic.id, '--root', root, '--dry-run'], { encoding: 'utf8', env });

  assert.equal(result.status, 0, result.stderr);
  const expectedContextPath = path.join(root, epic.id, 'CONTEXT.md');
  const expectedPromptPath = path.join(root, epic.id, 'piarc-0390.epic01.2-add-exporter-script', 'PROMPT.md');
  const stdoutLines = result.stdout.trim().split(/\r?\n/);
  assert.ok(stdoutLines.includes(expectedContextPath), result.stdout);
  assert.ok(stdoutLines.includes(expectedPromptPath), result.stdout);
  assert.equal(result.stdout.includes('/orch-plan'), false);
  assert.equal(result.stdout.includes('/orch '), false);
  assert.equal(existsSync(root), false);
  assert.equal(existsSync(expectedContextPath), false);
  assert.equal(existsSync(expectedPromptPath), false);
});

test('CLI export rejects open external dependencies outside selected child issues', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'arc-export-root-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const openDependency = { id: 'piarc-0390.external.open', title: 'Open external prerequisite', status: 'open' };
  const selectedChild = {
    id: issue.id,
    title: issue.title,
    status: 'open',
    description: issueDescription(),
    dependencies: [
      { issue_id: issue.id, depends_on_id: openDependency.id, type: 'blocks' },
    ],
  };
  const { env } = createArcFixture(t, {
    [epic.id]: {
      ...epic,
      status: 'open',
      dependents: [
        { issue_id: selectedChild.id, depends_on_id: epic.id, type: 'parent-child' },
      ],
    },
    [selectedChild.id]: selectedChild,
    [openDependency.id]: openDependency,
  });

  const result = spawnSync(process.execPath, [scriptPath, epic.id, '--root', root], { encoding: 'utf8', env });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /piarc-0390\.external\.open/);
});

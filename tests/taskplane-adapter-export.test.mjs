import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTaskplaneContext,
  buildTaskplanePrompt,
  extractFileScope,
  extractValidationCommand,
  formatTaskplaneDependencies,
} from '../scripts/export-arc-taskplane.mjs';

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

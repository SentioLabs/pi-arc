import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TASKPLANE_BACKEND_SELECTION_SIGNALS,
  TASKPLANE_PACKET_ROOT,
} from '../scripts/arc-taskplane-contract.mjs';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('README documents optional Taskplane adapter lane', () => {
  const source = read('README.md');

  assert.match(source, /Taskplane/);
  assert.match(source, new RegExp(TASKPLANE_PACKET_ROOT.replace('/', '\\/')));
  assert.match(source, /node scripts\/export-arc-taskplane\.mjs <epic-id> --root taskplane-tasks\/arc/);
  assert.match(source, /branch-visible spike artifacts/);
  assert.match(source, /Taskplane `\.DONE` does not close Arc issues/);
  assert.doesNotMatch(source, /Ant Colony: future\/optional lane/);
});

test('arc-build guidance offers Taskplane through ask_user_question', () => {
  const source = read('skills/arc-build/SKILL.md');

  assert.match(source, /Optional Taskplane backend for large\/resumable batches/);
  assert.match(source, /ask_user_question/);
  assert.match(source, /pi-subagents \(Recommended\)/);
  assert.match(source, /Taskplane/);
  for (const signal of TASKPLANE_BACKEND_SELECTION_SIGNALS) {
    assert.match(source, new RegExp(signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

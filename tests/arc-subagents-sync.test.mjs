import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('arc extension registers arc-subagents-sync command', () => {
  const source = read('extensions/arc.ts');
  assert.match(source, /registerCommand\("arc-subagents-sync"/);
  assert.match(source, /ARC_SUBAGENT_GENERATED_MARKER/);
  assert.match(source, /source-sha256/);
  assert.match(source, /\.pi", "agents"/);
  assert.match(source, /\.pi", "agent", "agents"/);
});

test('arc extension sync map includes all Arc specialists', () => {
  const source = read('extensions/arc.ts');
  for (const name of [
    'arc-builder',
    'arc-doc-writer',
    'arc-spec-reviewer',
    'arc-code-reviewer',
    'arc-evaluator',
    'arc-issue-manager',
  ]) {
    assert.match(source, new RegExp(name));
  }
  assert.match(source, /existing file is missing the generated marker; preserving user edits/);
});

test('arc-build skill references arc-subagents-sync for missing arc agents', () => {
  const source = read('skills/arc-build/SKILL.md');
  assert.match(source, /\/arc-subagents-sync/);
});

test('README documents arc-subagents-sync and avoiding generic worker', () => {
  const source = read('README.md');
  assert.match(source, /\/arc-subagents-sync/);
  assert.match(source, /generic `worker`/i);
});

test('migration script preserves arc-subagents-sync wording', () => {
  const source = read('scripts/migrate-arc-plugin.py');
  assert.match(source, /arc-subagents-sync/);
});

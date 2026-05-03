import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('Arc subagent materializer exposes stable result contract', () => {
  const source = read('extensions/arc/subagents.ts');

  assert.match(source, /export type ArcSubagentMaterializationReason/);
  assert.match(source, /"session_start"/);
  assert.match(source, /"arc_models_save"/);
  assert.match(source, /"manual_repair"/);
  assert.match(source, /export interface ArcSubagentMaterializationResult/);
  assert.match(source, /writes: ArcSubagentWriteResult\[\]/);
  assert.match(source, /shadows: ArcSubagentShadowWarning\[\]/);
});

test('Arc generated subagents record model freshness metadata', () => {
  const source = read('extensions/arc/subagents.ts');

  assert.match(source, /source-sha256/);
  assert.match(source, /model-profile-key/);
  assert.match(source, /model-resolution-source/);
  assert.match(source, /models-config-sha256/);
  assert.match(source, /generated-at/);
});

test('Arc subagent user target prefers modern user agent directory', () => {
  const source = read('extensions/arc/subagents.ts');

  assert.match(source, /"\\.agents"/);
  assert.match(source, /"\\.pi", "agent", "agents"/);
  assert.match(source, /legacyUserDir/);
});

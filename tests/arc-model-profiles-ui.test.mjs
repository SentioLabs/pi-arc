import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('arc model profiles UI exports the editor entrypoint and chain-style labels', () => {
  const source = read('extensions/arc/model-profiles-ui.ts');
  assert.match(source, /openArcModelProfilesEditor/);
  assert.match(source, /Arc Model Profiles/);
  assert.match(source, /Config:/);
  assert.match(source, /Setup:/);
  assert.match(source, /Available:/);
  assert.match(source, /model:/);
  assert.match(source, /thinking:/);
  assert.match(source, /status:/);
  assert.match(source, /\[m\]odel/);
  assert.match(source, /\[t\]hinking/);
  assert.match(source, /\[r\]ecommended/);
});

test('arc model profiles UI uses Pi available models and thinking helpers', () => {
  const source = read('extensions/arc/model-profiles-ui.ts');
  assert.match(source, /ctx\.modelRegistry\.getAvailable\(\)\.map\(toArcModelInfo\)/);
  assert.match(source, /getSupportedArcThinkingLevels/);
  assert.match(source, /findArcModelInfo/);
  assert.match(source, /preferredProvider/);
  assert.match(source, /unavailable/i);
  assert.match(source, /recommended/i);
});

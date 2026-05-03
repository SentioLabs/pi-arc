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
  assert.match(source, /\[d\]isable/);
  assert.match(source, /\[s\]ave/);
});

test('arc model profiles UI uses centered overlay options', () => {
  const source = read('extensions/arc/model-profiles-ui.ts');
  assert.match(source, /ctx\.ui\.custom/);
  assert.match(source, /overlay:\s*true/);
  assert.match(source, /anchor:\s*"center"/);
  assert.match(source, /width:\s*84/);
  assert.match(source, /maxHeight:\s*"80%"/);
});

test('arc model profiles UI dims inactive profile row labels and details', () => {
  const source = read('extensions/arc/model-profiles-ui.ts');
  assert.match(source, /: this\.theme\.fg\("dim", profile\.label\)/);
  assert.match(source, /this\.theme\.fg\("dim", `    model: \$\{pad\(model, valueWidth\)\} thinking: \$\{pad\(thinking, 10\)\} status: \$\{profile\.status\}`\)/);
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

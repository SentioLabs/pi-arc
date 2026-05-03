import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('arc extension wires model profiles into commands and agent dispatch', () => {
  const source = read('extensions/arc.ts');

  for (const token of [
    'registerCommand("arc-models"',
    'openArcModelProfilesEditor',
    'loadArcModelsConfig',
    'saveArcModelsConfig',
    'resolveArcModelProfile',
    'ARC_AGENT_PROFILE_KEYS',
    'builder',
    'codeReviewer',
    'docWriter',
    'evaluator',
    'issueManager',
    'specReviewer',
    'maybeEnsureBrainstormProfileReady',
    'arc-brainstorm',
    'Use recommended defaults',
    'Customize',
    'Skip for now',
    'Reconfigure now',
    'Use fallback once',
    'Disable profile',
    'resolveArcModelForAgent',
    'applyArcThinkingSuffix',
    'profileKey',
    'modelPattern',
    'buildArcSubagentMarkdown',
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

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
  assert.match(source, /export const ARC_SUBAGENT_GENERATED_MARKER/);
  assert.match(source, /export function isGeneratedArcSubagent/);
});

test('Arc subagent user target prefers modern user agent directory', () => {
  const source = read('extensions/arc/subagents.ts');

  assert.match(source, /"\.agents"/);
  assert.match(source, /"\.pi", "agent", "agents"/);
  assert.match(source, /legacyUserDir/);
  assert.equal(source.includes('// "\\.agents" "\\.pi", "agent", "agents"'), false);
});

test('Arc subagent markdown render accepts ArcSubagentRenderInput contract directly', () => {
  const source = read('extensions/arc/subagents.ts');

  assert.match(source, /import type \{ ArcModelProfileKey \} from "\.\/model-profiles\.ts";/);
  assert.match(source, /export interface ArcSubagentRenderInput/);
  assert.match(source, /export interface ArcSubagentParsedSource/);
  assert.match(source, /parsedSource:\s*ArcSubagentParsedSource;/);
  assert.match(source, /prompt:\s*string;/);
  assert.match(source, /buildArcSubagentMarkdown\(input: ArcSubagentRenderInput\): string/);
  assert.match(source, /const frontmatter = \[/);
  assert.match(source, /"---"/);
  assert.match(source, /`name: \$\{input\.targetName\}`/);
  assert.match(source, /systemPromptMode: replace/);
  assert.match(source, /inheritProjectContext: true/);
  assert.match(source, /inheritSkills: false/);
  assert.match(source, /frontmatter\}\\n\$\{metadata\}\\n\\n\$\{body\}/);
});

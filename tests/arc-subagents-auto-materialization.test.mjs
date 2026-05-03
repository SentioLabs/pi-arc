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

test('Arc subagent markdown render preserves frontmatter, metadata, and body order', () => {
  const source = read('extensions/arc/subagents.ts');

  assert.match(source, /import \{ createHash \} from "node:crypto";/);
  assert.match(source, /import type \{ ArcModelProfileKey \} from "\.\/model-profiles\.ts";/);
  assert.match(source, /export interface ArcSubagentRenderInput/);
  assert.match(source, /export interface ArcSubagentParsedSource/);
  assert.match(source, /parsedSource:\s*ArcSubagentParsedSource;/);
  assert.match(source, /prompt:\s*string;/);
  assert.match(source, /export interface ArcSubagentRenderInput\s*\{[^}]*generatedAt:\s*string;[^}]*\}/);
  assert.doesNotMatch(source, /export interface ArcSubagentRenderInput\s*\{[^}]*sourceSha256:\s*string;/);
  assert.match(source, /createHash\("sha256"\)\.update\(text\)\.digest\("hex"\)/);
  assert.match(source, /buildArcSubagentMarkdown\(input: ArcSubagentRenderInput\): string/);
  assert.match(source, /sourceSha256:\s*sha256Text\(input\.sourceMarkdown\),/);
  assert.match(source, /const frontmatter = \[/);
  assert.match(source, /"---"/);
  assert.match(source, /`name: \$\{input\.targetName\}`/);
  assert.match(source, /systemPromptMode: replace/);
  assert.match(source, /inheritProjectContext: true/);
  assert.match(source, /inheritSkills: false/);
  assert.match(source, /frontmatter\}\\n\$\{metadata\}\\n\\n\$\{body\}/);
});

test('Arc subagent markdown render quotes colon-bearing descriptions and keeps expected output sections', () => {
  const source = read('extensions/arc/subagents.ts');
  const problematicDescription = 'Use this agent when creating issues. This includes: epics, tasks, labels.';

  assert.equal(JSON.stringify(problematicDescription), '"Use this agent when creating issues. This includes: epics, tasks, labels."');
  assert.match(source, /function yamlStringValue\(value: string\): string \{\s*return JSON\.stringify\(value\);\s*\}/);
  assert.match(source, /input\.parsedSource\.description \? `description: \$\{yamlStringValue\(input\.parsedSource\.description\)\}` : undefined,/);
  assert.match(source, /`name: \$\{input\.targetName\}`/);
  assert.match(source, /input\.resolvedModel \? `model: \$\{input\.resolvedModel\}` : undefined,/);
  assert.match(source, /input\.parsedSource\.tools\?\.length \? `tools: \$\{input\.parsedSource\.tools\.join\(", "\)\}` : undefined,/);
  assert.match(source, /frontmatter\}\\n\$\{metadata\}\\n\\n\$\{body\}/);
  assert.match(source, /source-sha256/);
  assert.match(source, /model-profile-key/);
  assert.match(source, /model-resolution-source/);
  assert.match(source, /models-config-sha256/);
  assert.match(source, /generated-at/);
});

test('Arc subagent markdown render runtime output matches expected structure', async () => {
  const mod = await import('../extensions/arc/subagents.ts');
  const output = mod.buildArcSubagentMarkdown({
    targetName: 'arc-issue-manager',
    sourceName: 'issue-manager',
    sourceMarkdown: '---\nname: issue-manager\n---\n# Arc Issue Tracker Agent',
    parsedSource: {
      prompt: '# Arc Issue Tracker Agent',
      description: 'Use this agent when creating issues. This includes: epics, tasks, labels.',
      tools: ['bash', 'read', 'grep'],
    },
    resolvedModel: 'openai-codex/gpt-5.4-mini',
    modelProfileKey: 'issueManager',
    modelResolutionSource: 'profile',
    modelsConfigHash: 'abc123',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });

  assert.ok(output.startsWith('---\nname: arc-issue-manager'));
  assert.ok(output.includes('description: "Use this agent when creating issues. This includes: epics, tasks, labels."'));
  assert.ok(output.includes('model: openai-codex/gpt-5.4-mini'));
  assert.ok(output.includes('tools: bash, read, grep'));
  assert.ok(output.includes('systemPromptMode: replace'));
  assert.ok(output.includes('inheritProjectContext: true'));
  assert.ok(output.includes('inheritSkills: false'));

  const frontmatterEnd = output.indexOf('\n---\n');
  const metadataStart = output.indexOf('\n<!-- generated by @sentiolabs/pi-arc arc-subagents -->');
  assert.ok(frontmatterEnd >= 0, 'frontmatter should have closing delimiter');
  assert.ok(metadataStart > frontmatterEnd, 'metadata marker must be after frontmatter');

  assert.ok(output.includes('source-sha256: '));
  assert.ok(output.includes('model-profile-key: issueManager'));
  assert.ok(output.includes('model-resolution-source: profile'));
  assert.ok(output.includes('models-config-sha256: abc123'));
  assert.ok(output.includes('generated-at: 2026-05-03T00:00:00.000Z'));
  assert.ok(output.includes('\n\n# Arc Issue Tracker Agent'));
});

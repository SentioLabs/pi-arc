import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TASKPLANE_ARC_MAPPING_FIELDS,
  TASKPLANE_CONTEXT_FILE,
  TASKPLANE_PACKET_HEADINGS,
  TASKPLANE_PACKET_ROOT,
  TASKPLANE_PROMPT_FILE,
  taskplaneTaskDir,
  taskplaneTaskFolderName,
} from './arc-taskplane-contract.mjs';

const TASKPLANE_PROMPT_CLOSURE_SENTENCE =
  'Taskplane `.DONE` does not close Arc; Arc validation, review, and issue closure happen after the Taskplane batch is integrated.';
const TASKPLANE_CONTEXT_CLOSURE_SENTENCE = 'Taskplane `.DONE` does not close Arc.';

const USAGE =
  'Usage: node scripts/export-arc-taskplane.mjs <epic-id> [--root taskplane-tasks/arc] [--design docs/plans/2026-05-02-arc-taskplane-adapter-spike.md] [--dry-run]';

function extractSection(description = '', heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = description.match(new RegExp(`${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|\\n?$)`));
  return match?.[1] ?? '';
}

function extractMission(description = '') {
  const summaryMatch = description.match(/## Summary\s*\n([\s\S]*?)(?=\n## Files|$)/m)?.[1];
  if (summaryMatch) {
    return summaryMatch.trim();
  }

  const beforeFiles = description.split(/\n## Files/m)[0] ?? '';
  return beforeFiles.replace(/^##\s+Summary\s*$/m, '').trim();
}

export function extractFileScope(description = '') {
  const filesSection = extractSection(description, '## Files');
  return filesSection
    .split(/\r?\n/)
    .map((line) => line.match(/^\-\s+(?:Create|Modify|Test|Read):\s+`([^`]+)`/i)?.[1])
    .filter(Boolean);
}

export function extractValidationCommand(description = '') {
  const testCommand = description.match(/## Test Command\s*\n`([^`]+)`/m)?.[1];
  if (testCommand) return testCommand;

  const verification = extractSection(description, '## Verification').trim();
  if (verification) return 'Manual verification: follow ## Verification checklist';

  return undefined;
}

export function formatTaskplaneDependencies(issues = []) {
  return issues.map((dep) => taskplaneTaskFolderName(dep.id, dep.title));
}

export function buildTaskplanePrompt({ epic, issue, exportedDependencies = [], designPath }) {
  const dependencyLines = formatTaskplaneDependencies(exportedDependencies);
  const fileScope = extractFileScope(issue.description);
  const validationCommand = extractValidationCommand(issue.description);
  const mission = extractMission(issue.description);

  const arcMappingValues = {
    [TASKPLANE_ARC_MAPPING_FIELDS[0]]: issue.id,
    [TASKPLANE_ARC_MAPPING_FIELDS[1]]: epic.id,
    [TASKPLANE_ARC_MAPPING_FIELDS[2]]: issue.title,
    [TASKPLANE_ARC_MAPPING_FIELDS[3]]: issue.status,
    [TASKPLANE_ARC_MAPPING_FIELDS[4]]: '@sentiolabs/pi-arc',
  };

  const lines = [];
  lines.push(`# Task: ${issue.id} — ${issue.title}`);
  lines.push('');
  lines.push(TASKPLANE_PACKET_HEADINGS[1]);
  lines.push('branch-visible spike export');
  lines.push('');
  lines.push(TASKPLANE_PACKET_HEADINGS[2]);
  for (const field of TASKPLANE_ARC_MAPPING_FIELDS) {
    lines.push(`- ${field}: \`${arcMappingValues[field]}\``);
  }
  lines.push('');
  lines.push(TASKPLANE_PACKET_HEADINGS[3]);
  lines.push(mission || issue.title);
  lines.push('');
  lines.push(TASKPLANE_PACKET_HEADINGS[4]);
  if (dependencyLines.length === 0) {
    lines.push('- none');
  } else {
    lines.push(...dependencyLines.map((dependency) => `- ${dependency}`));
  }
  lines.push('');
  lines.push(TASKPLANE_PACKET_HEADINGS[5]);
  if (designPath) {
    lines.push(`- \`${designPath}\``);
  } else {
    lines.push('- none');
  }
  lines.push('');
  lines.push(TASKPLANE_PACKET_HEADINGS[6]);
  lines.push(...fileScope.map((file) => `- \`${file}\``));
  lines.push('');
  lines.push(TASKPLANE_PACKET_HEADINGS[7]);
  if (validationCommand) {
    lines.push(`- Run \`${validationCommand}\``);
  }
  lines.push(`- ${TASKPLANE_PROMPT_CLOSURE_SENTENCE}`);
  lines.push('');
  lines.push(TASKPLANE_PACKET_HEADINGS[8]);
  lines.push(`- Confirm all items in file scope are complete and validated.`);
  lines.push(`- ${TASKPLANE_PROMPT_CLOSURE_SENTENCE}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(TASKPLANE_PACKET_HEADINGS[9]);
  lines.push('- _None yet._');

  return `${lines.join('\n')}\n`;
}

export function buildTaskplaneContext({
  epic,
  selectedIssues = [],
  satisfiedExternalDependencies = [],
  root = TASKPLANE_PACKET_ROOT,
}) {
  const lines = [];
  lines.push('# Arc Taskplane Export Context');
  lines.push('');
  lines.push(`Packet root: \`${root}\``);
  lines.push('Generated packets are branch-visible spike artifacts.');
  lines.push(TASKPLANE_CONTEXT_CLOSURE_SENTENCE);
  lines.push('');
  lines.push(`Epic: ${epic.id} — ${epic.title}`);
  lines.push('');
  lines.push('## Selected Arc Issues');
  lines.push(...selectedIssues.map((issue) => `- ${issue.id} — ${issue.title}`));
  lines.push('');
  lines.push('## Satisfied External Dependencies');
  if (satisfiedExternalDependencies.length === 0) {
    lines.push('- none');
  } else {
    lines.push(...satisfiedExternalDependencies.map((dep) => `- ${dep.id} — ${dep.title}`));
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv = process.argv.slice(2)) {
  const [epicId, ...rest] = argv;
  if (!epicId || epicId.startsWith('--')) {
    throw new Error(USAGE);
  }

  const options = {
    epicId,
    root: TASKPLANE_PACKET_ROOT,
    designPath: undefined,
    dryRun: false,
  };

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--root') {
      const value = rest[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for --root\n${USAGE}`);
      }
      options.root = value;
      i += 1;
      continue;
    }

    if (arg === '--design') {
      const value = rest[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for --design\n${USAGE}`);
      }
      options.designPath = value;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}\n${USAGE}`);
  }

  return options;
}

export function readArcIssue(id) {
  const stdout = execFileSync('arc', ['show', id, '--json'], { encoding: 'utf8' });
  return JSON.parse(stdout);
}

function resolveChildIssueId(link, epicId) {
  if (link.issue_id && link.issue_id !== epicId) {
    return link.issue_id;
  }

  if (link.depends_on_id && link.depends_on_id !== epicId) {
    return link.depends_on_id;
  }

  return undefined;
}

function selectOpenChildren(epic, childIssues) {
  const childIds = (epic.dependents ?? [])
    .filter((link) => link.type === 'parent-child')
    .map((link) => resolveChildIssueId(link, epic.id))
    .filter(Boolean);

  return childIds
    .map((childId) => childIssues.get(childId))
    .filter(Boolean)
    .filter((issue) => issue.status === 'open' || issue.status === 'in_progress');
}

function collectSatisfiedExternalDependencies(epic, selectedIssues, issueLookup) {
  const selectedIds = new Set(selectedIssues.map((issue) => issue.id));
  const dependencies = [];
  const seen = new Set();

  for (const issue of selectedIssues) {
    for (const dependency of issue.dependencies ?? []) {
      const dependencyId = resolveChildIssueId(dependency, issue.id) ?? dependency.depends_on_id;
      if (!dependencyId || dependencyId === epic.id || selectedIds.has(dependencyId) || seen.has(dependencyId)) {
        continue;
      }

      let dependencyIssue = issueLookup.get(dependencyId);
      if (!dependencyIssue) {
        dependencyIssue = readArcIssue(dependencyId);
        issueLookup.set(dependencyId, dependencyIssue);
      }

      if (dependencyIssue.status === 'open' || dependencyIssue.status === 'in_progress') {
        throw new Error(
          `External dependency ${dependencyIssue.id} is ${dependencyIssue.status}; selected Taskplane export batch is not ready.`,
        );
      }

      dependencies.push({ id: dependencyIssue.id, title: dependencyIssue.title });
      seen.add(dependencyIssue.id);
    }
  }

  return dependencies;
}

function validateSelectedIssues(selectedIssues) {
  if (selectedIssues.length === 0) {
    throw new Error('No open or in_progress child issues found for export.');
  }

  for (const issue of selectedIssues) {
    const files = extractFileScope(issue.description);
    if (files.length === 0) {
      throw new Error(`Issue ${issue.id} is missing a ## Files scope.`);
    }

    const validation = extractValidationCommand(issue.description);
    if (!validation) {
      throw new Error(`Issue ${issue.id} is missing ## Test Command or ## Verification.`);
    }
  }
}

function plannedWrites({ root, epic, selectedIssues, context, designPath, exportedDependenciesByIssue }) {
  const writes = [
    {
      path: path.join(root, epic.id, TASKPLANE_CONTEXT_FILE),
      content: context,
    },
  ];

  for (const issue of selectedIssues) {
    writes.push({
      path: path.join(
        taskplaneTaskDir({ root, epicId: epic.id, issueId: issue.id, title: issue.title }),
        TASKPLANE_PROMPT_FILE,
      ),
      content: buildTaskplanePrompt({
        epic,
        issue,
        exportedDependencies: exportedDependenciesByIssue.get(issue.id) ?? [],
        designPath,
      }),
    });
  }

  return writes;
}

async function performExport(options) {
  const epic = readArcIssue(options.epicId);

  const childLinks = (epic.dependents ?? []).filter((link) => link.type === 'parent-child');
  const childIds = childLinks
    .map((link) => resolveChildIssueId(link, epic.id))
    .filter(Boolean);

  const childIssues = new Map();
  for (const childId of childIds) {
    childIssues.set(childId, readArcIssue(childId));
  }

  const selectedIssues = selectOpenChildren(epic, childIssues);
  validateSelectedIssues(selectedIssues);

  const issueLookup = new Map(childIssues);
  issueLookup.set(epic.id, epic);

  const satisfiedExternalDependencies = collectSatisfiedExternalDependencies(epic, selectedIssues, issueLookup);
  const context = buildTaskplaneContext({
    epic,
    selectedIssues,
    satisfiedExternalDependencies,
    root: options.root,
  });

  const exportedDependenciesByIssue = new Map();
  for (const issue of selectedIssues) {
    const exportedDependencies = [];
    for (const dependency of issue.dependencies ?? []) {
      const dependencyId = resolveChildIssueId(dependency, issue.id) ?? dependency.depends_on_id;
      if (!dependencyId || dependencyId === epic.id) {
        continue;
      }

      const candidate = childIssues.get(dependencyId);
      if (candidate && (candidate.status === 'open' || candidate.status === 'in_progress')) {
        exportedDependencies.push({ id: candidate.id, title: candidate.title });
      }
    }
    exportedDependenciesByIssue.set(issue.id, exportedDependencies);
  }

  const writes = plannedWrites({
    root: options.root,
    epic,
    selectedIssues,
    context,
    designPath: options.designPath,
    exportedDependenciesByIssue,
  });

  if (options.dryRun) {
    for (const writePlan of writes) {
      console.log(writePlan.path);
    }
  } else {
    for (const writePlan of writes) {
      await fs.mkdir(path.dirname(writePlan.path), { recursive: true });
      await fs.writeFile(writePlan.path, writePlan.content, 'utf8');
    }
  }

  console.log(`/orch-plan ${path.join(options.root, epic.id)}`);
  console.log(`/orch ${path.join(options.root, epic.id)}`);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  await performExport(options);
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    if (!String(error.message).includes('Usage:')) {
      console.error(USAGE);
    }
    process.exit(1);
  });
}

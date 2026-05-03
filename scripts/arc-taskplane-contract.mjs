export const TASKPLANE_PACKET_ROOT = 'taskplane-tasks/arc';
export const TASKPLANE_CONTEXT_FILE = 'CONTEXT.md';
export const TASKPLANE_PROMPT_FILE = 'PROMPT.md';

export const TASKPLANE_PACKET_HEADINGS = [
  '# Task:',
  '## Review Level',
  '## Arc Mapping',
  '## Mission',
  '## Dependencies',
  '## Context to Read First',
  '## File Scope',
  '## Steps',
  '## Completion Criteria',
  '## Amendments (Added During Execution)',
];

export const TASKPLANE_ARC_MAPPING_FIELDS = [
  'Arc Issue',
  'Parent Epic',
  'Arc Title',
  'Arc Status At Export',
  'Arc Exported By',
];

export const TASKPLANE_CLOSURE_PROTOCOL_TERMS = [
  'Taskplane `.DONE` does not close Arc',
  'Arc runs fresh validation for the batch',
  'close the Arc issue only after Arc gates pass',
];

export const TASKPLANE_AVAILABILITY_CHECKS = [
  'command -v taskplane',
  'pi -e /home/bfirestone/devspace/personal/github/pi-taskplane',
  'pi install npm:taskplane',
];

export const TASKPLANE_BACKEND_SELECTION_SIGNALS = [
  'large or longer-running Arc batch',
  'dashboard visibility',
  'resume support',
  'supervisor control',
  'orch-branch merge',
  'ask_user_question opt-in',
];

export function slugifyTaskplaneSegment(value) {
  const slug = String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/["']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');

  return slug || 'task';
}

export function taskplaneTaskFolderName(issueId, title) {
  return `${issueId}-${slugifyTaskplaneSegment(title)}`;
}

export function taskplaneTaskDir({ root = TASKPLANE_PACKET_ROOT, epicId, issueId, title }) {
  return `${root}/${epicId}/${taskplaneTaskFolderName(issueId, title)}`;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TASKPLANE_ARC_MAPPING_FIELDS,
  TASKPLANE_AVAILABILITY_CHECKS,
  TASKPLANE_BACKEND_SELECTION_SIGNALS,
  TASKPLANE_CLOSURE_PROTOCOL_TERMS,
  TASKPLANE_CONTEXT_FILE,
  TASKPLANE_PACKET_HEADINGS,
  TASKPLANE_PACKET_ROOT,
  TASKPLANE_PROMPT_FILE,
  slugifyTaskplaneSegment,
  taskplaneTaskDir,
  taskplaneTaskFolderName,
} from '../scripts/arc-taskplane-contract.mjs';

test('Taskplane packet root and filenames are stable', () => {
  assert.equal(TASKPLANE_PACKET_ROOT, 'taskplane-tasks/arc');
  assert.equal(TASKPLANE_CONTEXT_FILE, 'CONTEXT.md');
  assert.equal(TASKPLANE_PROMPT_FILE, 'PROMPT.md');
});

test('Taskplane prompt headings are stable', () => {
  assert.deepEqual(TASKPLANE_PACKET_HEADINGS, [
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
  ]);
});

test('Arc mapping and closure terms are stable', () => {
  assert.deepEqual(TASKPLANE_ARC_MAPPING_FIELDS, [
    'Arc Issue',
    'Parent Epic',
    'Arc Title',
    'Arc Status At Export',
    'Arc Exported By',
  ]);
  assert.deepEqual(TASKPLANE_CLOSURE_PROTOCOL_TERMS, [
    'Taskplane `.DONE` does not close Arc',
    'Arc runs fresh validation for the batch',
    'close the Arc issue only after Arc gates pass',
  ]);
});

test('availability and backend-selection guidance is explicit', () => {
  assert.deepEqual(TASKPLANE_AVAILABILITY_CHECKS, [
    'command -v taskplane',
    'pi -e /home/bfirestone/devspace/personal/github/pi-taskplane',
    'pi install npm:taskplane',
  ]);
  assert.deepEqual(TASKPLANE_BACKEND_SELECTION_SIGNALS, [
    'large or longer-running Arc batch',
    'dashboard visibility',
    'resume support',
    'supervisor control',
    'orch-branch merge',
    'ask_user_question opt-in',
  ]);
});

test('Taskplane folder names keep Arc issue IDs and slug titles', () => {
  assert.equal(slugifyTaskplaneSegment('Add optional Arc-to-Taskplane exporter spike!'), 'add-optional-arc-to-taskplane-exporter-spike');
  assert.equal(taskplaneTaskFolderName('piarc-0390.abc123', 'Add exporter!'), 'piarc-0390.abc123-add-exporter');
  assert.equal(
    taskplaneTaskDir({ epicId: 'piarc-0390.epic01', issueId: 'piarc-0390.epic01.1', title: 'T0 Contract' }),
    'taskplane-tasks/arc/piarc-0390.epic01/piarc-0390.epic01.1-t0-contract',
  );
});

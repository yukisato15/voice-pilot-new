import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDirectorNotesCsv,
  formatEventsJsonl,
  formatFcpxml,
  formatMarkersCsv,
  formatTimecode,
} from '../exportFormats';

const sampleEvents = [
  {
    id: 'evt-1',
    category: 'PII',
    label: '個人情報',
    note: '苗字を言及',
    shortcut: 'F1',
    themeId: 'T-0001',
    relativeSeconds: 12.3,
    createdAt: '2025-01-01T10:00:00Z',
  },
  {
    id: 'evt-2',
    category: 'CUT_IN',
    label: 'カットIN',
    note: undefined,
    shortcut: '[',
    themeId: 'T-0001',
    relativeSeconds: 48.0,
    createdAt: '2025-01-01T10:02:00Z',
  },
];

const sampleNotes = [
  {
    id: 'note-1',
    body: 'Bの声が小さい',
    createdAt: '2025-01-01T10:05:00Z',
    updatedAt: '2025-01-01T10:05:00Z',
    themeId: 'T-0001',
    relatedEventId: 'evt-1',
    speaker: 'B',
    relativeSeconds: 85.2,
  },
];

test('formatTimecode converts seconds to SMPTE-like string', () => {
  assert.equal(formatTimecode(12.3, 30), '00:00:12:09');
  assert.equal(formatTimecode(undefined, 25), '00:00:00:00');
  assert.equal(formatTimecode(1.5, 25), '00:00:01:13');
});

test('formatMarkersCsv generates CSV with header and rows', () => {
  const csv = formatMarkersCsv(sampleEvents, { fps: 29.97 });
  const lines = csv.split('\n');
  assert.equal(lines[0], 'label,category,start_tc,end_tc,duration,note');
  assert(lines[1].includes('個人情報'));
  assert(lines[1].includes('00:00:12:09'));
});

test('formatDirectorNotesCsv escapes commas', () => {
  const csv = formatDirectorNotesCsv(sampleNotes, { fps: 30 });
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert(lines[1].includes('Bの声が小さい'));
  assert(lines[0].includes('speaker'));
});

test('formatEventsJsonl outputs JSON lines', () => {
  const jsonl = formatEventsJsonl(sampleEvents);
  const rows = jsonl.split('\n');
  assert.equal(rows.length, 2);
  const first = JSON.parse(rows[0]);
  assert.equal(first.type, 'PII');
  assert.equal(first.t_rel, 12.3);
});

test('formatFcpxml embeds markers with notes', () => {
  const xml = formatFcpxml(sampleEvents, { themeTitle: 'テーマ', fps: 29.97 });
  assert(xml.includes('<fcpxml'));
  assert(xml.includes('個人情報'));
  assert(xml.includes('note="苗字を言及"'));
});

test('formatDirectorNotesCsv escapes newlines and double quotes', () => {
  const csv = formatDirectorNotesCsv(
    [
      {
        ...sampleNotes[0],
        body: '途中で\n"Zoom"を確認',
      },
    ],
    { fps: 29.97 },
  );
  assert(csv.includes(',85.20,00:01:25:06,"途中で\n""Zoom""を確認"'));
  assert(csv.startsWith('id,created_at,updated_at,theme_id,event_id,speaker,relative_seconds,timecode,note'));
});

test('formatMarkersCsv falls back to header only when empty', () => {
  const csv = formatMarkersCsv([]);
  assert.equal(csv, 'label,category,start_tc,end_tc,duration,note');
});

test('formatFcpxml renders NTSC frame duration when fps≈29.97', () => {
  const xml = formatFcpxml(sampleEvents, { fps: 29.97 });
  assert(xml.includes('frameDuration="1001/30000s"'));
  assert(xml.includes('value="個人情報"'));
});

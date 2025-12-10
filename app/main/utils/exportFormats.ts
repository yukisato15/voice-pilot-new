type EventRecord = {
  id: string;
  category: string;
  label: string;
  note?: string;
  shortcut?: string;
  themeId?: string;
  relativeSeconds?: number;
  createdAt: string;
};

type NoteRecord = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  themeId?: string;
  relatedEventId?: string;
  speaker?: string;
  relativeSeconds?: number;
};

export const formatMarkersCsv = (events: EventRecord[], options?: { fps?: number }): string => {
  const fps = options?.fps ?? 30;
  const header = ['label', 'category', 'start_tc', 'end_tc', 'duration', 'note'];
  const rows = events.map((event) => {
    const tc = formatTimecode(event.relativeSeconds, fps);
    return [event.label, event.category, tc, tc, '0', event.note ?? ''];
  });
  return toCsv([header, ...rows]);
};

export const formatDirectorNotesCsv = (notes: NoteRecord[], options?: { fps?: number }): string => {
  const fps = options?.fps ?? 30;
  const header = ['id', 'created_at', 'updated_at', 'theme_id', 'event_id', 'speaker', 'relative_seconds', 'timecode', 'note'];
  const rows = notes.map((note) => [
    note.id,
    note.createdAt,
    note.updatedAt,
    note.themeId ?? '',
    note.relatedEventId ?? '',
    note.speaker ?? '',
    note.relativeSeconds?.toFixed(2) ?? '',
    note.relativeSeconds !== undefined ? formatTimecode(note.relativeSeconds, fps) : '',
    note.body,
  ]);
  return toCsv([header, ...rows]);
};

export const formatEventsJsonl = (events: EventRecord[]): string => {
  return events
    .map((event) =>
      JSON.stringify({
        id: event.id,
        t_rel: event.relativeSeconds ?? null,
        type: event.category,
        label: event.label,
        note: event.note ?? null,
        shortcut: event.shortcut ?? null,
        theme_id: event.themeId ?? null,
        created_at: event.createdAt,
      }),
    )
    .join('\n');
};

export const formatFcpxml = (events: EventRecord[], options?: { themeTitle?: string; fps?: number }): string => {
  const fps = options?.fps ?? 30;
  const markers = events
    .map((event) => {
      const startSeconds = Number.parseFloat((event.relativeSeconds ?? 0).toFixed(3));
      const start = `${startSeconds}s`;
      return `<marker start="${start}" duration="0s" value="${escapeXml(event.label)}" note="${escapeXml(event.note ?? '')}"/>`;
    })
    .join('\n            ');

  const frameDuration = fpsToFrameDuration(fps);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.8">
  <resources>
    <format id="r1" name="FFVideoFormat1080p${fps}" frameDuration="${frameDuration}" width="1920" height="1080" colorSpace="1-1-1"/>
  </resources>
  <library>
    <event name="${escapeXml(options?.themeTitle ?? 'Session Markers')}">
      <project name="Session" format="r1">
        <sequence duration="3600s" format="r1">
          <spine>
            <gap name="Gap" offset="0s" duration="3600s" start="0s">
              ${markers}
            </gap>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;
};

export const formatTimecode = (seconds: number | undefined, fps = 30): string => {
  const total = Number.isFinite(seconds) ? Math.max(0, seconds ?? 0) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  const frames = Math.round((total % 1) * fps);
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}:${pad(frames)}`;
};

const toCsv = (rows: string[][]): string => {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(','),
    )
    .join('\n');
};

const pad = (value: number): string => String(value).padStart(2, '0');

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const fpsToFrameDuration = (fps: number): string => {
  if (Math.abs(fps - 29.97) < 0.01) {
    return '1001/30000s';
  }
  if (Math.abs(fps - 59.94) < 0.01) {
    return '1001/60000s';
  }
  if (Number.isInteger(fps)) {
    return `1/${Math.round(fps)}s`;
  }
  const denom = 100000;
  const numer = Math.round(denom / fps);
  return `${numer}/${denom}s`;
};

export type { EventRecord, NoteRecord };

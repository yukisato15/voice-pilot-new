import { dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

import { getConfig, type AppConfig } from '../config/store';

import {
  formatDirectorNotesCsv,
  formatEventsJsonl,
  formatFcpxml,
  formatMarkersCsv,
} from '../utils/exportFormats';

type RendererEventLog = {
  id: string;
  category: string;
  label: string;
  note?: string;
  shortcut?: string;
  themeId?: string;
  relativeSeconds?: number;
  createdAt: string;
};

type RendererDirectorNote = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  themeId?: string;
  relatedEventId?: string;
  speaker?: string;
  relativeSeconds?: number;
};

type ExportPayload = {
  events: RendererEventLog[];
  notes: RendererDirectorNote[];
  theme?: {
    id?: string;
    title?: string;
  } | null;
};

type OutputResolution = {
  path: string | null;
  usedProjectDir: boolean;
  warning?: 'projectDirMissing' | 'projectDirInaccessible';
};

const resolveOutputDir = async (config: AppConfig): Promise<OutputResolution> => {
  const projectDir = config.projectDir?.trim() ?? '';
  if (projectDir) {
    try {
      const stats = await fs.stat(projectDir);
      if (!stats.isDirectory()) {
        throw new Error('projectDir is not a directory');
      }
      const exportsDir = path.join(projectDir, 'exports');
      const folderName = formatTimestamp(new Date());
      const outputDir = path.join(exportsDir, folderName);
      return { path: outputDir, usedProjectDir: true };
    } catch {
      const manual = await promptManualSelection(projectDir);
      return { path: manual, usedProjectDir: false, warning: 'projectDirInaccessible' };
    }
  }

  const manual = await promptManualSelection();
  return { path: manual, usedProjectDir: false, warning: 'projectDirMissing' };
};

const promptManualSelection = async (defaultPath?: string): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    title: 'ログの出力先フォルダを選択',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath,
    message: 'エクスポート先を指定してください（プロジェクト未設定のため手動選択）。',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
};

const formatTimestamp = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  const seconds = String(value.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

export const registerEventsHandlers = (): void => {
  ipcMain.removeHandler('events/export');
  ipcMain.handle('events/export', async (_event, payload: ExportPayload) => {
    const config = getConfig();
    const { path: outputDir, usedProjectDir, warning } = await resolveOutputDir(config);
    if (!outputDir) {
      return { success: false, message: '出力がキャンセルされました。' };
    }

    try {
      const fps = config.timecodeFps ?? 30;
      const markersCsv = formatMarkersCsv(payload.events ?? [], { fps });
      const directorNotesCsv = formatDirectorNotesCsv(payload.notes ?? [], { fps });
      const eventsJsonl = formatEventsJsonl(payload.events ?? []);
      const fcpxml = formatFcpxml(payload.events ?? [], { themeTitle: payload.theme?.title ?? undefined, fps });

      await fs.mkdir(outputDir, { recursive: true });
      await Promise.all([
        fs.writeFile(path.join(outputDir, 'markers.csv'), markersCsv, 'utf-8'),
        fs.writeFile(path.join(outputDir, 'director_notes.csv'), directorNotesCsv, 'utf-8'),
        fs.writeFile(path.join(outputDir, 'events.jsonl'), eventsJsonl, 'utf-8'),
        fs.writeFile(path.join(outputDir, 'edit.fcpxml'), fcpxml, 'utf-8'),
      ]);

      return { success: true, outputDir, usedProjectDir, warning };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[events/export] failed', error);
      return { success: false, message };
    }
  });
};

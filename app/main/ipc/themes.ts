import { app, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';

type ThemeSummary = {
  id: string;
  title: string;
  category?: string;
  roleAPrompt?: string;
  roleBPrompt?: string;
  hints: string[];
  description?: string;
};

type ThemeLoadResult = {
  themes: ThemeSummary[];
  sourcePath: string;
  format: 'csv' | 'json';
  loadedAt: string;
};

type ThemeLoadArgs = {
  preset?: 'sample';
  path?: string;
};

const SAMPLE_RELATIVE_PATH = ['..', 'samples', 'themes_sample.csv'];

const resolveSamplePath = (): string => {
  const appPath = app.getAppPath();
  return path.resolve(appPath, ...SAMPLE_RELATIVE_PATH);
};

const toThemeSummary = (row: Record<string, string | undefined>): ThemeSummary | null => {
  const id = (row.theme_id ?? row.id ?? '').trim();
  const title = (row.title ?? '').trim();
  if (!id || !title) {
    return null;
  }

  const roleAPrompt = (row.role_A_prompt ?? row.role_a_prompt ?? row.role_a ?? '').trim();
  const roleBPrompt = (row.role_B_prompt ?? row.role_b_prompt ?? row.role_b ?? '').trim();
  const description = (row.description ?? '').trim();

  const hints: string[] = Object.entries(row)
    .filter(([key]) => /^hint_/i.test(key))
    .map(([, value]) => (value ?? '').toString().trim())
    .filter((hint) => hint.length > 0);

  return {
    id,
    title,
    category: (row.category ?? '').trim() || undefined,
    roleAPrompt: roleAPrompt || undefined,
    roleBPrompt: roleBPrompt || undefined,
    hints,
    description: description || undefined,
  };
};

type CsvRow = Record<string, string | undefined>;

type PapaParseError = {
  message: string;
};

type PapaParseResult<T> = {
  data: T[];
  errors: PapaParseError[];
};

const parseCsvThemes = (content: string): ThemeSummary[] => {
  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: 'greedy',
  }) as PapaParseResult<CsvRow>;

  if (parsed.errors.length > 0) {
    const message = parsed.errors.map((error: PapaParseError) => error.message).join('; ');
    throw new Error(`テーマCSVの解析に失敗しました: ${message}`);
  }

  return parsed.data
    .map((row: CsvRow) => toThemeSummary(row))
    .filter((row): row is ThemeSummary => row !== null);
};

const parseJsonThemes = (content: string): ThemeSummary[] => {
  const data = JSON.parse(content) as unknown;
  let entries: unknown[] = [];

  if (Array.isArray(data)) {
    entries = data;
  } else if (data && typeof data === 'object' && Array.isArray((data as { themes?: unknown[] }).themes)) {
    entries = (data as { themes: unknown[] }).themes;
  }

  const themes = entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      return toThemeSummary(
        Object.fromEntries(
          Object.entries(record).map(([key, value]) => [key, typeof value === 'string' ? value : String(value ?? '')]),
        ),
      );
    })
    .filter((row): row is ThemeSummary => row !== null);

  return themes;
};

const loadThemesFromFile = async (filePath: string): Promise<ThemeLoadResult> => {
  const content = await fs.readFile(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  let themes: ThemeSummary[] = [];
  if (ext === '.csv' || ext === '.tsv' || ext === '.txt') {
    themes = parseCsvThemes(content);
  } else {
    themes = parseJsonThemes(content);
  }

  if (!themes.length) {
    throw new Error('テーマファイルに有効なテーマがありませんでした。');
  }

  const format: 'csv' | 'json' = ext === '.csv' || ext === '.tsv' || ext === '.txt' ? 'csv' : 'json';

  return {
    themes,
    sourcePath: filePath,
    format,
    loadedAt: new Date().toISOString(),
  };
};

export const registerThemesHandlers = (): void => {
  ipcMain.removeHandler('themes/load');
  ipcMain.handle('themes/load', async (_event, args?: ThemeLoadArgs): Promise<ThemeLoadResult | null> => {
    try {
      let targetPath = args?.path ?? null;

      if (args?.preset === 'sample') {
        targetPath = resolveSamplePath();
      }

      if (!targetPath) {
        const { canceled, filePaths } = await dialog.showOpenDialog({
          title: 'テーマファイルを選択',
          properties: ['openFile'],
          filters: [
            { name: 'Theme Files', extensions: ['csv', 'json'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (canceled || filePaths.length === 0) {
          return null;
        }

        targetPath = filePaths[0];
      }

      return await loadThemesFromFile(targetPath);
    } catch (error) {
      console.error('[ipc/themes] failed to load themes', error);
      throw error;
    }
  });
};

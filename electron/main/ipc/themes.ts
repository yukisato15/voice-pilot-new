import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import * as fs from 'node:fs';
import { stat } from 'node:fs/promises';
import * as path from 'node:path';
import Store from 'electron-store';

import { PythonWorkerClient } from '../python/client';

export interface ThemeRecord {
  theme_id: string;
  category: string;
  title: string;
  role_A_prompt: string;
  role_B_prompt: string;
  hints: string[];
}

export interface ThemeDuplicateGroup {
  hash: string;
  themeIds: string[];
}

export interface ThemeRequestPayload {
  count?: number;
  forceReload?: boolean;
}

export interface ThemeResponsePayload {
  items: ThemeRecord[];
  totalCount: number;
  csvPath: string;
  mtimeMs: number;
  cached: boolean;
  duplicates: ThemeDuplicateGroup[];
  duplicateCount: number;
  lastUpdatedAt: number;
}

interface WorkerDuplicateSummary {
  hash: string;
  theme_ids: string[];
}

interface HashIndexResult {
  count: number;
  duplicates: WorkerDuplicateSummary[];
}

interface LoadRecordsResult {
  items: ThemeRecord[];
}

interface ThemeCacheEntry {
  csvPath: string;
  mtimeMs: number;
  records: ThemeRecord[];
  duplicates: ThemeDuplicateGroup[];
  totalCount: number;
  cachedAt: number;
}

type LegacyThemeCacheEntry = Omit<ThemeCacheEntry, 'duplicates'> & {
  duplicates: Record<string, string[]>;
};

type StoredThemeCacheEntry = ThemeCacheEntry | LegacyThemeCacheEntry;

type ThemeCacheStoreSchema = Record<string, StoredThemeCacheEntry>;

class ThemeCache {
  private readonly memory = new Map<string, ThemeCacheEntry>();

  private readonly store: Store<ThemeCacheStoreSchema>;

  constructor(store?: Store<ThemeCacheStoreSchema>) {
    this.store = store ?? new Store<ThemeCacheStoreSchema>({
      name: 'theme-cache',
    });

    for (const [key, entry] of Object.entries(this.store.store)) {
      const normalized = this.normalizeEntry(entry);
      this.memory.set(key, normalized);
      if (normalized !== entry) {
        this.store.set(key, normalized);
      }
    }
  }

  async getOrLoad(
    csvPath: string,
    loader: () => Promise<Omit<ThemeCacheEntry, 'csvPath' | 'mtimeMs' | 'cachedAt'>>,
  ): Promise<{ entry: ThemeCacheEntry; fromCache: boolean }> {
    const key = this.normalize(csvPath);
    const mtimeMs = await this.getMTime(csvPath);

    const cached = this.memory.get(key);
    if (cached && cached.mtimeMs === mtimeMs) {
      return { entry: cached, fromCache: true };
    }

    const loaded = await loader();
    const entry: ThemeCacheEntry = {
      csvPath: key,
      mtimeMs,
      records: loaded.records,
      duplicates: loaded.duplicates,
      totalCount: loaded.totalCount,
      cachedAt: Date.now(),
    };

    this.memory.set(key, entry);
    this.store.set(key, entry);

    return { entry, fromCache: false };
  }

  markDirty(csvPath: string): void {
    const key = this.normalize(csvPath);
    this.memory.delete(key);
    this.store.delete(key);
  }

  private normalize(csvPath: string): string {
    return path.resolve(csvPath);
  }

  private async getMTime(csvPath: string): Promise<number> {
    const resolved = path.resolve(csvPath);
    try {
      const stats = await stat(resolved);
      return stats.mtimeMs;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code === 'ENOENT') {
        throw new Error(`Theme CSV not found at ${resolved}`);
      }
      throw error;
    }
  }

  private normalizeEntry(entry: StoredThemeCacheEntry): ThemeCacheEntry {
    if (Array.isArray(entry.duplicates)) {
      return {
        ...entry,
        duplicates: entry.duplicates.map((duplicate) => ({
          hash: duplicate.hash,
          themeIds: [...duplicate.themeIds],
        })),
      };
    }

    const duplicates = Object.entries(entry.duplicates).map(([hash, themeIds]) => ({
      hash,
      themeIds: [...themeIds],
    }));

    return { ...entry, duplicates };
  }
}

class CsvWatcher {
  private watcher?: fs.FSWatcher;

  constructor(private readonly csvPath: string, private readonly onChange: () => void) {
    this.initialize();
  }

  private initialize(): void {
    if (!fs.existsSync(this.csvPath)) {
      return;
    }

    this.watcher = fs.watch(this.csvPath, { persistent: false }, (eventType) => {
      if (eventType === 'change' || eventType === 'rename') {
        this.onChange();
      }
    });
  }

  dispose(): void {
    this.watcher?.close();
  }
}

function broadcastThemeUpdate(payload: { csvPath: string; reason: 'file-changed' | 'manual' }): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('themes/updated', payload);
  }
}

export interface RegisterThemeIpcHandlersOptions {
  workerClient: PythonWorkerClient;
  csvPath: string;
  cacheStore?: Store<ThemeCacheStoreSchema>;
}

export function registerThemeIpcHandlers(options: RegisterThemeIpcHandlersOptions): () => void {
  const cache = new ThemeCache(options.cacheStore);

  const loadFromWorker = async (): Promise<Omit<ThemeCacheEntry, 'csvPath' | 'mtimeMs' | 'cachedAt'>> => {
    const [hashIndex, loadResult] = await Promise.all([
      options.workerClient.invoke<HashIndexResult>('themes/hash-index', { csv_path: options.csvPath }),
      options.workerClient.invoke<LoadRecordsResult>('themes/load-records', { csv_path: options.csvPath }),
    ]);

    const duplicates = hashIndex.duplicates.map((duplicate) => ({
      hash: duplicate.hash,
      themeIds: duplicate.theme_ids,
    }));

    return {
      records: loadResult.items,
      duplicates,
      totalCount: hashIndex.count,
    };
  };

  const reloadCache = async (): Promise<{ entry: ThemeCacheEntry; fromCache: boolean } | null> => {
    cache.markDirty(options.csvPath);
    try {
      return await cache.getOrLoad(options.csvPath, loadFromWorker);
    } catch (error) {
      console.warn('[themes] Failed to warm cache after change', error);
      return null;
    }
  };

  const watcher = new CsvWatcher(options.csvPath, () => {
    void reloadCache().finally(() => {
      broadcastThemeUpdate({ csvPath: options.csvPath, reason: 'file-changed' });
    });
  });

  const handler = async (_event: IpcMainInvokeEvent, payload: ThemeRequestPayload): Promise<ThemeResponsePayload> => {
    const { count, forceReload } = payload ?? {};

    let entryResult: { entry: ThemeCacheEntry; fromCache: boolean } | null = null;
    if (forceReload) {
      entryResult = await reloadCache();
    }

    const { entry, fromCache } =
      entryResult ?? (await cache.getOrLoad(options.csvPath, loadFromWorker));

    const limitedCount = count ? Math.min(count, entry.records.length) : entry.records.length;
    const duplicates: ThemeDuplicateGroup[] = entry.duplicates.map((duplicate) => ({
      hash: duplicate.hash,
      themeIds: [...duplicate.themeIds],
    }));

    return {
      items: entry.records.slice(0, limitedCount),
      totalCount: entry.totalCount,
      csvPath: path.resolve(options.csvPath),
      mtimeMs: entry.mtimeMs,
      cached: fromCache,
      duplicates,
      duplicateCount: duplicates.length,
      lastUpdatedAt: entry.cachedAt,
    };
  };

  ipcMain.handle('themes/request', handler);

  return () => {
    watcher.dispose();
    ipcMain.removeHandler('themes/request');
  };
}

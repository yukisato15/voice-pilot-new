import { EventEmitter } from 'node:events';
import path from 'node:path';
import { stat } from 'node:fs/promises';

import chokidar, { type FSWatcher } from 'chokidar';

export type ZoomWatcherState = 'idle' | 'recording' | 'converting' | 'ready';

export interface ZoomWatcherStatus {
  state: ZoomWatcherState | 'error';
  path?: string;
  file?: string;
  bytes?: number;
  error?: string;
}

export declare interface ZoomWatcher {
  on(event: 'status', listener: (status: ZoomWatcherStatus) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

export class ZoomWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;

  private currentDir: string | null = null;

  private readonly pendingTimeouts = new Map<string, NodeJS.Timeout[]>();

  private readonly fileSizes = new Map<string, number>();

  private lastStatus: ZoomWatcherStatus | null = null;

  start(directory: string | null | undefined): void {
    const normalized = directory ? path.resolve(directory) : null;
    if (!normalized) {
      this.emit('status', { state: 'error', error: '録音フォルダが設定されていません。' });
      return;
    }

    if (this.currentDir === normalized && this.watcher) {
      return;
    }

    this.stop();
    this.currentDir = normalized;
    this.dispatchStatus({ state: 'idle', path: normalized });

    this.watcher = chokidar.watch(normalized, {
      ignoreInitial: false,
      depth: 2,
    });

    const handleFile = async (filePath: string) => {
      try {
        const stats = await stat(filePath);
        if (!stats.isFile()) {
          return;
        }
        const prevSize = this.fileSizes.get(filePath) ?? 0;
        this.fileSizes.set(filePath, stats.size);

        const isGrowing = stats.size > prevSize;
        const state: ZoomWatcherState = isGrowing ? 'recording' : 'converting';

        this.dispatchStatus({
          state,
          file: filePath,
          path: normalized,
          bytes: stats.size,
        });

        if (!isGrowing) {
          this.scheduleTransition(filePath, 'ready', 3000);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('error', err);
        this.dispatchStatus({ state: 'error', error: err.message, path: normalized });
      }
    };

    this.watcher.on('add', handleFile);
    this.watcher.on('change', handleFile);

    this.watcher.on('error', (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      this.dispatchStatus({ state: 'error', error: err.message, path: normalized });
    });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close().catch(() => {
        // Ignore closing errors during shutdown.
      });
      this.watcher = null;
    }

    for (const timeouts of this.pendingTimeouts.values()) {
      timeouts.forEach(clearTimeout);
    }
    this.pendingTimeouts.clear();
    this.fileSizes.clear();
    this.currentDir = null;
  }

  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }

  private scheduleTransition(filePath: string, state: ZoomWatcherState, delay: number): void {
    const queue = this.pendingTimeouts.get(filePath) ?? [];
    const timeout = setTimeout(() => {
      this.dispatchStatus({ state, file: filePath, path: this.currentDir ?? undefined });
    }, delay);
    queue.push(timeout);

    if (!this.pendingTimeouts.has(filePath)) {
      this.pendingTimeouts.set(filePath, queue);
    }
  }

  private dispatchStatus(status: ZoomWatcherStatus): void {
    this.lastStatus = status;
    this.emit('status', status);
  }

  getStatus(): ZoomWatcherStatus | null {
    return this.lastStatus;
  }
}

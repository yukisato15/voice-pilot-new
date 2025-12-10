import { EventEmitter } from 'node:events';
import path from 'node:path';
import chokidar, { FSWatcher } from 'chokidar';

export type ZoomWatcherState = 'idle' | 'recording' | 'converting' | 'ready';

export interface ZoomWatcherStatus {
  state: ZoomWatcherState | 'error';
  path?: string;
  file?: string;
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

  start(directory: string | null | undefined): void {
    const normalized = directory ? path.resolve(directory) : null;
    if (!normalized) {
      return;
    }

    if (this.currentDir === normalized && this.watcher) {
      return;
    }

    this.stop();
    this.currentDir = normalized;
    this.emit('status', { state: 'idle', path: normalized });

    this.watcher = chokidar.watch(normalized, {
      ignoreInitial: true,
      depth: 2,
    });

    this.watcher.on('add', (filePath) => {
      this.emit('status', { state: 'recording', file: filePath, path: normalized });
      this.scheduleTransition(filePath, 'converting', 1500);
      this.scheduleTransition(filePath, 'ready', 5000);
    });

    this.watcher.on('error', (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      this.emit('status', { state: 'error', error: err.message, path: normalized });
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
    this.currentDir = null;
  }

  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }

  private scheduleTransition(filePath: string, state: ZoomWatcherState, delay: number): void {
    const queue = this.pendingTimeouts.get(filePath) ?? [];
    const timeout = setTimeout(() => {
      this.emit('status', { state, file: filePath, path: this.currentDir ?? undefined });
    }, delay);
    queue.push(timeout);

    if (!this.pendingTimeouts.has(filePath)) {
      this.pendingTimeouts.set(filePath, queue);
    }
  }
}

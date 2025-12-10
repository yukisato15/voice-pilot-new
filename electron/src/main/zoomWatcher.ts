import { EventEmitter } from "events";
import chokidar, { FSWatcher } from "chokidar";
import fs from "fs";
import path from "path";

type RecordingState = "idle" | "recording" | "converting" | "ready";

interface StatusPayload {
  state: RecordingState;
  file?: string;
}

class ZoomWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private monitoredPath: string | null = null;
  private activeFiles = new Map<string, number>();
  private stabilityTimers = new Map<string, NodeJS.Timeout>();
  private lastStatus: StatusPayload = { state: "idle" };

  start(directory: string) {
    if (this.watcher) {
      this.stop();
    }

    this.monitoredPath = directory;
    this.watcher = chokidar.watch(directory, {
      ignoreInitial: true,
      depth: 1,
      awaitWriteFinish: { stabilityThreshold: 2000 }
    });

    this.watcher.on("add", (filePath) => this.handleFileEvent("add", filePath));
    this.watcher.on("change", (filePath) =>
      this.handleFileEvent("change", filePath)
    );
    this.emitStatus({ state: "idle" });
  }

  stop() {
    if (this.watcher) {
      this.watcher.close().catch(() => void 0);
      this.watcher = null;
    }
    this.monitoredPath = null;
    this.activeFiles.clear();
    this.clearTimers();
    this.emitStatus({ state: "idle" });
  }

  onStatusChange(listener: (payload: StatusPayload) => void) {
    listener(this.lastStatus);
    this.on("status", listener);
  }

  private handleFileEvent(_type: "add" | "change", filePath: string) {
    if (![".m4a", ".zoom", ".tmp"].includes(path.extname(filePath))) {
      return;
    }

    try {
      const stats = fs.statSync(filePath);
      const lastSize = this.activeFiles.get(filePath) ?? 0;
      this.activeFiles.set(filePath, stats.size);

      if (stats.size > lastSize) {
        this.emitStatus({ state: "recording", file: filePath });
        this.scheduleStabilityCheck(filePath);
      }
    } catch (error) {
      console.warn("ZoomWatcher: stat failed", error);
    }
  }

  private scheduleStabilityCheck(filePath: string) {
    const existing = this.stabilityTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      try {
        const currentSize = fs.statSync(filePath).size;
        if (currentSize === this.activeFiles.get(filePath)) {
          this.emitStatus({ state: "ready", file: filePath });
          this.activeFiles.delete(filePath);
        } else {
          this.scheduleStabilityCheck(filePath);
        }
      } catch (error) {
        console.warn("ZoomWatcher: stability check failed", error);
      }
    }, 10_000);

    this.stabilityTimers.set(filePath, timer);
  }

  private clearTimers() {
    for (const timer of this.stabilityTimers.values()) {
      clearTimeout(timer);
    }
    this.stabilityTimers.clear();
  }

  private emitStatus(payload: StatusPayload) {
    this.lastStatus = payload;
    this.emit("status", payload);
  }
}

export const zoomWatcher = new ZoomWatcher();

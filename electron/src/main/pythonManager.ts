import { EventEmitter } from "events";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import path from "path";
import { app } from "electron";
import { randomUUID } from "crypto";

interface PythonRequest {
  action: string;
  payload: unknown;
}

interface PythonEvent {
  channel: string;
  payload: unknown;
}

class PythonManager extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null;
  private queue: Array<PythonRequest & { id: string }> = [];
  private ready = false;
  private pending = new Map<
    string,
    {
      resolve: (payload: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor() {
    super();
    app.on("before-quit", () => this.shutdown());
    this.start();
  }

  enqueue(request: PythonRequest) {
    void this.request(request).catch((error) => {
      console.error("Python request failed", error);
    });
  }

  request<T = unknown>(request: PythonRequest): Promise<T> {
    const id = randomUUID();
    const envelope = { id, ...request };

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (payload) => resolve(payload as T),
        reject
      });

      if (!this.process || !this.ready) {
        this.queue.push(envelope);
      } else {
        this.send(envelope);
      }
    });
  }

  onEvent(listener: (event: PythonEvent) => void) {
    this.on("event", listener);
  }

  private start() {
    const scriptPath = path.resolve(
      app.isPackaged
        ? path.join(process.resourcesPath, "backend", "worker.py")
        : path.join(__dirname, "../../../backend/worker.py")
    );

    this.process = spawn("python3", [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.process.stdout.on("data", (data) => this.handleStdout(data));
    this.process.stderr.on("data", (data) => {
      console.error("[Python]", data.toString());
    });
    this.process.on("exit", (code, signal) => {
      console.warn(`Python worker exited (code=${code} signal=${signal})`);
      this.ready = false;
      this.rejectAllPending(new Error("Python worker exited"));
      this.restartWithBackoff();
    });
  }

  private handleStdout(data: Buffer) {
    const lines = data.toString().trim().split("\n");
    for (const line of lines) {
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.event) {
          this.emit("event", {
            channel: parsed.event,
            payload: parsed.data
          });
        } else if (parsed.status === "ready") {
          this.ready = true;
          this.flushQueue();
        } else if (parsed.id && this.pending.has(parsed.id)) {
          const pending = this.pending.get(parsed.id);
          if (!pending) {
            continue;
          }

          if (parsed.status === "ok") {
            pending.resolve(parsed.result);
          } else {
            pending.reject(
              new Error(parsed.error?.message ?? "Unknown Python error")
            );
          }
          this.pending.delete(parsed.id);
        } else {
          this.emit("event", {
            channel: "python/response",
            payload: parsed
          });
        }
      } catch (error) {
        console.error("Failed to parse Python stdout", error);
      }
    }
  }

  private send(request: PythonRequest & { id: string }) {
    if (!this.process) {
      this.queue.push(request);
      return;
    }
    this.process.stdin.write(`${JSON.stringify(request)}\n`);
  }

  private flushQueue() {
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) continue;
      this.send(request);
    }
  }

  private restartWithBackoff() {
    setTimeout(() => {
      this.start();
    }, 3000);
  }

  private rejectAllPending(error: Error) {
    for (const { reject } of this.pending.values()) {
      reject(error);
    }
    this.pending.clear();
    this.queue = [];
  }

  private shutdown() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.rejectAllPending(new Error("Python manager shutdown"));
  }
}

export const pythonManager = new PythonManager();

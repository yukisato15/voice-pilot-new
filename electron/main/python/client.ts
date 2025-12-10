import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import * as readline from 'node:readline';
import * as path from 'node:path';

export interface PythonWorkerClientOptions {
  /** Path to the Python executable. Defaults to `python3`. */
  pythonPath?: string;
  /** Path to the worker script. Defaults to `../../backend/worker.py` relative to this file. */
  scriptPath?: string;
  /** Default timeout for requests in milliseconds. */
  timeoutMs?: number;
  /** Additional environment variables to pass to the child process. */
  env?: NodeJS.ProcessEnv;
}

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

export interface PythonWorkerResponse<T = unknown> {
  id?: string;
  action?: string;
  status?: 'ok' | 'error';
  result?: T;
  error?: { message: string };
  event?: string;
  data?: unknown;
}

export class PythonWorkerClient extends EventEmitter {
  private readonly process: ChildProcessWithoutNullStreams;

  private readonly pending = new Map<string, PendingRequest<unknown>>();

  private readonly defaultTimeoutMs: number;

  private disposed = false;

  constructor(options: PythonWorkerClientOptions = {}) {
    super();

    const pythonPath = options.pythonPath ?? 'python3';
    const scriptPath =
      options.scriptPath ?? path.resolve(__dirname, '../../../backend/worker.py');
    this.defaultTimeoutMs = options.timeoutMs ?? 60_000;

    this.process = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...options.env,
      },
    });

    this.process.on('error', (error) => {
      this.emit('error', error);
      this.rejectAll(new Error(`Failed to spawn Python worker: ${error.message}`));
    });

    this.process.on('exit', (code, signal) => {
      if (!this.disposed) {
        const reason = signal ? `signal ${signal}` : `exit code ${code}`;
        this.rejectAll(new Error(`Python worker exited unexpectedly (${reason})`));
      }
      this.emit('exit', code, signal);
    });

    const stdoutReader = readline.createInterface({
      input: this.process.stdout,
    });

    stdoutReader.on('line', (line) => {
      this.handleMessage(line);
    });

    const stderrReader = readline.createInterface({
      input: this.process.stderr,
    });

    stderrReader.on('line', (line) => {
      this.emit('stderr', line);
    });
  }

  async invoke<T>(action: string, payload: unknown, timeoutOverride?: number): Promise<T> {
    if (this.disposed) {
      throw new Error('Python worker client has been disposed');
    }

    const id = randomUUID();
    const message = JSON.stringify({ id, action, payload });

    const timeoutMs = timeoutOverride ?? this.defaultTimeoutMs;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Python worker request timed out for action=${action}`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });

      this.process.stdin.write(`${message}\n`, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.rejectAll(new Error('Python worker client disposed'));

    this.process.removeAllListeners();
    this.process.kill();
  }

  private handleMessage(rawLine: string): void {
    let parsed: PythonWorkerResponse;
    try {
      parsed = JSON.parse(rawLine) as PythonWorkerResponse;
    } catch (error) {
      this.emit('stderr', `Invalid JSON from worker: ${rawLine}`);
      return;
    }

    if (parsed.event) {
      this.emit(parsed.event, parsed.data);
      this.emit('event', { event: parsed.event, data: parsed.data });
      return;
    }

    const { id } = parsed;
    if (!id) {
      return;
    }

    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(id);

    if (parsed.status === 'ok') {
      pending.resolve(parsed.result);
    } else {
      const errorMessage = parsed.error?.message ?? 'Unknown worker error';
      pending.reject(new Error(errorMessage));
    }
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}

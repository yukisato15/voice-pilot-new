import { BrowserWindow, ipcMain } from 'electron';

import { getConfig, updateConfig } from '../config/store';

type TimerMode = 'up' | 'down';

type TimerPhase = 'idle' | 'intro' | 'running' | 'outro' | 'completed';
type StopReason = 'manual' | 'completed' | 'aborted';

interface TimerConfig {
  durationSec: number;
  introSec: number;
  outroSec: number;
  intervalSec: number;
  breakLengthSec: number;
}

interface TimerState {
  phase: TimerPhase;
  config: TimerConfig | null;
  elapsedSec: number;
  remainingSec: number;
  startedAt: number | null;
  stoppedAt: number | null;
  introRemaining: number;
  mode: TimerMode;
}

interface TimerStartPayload {
  durationSec?: number;
  introSec?: number;
  outroSec?: number;
  intervalSec?: number;
  breakLengthSec?: number;
}

const defaults: TimerConfig = {
  durationSec: 360,
  introSec: 3,
  outroSec: 5,
  intervalSec: 60,
  breakLengthSec: 300,
};

const broadcast = (channel: string, payload: unknown): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
};

class SessionTimer {
  private interval: NodeJS.Timeout | undefined;

  private state: TimerState = {
    phase: 'idle',
    config: null,
    elapsedSec: 0,
    remainingSec: 0,
    startedAt: null,
    stoppedAt: null,
    introRemaining: 0,
    mode: getConfig().timerMode ?? 'up',
  };

  private mode: TimerMode = getConfig().timerMode ?? 'up';

  start(payload?: TimerStartPayload): TimerState {
    this.clearInterval();

    const config = this.normalizeConfig(payload);
    const currentConfig = getConfig();
    const nextSegment = (currentConfig.segmentCounter ?? 0) + 1;
    updateConfig({ segmentCounter: nextSegment, timerMode: this.mode });
    const introRemaining = config.introSec;

    this.state = {
      phase: introRemaining > 0 ? 'intro' : 'running',
      config,
      elapsedSec: 0,
      remainingSec: config.durationSec,
      startedAt: Date.now(),
      stoppedAt: null,
      introRemaining,
      mode: this.mode,
    };

    if (this.state.startedAt !== null) {
      broadcast('timer/start', {
        phase: this.state.phase,
        config,
        mode: this.mode,
        startedAt: new Date(this.state.startedAt).toISOString(),
      });
    }

    if (this.state.phase === 'intro') {
      broadcast('timer/phase', {
        phase: 'intro',
        remaining: this.state.introRemaining,
        mode: this.mode,
      });
    } else {
      broadcast('timer/phase', {
        phase: 'running',
        remaining: this.state.remainingSec,
        mode: this.mode,
      });
      broadcast('timer/tick', this.getTickPayload());
    }

    this.interval = setInterval(() => {
      try {
        this.tick();
      } catch (error) {
        console.error('[timer] tick error', error);
        this.stop('aborted');
      }
    }, 1000);

    return this.getState();
  }

  stop(reason: StopReason = 'manual'): TimerState {
    this.clearInterval();
    if (!this.state.config) {
      return this.getState();
    }

    this.state.stoppedAt = Date.now();
    this.state.phase = reason === 'completed' ? 'completed' : 'idle';

    if (this.state.stoppedAt !== null) {
      broadcast('timer/stop', {
        reason,
        stoppedAt: new Date(this.state.stoppedAt).toISOString(),
        elapsedSec: this.state.elapsedSec,
        remainingSec: this.state.remainingSec,
        phase: this.state.phase,
        mode: this.mode,
      });
    }

    return this.getState();
  }

  reset(): TimerState {
    this.stop('aborted');
    this.state = {
      phase: 'idle',
      config: null,
      elapsedSec: 0,
      remainingSec: 0,
      startedAt: null,
      stoppedAt: null,
      introRemaining: 0,
      mode: this.mode,
    };
    return this.getState();
  }

  status(): TimerState {
    return this.getState();
  }

  private tick(): void {
    if (!this.state.config) {
      this.stop('aborted');
      return;
    }

    if (this.state.phase === 'intro') {
      this.state.introRemaining = Math.max(this.state.introRemaining - 1, 0);
      broadcast('timer/phase', {
        phase: 'intro',
        remaining: this.state.introRemaining,
        mode: this.mode,
      });

      if (this.state.introRemaining <= 0) {
        this.state.phase = 'running';
        this.state.startedAt = Date.now();
        this.state.elapsedSec = 0;
        this.state.remainingSec = this.state.config.durationSec;

        broadcast('timer/phase', {
          phase: 'running',
          remaining: this.state.remainingSec,
          mode: this.mode,
        });

        broadcast('timer/tick', this.getTickPayload());
      }

      return;
    }

    if (this.mode === 'up') {
      this.state.elapsedSec += 1;
      this.state.remainingSec = Math.max(this.state.config.durationSec - this.state.elapsedSec, 0);
      broadcast('timer/tick', this.getTickPayload());
      return;
    }

    this.state.elapsedSec = Math.min(this.state.elapsedSec + 1, this.state.config.durationSec);
    this.state.remainingSec = Math.max(this.state.config.durationSec - this.state.elapsedSec, 0);

    broadcast('timer/tick', this.getTickPayload());

    if (this.state.remainingSec <= this.state.config.outroSec && this.state.config.outroSec > 0) {
      this.state.phase = this.state.remainingSec > 0 ? 'outro' : 'completed';
      broadcast('timer/phase', {
        phase: this.state.phase,
        remaining: this.state.remainingSec,
        mode: this.mode,
      });
    }

    if (this.state.remainingSec <= 0) {
      this.stop('completed');
    }
  }

  private normalizeConfig(payload?: TimerStartPayload): TimerConfig {
    return {
      durationSec: this.sanitizeNumber(payload?.durationSec, defaults.durationSec),
      introSec: this.sanitizeNumber(payload?.introSec, defaults.introSec),
      outroSec: this.sanitizeNumber(payload?.outroSec, defaults.outroSec),
      intervalSec: this.sanitizeNumber(payload?.intervalSec, defaults.intervalSec),
      breakLengthSec: this.sanitizeNumber(payload?.breakLengthSec, defaults.breakLengthSec),
    };
  }

  private sanitizeNumber(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return fallback;
    }
    return Math.max(0, Math.floor(value));
  }

  private getTickPayload(): Record<string, unknown> {
    return {
      phase: this.state.phase,
      elapsedSec: this.state.elapsedSec,
      remainingSec: this.state.remainingSec,
      timestamp: new Date().toISOString(),
      mode: this.mode,
    };
  }

  private clearInterval(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private getState(): TimerState {
    return { ...this.state, config: this.state.config ? { ...this.state.config } : null };
  }

  setMode(mode: TimerMode): { success: boolean; mode: TimerMode } {
    if (mode !== 'up' && mode !== 'down') {
      return { success: false, mode: this.mode };
    }
    if (this.state.phase !== 'idle' && this.state.phase !== 'completed') {
      return { success: false, mode: this.mode };
    }
    this.mode = mode;
    this.state.mode = mode;
    updateConfig({ timerMode: mode });
    return { success: true, mode: this.mode };
  }
}

export const registerTimerHandlers = (): void => {
  const controller = new SessionTimer();
  controller.setMode(getConfig().timerMode ?? 'up');

  ipcMain.removeHandler('timer/start');
  ipcMain.handle('timer/start', (_event, payload: TimerStartPayload | undefined) => {
    return controller.start(payload);
  });

  ipcMain.removeHandler('timer/stop');
  ipcMain.handle('timer/stop', (_event, payload: { reason?: StopReason } | undefined) => {
    return controller.stop(payload?.reason);
  });

  ipcMain.removeHandler('timer/reset');
  ipcMain.handle('timer/reset', () => {
    return controller.reset();
  });

  ipcMain.removeHandler('timer/status');
  ipcMain.handle('timer/status', () => {
    return controller.status();
  });

  ipcMain.removeHandler('timer/set-mode');
  ipcMain.handle('timer/set-mode', (_event, payload: { mode: TimerMode }) => {
    return controller.setMode(payload?.mode ?? 'up');
  });
};

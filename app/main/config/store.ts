import Store from 'electron-store';

export type AppConfig = {
  projectDir: string | null;
  zoomRecordingDir: string | null;
  projectCode: string;
  pairId: string;
  segmentCounter: number;
  lastChannel: 'A' | 'B';
  sessionLength: number;
  startSilence: number;
  endSilence: number;
  intervalSeconds: number;
  breakEveryMinutes: number;
  breakLengthMinutes: number;
  themeSourcePath: string | null;
  lastRenameAt: string | null;
  timerMode: 'up' | 'down';
  endWarnSec: number;
  memoDisplaySec: number;
  eventPillSec: number;
  timecodeFps: number;
  overtimeAlert: boolean;
  showProjectSelector: boolean;
};

const defaults: AppConfig = {
  projectDir: null,
  zoomRecordingDir: null,
  projectCode: 'PROJECT',
  pairId: '001',
  segmentCounter: 0,
  lastChannel: 'A',
  sessionLength: 360,
  startSilence: 3,
  endSilence: 5,
  intervalSeconds: 60,
  breakEveryMinutes: 30,
  breakLengthMinutes: 5,
  themeSourcePath: null,
  lastRenameAt: null,
  timerMode: 'up',
  endWarnSec: 10,
  memoDisplaySec: 3,
  eventPillSec: 1,
  timecodeFps: 30,
  overtimeAlert: true,
  showProjectSelector: true,
};

const store = new Store<AppConfig>({
  name: 'voice-pilot-config',
  defaults,
});

const listeners = new Set<(config: AppConfig) => void>();

export const getConfig = (): AppConfig => store.store;

export const updateConfig = (partial: Partial<AppConfig>): AppConfig => {
  const next = { ...store.store, ...partial };
  store.store = next;
  listeners.forEach((listener) => listener(next));
  return next;
};

export const onConfigDidChange = (listener: (config: AppConfig) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

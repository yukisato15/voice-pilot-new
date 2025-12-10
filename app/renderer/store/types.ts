export type SessionStatus =
  | 'idle'
  | 'ready'
  | 'countdown'
  | 'running'
  | 'interval'
  | 'break'
  | 'completed';

export type CountdownMode = 'intro' | 'outro' | null;
export type TimerMode = 'up' | 'down';

export interface ThemeSummary {
  id: string;
  title: string;
  category?: string;
  roleAPrompt?: string;
  roleBPrompt?: string;
  hints: string[];
  description?: string;
}

export type EventCategory =
  | 'PII'
  | 'NOISE'
  | 'MIC_A'
  | 'MIC_B'
  | 'NET_DROP'
  | 'NG'
  | 'CUSTOM'
  | 'CUT_IN'
  | 'CUT_OUT';

export interface EventLog {
  id: string;
  createdAt: string;
  category: EventCategory;
  label: string;
  shortcut?: string;
  note?: string;
  themeId?: string;
  relativeSeconds?: number;
}

export interface DirectorNote {
  id: string;
  createdAt: string;
  updatedAt: string;
  body: string;
  themeId?: string;
  pinned?: boolean;
  tags?: string[];
  relatedEventId?: string;
  speaker?: 'A' | 'B' | 'both';
  relativeSeconds?: number;
}

export interface SlideDeck {
  id: string;
  title: string;
  sourcePath?: string;
  images: string[];
  generatedAt: string;
  notes?: string;
}

export interface SessionState {
  status: SessionStatus;
  durationSec: number;
  elapsedSec: number;
  remainingSec: number;
  talkStartSilenceSec: number;
  talkEndSilenceSec: number;
  intervalSec: number;
  breakEveryMinutes: number;
  breakLengthMinutes: number;
  startTimestamp: string | null;
  endTimestamp: string | null;
  availableThemes: ThemeSummary[];
  themeSourcePath: string | null;
  themeSourceFormat: 'csv' | 'json' | null;
  themeLoadedAt: string | null;
  currentTheme: ThemeSummary | null;
  hintsUsed: number[];
  timerMode: TimerMode;
  lastHintIndex: number | null;
  countdown: {
    mode: CountdownMode;
    remaining: number | null;
  };
  endWarningSec: number;
  timecodeFps: number;
  memoDisplaySec: number;
  eventPillSec: number;
  overtimeAlertEnabled: boolean;
  eventLog: EventLog[];
  directorNotes: DirectorNote[];
  slideDeck: SlideDeck | null;
  slideIndex: number;
  slideLoading: boolean;
  slideError: string | null;
}

export type RecordingStatus = 'idle' | 'waiting' | 'recording' | 'stopped' | 'unknown' | 'converting';

export interface ZoomRecordingDetail {
  state: RecordingStatus;
  file?: string;
  bytes?: number;
  path?: string;
  updatedAt: string;
}

export interface AppConfigState {
  projectDir: string | null;
  zoomRecordingDir: string | null;
  projectCode: string;
  pairId: string;
  segmentCounter: number;
  lastChannel: 'A' | 'B';
  timerMode: TimerMode;
  sessionLength: number;
  startSilence: number;
  endSilence: number;
  intervalSeconds: number;
  breakEveryMinutes: number;
  breakLengthMinutes: number;
  themeSourcePath: string | null;
  lastRenameAt: string | null;
  endWarnSec: number;
  memoDisplaySec: number;
  eventPillSec: number;
  timecodeFps: number;
  overtimeAlert: boolean;
  showProjectSelector: boolean;
}

export type StageOverlay =
  | { type: 'countdown'; remaining: number }
  | { type: 'final'; remaining: number }
  | { type: 'message'; title: string; description?: string; ttlMs?: number }
  | null;

export interface ToastMessage {
  id: string;
  variant: 'info' | 'success' | 'warning' | 'error';
  message: string;
  createdAt: string;
  expiresAt?: string;
}

export type StageInstructionOverlay = {
  text: string;
  speaker?: 'A' | 'B' | 'both';
  expiresAt: string;
};

export type StageEventOverlay = {
  label: string;
  category: string;
  expiresAt: string;
};

export interface UIState {
  directorView: 'lobby' | 'session' | 'post';
  isSettingsOpen: boolean;
  isSlidePickerOpen: boolean;
  isConfirmStopOpen: boolean;
  isTimerLocked: boolean;
  recordingStatus: RecordingStatus;
  recordingDetail: ZoomRecordingDetail | null;
  zoomRecordingDir: string | null;
  stageOverlay: StageOverlay;
  toasts: ToastMessage[];
  stageInstruction: StageInstructionOverlay | null;
  stageEvent: StageEventOverlay | null;
}

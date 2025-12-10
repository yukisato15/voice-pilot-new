import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  CountdownMode,
  DirectorNote,
  EventLog,
  SessionState,
  SessionStatus,
  TimerMode,
  SlideDeck,
  ThemeSummary,
} from '../types';
import { generateId } from '../utils';

const createInitialState = (): SessionState => ({
  status: 'idle',
  durationSec: 360,
  elapsedSec: 0,
  remainingSec: 360,
  talkStartSilenceSec: 3,
  talkEndSilenceSec: 5,
  intervalSec: 60,
  breakEveryMinutes: 30,
  breakLengthMinutes: 5,
  startTimestamp: null,
  endTimestamp: null,
  availableThemes: [],
  themeSourcePath: null,
  themeSourceFormat: null,
  themeLoadedAt: null,
  currentTheme: null,
  hintsUsed: [],
  timerMode: 'up',
  lastHintIndex: null,
  countdown: {
    mode: null,
    remaining: null,
  },
  endWarningSec: 10,
  timecodeFps: 30,
  memoDisplaySec: 3,
  eventPillSec: 1,
  overtimeAlertEnabled: true,
  eventLog: [],
  directorNotes: [],
  slideDeck: null,
  slideIndex: 0,
  slideLoading: false,
  slideError: null,
});

const clampCountdown = (mode: CountdownMode, remaining: number | null): { mode: CountdownMode; remaining: number | null } => {
  if (mode === null || remaining === null) {
    return { mode: null, remaining: null };
  }
  return { mode, remaining: Math.max(remaining, 0) };
};

const applyPhase = (state: SessionState, phase: TimerPhase, countdownRemaining?: number): void => {
  switch (phase) {
    case 'intro': {
      state.status = 'countdown';
      const remaining = countdownRemaining ?? state.countdown.remaining ?? state.talkStartSilenceSec;
      state.countdown = clampCountdown('intro', remaining);
      break;
    }
    case 'running': {
      state.status = 'running';
      state.countdown = { mode: null, remaining: null };
      break;
    }
    case 'outro': {
      state.status = 'running';
      const remaining =
        countdownRemaining ?? Math.max(Math.ceil(state.remainingSec), 0);
      state.countdown = clampCountdown('outro', remaining);
      break;
    }
    case 'completed': {
      state.status = 'completed';
      state.countdown = { mode: null, remaining: null };
      state.remainingSec = 0;
      state.endTimestamp = state.endTimestamp ?? new Date().toISOString();
      break;
    }
    default:
      break;
  }
};

type TimerPhase = 'intro' | 'running' | 'outro' | 'completed';

const sessionSlice = createSlice({
  name: 'session',
  initialState: createInitialState(),
  reducers: {
    configureSession(state, action: PayloadAction<Partial<Pick<SessionState, 'durationSec' | 'talkStartSilenceSec' | 'talkEndSilenceSec' | 'intervalSec' | 'breakEveryMinutes' | 'breakLengthMinutes' | 'endWarningSec' | 'timecodeFps' | 'memoDisplaySec' | 'eventPillSec' | 'overtimeAlertEnabled'>>>) {
      if (action.payload.durationSec !== undefined) {
        state.durationSec = Math.max(0, action.payload.durationSec);
        state.remainingSec = Math.max(state.durationSec - state.elapsedSec, 0);
      }
      if (action.payload.talkStartSilenceSec !== undefined) {
        state.talkStartSilenceSec = Math.max(0, action.payload.talkStartSilenceSec);
        if (state.countdown.mode === 'intro') {
          state.countdown.remaining = state.talkStartSilenceSec;
        }
      }
      if (action.payload.talkEndSilenceSec !== undefined) {
        state.talkEndSilenceSec = Math.max(0, action.payload.talkEndSilenceSec);
      }
      if (action.payload.intervalSec !== undefined) {
        state.intervalSec = Math.max(0, action.payload.intervalSec);
      }
      if (action.payload.breakEveryMinutes !== undefined) {
        state.breakEveryMinutes = Math.max(0, action.payload.breakEveryMinutes);
      }
      if (action.payload.breakLengthMinutes !== undefined) {
        state.breakLengthMinutes = Math.max(0, action.payload.breakLengthMinutes);
      }
      if (action.payload.endWarningSec !== undefined) {
        state.endWarningSec = Math.max(0, action.payload.endWarningSec);
      }
      if (action.payload.timecodeFps !== undefined) {
        state.timecodeFps = Math.max(1, action.payload.timecodeFps);
      }
      if (action.payload.memoDisplaySec !== undefined) {
        state.memoDisplaySec = Math.max(1, action.payload.memoDisplaySec);
      }
      if (action.payload.eventPillSec !== undefined) {
        state.eventPillSec = Math.max(1, action.payload.eventPillSec);
      }
      if (action.payload.overtimeAlertEnabled !== undefined) {
        state.overtimeAlertEnabled = action.payload.overtimeAlertEnabled;
      }
    },
    setSessionStatus(state, action: PayloadAction<SessionStatus>) {
      state.status = action.payload;
    },
    setCurrentTheme(state, action: PayloadAction<ThemeSummary | null>) {
      const nextTheme = action.payload;
      if (!nextTheme || nextTheme.id !== state.currentTheme?.id) {
        state.hintsUsed = [];
        state.lastHintIndex = null;
      }
      state.currentTheme = nextTheme;
    },
    setTimerMode(state, action: PayloadAction<TimerMode>) {
      state.timerMode = action.payload;
    },
    setThemeLibrary(
      state,
      action: PayloadAction<{
        themes: ThemeSummary[];
        sourcePath?: string | null;
        format?: 'csv' | 'json' | null;
        loadedAt?: string | null;
        autoSelectFirst?: boolean;
      }>,
    ) {
      state.availableThemes = action.payload.themes;
      state.themeSourcePath = action.payload.sourcePath ?? null;
      state.themeSourceFormat = action.payload.format ?? null;
      state.themeLoadedAt = action.payload.loadedAt ?? new Date().toISOString();

      if (action.payload.autoSelectFirst && action.payload.themes.length > 0) {
        state.currentTheme = action.payload.themes[0];
      } else if (state.currentTheme) {
        const matched = action.payload.themes.find(
          (theme) => theme.id === state.currentTheme?.id,
        );
        state.currentTheme = matched ?? null;
      }
    },
    startSession(
      state,
      action: PayloadAction<{
        theme?: ThemeSummary | null;
        startTimestamp?: string;
      } | undefined>,
    ) {
      if (action.payload?.theme !== undefined) {
        state.currentTheme = action.payload.theme;
      }
      state.status = state.talkStartSilenceSec > 0 ? 'countdown' : 'running';
      state.startTimestamp = action.payload?.startTimestamp ?? new Date().toISOString();
      state.endTimestamp = null;
      state.elapsedSec = 0;
      state.remainingSec = state.durationSec;
      state.hintsUsed = [];
      state.countdown = clampCountdown(
        state.status === 'countdown' ? 'intro' : null,
        state.status === 'countdown' ? state.talkStartSilenceSec : null,
      );
      state.eventLog = [];
      state.directorNotes = [];
      state.slideIndex = 0;
    },
    tickSession(
      state,
      action: PayloadAction<
        | number
        | undefined
        | {
            elapsedSec: number;
            remainingSec: number;
            phase?: TimerPhase;
            countdownRemaining?: number;
          }
      >,
    ) {
      if (state.status === 'idle' || state.status === 'completed') {
        return;
      }

      if (typeof action.payload === 'number' || action.payload === undefined) {
        const delta = action.payload ?? 1;
        if (delta <= 0) {
          return;
        }

        state.elapsedSec = Math.min(state.elapsedSec + delta, state.durationSec);
        state.remainingSec = Math.max(state.durationSec - state.elapsedSec, 0);

        if (state.countdown.mode === 'intro' && state.countdown.remaining !== null) {
          const next = Math.max(state.countdown.remaining - delta, 0);
          state.countdown.remaining = next;
          if (next <= 0) {
            state.countdown = { mode: null, remaining: null };
            state.status = 'running';
          }
        }
      } else {
        state.elapsedSec = Math.min(Math.max(action.payload.elapsedSec, 0), state.durationSec);
        state.remainingSec = Math.max(
          Math.min(action.payload.remainingSec, state.durationSec),
          0,
        );
        if (action.payload.phase) {
          applyPhase(state, action.payload.phase, action.payload.countdownRemaining);
        }
      }

      if (
        state.status === 'running' &&
        state.remainingSec <= state.talkEndSilenceSec &&
        state.talkEndSilenceSec > 0
      ) {
        const next = Math.max(Math.ceil(state.remainingSec), 0);
        state.countdown = clampCountdown('outro', next);
      }

      if (state.remainingSec <= 0) {
        state.status = 'completed';
        state.endTimestamp = new Date().toISOString();
        state.countdown = { mode: null, remaining: null };
      }
    },
    stopSession(
      state,
      action: PayloadAction<{ endTimestamp?: string; status?: SessionStatus } | undefined>,
    ) {
      state.status = action.payload?.status ?? 'completed';
      state.endTimestamp = action.payload?.endTimestamp ?? new Date().toISOString();
      state.countdown = { mode: null, remaining: null };
      if (state.status === 'completed') {
        state.remainingSec = 0;
      }
    },
    resetSession(state) {
      const preservedConfig = {
        durationSec: state.durationSec,
        talkStartSilenceSec: state.talkStartSilenceSec,
        talkEndSilenceSec: state.talkEndSilenceSec,
        intervalSec: state.intervalSec,
        breakEveryMinutes: state.breakEveryMinutes,
        breakLengthMinutes: state.breakLengthMinutes,
        slideDeck: state.slideDeck,
        availableThemes: state.availableThemes,
        themeSourcePath: state.themeSourcePath,
        themeSourceFormat: state.themeSourceFormat,
        themeLoadedAt: state.themeLoadedAt,
        currentTheme: state.currentTheme,
        timerMode: state.timerMode,
        endWarningSec: state.endWarningSec,
        timecodeFps: state.timecodeFps,
        memoDisplaySec: state.memoDisplaySec,
        eventPillSec: state.eventPillSec,
        overtimeAlertEnabled: state.overtimeAlertEnabled,
      };
      const resetState = createInitialState();
      Object.assign(state, { ...resetState, ...preservedConfig });
    },
    useHint(state, action: PayloadAction<number>) {
      if (!state.hintsUsed.includes(action.payload)) {
        state.hintsUsed.push(action.payload);
      }
      state.lastHintIndex = action.payload;
    },
    appendEventLog(state, action: PayloadAction<EventLog>) {
      const payload = action.payload;
      if (!payload.relativeSeconds) {
        payload.relativeSeconds = state.elapsedSec;
      }
      state.eventLog.push(payload);
    },
    updateEventLog(state, action: PayloadAction<EventLog>) {
      const index = state.eventLog.findIndex((event) => event.id === action.payload.id);
      if (index >= 0) {
        state.eventLog[index] = action.payload;
      }
    },
    removeEventLog(state, action: PayloadAction<string>) {
      state.eventLog = state.eventLog.filter((event) => event.id !== action.payload);
    },
    addDirectorNote(state, action: PayloadAction<DirectorNote>) {
      state.directorNotes.push(action.payload);
    },
    updateDirectorNote(state, action: PayloadAction<DirectorNote>) {
      const index = state.directorNotes.findIndex((note) => note.id === action.payload.id);
      if (index >= 0) {
        state.directorNotes[index] = action.payload;
      }
    },
    removeDirectorNote(state, action: PayloadAction<string>) {
      state.directorNotes = state.directorNotes.filter((note) => note.id !== action.payload);
    },
    setSlideDeck(state, action: PayloadAction<SlideDeck | null>) {
      state.slideDeck = action.payload;
      state.slideIndex = 0;
      if (action.payload) {
        state.slideError = null;
      }
    },
    setSlideIndex(state, action: PayloadAction<number>) {
      const next = action.payload;
      const maxIndex = (state.slideDeck?.images.length ?? 1) - 1;
      state.slideIndex = Math.min(Math.max(next, 0), Math.max(maxIndex, 0));
    },
    setSlideLoading(state, action: PayloadAction<boolean>) {
      state.slideLoading = action.payload;
      if (action.payload) {
        state.slideError = null;
      }
    },
    setSlideError(state, action: PayloadAction<string | null>) {
      state.slideError = action.payload;
    },
  },
});

export const {
  configureSession,
  setSessionStatus,
  setCurrentTheme,
  setTimerMode,
  setThemeLibrary,
  startSession,
  tickSession,
  stopSession,
  resetSession,
  useHint,
  appendEventLog,
  updateEventLog,
  removeEventLog,
  addDirectorNote,
  updateDirectorNote,
  removeDirectorNote,
  setSlideDeck,
  setSlideIndex,
  setSlideLoading,
  setSlideError,
} = sessionSlice.actions;

export const sessionReducer = sessionSlice.reducer;

export const buildDirectorNote = (body: string, overrides?: Partial<DirectorNote>): DirectorNote => {
  const timestamp = new Date().toISOString();
  return {
    id: overrides?.id ?? generateId(),
    body,
    createdAt: overrides?.createdAt ?? timestamp,
    updatedAt: overrides?.updatedAt ?? timestamp,
    themeId: overrides?.themeId,
    pinned: overrides?.pinned ?? false,
    tags: overrides?.tags ?? [],
    relatedEventId: overrides?.relatedEventId,
    speaker: overrides?.speaker,
    relativeSeconds: overrides?.relativeSeconds,
  };
};

export const buildEventLog = (
  params: Omit<EventLog, 'id' | 'createdAt'> & Partial<Pick<EventLog, 'id' | 'createdAt'>>,
): EventLog => {
  const timestamp = params.createdAt ?? new Date().toISOString();
  return {
    id: params.id ?? generateId(),
    createdAt: timestamp,
    category: params.category,
    label: params.label,
    note: params.note,
    shortcut: params.shortcut,
    themeId: params.themeId,
    relativeSeconds: params.relativeSeconds,
  };
};

export type SessionSliceState = SessionState;

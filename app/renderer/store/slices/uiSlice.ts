import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  RecordingStatus,
  StageOverlay,
  ToastMessage,
  UIState,
  ZoomRecordingDetail,
} from '../types';
import { generateId } from '../utils';

const createInitialState = (): UIState => ({
  directorView: 'lobby',
  isSettingsOpen: false,
  isSlidePickerOpen: false,
  isConfirmStopOpen: false,
  isTimerLocked: false,
  recordingStatus: 'idle',
  recordingDetail: null,
  zoomRecordingDir: null,
  stageOverlay: null,
  toasts: [],
  stageInstruction: null,
  stageEvent: null,
});

const uiSlice = createSlice({
  name: 'ui',
  initialState: createInitialState(),
  reducers: {
    setDirectorView(state, action: PayloadAction<UIState['directorView']>) {
      state.directorView = action.payload;
    },
    setSettingsOpen(state, action: PayloadAction<boolean>) {
      state.isSettingsOpen = action.payload;
    },
    setSlidePickerOpen(state, action: PayloadAction<boolean>) {
      state.isSlidePickerOpen = action.payload;
    },
    setConfirmStopOpen(state, action: PayloadAction<boolean>) {
      state.isConfirmStopOpen = action.payload;
    },
    setTimerLocked(state, action: PayloadAction<boolean>) {
      state.isTimerLocked = action.payload;
    },
    setRecordingStatus(state, action: PayloadAction<RecordingStatus>) {
      state.recordingStatus = action.payload;
    },
    setRecordingDetail(state, action: PayloadAction<ZoomRecordingDetail | null>) {
      state.recordingDetail = action.payload;
      if (action.payload?.state) {
        state.recordingStatus = action.payload.state;
      }
    },
    setZoomRecordingDir(state, action: PayloadAction<string | null>) {
      state.zoomRecordingDir = action.payload;
      state.recordingStatus = action.payload ? state.recordingStatus : 'idle';
    },
    setStageOverlay(state, action: PayloadAction<StageOverlay>) {
      state.stageOverlay = action.payload;
    },
    setStageInstruction(state, action: PayloadAction<UIState['stageInstruction']>) {
      state.stageInstruction = action.payload;
    },
    setStageEvent(state, action: PayloadAction<UIState['stageEvent']>) {
      state.stageEvent = action.payload;
    },
    clearStageInstruction(state) {
      state.stageInstruction = null;
    },
    clearStageEvent(state) {
      state.stageEvent = null;
    },
    pushToast: {
      reducer(state, action: PayloadAction<ToastMessage>) {
        state.toasts.push(action.payload);
      },
      prepare(message: Omit<ToastMessage, 'id' | 'createdAt'> & Partial<Pick<ToastMessage, 'id' | 'createdAt'>>) {
        const createdAt = message.createdAt ?? new Date().toISOString();
        return {
          payload: {
            id: message.id ?? generateId(),
            variant: message.variant,
            message: message.message,
            createdAt,
            expiresAt: message.expiresAt,
          } satisfies ToastMessage,
        };
      },
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
    clearToasts(state) {
      state.toasts = [];
    },
  },
});

export const {
  setDirectorView,
  setSettingsOpen,
  setSlidePickerOpen,
  setConfirmStopOpen,
  setTimerLocked,
  setRecordingStatus,
  setRecordingDetail,
  setZoomRecordingDir,
  setStageOverlay,
  setStageInstruction,
  setStageEvent,
  clearStageInstruction,
  clearStageEvent,
  pushToast,
  dismissToast,
  clearToasts,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;

export type UISliceState = UIState;

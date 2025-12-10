import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AppConfigState } from '../types';

const initialState: AppConfigState = {
  projectDir: null,
  zoomRecordingDir: null,
  projectCode: 'PROJECT',
  pairId: '001',
  segmentCounter: 0,
  lastChannel: 'A',
  timerMode: 'up',
  sessionLength: 360,
  startSilence: 3,
  endSilence: 5,
  intervalSeconds: 60,
  breakEveryMinutes: 30,
  breakLengthMinutes: 5,
  themeSourcePath: null,
  lastRenameAt: null,
  endWarnSec: 10,
  memoDisplaySec: 3,
  eventPillSec: 1,
  timecodeFps: 30,
  overtimeAlert: true,
  showProjectSelector: true,
};

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setConfig(state, action: PayloadAction<AppConfigState>) {
      Object.assign(state, action.payload);
    },
    mergeConfig(state, action: PayloadAction<Partial<AppConfigState>>) {
      Object.assign(state, action.payload);
    },
  },
});

export const { setConfig, mergeConfig } = configSlice.actions;

export const configReducer = configSlice.reducer;

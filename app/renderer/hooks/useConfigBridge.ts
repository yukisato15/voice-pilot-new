import { useEffect, useRef } from 'react';

import { useAppDispatch } from '@store/hooks';
import { setConfig } from '@store/slices/configSlice';
import { configureSession, setTimerMode } from '@store/slices/sessionSlice';
import { setZoomRecordingDir } from '@store/slices/uiSlice';

type AppConfig = {
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
  timerMode: 'up' | 'down';
  endWarnSec: number;
  memoDisplaySec: number;
  eventPillSec: number;
  timecodeFps: number;
  overtimeAlert: boolean;
  showProjectSelector: boolean;
  lastRenameAt: string | null;
};

const applySessionSettings = (
  dispatch: ReturnType<typeof useAppDispatch>,
  config: AppConfig,
) => {
  if (config.timerMode) {
    dispatch(setTimerMode(config.timerMode));
  }
  dispatch(
    configureSession({
      durationSec: config.sessionLength,
      talkStartSilenceSec: config.startSilence,
      talkEndSilenceSec: config.endSilence,
      intervalSec: config.intervalSeconds,
      breakEveryMinutes: config.breakEveryMinutes,
      breakLengthMinutes: config.breakLengthMinutes,
      endWarningSec: config.endWarnSec,
      memoDisplaySec: config.memoDisplaySec,
      eventPillSec: config.eventPillSec,
      timecodeFps: config.timecodeFps,
      overtimeAlertEnabled: config.overtimeAlert,
    }),
  );
};

export const useConfigBridge = (): void => {
  const dispatch = useAppDispatch();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!window?.directorAPI?.invoke || initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    const loadConfig = async () => {
      try {
        const config = (await window.directorAPI.invoke('config/get')) as AppConfig;
        dispatch(setConfig(config));
        dispatch(setZoomRecordingDir(config.zoomRecordingDir));
        applySessionSettings(dispatch, config);
      } catch (error) {
        console.error('Failed to load config', error);
      }
    };

    void loadConfig();
  }, [dispatch]);

  useEffect(() => {
    if (!window?.directorAPI?.on) {
      return;
    }

    const unsubscribe = window.directorAPI.on('config/changed', (_event, payload) => {
      const config = payload as AppConfig;
      dispatch(setConfig(config));
      dispatch(setZoomRecordingDir(config.zoomRecordingDir));
      applySessionSettings(dispatch, config);
    });

    return () => {
      unsubscribe?.();
    };
  }, [dispatch]);
};

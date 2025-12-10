import { useEffect, useRef } from 'react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import {
  configureSession,
  setSessionStatus,
  setTimerMode,
  startSession,
  stopSession,
  tickSession,
} from '@store/slices/sessionSlice';
import { setStageOverlay } from '@store/slices/uiSlice';

type TimerPhase = 'intro' | 'running' | 'outro' | 'completed';
type TimerMode = 'up' | 'down';

type TimerConfig = {
  durationSec: number;
  introSec: number;
  outroSec: number;
  intervalSec: number;
  breakLengthSec: number;
};

type TimerStartEvent = {
  phase: Extract<TimerPhase, 'intro' | 'running'>;
  config: TimerConfig;
  startedAt: string;
  mode?: TimerMode;
};

type TimerTickEvent = {
  phase: Extract<TimerPhase, 'running' | 'outro' | 'completed'>;
  elapsedSec: number;
  remainingSec: number;
  timestamp: string;
  mode?: TimerMode;
};

type TimerPhaseEvent = {
  phase: TimerPhase;
  remaining: number;
  mode?: TimerMode;
};

type TimerStopEvent = {
  reason: 'manual' | 'completed' | 'aborted';
  stoppedAt: string;
  elapsedSec: number;
  remainingSec: number;
  phase: TimerPhase | 'idle';
  mode?: TimerMode;
};

type TimerStatusResponse = {
  phase: TimerPhase | 'idle';
  config: TimerConfig | null;
  elapsedSec: number;
  remainingSec: number;
  startedAt: number | null;
  stoppedAt: number | null;
  introRemaining: number;
  mode?: TimerMode;
};

const secondsToMinutes = (seconds: number): number => Math.max(0, Math.round(seconds / 60));

export const useSessionTimerBridge = (): void => {
  const dispatch = useAppDispatch();
  const durationSec = useAppSelector((state) => state.session.durationSec);

  const durationRef = useRef(durationSec);
  const warningsRef = useRef({ minute: false, final: false });
  const finalCountdownRef = useRef<number | null>(null);

  useEffect(() => {
    durationRef.current = durationSec;
  }, [durationSec]);

  useEffect(() => {
    const api = window.directorAPI;
    if (!api?.on) {
      return;
    }

    const resetWarnings = () => {
      warningsRef.current = { minute: false, final: false };
      finalCountdownRef.current = null;
    };

    const issueWarnings = (remainingSec: number) => {
      if (!warningsRef.current.minute && remainingSec <= 60 && remainingSec > 10) {
        warningsRef.current.minute = true;
        dispatch(
          setStageOverlay({
            type: 'message',
            title: '残り1分',
            description: 'まとめに入りましょう。',
            ttlMs: 4000,
          }),
        );
      }

      if (!warningsRef.current.final && remainingSec <= 10) {
        warningsRef.current.final = true;
      }

      if (remainingSec <= 10) {
        const nextValue = Math.max(0, Math.ceil(remainingSec));
        if (finalCountdownRef.current !== nextValue) {
          finalCountdownRef.current = nextValue;
          dispatch(
            setStageOverlay({
              type: 'final',
              remaining: nextValue,
            }),
          );
        }
      }
    };

    const syncFromStatus = async () => {
      if (typeof api.invoke !== 'function') {
        return;
      }
      try {
        const status = (await api.invoke<TimerStatusResponse>('timer/status')) ?? null;
        if (!status) {
          return;
        }

        if (status.config) {
          durationRef.current = status.config.durationSec;
          dispatch(
            configureSession({
              durationSec: status.config.durationSec,
              talkStartSilenceSec: status.config.introSec,
              talkEndSilenceSec: status.config.outroSec,
              intervalSec: status.config.intervalSec,
              breakEveryMinutes: secondsToMinutes(status.config.intervalSec),
              breakLengthMinutes: secondsToMinutes(status.config.breakLengthSec),
            }),
          );
        }

        if (status.mode) {
          dispatch(setTimerMode(status.mode));
        }

        if (status.phase === 'idle') {
          return;
        }

        dispatch(
          startSession({
            startTimestamp: status.startedAt ? new Date(status.startedAt).toISOString() : undefined,
          }),
        );

        resetWarnings();

        if (status.phase === 'intro') {
          dispatch(setSessionStatus('countdown'));
          dispatch(
            tickSession({
              elapsedSec: 0,
              remainingSec: status.config?.durationSec ?? durationRef.current,
              phase: 'intro',
              countdownRemaining: status.introRemaining,
            }),
          );
          dispatch(
            setStageOverlay({
              type: 'countdown',
              remaining: Math.max(0, Math.ceil(status.introRemaining)),
            }),
          );
          return;
        }

        if (status.phase === 'completed') {
          dispatch(
            tickSession({
              elapsedSec: status.elapsedSec,
              remainingSec: 0,
              phase: 'completed',
            }),
          );
          dispatch(
            stopSession({
              endTimestamp: status.stoppedAt ? new Date(status.stoppedAt).toISOString() : undefined,
              status: 'completed',
            }),
          );
          dispatch(
            setStageOverlay({
              type: 'final',
              remaining: 0,
            }),
          );
          return;
        }

        dispatch(setSessionStatus('running'));
        dispatch(
          tickSession({
            elapsedSec: status.elapsedSec,
            remainingSec: status.remainingSec,
            phase: status.phase,
            countdownRemaining: status.phase === 'outro' ? status.remainingSec : undefined,
          }),
        );

        if (status.phase === 'outro') {
          dispatch(
            setStageOverlay({
              type: 'countdown',
              remaining: Math.max(0, Math.ceil(status.remainingSec)),
            }),
          );
        }

        issueWarnings(status.remainingSec);
      } catch (error) {
        console.error('timer status sync failed', error);
      }
    };

    void syncFromStatus();

    const handleTimerStart = (_event: Electron.IpcRendererEvent, raw: unknown) => {
      const payload = raw as TimerStartEvent | undefined;
      if (!payload || !payload.config) {
        return;
      }

      durationRef.current = payload.config.durationSec;
      resetWarnings();

      dispatch(
        configureSession({
          durationSec: payload.config.durationSec,
          talkStartSilenceSec: payload.config.introSec,
          talkEndSilenceSec: payload.config.outroSec,
          intervalSec: payload.config.intervalSec,
          breakEveryMinutes: secondsToMinutes(payload.config.intervalSec),
          breakLengthMinutes: secondsToMinutes(payload.config.breakLengthSec),
        }),
      );

      dispatch(startSession({ startTimestamp: payload.startedAt }));
      if (payload.mode) {
        dispatch(setTimerMode(payload.mode));
      }

      if (payload.phase === 'intro') {
        dispatch(
          tickSession({
            elapsedSec: 0,
            remainingSec: payload.config.durationSec,
            phase: 'intro',
            countdownRemaining: payload.config.introSec,
          }),
        );
        dispatch(
          setStageOverlay({
            type: 'countdown',
            remaining: Math.max(0, Math.ceil(payload.config.introSec)),
          }),
        );
      } else {
        dispatch(
          tickSession({
            elapsedSec: 0,
            remainingSec: payload.config.durationSec,
            phase: 'running',
          }),
        );
        dispatch(
          setStageOverlay({
            type: 'message',
            title: 'START',
            description: '収録を開始してください。',
          }),
        );
      }
    };

    const handleTimerTick = (_event: Electron.IpcRendererEvent, raw: unknown) => {
      const payload = raw as TimerTickEvent | undefined;
      if (!payload) {
        return;
      }
      if (payload.mode) {
        dispatch(setTimerMode(payload.mode));
      }
      dispatch(
        tickSession({
          elapsedSec: payload.elapsedSec,
          remainingSec: payload.remainingSec,
          phase: payload.phase,
          countdownRemaining: payload.phase === 'outro' ? payload.remainingSec : undefined,
        }),
      );

      issueWarnings(payload.remainingSec);
    };

    const handleTimerPhase = (_event: Electron.IpcRendererEvent, raw: unknown) => {
      const payload = raw as TimerPhaseEvent | undefined;
      if (!payload) {
        return;
      }

      const duration = durationRef.current;
      if (payload.mode) {
        dispatch(setTimerMode(payload.mode));
      }

      switch (payload.phase) {
        case 'intro':
          dispatch(setSessionStatus('countdown'));
          dispatch(
            tickSession({
              elapsedSec: 0,
              remainingSec: duration,
              phase: 'intro',
              countdownRemaining: payload.remaining,
            }),
          );
          dispatch(
            setStageOverlay({
              type: 'countdown',
              remaining: Math.max(0, Math.ceil(payload.remaining)),
            }),
          );
          issueWarnings(payload.remaining);
          break;
        case 'running':
          dispatch(setSessionStatus('running'));
          dispatch(
            tickSession({
              elapsedSec: Math.max(duration - payload.remaining, 0),
              remainingSec: payload.remaining,
              phase: 'running',
            }),
          );
          dispatch(
            setStageOverlay({
              type: 'message',
              title: 'START',
              description: '話し始めてください。',
            }),
          );
          break;
        case 'outro':
          dispatch(
            tickSession({
              elapsedSec: Math.max(duration - payload.remaining, 0),
              remainingSec: payload.remaining,
              phase: 'outro',
              countdownRemaining: payload.remaining,
            }),
          );
          dispatch(
            setStageOverlay({
              type: 'countdown',
              remaining: Math.max(0, Math.ceil(payload.remaining)),
            }),
          );
          issueWarnings(payload.remaining);
          break;
        case 'completed':
          dispatch(
            tickSession({
              elapsedSec: duration,
              remainingSec: 0,
              phase: 'completed',
            }),
          );
          break;
        default:
          break;
      }
    };

    const handleTimerStop = (_event: Electron.IpcRendererEvent, raw: unknown) => {
      const payload = raw as TimerStopEvent | undefined;
      if (!payload) {
        return;
      }

      if (payload.mode) {
        dispatch(setTimerMode(payload.mode));
      }

      dispatch(
        stopSession({
          endTimestamp: payload.stoppedAt,
          status: payload.reason === 'completed' ? 'completed' : 'idle',
        }),
      );

      resetWarnings();

      if (payload.reason === 'completed') {
        dispatch(
          setStageOverlay({
            type: 'final',
            remaining: 0,
          }),
        );
      } else if (payload.reason === 'manual') {
        dispatch(setStageOverlay(null));
      }
    };

    const offStart = api.on('timer/start', handleTimerStart);
    const offTick = api.on('timer/tick', handleTimerTick);
    const offPhase = api.on('timer/phase', handleTimerPhase);
    const offStop = api.on('timer/stop', handleTimerStop);

    return () => {
      offStart?.();
      offTick?.();
      offPhase?.();
      offStop?.();
    };
  }, [dispatch]);
};

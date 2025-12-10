import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeRecord } from "@common/ipc";

export interface SessionState {
  running: boolean;
  elapsedMs: number;
  durationMs: number;
  startTimestamp?: number;
  theme?: ThemeRecord | null;
  hintsUsed: number[];
  showIntroSilence: boolean;
  showOutroSilence: boolean;
}

const MS = {
  second: 1000,
  minute: 60 * 1000
};

export interface SessionController {
  state: SessionState;
  start: (theme: ThemeRecord, durationSeconds: number) => void;
  stop: () => void;
  reset: () => void;
  useHint: (index: number) => void;
  setTheme: (theme: ThemeRecord | null) => void;
}

export function useSessionController(): SessionController {
  const [state, setState] = useState<SessionState>({
    running: false,
    elapsedMs: 0,
    durationMs: 6 * MS.minute,
    theme: null,
    hintsUsed: [],
    showIntroSilence: false,
    showOutroSilence: false
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!state.running) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setState((prev) => {
        const nextElapsed = prev.elapsedMs + MS.second;
        const remaining = Math.max(prev.durationMs - nextElapsed, 0);
        return {
          ...prev,
          elapsedMs: nextElapsed,
          showIntroSilence: nextElapsed < 3 * MS.second,
          showOutroSilence: remaining <= 5 * MS.second
        };
      });
    }, MS.second);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.running]);

  const start = useCallback((theme: ThemeRecord, durationSeconds: number) => {
    setState({
      running: true,
      elapsedMs: 0,
      durationMs: durationSeconds * MS.second,
      startTimestamp: Date.now(),
      theme,
      hintsUsed: [],
      showIntroSilence: true,
      showOutroSilence: false
    });
  }, []);

  const stop = useCallback(() => {
    setState((prev) => ({
      ...prev,
      running: false,
      showIntroSilence: false,
      showOutroSilence: false
    }));
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      running: false,
      elapsedMs: 0,
      theme: null,
      hintsUsed: [],
      showIntroSilence: false,
      showOutroSilence: false
    }));
  }, []);

  const useHint = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      hintsUsed: prev.hintsUsed.includes(index)
        ? prev.hintsUsed
        : [...prev.hintsUsed, index]
    }));
  }, []);

  const setTheme = useCallback((theme: ThemeRecord | null) => {
    setState((prev) => ({ ...prev, theme }));
  }, []);

  return useMemo(
    () => ({
      state,
      start,
      stop,
      reset,
      useHint,
      setTheme
    }),
    [state, start, stop, reset, useHint, setTheme]
  );
}

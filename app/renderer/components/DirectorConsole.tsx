import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import type { AppConfigState, EventCategory, TimerMode } from '@store/types';
import {
  appendEventLog,
  buildEventLog,
  configureSession,
  setCurrentTheme,
  setSlideDeck,
  setSlideError,
  setSlideIndex,
  setSlideLoading,
  setThemeLibrary,
  setTimerMode,
  removeEventLog,
  updateEventLog,
  useHint,
  addDirectorNote,
  buildDirectorNote,
} from '@store/slices/sessionSlice';
import { mergeConfig } from '@store/slices/configSlice';
import { pushToast, setStageOverlay, setSettingsOpen, setStageInstruction, setStageEvent } from '@store/slices/uiSlice';
import { useZoomWatcher } from '@renderer/hooks/useZoomWatcher';
import TimingSettingsModal from '@components/TimingSettingsModal';
const formatTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const secs = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
};

const formatTimecodeDetailed = (seconds: number | undefined, fps = 30): string => {
  const total = Number.isFinite(seconds) ? Math.max(0, seconds ?? 0) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  const frames = Math.round((total % 1) * fps);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
};

type SlideLoadResult = {
  id: string;
  title: string;
  images: string[];
  sourcePath?: string;
  generatedAt: string;
  notes?: string;
};

type ThemeLoadResult = {
  themes: Array<{
    id: string;
    title: string;
    category?: string;
    roleAPrompt?: string;
    roleBPrompt?: string;
    hints?: string[];
    description?: string;
  }>;
  sourcePath?: string;
  format?: 'csv' | 'json';
  loadedAt?: string;
};

const fallbackId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `deck_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
};

const formatTimecode = (seconds: number): string => {
  const total = Math.max(0, seconds);
  const hh = String(Math.floor(total / 3600)).padStart(2, '0');
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(Math.floor(total % 60)).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const describeRecordingStatus = (status: string): string => {
  switch (status) {
    case 'idle':
      return '待機中';
    case 'recording':
      return '録画中';
    case 'converting':
      return '変換中';
    case 'stopped':
      return '停止';
    case 'waiting':
      return '待機中';
    case 'unknown':
      return '不明';
    default:
      return '未監視';
  }
};

type EventButtonConfig = {
  key: string;
  label: string;
  category: EventCategory;
  shortcut?: string;
  requiresNote?: boolean;
  accent?: string;
  description?: string;
  group: 'event' | 'cut';
};

const EVENT_BUTTONS: EventButtonConfig[] = [
  {
    key: 'PII',
    label: '個人情報',
    category: 'PII',
    shortcut: 'F1',
    accent: '#ef4444',
    description: '個人情報の発言',
    group: 'event',
  },
  {
    key: 'NOISE',
    label: '外部ノイズ',
    category: 'NOISE',
    shortcut: 'F2',
    accent: '#f97316',
    description: '周囲の雑音・外乱',
    group: 'event',
  },
  {
    key: 'MIC_A',
    label: '参加者A（左チャンネル）',
    category: 'MIC_A',
    shortcut: 'F3',
    accent: '#38bdf8',
    description: '参加者Aのマイクトラブル',
    group: 'event',
  },
  {
    key: 'MIC_B',
    label: '参加者B（右チャンネル）',
    category: 'MIC_B',
    shortcut: 'F4',
    accent: '#6366f1',
    description: '参加者Bのマイクトラブル',
    group: 'event',
  },
  {
    key: 'NET_DROP',
    label: '通信トラブル',
    category: 'NET_DROP',
    shortcut: 'F5',
    accent: '#facc15',
    description: '回線の遅延や途切れ',
    group: 'event',
  },
  {
    key: 'NG',
    label: 'NGワード',
    category: 'NG',
    shortcut: 'F6',
    accent: '#f472b6',
    description: 'NG発言',
    group: 'event',
  },
  {
    key: 'CUSTOM',
    label: 'カスタム',
    category: 'CUSTOM',
    requiresNote: true,
    accent: '#22d3ee',
    description: '任意メモ',
    group: 'event',
  },
  {
    key: 'CUT_IN',
    label: 'カット IN',
    category: 'CUT_IN',
    shortcut: '[',
    accent: '#10b981',
    description: 'この時刻からカット開始',
    group: 'cut',
  },
  {
    key: 'CUT_OUT',
    label: 'カット OUT',
    category: 'CUT_OUT',
    shortcut: ']',
    accent: '#0ea5e9',
    description: 'この時刻でカット終了',
    group: 'cut',
  },
];

const DirectorConsole: React.FC = () => {
  const dispatch = useAppDispatch();
  const session = useAppSelector((state) => state.session);
  const recordingStatus = useAppSelector((state) => state.ui.recordingStatus);
  const recordingDetail = useAppSelector((state) => state.ui.recordingDetail);
  const zoomDirectory = useAppSelector((state) => state.ui.zoomRecordingDir);
  const isTimingSettingsOpen = useAppSelector((state) => state.ui.isSettingsOpen);
  const appConfig = useAppSelector((state) => state.config);
  const timerMode = session.timerMode;
  const [themeError, setThemeError] = useState<string | null>(null);
  const [themeLoading, setThemeLoading] = useState(false);
  const slideDeck = session.slideDeck;
  const slideLoading = session.slideLoading;
  const slideError = session.slideError;
  const themes = session.availableThemes;
  const currentTheme = session.currentTheme;
  const themeSourcePath = session.themeSourcePath;
  const themeLoadedAt = session.themeLoadedAt;
  const themeSourceFormat = session.themeSourceFormat;
  const eventLog = session.eventLog;
  const memoHistory = useMemo(
    () =>
      [...session.directorNotes]
        .sort((a, b) => (a.relativeSeconds ?? 0) - (b.relativeSeconds ?? 0))
        .slice(-20),
    [session.directorNotes],
  );
  const { selectDirectory } = useZoomWatcher();
  const openTimingSettings = useCallback(() => {
    dispatch(setSettingsOpen(true));
  }, [dispatch]);

  const closeTimingSettings = useCallback(() => {
    dispatch(setSettingsOpen(false));
  }, [dispatch]);
  const [showRecordingWarning, setShowRecordingWarning] = useState(false);
  const warningTimerRef = useRef<number | null>(null);
const [memoSpeaker, setMemoSpeaker] = useState<'A' | 'B' | 'both'>('both');
const [memoText, setMemoText] = useState('');
const memoInputRef = useRef<HTMLInputElement | null>(null);
const [showSlides, setShowSlides] = useState(false);
  const updateConfigPartial = useCallback(
    async (partial: Partial<AppConfigState>) => {
      const next = { ...appConfig, ...partial };
      dispatch(mergeConfig(partial));
      dispatch(
        configureSession({
          durationSec: next.sessionLength,
          talkStartSilenceSec: next.startSilence,
          talkEndSilenceSec: next.endSilence,
          intervalSec: next.intervalSeconds,
          breakEveryMinutes: next.breakEveryMinutes,
          breakLengthMinutes: next.breakLengthMinutes,
          endWarningSec: next.endWarnSec,
          memoDisplaySec: next.memoDisplaySec,
          eventPillSec: next.eventPillSec,
          timecodeFps: next.timecodeFps,
          overtimeAlertEnabled: next.overtimeAlert,
        }),
      );
      try {
        await window.directorAPI?.invoke?.('config/update', partial);
      } catch (error) {
        console.error('設定の更新に失敗しました', error);
      }
    },
    [appConfig, dispatch],
  );

  const applyNumberSetting = useCallback(
    (key: keyof typeof appConfig, value: number, options?: { min?: number; max?: number; multiplier?: number }) => {
      if (!Number.isFinite(value)) {
        return;
      }
      const multiplier = options?.multiplier ?? 1;
      const raw = value * multiplier;
      const min = options?.min !== undefined ? options.min * multiplier : undefined;
      const max = options?.max !== undefined ? options.max * multiplier : undefined;
      const clamped = Math.round(
        Math.max(min ?? raw, Math.min(max ?? raw, raw)),
      );
      void updateConfigPartial({ [key]: clamped } as Partial<AppConfigState>);
    },
    [updateConfigPartial],
  );

  const introCountdown = session.countdown.mode === 'intro' ? Math.ceil(session.countdown.remaining ?? session.talkStartSilenceSec) : null;
  const outroCountdown = session.countdown.mode === 'outro' ? Math.ceil(session.countdown.remaining ?? session.talkEndSilenceSec) : null;

  const timeDisplay = useMemo(() => formatTime(session.remainingSec), [session.remainingSec]);
  const elapsedDisplay = useMemo(() => formatTime(session.elapsedSec), [session.elapsedSec]);

  const isActive = session.status === 'running' || session.status === 'countdown';
  const currentSlide = slideDeck?.images?.[session.slideIndex] ?? null;
  const totalSlides = slideDeck?.images.length ?? 0;
  const isRecording = recordingStatus === 'recording';

  const handleStart = useCallback(async () => {
    if (!window?.directorAPI?.invoke) {
      console.warn('directorAPI.invoke is not available');
      return;
    }
    try {
      await window.directorAPI.invoke('timer/start', {
        durationSec: session.durationSec,
        introSec: session.talkStartSilenceSec,
        outroSec: session.talkEndSilenceSec,
        intervalSec: session.intervalSec,
        breakLengthSec: session.breakLengthMinutes * 60,
      });
    } catch (error) {
      console.error('タイマーの開始に失敗しました', error);
    }
  }, [session.breakLengthMinutes, session.durationSec, session.intervalSec, session.talkEndSilenceSec, session.talkStartSilenceSec]);

  const handleStop = useCallback(async () => {
    if (!window?.directorAPI?.invoke) {
      return;
    }
    try {
      await window.directorAPI.invoke('timer/stop', { reason: 'manual' });
    } catch (error) {
      console.error('タイマーの停止に失敗しました', error);
    }
  }, []);

  const handleTimerModeChange = useCallback(
    async (mode: TimerMode) => {
      if (mode === timerMode) {
        return;
      }
      if (isActive) {
        dispatch(
          pushToast({
            variant: 'warning',
            message: 'タイマー停止中のみモードを切り替えできます。',
          }),
        );
        return;
      }
      try {
        const result = (await window.directorAPI?.invoke?.('timer/set-mode', { mode })) as
          | { success?: boolean }
          | undefined;
        if (result?.success === false) {
          dispatch(
            pushToast({
              variant: 'warning',
              message: 'タイマー停止中のみモードを切り替えできます。',
            }),
          );
          return;
        }
        dispatch(setTimerMode(mode));
        void updateConfigPartial({ timerMode: mode });
      } catch (error) {
        console.error('タイマーのモード切替に失敗しました', error);
        dispatch(
          pushToast({
            variant: 'error',
            message: 'タイマーのモード切替に失敗しました。',
          }),
        );
      }
    },
    [dispatch, isActive, timerMode, updateConfigPartial],
  );

  const handleTimingSettingsSave = useCallback(
    (values: Partial<AppConfigState>) => {
      updateConfigPartial(values);
    },
    [updateConfigPartial],
  );

  const handleMemoSubmit = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault();
      const text = memoText.trim();
      if (!text) {
        return;
      }
      const note = buildDirectorNote(text, {
        themeId: session.currentTheme?.id,
        speaker: memoSpeaker,
        relativeSeconds: session.elapsedSec,
      });
      dispatch(addDirectorNote(note));
      const displaySec = appConfig.memoDisplaySec ?? 3;
      dispatch(
        setStageInstruction({
          text,
          speaker: memoSpeaker === 'both' ? undefined : memoSpeaker,
          expiresAt: new Date(Date.now() + displaySec * 1000).toISOString(),
        }),
      );
      setMemoText('');
      if (memoInputRef.current) {
        memoInputRef.current.focus();
      }
    },
    [appConfig.memoDisplaySec, dispatch, memoSpeaker, memoText, session.currentTheme?.id, session.elapsedSec],
  );

  const handleSelectProjectDir = useCallback(async () => {
    if (!window?.directorAPI?.invoke) {
      return;
    }
    try {
      const result = (await window.directorAPI.invoke('project/select-dir')) as
        | { directory: string; config: Partial<AppConfigState> }
        | null;
      if (result?.directory) {
        updateConfigPartial({ projectDir: result.directory });
      }
    } catch (error) {
      console.error('プロジェクトフォルダの選択に失敗しました', error);
      dispatch(
        pushToast({
          variant: 'error',
          message: 'プロジェクトフォルダの選択に失敗しました。',
        }),
      );
    }
  }, [dispatch, updateConfigPartial]);

  useEffect(() => {
    const styleId = 'vp-director-pulse-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `@keyframes vp-pulse { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }`;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (session.status === 'running' || session.status === 'countdown') {
      if (warningTimerRef.current) {
        window.clearTimeout(warningTimerRef.current);
      }
      if (!isRecording) {
        warningTimerRef.current = window.setTimeout(() => {
          if (!isRecording) {
            setShowRecordingWarning(true);
            dispatch(
              pushToast({
                variant: 'warning',
                message: 'Zoomの録画ボタンが押されていません。録画状態を確認してください。',
              }),
            );
          }
        }, 10000);
      }
    } else {
      if (warningTimerRef.current) {
        window.clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
      setShowRecordingWarning(false);
    }

    if (isRecording) {
      if (warningTimerRef.current) {
        window.clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
      setShowRecordingWarning(false);
    }

    return () => {
      if (warningTimerRef.current) {
        window.clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
    };
  }, [dispatch, isRecording, session.status]);

  const loadThemes = useCallback(
    async (mode: 'dialog' | 'sample') => {
      if (!window?.directorAPI?.invoke) {
        setThemeError('renderer からテーマ読み込み API にアクセスできませんでした。');
        return;
      }

      setThemeLoading(true);
      setThemeError(null);

      try {
        const payload = mode === 'sample' ? { preset: 'sample' } : undefined;
        const result = await window.directorAPI.invoke<ThemeLoadResult | null>('themes/load', payload);

        if (!result) {
          return;
        }

        if (!Array.isArray(result.themes) || result.themes.length === 0) {
          setThemeError('テーマが取得できませんでした。');
          return;
        }

        const sanitizedThemes = result.themes.map((theme) => ({
          ...theme,
          hints: (theme.hints ?? []).filter((hint): hint is string => Boolean(hint?.trim?.())),
        }));

        dispatch(
          setThemeLibrary({
            themes: sanitizedThemes,
            sourcePath: result.sourcePath ?? null,
            format: result.format ?? null,
            loadedAt: result.loadedAt ?? new Date().toISOString(),
            autoSelectFirst: !currentTheme,
          }),
        );

        if (!currentTheme && sanitizedThemes.length > 0) {
          dispatch(setCurrentTheme(sanitizedThemes[0]));
        }

        if (result.sourcePath) {
          void updateConfigPartial({ themeSourcePath: result.sourcePath });
        }
      } catch (error) {
        console.error('テーマ読み込みに失敗しました', error);
        setThemeError('テーマの読み込みに失敗しました。');
      } finally {
        setThemeLoading(false);
      }
    },
    [currentTheme, dispatch, updateConfigPartial],
  );

  const handleThemeChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      if (!value) {
        dispatch(setCurrentTheme(null));
        return;
      }
      const next = themes.find((theme) => theme.id === value) ?? null;
      dispatch(setCurrentTheme(next));
      setThemeError(null);
    },
    [dispatch, themes],
  );

  const applySlideDeck = useCallback(
    (result: SlideLoadResult, overrides?: { title?: string; notes?: string }) => {
      dispatch(
        setSlideDeck({
          id: result.id ?? fallbackId(),
          title: result.title ?? overrides?.title ?? 'ガイダンススライド',
          images: result.images,
          sourcePath: result.sourcePath,
          generatedAt: result.generatedAt,
          notes: result.notes ?? overrides?.notes,
        }),
      );
      dispatch(setSlideIndex(0));
      dispatch(setSlideError(null));
    },
    [dispatch],
  );

  const handleLoadSlides = useCallback(async () => {
    if (!window?.directorAPI?.invoke) {
      dispatch(setSlideError('renderer から timer API にアクセスできませんでした。'));
      return;
    }

    dispatch(setSlideLoading(true));
    try {
      const result = await window.directorAPI.invoke<SlideLoadResult | null>('slides/load-sample');
      if (!result || !Array.isArray(result.images) || result.images.length === 0) {
        dispatch(setSlideDeck(null));
        dispatch(setSlideError('スライドが取得できませんでした。'));
        return;
      }

      applySlideDeck(result, { title: 'ガイダンススライド（サンプル）' });
      setShowSlides(true);
    } catch (error) {
      console.error('スライド読み込みに失敗しました', error);
      dispatch(setSlideDeck(null));
      dispatch(setSlideError('スライドの読み込みに失敗しました。'));
    } finally {
      dispatch(setSlideLoading(false));
    }
  }, [applySlideDeck, dispatch]);

  const handleImportSlides = useCallback(async () => {
    if (!window?.directorAPI?.invoke) {
      dispatch(setSlideError('renderer から timer API にアクセスできませんでした。'));
      return;
    }

    dispatch(setSlideLoading(true));
    try {
      const result = await window.directorAPI.invoke<SlideLoadResult | null>('slides/import-directory');
      if (!result) {
        dispatch(setSlideError(null));
        return;
      }
      if (!Array.isArray(result.images) || result.images.length === 0) {
        dispatch(setSlideDeck(null));
        dispatch(setSlideError('選択したフォルダに表示可能な画像が見つかりませんでした。'));
        return;
      }
      applySlideDeck(result, {
        notes: result.notes ?? 'フォルダから読み込んだスライドです。',
      });
      setShowSlides(true);
    } catch (error) {
      console.error('スライドインポートに失敗しました', error);
      const message = error instanceof Error ? error.message : 'スライドの読み込みに失敗しました。';
      dispatch(setSlideDeck(null));
      dispatch(setSlideError(message));
    } finally {
      dispatch(setSlideLoading(false));
    }
  }, [applySlideDeck, dispatch]);

  const handleToggleSlides = useCallback(() => {
    setShowSlides((prev) => !prev);
  }, []);

  const handlePrevSlide = useCallback(() => {
    dispatch(setSlideIndex(session.slideIndex - 1));
  }, [dispatch, session.slideIndex]);

  const handleNextSlide = useCallback(() => {
    dispatch(setSlideIndex(session.slideIndex + 1));
  }, [dispatch, session.slideIndex]);

  const handleHintNext = useCallback(() => {
    if (!currentTheme?.hints?.length) {
      dispatch(
        pushToast({
          variant: 'info',
          message: '利用可能なヒントがありません。',
        }),
      );
      return;
    }
    const hintIndices = new Set(session.hintsUsed);
    const nextIndex = currentTheme.hints.findIndex((_, idx) => !hintIndices.has(idx));
    if (nextIndex === -1) {
      dispatch(
        pushToast({
          variant: 'info',
          message: 'すべてのヒントを表示済みです。',
        }),
      );
      return;
    }
    const hint = currentTheme.hints[nextIndex];
    dispatch(useHint(nextIndex));
    const ttl = appConfig.memoDisplaySec ?? 3;
    dispatch(
      setStageInstruction({
        text: hint,
        speaker: 'both',
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      }),
    );
  }, [appConfig.memoDisplaySec, currentTheme, dispatch, session.hintsUsed]);

  const handleEventClick = useCallback(
    (button: EventButtonConfig) => {
      if (!window?.directorAPI?.invoke) {
        // Even without IPC, log locally so相対時刻を確保
      }

      let note: string | undefined;
      if (button.requiresNote) {
        const input = window.prompt('出来事の内容を入力してください', '');
        if (!input) {
          return;
        }
        note = input.trim();
      }

      const event = buildEventLog({
        category: button.category,
        label: button.description ?? button.label,
        note,
        shortcut: button.shortcut,
        themeId: currentTheme?.id,
        relativeSeconds: session.elapsedSec,
      });
      dispatch(appendEventLog(event));
      const ttl = appConfig.eventPillSec ?? 1;
      dispatch(
        setStageEvent({
          label: button.label,
          category: button.category,
          expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        }),
      );
    },
    [appConfig.eventPillSec, currentTheme?.id, dispatch, session.elapsedSec],
  );

  const handleEventEdit = useCallback(
    (eventId: string) => {
      const target = eventLog.find((entry) => entry.id === eventId);
      if (!target) {
        return;
      }
      const input = window.prompt('メモを編集', target.note ?? '');
      if (input === null) {
        return;
      }
      const updated = {
        ...target,
        note: input.trim() === '' ? undefined : input.trim(),
      };
      dispatch(updateEventLog(updated));
    },
    [dispatch, eventLog],
  );

  const handleEventDelete = useCallback(
    (eventId: string) => {
      const confirmed = window.confirm('この出来事ログを削除しますか？');
      if (!confirmed) {
        return;
      }
      dispatch(removeEventLog(eventId));
    },
    [dispatch],
  );

  const handleExportLogs = useCallback(async () => {
    if (!window?.directorAPI?.invoke) {
      return;
    }
    const payload = {
      events: session.eventLog,
      notes: session.directorNotes,
      theme: session.currentTheme,
    };
    try {
      type ExportResult =
        | {
            success: true;
            outputDir: string;
            usedProjectDir?: boolean;
            warning?: 'projectDirMissing' | 'projectDirInaccessible';
          }
        | {
            success: false;
            message?: string;
            warning?: 'projectDirMissing' | 'projectDirInaccessible';
          };
      const result = (await window.directorAPI.invoke('events/export', payload)) as
        | ExportResult
        | undefined;
      if (result?.success) {
        dispatch(
          setStageOverlay({
            type: 'message',
            title: 'エクスポート完了',
            description: result.outputDir ?? '',
            ttlMs: 2500,
          }),
        );
        const toastMessage = result.usedProjectDir
          ? `プロジェクトフォルダに保存しました: ${result.outputDir}`
          : `選択したフォルダに保存しました: ${result.outputDir}`;
        dispatch(
          pushToast({
            variant: result.usedProjectDir ? 'success' : 'info',
            message: toastMessage,
          }),
        );
        if (result.warning === 'projectDirMissing') {
          dispatch(
            pushToast({
              variant: 'warning',
              message: 'プロジェクトフォルダが未設定のため、保存先を毎回手動で選択します。',
            }),
          );
        } else if (result.warning === 'projectDirInaccessible') {
          dispatch(
            pushToast({
              variant: 'warning',
              message: '設定されたプロジェクトフォルダにアクセスできなかったため、保存先を手動選択しました。フォルダの存在と権限を確認してください。',
            }),
          );
        }
      } else if (result?.message) {
        window.alert(result.message);
      }
    } catch (error) {
      console.error('エクスポートに失敗しました', error);
      window.alert('ログのエクスポートに失敗しました。');
    }
  }, [dispatch, session.currentTheme, session.directorNotes, session.eventLog]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true')) {
        return;
      }
      const key = event.key.toLowerCase();
      const match = EVENT_BUTTONS.find((button) => button.shortcut && button.shortcut.toLowerCase() === key);
      if (match) {
        event.preventDefault();
        handleEventClick(match);
        return;
      }
      if (key === 'h') {
        event.preventDefault();
        handleHintNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [handleEventClick, handleHintNext]);

  return (
    <div
      style={{
        backgroundColor: '#1a1a1a',
        color: '#f5f5f5',
        minHeight: '100vh',
        padding: '24px',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: isRecording ? '#b91c1c' : '#374151',
          color: '#f9fafb',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '999px',
              backgroundColor: isRecording ? '#fef2f2' : '#d1d5db',
              animation: isRecording ? 'vp-pulse 1.2s infinite' : undefined,
            }}
          />
          <span>{isRecording ? 'REC 録画中' : 'REC 停止中'}</span>
        </div>
        {recordingDetail?.file && (
          <span style={{ fontSize: '12px', color: '#e5e7eb', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {recordingDetail.file}
          </span>
        )}
      </div>
      {showRecordingWarning && (
        <div
          style={{
            backgroundColor: '#dc2626',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          Zoom の録画が開始されていない可能性があります。赤い「録画中」表示を確認してください。
        </div>
      )}
      <header>
        <h1>Director Console</h1>
        <p>Zoom収録ディレクター補助ツール（MVP scaffolding）</p>
      </header>

      <section style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
        <div
          style={{
            backgroundColor: '#242424',
            padding: '16px',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <h2 style={{ margin: 0 }}>タイマー</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: '#d1d5db' }}>タイマー種別:</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
              <input
                type="radio"
                name="timer-mode"
                value="down"
                checked={timerMode === 'down'}
                onChange={() => handleTimerModeChange('down')}
              />
              カウントダウン
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
              <input
                type="radio"
                name="timer-mode"
                value="up"
                checked={timerMode === 'up'}
                onChange={() => handleTimerModeChange('up')}
              />
              カウントアップ
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
            <span style={{ fontSize: '64px', fontWeight: 600 }}>
              {introCountdown !== null ? introCountdown : timeDisplay}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px', color: '#b5b5b5' }}>
              <span>経過: {elapsedDisplay}</span>
              <span>状態: {session.status}</span>
              {outroCountdown !== null && <span>終了まで {outroCountdown}s</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" onClick={handleStart} disabled={isActive}>
              開始
            </button>
            <button type="button" onClick={handleStop} disabled={!isActive}>
              停止
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#d1d5db' }}>
            <span>終了告知: {appConfig.endWarnSec}秒</span>
            <span>休憩アラート: {appConfig.breakEveryMinutes}分</span>
            <span>タイムコード: {appConfig.timecodeFps}fps</span>
            <span>超過アラート: {appConfig.overtimeAlert ? 'ON' : 'OFF'}</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#242424',
            padding: '16px',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            保存先フォルダ（プロジェクト）
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '999px',
                backgroundColor: '#4b5563',
                fontSize: '12px',
                cursor: 'help',
              }}
              title="テーマやログ、エクスポートの保存先を指定してください。案件ごとの識別に使われます。"
            >
              ?
            </span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', color: '#d1d5db' }}>
              {appConfig.projectDir ?? '（未設定）'}
            </span>
            <button type="button" onClick={handleSelectProjectDir}>
              参照…
            </button>
            <button type="button" onClick={selectDirectory}>
              Zoom録音フォルダを選択
            </button>
          </div>
          {!appConfig.projectDir && (
            <div style={{ backgroundColor: '#7f1d1d', color: '#fee2e2', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}>
              保存先フォルダが未設定です。エクスポートやログ保存の前に設定してください。
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: '#b5b5b5' }}>
            <span>トーク長: {session.durationSec / 60}分</span>
            <span>スタート無音: {session.talkStartSilenceSec}秒 / エンド無音: {session.talkEndSilenceSec}秒</span>
            {zoomDirectory ? (
              <span>Zoom録音フォルダ: {zoomDirectory}</span>
            ) : (
              <span style={{ color: '#f87171' }}>Zoom録音フォルダを設定してください</span>
            )}
            <span>
              録画状態: {describeRecordingStatus(recordingStatus)}
              {recordingDetail?.bytes !== undefined && recordingDetail.bytes > 0
                ? ` (${(recordingDetail.bytes / (1024 * 1024)).toFixed(1)} MB)`
                : ''}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                プロジェクトコード
                <input
                  type="text"
                  value={appConfig.projectCode}
                  onChange={(event) => updateConfigPartial({ projectCode: event.target.value })}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                ペアID（参加者ペア）
                <input
                  type="text"
                  value={appConfig.pairId}
                  onChange={(event) => updateConfigPartial({ pairId: event.target.value })}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                次セグメント番号
                <input
                  type="number"
                  min={1}
                  value={appConfig.segmentCounter}
                  onChange={(event) => {
                    const raw = event.target.value;
                    if (raw === '') {
                      return;
                    }
                    updateConfigPartial({ segmentCounter: Math.max(1, Number(raw)) });
                  }}
                />
              </label>
            </div>
            {appConfig.lastRenameAt && (
              <span>最終リネーム: {new Date(appConfig.lastRenameAt).toLocaleString()}</span>
            )}
          </div>
        </div>
      </section>

      <section style={{ marginTop: '24px' }}>
        <h2>タイミング設定</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            backgroundColor: '#242424',
            padding: '16px',
            borderRadius: '12px',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            セッション長 (分)
            <input
              type="number"
              min={1}
              max={60}
              value={Math.round(appConfig.sessionLength / 60)}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === '') {
                  return;
                }
                applyNumberSetting('sessionLength', Number(raw), { min: 1, max: 90, multiplier: 60 });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            スタート無音 (秒)
            <input
              type="number"
              min={0}
              max={10}
              value={appConfig.startSilence}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === '') {
                  return;
                }
                applyNumberSetting('startSilence', Number(raw), { min: 0, max: 10 });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            エンド無音 (秒)
            <input
              type="number"
              min={0}
              max={20}
              value={appConfig.endSilence}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === '') {
                  return;
                }
                applyNumberSetting('endSilence', Number(raw), { min: 0, max: 20 });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            インターバル (秒)
            <input
              type="number"
              min={0}
              max={300}
              value={appConfig.intervalSeconds}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === '') {
                  return;
                }
                applyNumberSetting('intervalSeconds', Number(raw), { min: 0, max: 300 });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            休憩頻度 (分)
            <input
              type="number"
              min={10}
              max={120}
              value={appConfig.breakEveryMinutes}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === '') {
                  return;
                }
                applyNumberSetting('breakEveryMinutes', Number(raw), { min: 5, max: 180 });
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            休憩時間 (分)
            <input
              type="number"
              min={1}
              max={30}
              value={appConfig.breakLengthMinutes}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === '') {
                  return;
                }
                applyNumberSetting('breakLengthMinutes', Number(raw), { min: 1, max: 60 });
              }}
            />
          </label>
        </div>
      </section>

      <section style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="theme-select" style={{ fontSize: '13px', color: '#d1d5db', marginBottom: '4px' }}>
                テーマ選択
              </label>
              <select
                id="theme-select"
                style={{ minWidth: '280px' }}
                value={currentTheme?.id ?? ''}
                onChange={handleThemeChange}
                disabled={themes.length === 0}
              >
                <option value="">-- テーマを読み込んでください --</option>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>{`${theme.id} | ${theme.title}`}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => loadThemes('dialog')} disabled={themeLoading}>
              {themeLoading ? '読み込み中…' : 'テーマ読み込み…'}
            </button>
            <button type="button" onClick={() => loadThemes('sample')} disabled={themeLoading}>
              サンプル読み込み
            </button>
            <button type="button" onClick={handleHintNext} disabled={!currentTheme}>
              ヒントを出す (H)
            </button>
            <button type="button" onClick={openTimingSettings}>
              タイミング設定
            </button>
          </div>
          {themeSourcePath && (
            <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '6px' }}>
              読み込み元: {themeSourcePath}
              {themeSourceFormat ? ` (${themeSourceFormat.toUpperCase()})` : ''}
              {themeLoadedAt ? ` / ${new Date(themeLoadedAt).toLocaleString()}` : ''}
            </p>
          )}
          {appConfig.themeSourcePath && !themeSourcePath && (
            <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '6px' }}>
              設定に保存されたテーマ: {appConfig.themeSourcePath}
            </p>
          )}
          {themeError && (
            <p style={{ color: '#f87171', fontSize: '14px' }}>{themeError}</p>
          )}
          {currentTheme && (
            <div
              style={{
                backgroundColor: '#242424',
                padding: '16px',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '14px', color: '#b5b5b5' }}>
                {currentTheme.category && <span>カテゴリ: {currentTheme.category}</span>}
                {currentTheme.roleAPrompt && <span>ロールA: {currentTheme.roleAPrompt}</span>}
                {currentTheme.roleBPrompt && <span>ロールB: {currentTheme.roleBPrompt}</span>}
              </div>
              <div style={{ fontSize: '13px', color: '#d1d5db', lineHeight: 1.6 }}>
                {currentTheme.hints?.length ? 'ヒントは「ヒントを出す」ボタンで順次表示します。' : 'ヒントは未登録です。'}
              </div>
            </div>
          )}
        </div>
      </section>

      <section style={{ marginTop: '24px' }}>
        <h2>スライド</h2>
        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleToggleSlides} disabled={slideLoading}>
            {showSlides ? 'スライドを隠す' : 'スライドを表示'}
          </button>
          <button type="button" onClick={handleImportSlides} disabled={slideLoading}>
            {slideLoading ? '読み込み中…' : 'PPT/画像フォルダを読み込む…'}
          </button>
          <button type="button" onClick={handleLoadSlides} disabled={slideLoading}>
            {slideLoading ? '読み込み中…' : 'サンプルを読み込む'}
          </button>
        </div>
        {slideError && (
          <p style={{ color: '#f87171', fontSize: '14px', marginTop: '8px' }}>{slideError}</p>
        )}
        {showSlides && (
          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              gap: '24px',
              alignItems: 'center',
              backgroundColor: '#242424',
              padding: '16px',
              borderRadius: '12px',
              minHeight: '240px',
            }}
          >
            <div
              style={{
                width: '320px',
                height: '180px',
                backgroundColor: '#111',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {currentSlide ? (
                <img
                  src={currentSlide}
                  alt="Slide preview"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ color: '#777' }}>スライドが未読み込みです</span>
              )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '18px', fontWeight: 600 }}>
                  {slideDeck?.title ?? 'ガイダンススライド'}
                </span>
                <span style={{ fontSize: '14px', color: '#b5b5b5' }}>
                  {totalSlides > 0
                    ? `スライド ${session.slideIndex + 1} / ${totalSlides}`
                    : 'スライドがありません'}
                </span>
                {slideDeck?.notes && (
                  <span style={{ fontSize: '13px', color: '#a1a1a1' }}>{slideDeck.notes}</span>
                )}
                {slideDeck?.sourcePath && (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>読み込み元: {slideDeck.sourcePath}</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handlePrevSlide}
                  disabled={session.slideIndex <= 0 || totalSlides === 0}
                >
                  前へ
                </button>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  disabled={session.slideIndex >= totalSlides - 1 || totalSlides === 0}
                >
                  次へ
                </button>
              </div>
              {totalSlides === 0 && (
                <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.6 }}>
                  PowerPoint からは「ファイル &gt; エクスポート &gt; PNG/JPEG」でスライド画像を作成し、
                  フォルダを選択して読み込んでください。画像はファイル名順に並びます（例: slide_01.png）。
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section style={{ marginTop: '24px' }}>
        <h2>出来事</h2>
        <div
          style={{
            display: 'grid',
            gap: '12px',
            backgroundColor: '#242424',
            padding: '16px',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {EVENT_BUTTONS.filter((config) => config.group === 'event').map((config) => (
              <button
                key={config.key}
                type="button"
                onClick={() => handleEventClick(config)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: config.accent ?? '#6b7280',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {config.label}
                {config.shortcut ? ` (${config.shortcut})` : ''}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {EVENT_BUTTONS.filter((config) => config.group === 'cut').map((config) => (
              <button
                key={config.key}
                type="button"
                onClick={() => handleEventClick(config)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: config.accent ?? '#6b7280',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {config.label}
                {config.shortcut ? ` (${config.shortcut})` : ''}
              </button>
            ))}
          </div>
        </div>
        {eventLog.length > 0 ? (
          <div
            style={{
              marginTop: '16px',
              backgroundColor: '#111827',
              borderRadius: '12px',
              padding: '16px',
              maxHeight: '220px',
              overflowY: 'auto',
              fontSize: '13px',
            }}
          >
            {[...eventLog]
              .sort((a, b) => (a.relativeSeconds ?? 0) - (b.relativeSeconds ?? 0))
              .map((event) => {
                const timeLabel = formatTimecodeDetailed(event.relativeSeconds ?? session.elapsedSec, appConfig.timecodeFps);
                const meta = EVENT_BUTTONS.find((button) => button.category === event.category);
                return (
                  <div
                    key={event.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 1fr auto',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <span style={{ color: '#9ca3af' }}>{timeLabel}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ color: '#f3f4f6', fontWeight: 600 }}>{meta?.label ?? event.label}</span>
                      {(meta?.description || event.note) && (
                        <span style={{ color: '#d1d5db' }}>{event.note ?? meta?.description}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleEventEdit(event.id)}
                        style={{ background: '#374151', color: '#fafafa', border: 'none', borderRadius: '6px', padding: '4px 8px' }}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEventDelete(event.id)}
                        style={{ background: '#b91c1c', color: '#fafafa', border: 'none', borderRadius: '6px', padding: '4px 8px' }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '12px' }}>出来事はまだ記録されていません。</p>
        )}
      </section>

      <section style={{ marginTop: '24px' }}>
        <h2>指示メモ</h2>
        <form
          onSubmit={handleMemoSubmit}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', backgroundColor: '#242424', padding: '16px', borderRadius: '12px' }}
        >
          <select value={memoSpeaker} onChange={(event) => setMemoSpeaker(event.target.value as 'A' | 'B' | 'both')}>
            <option value="A">@参加者A</option>
            <option value="B">@参加者B</option>
            <option value="both">@両方</option>
          </select>
          <input
            ref={memoInputRef}
            type="text"
            value={memoText}
            onChange={(event) => setMemoText(event.target.value)}
            placeholder="指示テキストを入力 (Enterで追加)"
            style={{ flex: '1 1 280px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #4b5563', backgroundColor: '#1f2937', color: '#f3f4f6' }}
          />
          <button type="submit" style={{ padding: '8px 16px', borderRadius: '8px' }}>
            追加
          </button>
        </form>
        <p style={{ marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>メモは共有画面に表示され、CSVにも記録されます。</p>
        {memoHistory.length > 0 && (
          <div
            style={{
              marginTop: '12px',
              backgroundColor: '#111827',
              borderRadius: '12px',
              padding: '16px',
              maxHeight: '180px',
              overflowY: 'auto',
              fontSize: '13px',
            }}
          >
            {memoHistory.map((note) => {
              const timeLabel = formatTimecodeDetailed(note.relativeSeconds ?? session.elapsedSec, appConfig.timecodeFps);
              const speakerLabel = note.speaker === 'A' ? '参加者A' : note.speaker === 'B' ? '参加者B' : '両方';
              return (
                <div key={note.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 120px', gap: '12px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: '#9ca3af' }}>{timeLabel}</span>
                  <span style={{ color: '#f3f4f6' }}>{note.body}</span>
                  <span style={{ color: '#d1d5db' }}>{speakerLabel}</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          <button type="button" onClick={handleExportLogs}>
            エクスポート
          </button>
        </div>
      </section>
      <TimingSettingsModal
        open={isTimingSettingsOpen}
        config={appConfig}
        onClose={closeTimingSettings}
        onSave={handleTimingSettingsSave}
      />
    </div>
  );
};

export default DirectorConsole;

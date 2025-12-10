import React, { useEffect, useMemo } from 'react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import { clearStageEvent, clearStageInstruction, setStageOverlay } from '@store/slices/uiSlice';

const formatTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const secs = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
};

const SharedStage: React.FC = () => {
  const dispatch = useAppDispatch();
  const session = useAppSelector((state) => state.session);
  const overlay = useAppSelector((state) => state.ui.stageOverlay);
  const currentSlide = session.slideDeck?.images?.[session.slideIndex] ?? null;
  const timerMode = session.timerMode;
  const recordingStatus = useAppSelector((state) => state.ui.recordingStatus);
  const overtime = timerMode === 'up' && session.overtimeAlertEnabled && session.elapsedSec >= session.durationSec;
  const stageRecording = recordingStatus === 'recording';
  const stageInstruction = useAppSelector((state) => state.ui.stageInstruction);
  const stageEvent = useAppSelector((state) => state.ui.stageEvent);

  useEffect(() => {
    if (overlay?.type === 'message') {
      const ttl = overlay.ttlMs ?? 2000;
      const timer = window.setTimeout(() => {
        dispatch(setStageOverlay(null));
      }, ttl);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [dispatch, overlay]);

  useEffect(() => {
    if (!stageInstruction) {
      return undefined;
    }
    const expiresAt = new Date(stageInstruction.expiresAt).getTime();
    const delay = Math.max(0, expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      dispatch(clearStageInstruction());
    }, delay);
    return () => window.clearTimeout(timer);
  }, [dispatch, stageInstruction]);

  useEffect(() => {
    if (!stageEvent) {
      return undefined;
    }
    const expiresAt = new Date(stageEvent.expiresAt).getTime();
    const delay = Math.max(0, expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      dispatch(clearStageEvent());
    }, delay);
    return () => window.clearTimeout(timer);
  }, [dispatch, stageEvent]);

  const finalOverlay = overlay?.type === 'final' ? overlay : null;

  const countdownValue = useMemo(() => {
    if (overlay?.type === 'final') {
      return Math.max(0, Math.ceil(overlay.remaining));
    }
    if (overlay?.type === 'countdown') {
      return Math.max(0, Math.ceil(overlay.remaining));
    }
    if (timerMode === 'down' && (session.countdown.mode === 'intro' || session.countdown.mode === 'outro')) {
      return Math.max(0, Math.ceil(session.countdown.remaining ?? 0));
    }
    return null;
  }, [overlay, session.countdown.mode, session.countdown.remaining, timerMode]);

  const timerDisplay = useMemo(() => {
    if (overlay?.type === 'message') {
      return overlay.title;
    }
    if (overlay?.type === 'final') {
      return overlay.remaining <= 0 ? 'STOP' : Math.max(0, Math.ceil(overlay.remaining)).toString();
    }
    if (countdownValue !== null) {
      return countdownValue.toString();
    }
    if (timerMode === 'down') {
      return formatTime(session.remainingSec);
    }
    return formatTime(session.elapsedSec);
  }, [countdownValue, overlay, session.elapsedSec, session.remainingSec, timerMode]);

  const subMessage = useMemo(() => {
    if (overlay?.type === 'message') {
      return {
        title: overlay.description ?? '',
        description: '',
      };
    }
    if (overlay?.type === 'final') {
      return {
        title: overlay.remaining <= 0 ? '録音を停止してください' : '終了まであとわずかです',
        description: overlay.remaining > 0 ? `残り ${overlay.remaining} 秒` : '',
      };
    }

    if (session.currentTheme) {
      return {
        title: session.currentTheme.title,
        description: session.currentTheme.category ?? '',
      };
    }

    return {
      title: session.status === 'idle' ? '準備中...' : 'テーマ未選択',
      description: '',
    };
  }, [overlay, session.currentTheme, session.status]);

  const rolePrompts = useMemo(() => {
    if (!session.currentTheme) {
      return [] as Array<{ role: string; text: string }>;
    }
    const prompts: Array<{ role: string; text: string }> = [];
    if (session.currentTheme.roleAPrompt) {
      prompts.push({ role: 'A', text: session.currentTheme.roleAPrompt });
    }
    if (session.currentTheme.roleBPrompt) {
      prompts.push({ role: 'B', text: session.currentTheme.roleBPrompt });
    }
    return prompts;
  }, [session.currentTheme]);

  const hintList = session.currentTheme?.hints ?? [];
  const usedHintSet = useMemo(() => new Set(session.hintsUsed), [session.hintsUsed]);
  const lastHintIndex = session.lastHintIndex ?? -1;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#000',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '32px',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        position: 'relative',
        padding: '48px 24px',
      }}
    >
      {currentSlide && (
        <img
          src={currentSlide}
          alt="共有スライド"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: overlay?.type === 'message' ? 0.45 : 0.85,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
          }}
        />
      )}
      {stageInstruction && (
        <div
          style={{
            position: 'absolute',
            top: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(59, 130, 246, 0.55))',
            padding: '16px 28px',
            borderRadius: '28px',
            zIndex: 3,
            fontSize: '24px',
            fontWeight: 600,
            maxWidth: '78vw',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 18px 45px rgba(8, 47, 73, 0.35)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(148, 163, 184, 0.4)',
            color: '#f9fafb',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              fontSize: '14px',
              letterSpacing: '1px',
              color: '#facc15',
            }}
          >
            <span style={{ textTransform: 'uppercase' }}>指示</span>
            {stageInstruction.speaker && (
              <span style={{ color: '#bfdbfe' }}>
                {stageInstruction.speaker === 'A'
                  ? '参加者A'
                  : stageInstruction.speaker === 'B'
                  ? '参加者B'
                  : '全員'}
              </span>
            )}
            {stageInstruction.expiresAt && (
              <span style={{ color: '#94a3b8' }}>自動で消えます</span>
            )}
          </div>
          <div
            style={{
              maxHeight: '38vh',
              overflowY: 'auto',
              paddingRight: '6px',
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {stageInstruction.text}
          </div>
        </div>
      )}
      {stageEvent && (
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            left: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(234, 88, 12, 0.88)',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: '18px',
            zIndex: 3,
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            boxShadow: '0 12px 30px rgba(127, 29, 29, 0.35)',
            maxWidth: '320px',
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
          }}
        >
          <span
            style={{
              display: 'block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              boxShadow: '0 0 10px rgba(255,255,255,0.5)',
            }}
          />
          {stageEvent.label}
        </div>
      )}
      {finalOverlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            background: finalOverlay.remaining > 0 ? 'rgba(185, 28, 28, 0.65)' : 'rgba(239, 68, 68, 0.82)',
            backdropFilter: 'blur(4px)',
            zIndex: 5,
            pointerEvents: 'none',
            padding: '48px 24px',
            textShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          }}
        >
          <div
            style={{
              fontSize: finalOverlay.remaining > 0 ? '180px' : '140px',
              fontWeight: 800,
              letterSpacing: finalOverlay.remaining > 0 ? '12px' : '8px',
              color: '#fff5f5',
            }}
          >
            {finalOverlay.remaining > 0 ? finalOverlay.remaining : 'STOP'}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: 600,
              color: '#fee2e2',
              letterSpacing: '2px',
            }}
          >
            {finalOverlay.remaining > 0 ? '録音を停止する準備をしてください' : '録音を停止してください'}
          </p>
        </div>
      )}
      <div
      style={{
        fontSize: countdownValue !== null || overlay?.type === 'message' ? '128px' : '96px',
        fontWeight: 700,
        letterSpacing: '4px',
        textShadow: '0 0 24px rgba(255, 255, 255, 0.4)',
        color: overtime ? '#fca5a5' : '#ffffff',
        zIndex: 2,
      }}
    >
      {timerDisplay}
    </div>

      <div style={{ zIndex: 2, fontSize: '20px', color: '#e5e7eb' }}>
        {timerMode === 'down' ? `残り ${formatTime(session.remainingSec)}` : `経過 ${formatTime(session.elapsedSec)}`}
      </div>

      <div style={{ maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 2 }}>
        {subMessage.title && (
          <h1 style={{ fontSize: '42px', margin: 0 }}>{subMessage.title}</h1>
        )}
        {subMessage.description && (
          <p style={{ fontSize: '22px', margin: 0, color: '#d0d0d0' }}>{subMessage.description}</p>
        )}
      </div>

      {rolePrompts.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '32px',
            zIndex: 2,
            backgroundColor: 'rgba(17, 24, 39, 0.75)',
            padding: '16px 24px',
            borderRadius: '12px',
            backdropFilter: 'blur(4px)',
          }}
        >
          {rolePrompts.map((prompt) => (
            <div key={prompt.role} style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: '18px', color: '#facc15', letterSpacing: '1px' }}>ROLE {prompt.role}</p>
              <p style={{ margin: '4px 0 0', fontSize: '20px', color: '#f9fafb' }}>{prompt.text}</p>
            </div>
          ))}
        </div>
      )}

      {hintList.length > 0 && (
        <aside
          style={{
            position: 'absolute',
            right: '32px',
            top: '120px',
            width: '320px',
            backgroundColor: 'rgba(31, 41, 55, 0.85)',
            padding: '20px 22px',
            borderRadius: '18px',
            zIndex: 3,
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: '65vh',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '18px', color: '#facc15', letterSpacing: '1px' }}>ヒント</h3>
          <ol
            style={{
              margin: 0,
              padding: 0,
              listStylePosition: 'inside',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              overflowY: 'auto',
              scrollbarWidth: 'thin',
            }}
          >
            {hintList.map((hint, index) => {
              const used = usedHintSet.has(index);
              const isLatest = index === lastHintIndex;
              return (
                <li
                  key={index}
                  style={{
                    listStyle: 'none',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    backgroundColor: isLatest ? 'rgba(250, 204, 21, 0.35)' : used ? 'rgba(59,130,246,0.2)' : 'transparent',
                    color: used ? '#e5e7eb' : '#f9fafb',
                    border: used ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(148,163,184,0.2)',
                    fontSize: '14px',
                    lineHeight: 1.5,
                  }}
                >
                  {index + 1}. {hint}
                </li>
              );
            })}
          </ol>
        </aside>
      )}

      <div style={{ display: 'flex', gap: '24px', fontSize: '18px', color: '#bbbbbb', zIndex: 2 }}>
        <span>状態: {session.status}</span>
        <span>経過: {formatTime(session.elapsedSec)}</span>
        {currentSlide && (
          <span>
            スライド: {session.slideIndex + 1}/{session.slideDeck?.images.length ?? 1}
          </span>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: stageRecording ? 'rgba(220, 38, 38, 0.85)' : 'rgba(75, 85, 99, 0.85)',
          padding: '8px 18px',
          borderRadius: '999px',
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '0.5px',
          zIndex: 3,
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#fff',
            animation: stageRecording ? 'vp-pulse 1.2s infinite' : undefined,
          }}
        />
        <span>{stageRecording ? '録画中' : '停止中'}</span>
      </div>
    </div>
  );
};

export default SharedStage;

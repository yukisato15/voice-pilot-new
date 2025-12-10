import React, { useEffect, useState } from 'react';

import type { AppConfigState } from '@store/types';

type TimingSettingsModalProps = {
  open: boolean;
  config: AppConfigState;
  onClose: () => void;
  onSave: (values: Partial<AppConfigState>) => void;
};

const fpsOptions = [30, 29.97, 25];

const TimingSettingsModal: React.FC<TimingSettingsModalProps> = ({ open, config, onClose, onSave }) => {
  const [totalMinutes, setTotalMinutes] = useState(Math.round(config.sessionLength / 60));
  const [endWarnSec, setEndWarnSec] = useState(config.endWarnSec);
  const [breakMinutes, setBreakMinutes] = useState(config.breakEveryMinutes);
  const [fps, setFps] = useState(config.timecodeFps);
  const [memoDisplay, setMemoDisplay] = useState(config.memoDisplaySec);
  const [eventPill, setEventPill] = useState(config.eventPillSec);
  const [overtimeAlert, setOvertimeAlert] = useState(config.overtimeAlert);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTotalMinutes(Math.round(config.sessionLength / 60));
    setEndWarnSec(config.endWarnSec);
    setBreakMinutes(config.breakEveryMinutes);
    setFps(config.timecodeFps);
    setMemoDisplay(config.memoDisplaySec);
    setEventPill(config.eventPillSec);
    setOvertimeAlert(config.overtimeAlert);
  }, [config, open]);

  if (!open) {
    return null;
  }

  const handleSave = () => {
    const payload: Partial<AppConfigState> = {
      sessionLength: Math.max(1, totalMinutes) * 60,
      endWarnSec: Math.max(1, endWarnSec),
      breakEveryMinutes: Math.max(0, breakMinutes),
      timecodeFps: fps,
      memoDisplaySec: Math.max(1, memoDisplay),
      eventPillSec: Math.max(1, eventPill),
      overtimeAlert,
    };
    onSave(payload);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: '520px',
          maxWidth: '90vw',
          backgroundColor: '#1f2937',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
          color: '#f9fafb',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <header>
          <h2 style={{ margin: 0, fontSize: '20px' }}>タイミング設定</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#d1d5db' }}>
            セッション時間と各種アラートの閾値をここで設定してください。（保存を押すまで適用されません）
          </p>
        </header>

        <div style={{ display: 'grid', gap: '16px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            総時間 (分)
            <input
              type="number"
              min={1}
              value={totalMinutes}
              onChange={(event) => setTotalMinutes(Number(event.target.value))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            終了カウント閾値 (秒)
            <input
              type="number"
              min={1}
              value={endWarnSec}
              onChange={(event) => setEndWarnSec(Number(event.target.value))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            休憩アラート (分)
            <input
              type="number"
              min={0}
              value={breakMinutes}
              onChange={(event) => setBreakMinutes(Number(event.target.value))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            タイムコード FPS
            <select value={fps} onChange={(event) => setFps(Number(event.target.value))}>
              {fpsOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            メモ表示時間 (秒)
            <input
              type="number"
              min={1}
              value={memoDisplay}
              onChange={(event) => setMemoDisplay(Number(event.target.value))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            イベントピル表示時間 (秒)
            <input
              type="number"
              min={1}
              value={eventPill}
              onChange={(event) => setEventPill(Number(event.target.value))}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={overtimeAlert}
              onChange={(event) => setOvertimeAlert(event.target.checked)}
            />
            カウントアップ時に超過アラートを表示する
          </label>
        </div>

        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#374151', color: '#f3f4f6' }}>
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#f9fafb', fontWeight: 600 }}
          >
            保存
          </button>
        </footer>
      </div>
    </div>
  );
};

export default TimingSettingsModal;

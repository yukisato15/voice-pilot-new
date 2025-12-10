import React, { useEffect, useState } from "react";
import { AppConfig } from "@common/config";
import {
  RecordingStatus,
  ThemeHashIndexResult,
  ThemeRecord,
  ThemeSelectResult,
  SelectDirectoryResult,
  ConsentSubmitResult,
  ZoomDuoAPI
} from "@common/ipc";
import {
  ConsentModal,
  ConsentFormState
} from "./components/ConsentModal";
import { SessionControls } from "./components/SessionControls";
import { useSessionController } from "./hooks/useSessionController";

declare global {
  interface Window {
    zoomDuo: ZoomDuoAPI;
  }
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<RecordingStatus>({ state: "idle" });
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [themesSummary, setThemesSummary] = useState<ThemeHashIndexResult | null>(
    null
  );
  const [themesError, setThemesError] = useState<string | null>(null);
  const [monitorMessage, setMonitorMessage] = useState<string | null>(null);
  const [availableThemes, setAvailableThemes] = useState<ThemeRecord[]>([]);
  const session = useSessionController();
  const {
    state: sessionState,
    start: startSession,
    stop: stopSession,
    reset: resetSession,
    setTheme: setSessionTheme
  } = session;
  const [consentVisible, setConsentVisible] = useState(false);
  const [consentForm, setConsentForm] = useState<ConsentFormState>({
    participantName: "",
    meetingId: "",
    agreeHeadphones: false,
    agreeLocalRecording: false,
    agreeUpload: false
  });
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [lastConsent, setLastConsent] = useState<{
    timestamp: string;
    sessionDir?: string;
    path?: string;
  } | null>(null);

  const handleSelectZoomDir = async () => {
    if (!window.zoomDuo || typeof window.zoomDuo.invoke !== "function") {
      return;
    }
    const result = await window.zoomDuo.invoke<SelectDirectoryResult>(
      "zoom/select-recording-dir"
    );
    if (!result || result.canceled) {
      return;
    }

    try {
      await window.zoomDuo.invoke("config/update", {
        path: "zoom.recordingPath",
        value: result.path ?? ""
      });
      setMonitorMessage(`選択フォルダ: ${result.path ?? ""}`);
    } catch (error) {
      console.error("Failed to update zoom directory", error);
    }
  };

  const handleSelectCsv = async () => {
    if (!window.zoomDuo || typeof window.zoomDuo.invoke !== "function") {
      return;
    }
    const result = await window.zoomDuo.invoke<ThemeSelectResult>(
      "themes/select-csv"
    );
    if (!result || result.canceled) {
      return;
    }

    const nextThemes = {
      ...(config?.themes ?? { csv_path: "" }),
      csv_path: result.path ?? ""
    };

    try {
      await window.zoomDuo.invoke("config/update", {
        path: "themes",
        value: nextThemes
      });
    } catch (error) {
      console.error("Failed to update config", error);
    }
  };

  const handleStartMonitor = async () => {
    if (!window.zoomDuo || typeof window.zoomDuo.invoke !== "function") {
      return;
    }
    try {
      const result = await window.zoomDuo.invoke<{
        status: string;
        message?: string;
        path?: string;
      }>("zoom/start-monitor");

      if (result?.status === "error") {
        setMonitorMessage(result.message ?? "監視開始に失敗しました");
      } else {
        setMonitorMessage(
          `監視中: ${result?.path ?? config?.zoom_recording_dir ?? ""}`
        );
      }
    } catch (error) {
      setMonitorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const openConsentModal = () => {
    if (config?.consent) {
      const completed = config.consent.completed ?? false;
      setConsentForm({
        participantName: config.consent.participant_name ?? "",
        meetingId: config.consent.meeting_id ?? "",
        agreeHeadphones: completed,
        agreeLocalRecording: completed,
        agreeUpload: completed
      });
    }
    setConsentError(null);
    setConsentVisible(true);
  };

  const handleStopMonitor = async () => {
    if (!window.zoomDuo || typeof window.zoomDuo.invoke !== "function") {
      return;
    }
    try {
      await window.zoomDuo.invoke<{ status: string }>("zoom/stop-monitor");
      setMonitorMessage("監視を停止しました");
    } catch (error) {
      setMonitorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const handleConsentSubmit = async () => {
    if (!window.zoomDuo || typeof window.zoomDuo.invoke !== "function") {
      return;
    }
    setConsentLoading(true);
    setConsentError(null);
    const timestamp = new Date().toISOString();

    try {
      const result = await window.zoomDuo.invoke<ConsentSubmitResult>(
        "consent/submit",
        {
          participant_name: consentForm.participantName,
          meeting_id: consentForm.meetingId,
          timestamp,
          checks: {
            headphones: consentForm.agreeHeadphones,
            local_recording: consentForm.agreeLocalRecording,
            upload_agreement: consentForm.agreeUpload
          }
        }
      );

      if (result?.status === "ok") {
        const submittedAt = result.submitted_at ?? timestamp;
        const consentConfig = {
          completed: true,
          participant_name: consentForm.participantName,
          meeting_id: consentForm.meetingId,
          last_session_dir: result.session_dir ?? "",
          last_pdf_path: result.path ?? "",
          last_submitted_at: submittedAt
        };
        await window.zoomDuo.invoke("config/update", {
          path: "consent",
          value: consentConfig
        });
        setConfig((prev) =>
          prev
            ? {
                ...prev,
                consent: consentConfig
              }
            : prev
        );
        setLastConsent({
          timestamp: submittedAt,
          sessionDir: result.session_dir,
          path: result.path ?? ""
        });
        setConsentVisible(false);
      } else {
        setConsentError("同意書の生成に失敗しました。");
      }
    } catch (error) {
      setConsentError(error instanceof Error ? error.message : String(error));
    } finally {
      setConsentLoading(false);
    }
  };

  useEffect(() => {
    if (!window.zoomDuo || typeof window.zoomDuo.invoke !== "function") {
      return;
    }
    window.zoomDuo.invoke<AppConfig>("config/get").then((cfg) => {
      setConfig(cfg);
      const consent = cfg.consent;
      if (consent?.completed) {
        setLastConsent({
          timestamp: consent.last_submitted_at ?? "",
          sessionDir: consent.last_session_dir,
          path: consent.last_pdf_path
        });
      }
    });

    if (!window.zoomDuo || typeof window.zoomDuo.on !== "function") {
      return () => void 0;
    }

    const offStatus = window.zoomDuo.on("recording/status", (_event, payload) => {
      setStatus(payload as RecordingStatus);
    });

    const offConfig = window.zoomDuo.on("config/changed", (_event, payload) => {
      if (!payload) {
        return;
      }
      const cfg = payload as AppConfig;
      setConfig(cfg);
      const completed = cfg.consent?.completed ?? false;
      setConsentForm({
        participantName: cfg.consent?.participant_name ?? "",
        meetingId: cfg.consent?.meeting_id ?? "",
        agreeHeadphones: completed,
        agreeLocalRecording: completed,
        agreeUpload: completed
      });
      if (completed) {
        setLastConsent({
          timestamp: cfg.consent?.last_submitted_at ?? "",
          sessionDir: cfg.consent?.last_session_dir,
          path: cfg.consent?.last_pdf_path
        });
      }
    });

    return () => {
      offStatus();
      offConfig();
    };
  }, []);

  useEffect(() => {
    if (!config?.themes.csv_path || !window.zoomDuo.invoke) {
      setThemesSummary(null);
      setAvailableThemes([]);
      resetSession();
      return;
    }

    resetSession();
    let active = true;
    setThemesError(null);
    const initialTheme = sessionState.theme;

    window.zoomDuo
      .invoke<ThemeHashIndexResult>("themes/hash-index", {
        csv_path: config.themes.csv_path
      })
      .then((result) => {
        if (active) {
          setThemesSummary(result);
        }
        const csvPath = config.themes.csv_path;
        window.zoomDuo
          .invoke<{ items: ThemeRecord[] } | null>("themes/load-records", { csv_path: csvPath })
          .then((records) => {
            if (active && records && records.items) {
              setAvailableThemes(records.items);
              if (!initialTheme && records.items.length > 0) {
                setSessionTheme(records.items[0]);
              }
            }
          })
          .catch(() => void 0);
      })
      .catch((error) => {
        if (active) {
          setThemesError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      active = false;
    };
  }, [config?.themes.csv_path, resetSession, sessionState.theme, setSessionTheme]);

  useEffect(() => {
    const duration = config?.session?.talk_seconds ?? 360;
    if (status.state === "recording") {
      if (!sessionState.running) {
        const activeTheme = sessionState.theme || availableThemes[0];
        if (activeTheme) {
          if (!sessionState.theme) {
            setSessionTheme(activeTheme);
          }
          startSession(activeTheme, duration);
          setMonitorMessage("Zoom録画を検知しました。タイマーを開始します。");
        } else {
          setMonitorMessage("テーマが選択されていないため、タイマーを開始できません。");
        }
      }
    } else if (sessionState.running && ["ready", "idle", "converting"].includes(status.state)) {
      stopSession();
      setMonitorMessage("Zoom録画停止を検知しました。タイマーを停止しました。");
    }
  }, [
    status.state,
    sessionState.running,
    sessionState.theme,
    availableThemes,
    config?.session?.talk_seconds,
    setSessionTheme,
    startSession,
    stopSession
  ]);

  return (
    <>
      <main
        style={{
          padding: "24px",
          fontFamily: "sans-serif",
          position: "relative",
          color: "#f5f5f5"
        }}
      >
        <h1>Zoom Duo Recorder</h1>

        <section>
          <h2>システムステータス</h2>
          <p>
            録画状態: <strong>{status.state}</strong>
          </p>
          {status.file && <p>監視ファイル: {status.file}</p>}
          <div style={{ marginTop: "12px" }}>
            <button
              onClick={handleSelectZoomDir}
              style={{
                marginRight: "12px",
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #666",
                background: "#2b2b2b",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              Zoom フォルダを選択
            </button>
            <button
              onClick={handleStartMonitor}
              style={{
                marginRight: "12px",
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #666",
                background: "#2b2b2b",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              監視開始
            </button>
            <button
              onClick={handleStopMonitor}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #666",
                background: "#2b2b2b",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              監視停止
            </button>
          </div>
          {monitorMessage && (
            <p style={{ marginTop: "12px", color: "#ccc" }}>{monitorMessage}</p>
          )}
        </section>

        <section style={{ marginTop: "24px" }}>
          <h2>同意フロー</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={openConsentModal}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #666",
                background: "#2b2b2b",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              同意フォームを開く
            </button>
            {config?.consent?.completed ? (
              <span style={{ color: "#6be675" }}>直近の同意: {lastConsent?.timestamp ?? ""}</span>
            ) : (
              <span style={{ color: "#f66" }}>未完了</span>
            )}
          </div>
          {lastConsent?.path && (
            <p style={{ color: "#bbb" }}>PDF: {lastConsent.path}</p>
          )}
        </section>

        <section style={{ marginTop: "24px" }}>
          <h2>テーマ管理</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={handleSelectCsv}
              style={{
                padding: "8px 16px",
                borderRatio: "6px",
                border: "1px solid #666",
                background: "#2b2b2b",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              テーマ CSV を選択
            </button>
            {!config?.themes.csv_path && <p>テーマ CSV パスが未設定です。</p>}
          </div>
          {config?.themes.csv_path && (
            <>
              <p>読み込み元: {config.themes.csv_path}</p>
              {themesError && <p style={{ color: "#d33" }}>エラー: {themesError}</p>}
              {themesSummary && (
                <div>
                  <p>総件数: {themesSummary.count}</p>
                  {themesSummary.duplicates.length > 0 ? (
                    <div>
                      <p>重複候補: {themesSummary.duplicates.length} 件</p>
                      <ul>
                        {themesSummary.duplicates.map((dup) => (
                          <li key={dup.hash}>{dup.theme_ids.join(", ")}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p>重複候補はありません。</p>
                  )}
                </div>
              )}
              {!themesSummary && !themesError && <p>チェック中...</p>}
            </>
          )}
          {availableThemes.length === 0 && config?.themes.csv_path && !themesError && (
            <p style={{ color: "#aaa" }}>テーマの読み込み結果はありません。</p>
          )}
        </section>

        <SessionControls
          controller={session}
          availableThemes={availableThemes}
          defaultDurationSeconds={config?.session?.talk_seconds ?? 360}
        />
      </main>

      <ConsentModal
        open={consentVisible}
        state={consentForm}
        onChange={setConsentForm}
        onSubmit={handleConsentSubmit}
        loading={consentLoading}
        error={consentError}
        onCancel={config?.consent?.completed ? () => setConsentVisible(false) : undefined}
      />
    </>
  );
};

import React, { useMemo } from "react";

interface ConsentFormState {
  participantName: string;
  meetingId: string;
  agreeHeadphones: boolean;
  agreeLocalRecording: boolean;
  agreeUpload: boolean;
}

interface ConsentModalProps {
  open: boolean;
  state: ConsentFormState;
  onChange: (state: ConsentFormState) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  loading?: boolean;
  error?: string | null;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  open,
  state,
  onChange,
  onSubmit,
  onCancel,
  loading = false,
  error = null
}) => {
  const disabled = useMemo(() => {
    return (
      !state.participantName.trim() ||
      !state.meetingId.trim() ||
      !state.agreeHeadphones ||
      !state.agreeLocalRecording ||
      !state.agreeUpload ||
      loading
    );
  }, [state, loading]);

  if (!open) {
    return null;
  }

  const update = (partial: Partial<ConsentFormState>) =>
    onChange({ ...state, ...partial });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        backdropFilter: "blur(4px)"
      }}
    >
      <div
        style={{
          width: "640px",
          maxHeight: "90vh",
          background: "#1e1e1e",
          borderRadius: "12px",
          padding: "24px",
          color: "#f1f1f1",
          overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
        }}
      >
        <h2 style={{ marginBottom: "16px" }}>起動時の同意確認</h2>
        <p style={{ marginBottom: "8px" }}>
          アプリ利用前に、以下の項目をご確認のうえ同意してください。
        </p>

        <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
          <label style={{ flex: 1, display: "block" }}>
            <span style={{ display: "block", marginBottom: "4px" }}>
              参加者名
            </span>
            <input
              type="text"
              value={state.participantName}
              onChange={(e) => update({ participantName: e.target.value })}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #444",
                background: "#111",
                color: "#fff"
              }}
            />
          </label>
          <label style={{ flex: 1, display: "block" }}>
            <span style={{ display: "block", marginBottom: "4px" }}>
              会議 ID / セッション ID
            </span>
            <input
              type="text"
              value={state.meetingId}
              onChange={(e) => update({ meetingId: e.target.value })}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #444",
                background: "#111",
                color: "#fff"
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: "16px", lineHeight: 1.6 }}>
          <label style={{ display: "block", marginBottom: "8px" }}>
            <input
              type="checkbox"
              checked={state.agreeHeadphones}
              onChange={(e) => update({ agreeHeadphones: e.target.checked })}
              style={{ marginRight: "8px" }}
            />
            ヘッドホン装着 / スピーカー OFF を確認しました
          </label>
          <label style={{ display: "block", marginBottom: "8px" }}>
            <input
              type="checkbox"
              checked={state.agreeLocalRecording}
              onChange={(e) =>
                update({ agreeLocalRecording: e.target.checked })
              }
              style={{ marginRight: "8px" }}
            />
            Zoom のローカル録画と参加者別ファイル出力をONにします
          </label>
          <label style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={state.agreeUpload}
              onChange={(e) => update({ agreeUpload: e.target.checked })}
              style={{ marginRight: "8px" }}
            />
            収録データのアップロードと目的に同意します
          </label>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "12px",
              padding: "8px",
              borderRadius: "4px",
              background: "#3a1a1a",
              color: "#ffbaba"
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #666",
                background: "transparent",
                color: "#ddd",
                cursor: "pointer"
              }}
            >
              閉じる
            </button>
          )}
          <button
            onClick={onSubmit}
            disabled={disabled}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: "none",
              background: disabled ? "#555" : "#4a90e2",
              color: "#fff",
              cursor: disabled ? "not-allowed" : "pointer",
              minWidth: "120px"
            }}
          >
            {loading ? "生成中..." : "同意して続行"}
          </button>
        </div>
      </div>
    </div>
  );
};

export type { ConsentFormState, ConsentModalProps };

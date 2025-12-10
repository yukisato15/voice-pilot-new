import React from "react";
import { ThemeRecord } from "@common/ipc";
import { SessionController } from "../hooks/useSessionController";

interface SessionControlsProps {
  controller: SessionController;
  availableThemes: ThemeRecord[];
  defaultDurationSeconds: number;
}

const formatTime = (ms: number) => {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export const SessionControls: React.FC<SessionControlsProps> = ({
  controller,
  availableThemes,
  defaultDurationSeconds
}) => {
  const { state, start, stop, reset, useHint, setTheme } = controller;
  const theme = state.theme;
  const durationSeconds = Math.max(defaultDurationSeconds || 360, 60);

  return (
    <section>
      <h2>進行コントロール</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          alignItems: "start"
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: "8px" }}>
            テーマ選択
            <select
              value={theme?.theme_id ?? ""}
              onChange={(e) => {
                const next = availableThemes.find(
                  (item) => item.theme_id === e.target.value
                );
                setTheme(next ?? null);
              }}
              style={{
                width: "100%",
                marginTop: "4px",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #666",
                background: "#111",
                color: "#fff"
              }}
            >
              <option value="">-- テーマを選択 --</option>
              {availableThemes.map((item) => (
                <option key={item.theme_id} value={item.theme_id}>
                  {item.theme_id} / {item.title}
                </option>
              ))}
            </select>
          </label>
          {theme && (
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "#111",
                color: "#ddd",
                lineHeight: 1.6
              }}
            >
              <h3 style={{ marginTop: 0 }}>{theme.title}</h3>
              <p style={{ margin: 0 }}>カテゴリ: {theme.category}</p>
              <p style={{ margin: 0 }}>ロールA: {theme.role_A_prompt}</p>
              <p style={{ margin: 0 }}>ロールB: {theme.role_B_prompt}</p>
            </div>
          )}
          {!theme && availableThemes.length === 0 && (
            <p style={{ color: "#bbb" }}>テーマ CSV を読み込むと一覧が表示されます。</p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            background: "#111",
            padding: "16px",
            borderRadius: "8px"
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: 600 }}>
            残り時間: {formatTime(state.durationMs - state.elapsedMs)} / {formatTime(state.durationMs)}
          </div>
          {state.showIntroSilence && (
            <div style={{ color: "#ffdd57" }}>冒頭3秒: 発話せずに待機</div>
          )}
          {state.showOutroSilence && (
            <div style={{ color: "#ffdd57" }}>終了まで5秒: 発話を控えてください</div>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => theme && start(theme, durationSeconds)}
              disabled={!theme || state.running}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "6px",
                border: "none",
                background: theme && !state.running ? "#4caf50" : "#333",
                color: "#fff",
                cursor: theme && !state.running ? "pointer" : "not-allowed"
              }}
            >
              セッション開始
            </button>
            <button
              onClick={stop}
              disabled={!state.running}
              style={{
                padding: "10px",
                borderRadius: "6px",
                border: "none",
                background: state.running ? "#d9534f" : "#333",
                color: "#fff",
                cursor: state.running ? "pointer" : "not-allowed"
              }}
            >
              停止
            </button>
            <button
              onClick={reset}
              style={{
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #666",
                background: "transparent",
                color: "#ccc",
                cursor: "pointer"
              }}
            >
              リセット
            </button>
          </div>
          <div>
            <h4 style={{ margin: "12px 0 4px" }}>ヒント</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {(theme?.hints ?? []).map((hint, index) => {
                const hintIndex = index + 1;
                const used = state.hintsUsed.includes(hintIndex);
                return (
                  <button
                    key={hintIndex}
                    onClick={() => useHint(hintIndex)}
                    disabled={used}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "20px",
                      border: "1px solid #666",
                      background: used ? "#2b2b2b" : "#444",
                      color: "#fff",
                      cursor: used ? "not-allowed" : "pointer"
                    }}
                    title={hint}
                  >
                    {used ? `✓ ヒント${hintIndex}` : `ヒント${hintIndex}`}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: "8px", color: "#ccc" }}>
              {state.hintsUsed.length > 0
                ? `使用済み: ${state.hintsUsed.join(", ")}`
                : "ヒントはまだ使用されていません"}
            </div>
            {state.hintsUsed.length > 0 && (
              <div style={{ marginTop: "8px", color: "#bbb", lineHeight: 1.5 }}>
                {state.hintsUsed.map((idx) => (
                  <div key={idx}>ヒント{idx}: {theme?.hints?.[idx - 1] ?? ""}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

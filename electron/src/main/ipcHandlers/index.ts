import path from "path";
import { BrowserWindow, ipcMain, dialog } from "electron";
import { getConfig, updateConfig } from "../configStore";
import { AppConfig } from "@common/config";
import { zoomWatcher } from "../zoomWatcher";
import { pythonManager } from "../pythonManager";

interface ConsentPayload {
  participant_name: string;
  meeting_id: string;
  timestamp: string;
  checks: {
    headphones: boolean;
    local_recording: boolean;
    upload_agreement: boolean;
  };
}

function createSessionDir(meetingId: string, timestamp: string): string {
  const sanitizedMeeting =
    meetingId?.trim().replace(/[^a-zA-Z0-9_-]/g, "") || "session";
  const date = new Date(timestamp || Date.now());
  const pad = (value: number) => value.toString().padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}${m}${d}_${hh}${mm}${ss}_${sanitizedMeeting}`;
}

ipcMain.handle("config/get", () => {
  return getConfig();
});

ipcMain.handle(
  "config/update",
  (_event, payload: { key: keyof AppConfig; value: AppConfig[keyof AppConfig] }) => {
    const { key, value } = payload;
    const updated = updateConfig(key, value as never);
    BrowserWindow.getAllWindows().forEach((window) =>
      window.webContents.send("config/changed", updated)
    );
    return updated;
  }
);

ipcMain.handle("recording/start-monitor", (_event, payload: { path: string }) => {
  zoomWatcher.start(payload.path);
  return { status: "ok" };
});

ipcMain.handle("recording/stop-monitor", () => {
  zoomWatcher.stop();
  return { status: "ok" };
});

ipcMain.handle("consent/submit", async (_event, payload: ConsentPayload) => {
  const config = getConfig();
  const sessionDir = createSessionDir(payload.meeting_id, payload.timestamp);

  const enrichedPayload = {
    ...payload,
    export_root: config.export_root,
    session_dir: sessionDir
  };

  const result = await pythonManager.request({
    action: "generate_consent_pdf",
    payload: enrichedPayload
  });

  return {
    status: "ok",
    path: result?.path,
    session_dir: sessionDir,
    submitted_at: payload.timestamp
  };
});


ipcMain.handle("themes/hash-index", async (_event, payload: { csv_path: string }) => {
  const csvPath = path.isAbsolute(payload.csv_path)
    ? payload.csv_path
    : path.resolve(process.cwd(), payload.csv_path);
  const result = await pythonManager.request({
    action: "themes/hash-index",
    payload: { csv_path: csvPath }
  });
  return result;
});

ipcMain.handle("themes/select-csv", async () => {
  const window = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(window ?? undefined, {
    title: "テーマ CSV を選択",
    properties: ["openFile"],
    filters: [{ name: "CSV Files", extensions: ["csv"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return { canceled: false, path: result.filePaths[0] };
});

zoomWatcher.onStatusChange((status) => {
  BrowserWindow.getAllWindows().forEach((window) =>
    window.webContents.send("recording/status", status)
  );
});

pythonManager.onEvent((event) => {
  BrowserWindow.getAllWindows().forEach((window) =>
    window.webContents.send(event.channel, event.payload)
  );
});


ipcMain.handle("zoom/select-recording-dir", async () => {
  const window = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(window ?? undefined, {
    title: "Zoom 録画フォルダを選択",
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const updated = updateConfig("zoom_recording_dir", result.filePaths[0]);
  BrowserWindow.getAllWindows().forEach((window) =>
    window.webContents.send("config/changed", updated)
  );

  return { canceled: false, path: result.filePaths[0], config: updated };
});


ipcMain.handle("zoom/start-monitor", async () => {
  const dir = getConfig().zoom_recording_dir;
  if (!dir) {
    return { status: "error", message: "録画フォルダが未設定です" };
  }
  zoomWatcher.start(dir);
  return { status: "ok", path: dir };
});

ipcMain.handle("zoom/stop-monitor", async () => {
  zoomWatcher.stop();
  return { status: "ok" };
});


ipcMain.handle("themes/load-records", async (_event, payload: { csv_path: string }) => {
  const csvPath = path.isAbsolute(payload.csv_path)
    ? payload.csv_path
    : path.resolve(process.cwd(), payload.csv_path);
  try {
    const records = await pythonManager.request({
      action: "themes/load-records",
      payload: { csv_path: csvPath }
    });
    return records;
  } catch (error) {
    console.warn("Failed to load themes", error);
    return null;
  }
});

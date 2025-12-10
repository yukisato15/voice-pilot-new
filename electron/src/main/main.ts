import path from "path";
import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import "./ipcHandlers";

const isDev = process.env.NODE_ENV !== "production";

let mainWindow: BrowserWindow | null = null;

function getPreloadPath(): string {
  return path.join(__dirname, "../preload/index.js");
}

function getRendererUrl(): string {
  if (isDev) {
    return "http://localhost:5173";
  }
  return `file://${path.join(__dirname, "../renderer/index.html")}`;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1e1e1e" : "#ffffff",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const url = getRendererUrl();
  await mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  ipcMain.emit("app:shutdown");
});

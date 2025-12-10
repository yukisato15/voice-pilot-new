import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';

import { registerIpcHandlers } from './ipc';
import { disposeZoomHandlers } from './ipc/zoom';

const isDev = process.env.NODE_ENV !== 'production';
const rendererEntry = isDev
  ? 'http://localhost:5173'
  : path.join(__dirname, '..', 'renderer', 'index.html');

const preloadPath = path.join(__dirname, 'preload.js');

const createDirectorWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: 'Director Console',
    backgroundColor: '#121212',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    void window.loadURL(`${rendererEntry}/index.html#console`);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    void window.loadFile(rendererEntry, { hash: 'console' });
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  return window;
};

const createSharedStageWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreenable: true,
    title: 'Shared Stage',
    backgroundColor: '#000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    void window.loadURL(`${rendererEntry}/index.html#stage`);
  } else {
    void window.loadFile(rendererEntry, { hash: 'stage' });
  }

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  return window;
};

const bootstrap = async (): Promise<void> => {
  await app.whenReady();

  registerIpcHandlers();

  createDirectorWindow();
  createSharedStageWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDirectorWindow();
      createSharedStageWindow();
    }
  });
};

app.once('ready', () => {
  void bootstrap();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  disposeZoomHandlers();
});

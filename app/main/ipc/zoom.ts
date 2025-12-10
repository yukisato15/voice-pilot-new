import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';

import path from 'node:path';

import { ZoomWatcher, type ZoomWatcherStatus } from '../watchers/zoomWatcher';
import { renameZoomRecording, type RenameMetadata } from '../utils/renameZoomRecording';

const watcher = new ZoomWatcher();

const startWatching = (_event: IpcMainInvokeEvent | null, directory: string | null): ZoomWatcherStatus | null => {
  watcher.start(directory);
  return watcher.getStatus();
};

const stopWatching = (): void => {
  watcher.stop();
};

export const registerZoomHandlers = (): void => {
  ipcMain.removeHandler('zoom/watch-start');
  ipcMain.handle('zoom/watch-start', (event, directory: string | null) => {
    return startWatching(event, directory);
  });

  ipcMain.removeHandler('zoom/watch-stop');
  ipcMain.handle('zoom/watch-stop', () => {
    stopWatching();
  });

  ipcMain.removeHandler('zoom/status-current');
  ipcMain.handle('zoom/status-current', () => watcher.getStatus());

  ipcMain.removeHandler('zoom/select-recording-dir');
  ipcMain.handle('zoom/select-recording-dir', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Zoom 録音フォルダを選択',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const directory = path.resolve(result.filePaths[0]);
    startWatching(null, directory);
    return {
      directory,
      status: watcher.getStatus(),
    };
  });

  ipcMain.removeHandler('zoom/rename');
  ipcMain.handle('zoom/rename', async (_event, payload: { file: string; metadata: RenameMetadata }) => {
    if (!payload?.file) {
      return null;
    }
    try {
      return await renameZoomRecording(payload.file, payload.metadata ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[zoom/rename] failed', error);
      return { error: message };
    }
  });

  watcher.on('status', (payload) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('zoom/status', payload);
    }
  });

  watcher.on('error', (error) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('zoom/status', { state: 'error', error: error.message });
    }
  });
};

export const disposeZoomHandlers = (): void => {
  watcher.dispose();
};

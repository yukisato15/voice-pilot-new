import { BrowserWindow, dialog, ipcMain } from 'electron';

import { getConfig, onConfigDidChange, updateConfig, type AppConfig } from '../config/store';

export const registerConfigHandlers = (): void => {
  ipcMain.removeHandler('config/get');
  ipcMain.handle('config/get', () => getConfig());

  ipcMain.removeHandler('config/update');
  ipcMain.handle('config/update', (_event, partial: Partial<AppConfig>) => {
    return updateConfig(partial ?? {});
  });

  ipcMain.removeHandler('project/select-dir');
  ipcMain.handle('project/select-dir', async () => {
    const result = await dialog.showOpenDialog({
      title: '保存先フォルダ (プロジェクト) を選択',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const directory = result.filePaths[0];
    const config = updateConfig({ projectDir: directory });
    return { directory, config };
  });

  onConfigDidChange((config) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('config/changed', config);
    }
  });
};

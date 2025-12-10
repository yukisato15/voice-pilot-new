import { ipcMain } from 'electron';

import { registerTimerHandlers } from './ipc/timer';
import { registerSlidesHandlers } from './ipc/slides';
import { registerThemesHandlers } from './ipc/themes';
import { registerZoomHandlers } from './ipc/zoom';
import { registerEventsHandlers } from './ipc/events';
import { registerConfigHandlers } from './ipc/config';

export const registerIpcHandlers = (): void => {
  ipcMain.removeHandler('app/ping');
  ipcMain.handle('app/ping', async () => 'pong');

  registerTimerHandlers();
  registerSlidesHandlers();
  registerThemesHandlers();
  registerZoomHandlers();
  registerEventsHandlers();
  registerConfigHandlers();
};

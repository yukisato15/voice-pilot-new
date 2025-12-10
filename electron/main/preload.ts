import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

type Listener = (event: IpcRendererEvent, data: unknown) => void;

const api = {
  invoke: <T = unknown>(channel: string, payload?: unknown): Promise<T> => {
    return ipcRenderer.invoke(channel, payload) as Promise<T>;
  },
  on: (channel: string, listener: Listener): void => {
    ipcRenderer.on(channel, listener);
  },
  off: (channel: string, listener: Listener): void => {
    ipcRenderer.off(channel, listener);
  },
  removeListener: (channel: string, listener: Listener): void => {
    ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('electron', api);

contextBridge.exposeInMainWorld('zoomDuo', {
  invoke: <T = unknown>(channel: string, payload?: unknown): Promise<T> => {
    return ipcRenderer.invoke(channel, payload) as Promise<T>;
  },
  on: (channel: string, listener: (event: unknown, data: unknown) => void): (() => void) => {
    const wrapped: Listener = (event, data) => listener(event, data);
    ipcRenderer.on(channel, wrapped);
    return () => {
      ipcRenderer.off(channel, wrapped);
    };
  },
});

// Backwards compatibility with legacy renderer code expecting `window.api`.
contextBridge.exposeInMainWorld('api', {
  invoke: api.invoke,
  on: (_channel: string, listener: (data: unknown) => void) => {
    const wrapped: Listener = (_event, data) => listener(data);
    ipcRenderer.on(_channel, wrapped);
    return (): void => {
      ipcRenderer.off(_channel, wrapped);
    };
  },
});

declare global {
  interface Window {
    electron?: typeof api;
    zoomDuo?: {
      invoke: typeof api.invoke;
      on: (channel: string, listener: (event: unknown, data: unknown) => void) => () => void;
    };
    api?: {
      invoke: typeof api.invoke;
      on: (channel: string, listener: (data: unknown) => void) => () => void;
    };
  }
}

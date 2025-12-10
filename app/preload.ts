import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

type Listener = (event: IpcRendererEvent, data: unknown) => void;

const invoke = <T = unknown>(channel: string, payload?: unknown): Promise<T> => {
  return ipcRenderer.invoke(channel, payload) as Promise<T>;
};

const on = (channel: string, listener: Listener): (() => void) => {
  const wrapped = (event: IpcRendererEvent, data: unknown) => listener(event, data);
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.off(channel, wrapped);
  };
};

contextBridge.exposeInMainWorld('directorAPI', {
  invoke,
  on,
});

contextBridge.exposeInMainWorld('zoomDuo', {
  invoke,
  on,
});

export type PreloadBridge = {
  invoke: typeof invoke;
  on: typeof on;
};

declare global {
  interface Window {
    directorAPI: PreloadBridge;
    zoomDuo: PreloadBridge;
  }
}

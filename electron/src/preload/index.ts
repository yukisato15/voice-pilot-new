import { contextBridge, ipcRenderer } from "electron";
import { ZoomDuoAPI } from "@common/ipc";

type Listener = (event: unknown, ...args: unknown[]) => void;

const api: ZoomDuoAPI = {
  invoke(channel, payload) {
    return ipcRenderer.invoke(channel, payload);
  },
  on(channel, listener) {
    ipcRenderer.on(channel, listener as never);
    return () => ipcRenderer.removeListener(channel, listener as never);
  }
};

contextBridge.exposeInMainWorld("zoomDuo", api);

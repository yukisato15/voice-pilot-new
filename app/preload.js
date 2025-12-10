"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const invoke = (channel, payload) => {
    return electron_1.ipcRenderer.invoke(channel, payload);
};
const on = (channel, listener) => {
    const wrapped = (event, data) => listener(event, data);
    electron_1.ipcRenderer.on(channel, wrapped);
    return () => {
        electron_1.ipcRenderer.off(channel, wrapped);
    };
};
electron_1.contextBridge.exposeInMainWorld('directorAPI', {
    invoke,
    on,
});
electron_1.contextBridge.exposeInMainWorld('zoomDuo', {
    invoke,
    on,
});

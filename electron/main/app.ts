
import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import type { AppConfigSchema, UploadProvider } from './config/store';

type RendererAppConfig = {
    export_root: string;
    zoom_recording_dir: string;
    upload: {
        provider: UploadProvider;
        dest: string;
        credentials_path: string;
    };
    audio: AppConfigSchema['audio'];
    session: AppConfigSchema['session'];
    themes: AppConfigSchema['themes'];
    consent: {
        completed: boolean;
        participant_name: string;
        meeting_id: string;
        last_session_dir: string;
        last_pdf_path: string;
        last_submitted_at: string;
    };
};

import {
    detectDefaultZoomPath,
    ensureZoomPath,
    getAllConfig,
    getConfig,
    setConfig,
} from './config/store';
import { ZoomWatcher } from './watchers/zoomWatcher';
import { PythonWorkerClient } from './python/client';
import { registerThemeIpcHandlers } from './ipc/themes';

let mainWindow: BrowserWindow | null = null;
let zoomWatcher: ZoomWatcher | null = null;
let pythonClient: PythonWorkerClient | null = null;
let disposeThemeHandlers: (() => void) | null = null;

const isDev = process.env.NODE_ENV !== 'production';

const isWindowAlive = (window: BrowserWindow | null): window is BrowserWindow => {
    return Boolean(window && !window.isDestroyed());
};

const sendToRenderer = (channel: string, payload: unknown): void => {
    if (isWindowAlive(mainWindow)) {
        mainWindow.webContents.send(channel, payload);
    }
};

const mapConfigForRenderer = (config: AppConfigSchema): RendererAppConfig => {
    return {
        export_root: config.export_root,
        zoom_recording_dir: config.zoom.recordingPath,
        upload: { ...config.upload },
        audio: { ...config.audio },
        session: { ...config.session },
        themes: { ...config.themes },
        consent: {
            completed: config.consent.completed ?? false,
            participant_name: config.consent.participant_name ?? '',
            meeting_id: config.consent.meeting_id ?? '',
            last_session_dir: config.consent.last_session_dir ?? '',
            last_pdf_path: config.consent.last_pdf_path ?? '',
            last_submitted_at: config.consent.last_submitted_at ?? '',
        },
    };
};

const resolvePreloadPath = (): string => {
    return path.resolve(__dirname, 'preload.js');
};

const resolveRendererEntry = (): string => {
    if (isDev) {
        return 'http://localhost:5173';
    }
    return path.resolve(__dirname, '../renderer/index.html');
};

const resolveThemeCsvPath = (): string => {
    const appPath = app.getAppPath();
    const primaryConfigPath = path.resolve(appPath, 'config.json');
    const fallbackConfigPath = path.resolve(appPath, 'config.example.json');
    const defaultCsvPath = path.resolve(appPath, 'samples', 'themes_sample.csv');

    const readConfigFile = (configPath: string): string | null => {
        try {
            if (!fs.existsSync(configPath)) {
                return null;
            }
            const raw = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(raw) as { themes?: { csv_path?: string } };
            if (parsed.themes?.csv_path) {
                return path.resolve(appPath, parsed.themes.csv_path);
            }
        } catch (error) {
            console.warn(`[electron] Failed to parse ${configPath}:`, error);
        }
        return null;
    };

    return (
        readConfigFile(primaryConfigPath)
        ?? readConfigFile(fallbackConfigPath)
        ?? defaultCsvPath
    );
};

const createWindow = (): void => {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 1100,
        minHeight: 720,
        backgroundColor: '#121212',
        webPreferences: {
            preload: resolvePreloadPath(),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    const rendererEntry = resolveRendererEntry();
    if (isDev) {
        void mainWindow.loadURL(rendererEntry);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        void mainWindow.loadFile(rendererEntry);
    }
};

const registerPythonListeners = (client: PythonWorkerClient): void => {
    client.on('stderr', (line: string) => {
        sendToRenderer('python/log', line);
    });

    client.on('event', ({ event, data }: { event: string; data: unknown }) => {
        sendToRenderer(`python/${event}`, data);
    });

    client.on('error', (error: Error) => {
        sendToRenderer('python/log', `[worker:error] ${error.message}`);
    });

    client.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        sendToRenderer('python/log', `[worker:exit] code=${code ?? 'null'} signal=${signal ?? 'null'}`);
    });
};

const registerZoomWatcher = (directory: string | null | undefined): void => {
    if (!zoomWatcher) {
        zoomWatcher = new ZoomWatcher();
        zoomWatcher.on('status', (status) => {
            sendToRenderer('recording/status', status);
        });
        zoomWatcher.on('error', (error: Error) => {
            sendToRenderer('recording/status', {
                state: 'error',
                error: error.message,
            });
        });
    }

    zoomWatcher.start(directory);
};

const registerIpcHandlers = (client: PythonWorkerClient): void => {
    ipcMain.handle('config/get', async () => mapConfigForRenderer(getAllConfig()));

    ipcMain.handle('config/update', async (_event, payload: { path?: string; value: unknown }) => {
        if (!payload?.path) {
            return { success: false };
        }

        setConfig(payload.path, payload.value);
        const updatedConfig = mapConfigForRenderer(getAllConfig());
        sendToRenderer('config/changed', updatedConfig);

        if (payload.path === 'zoom.recordingPath') {
            registerZoomWatcher(String(payload.value ?? detectDefaultZoomPath()));
        }

        return { success: true, config: updatedConfig };
    });

    ipcMain.handle('dialog/select-directory', async () => {
        if (!isWindowAlive(mainWindow)) {
            return null;
        }
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        return result.filePaths[0];
    });

    ipcMain.handle('consent/submit', async (_event, payload) => {
        sendToRenderer('consent/pdf-status', { status: 'pending' });
        try {
            const exportRoot = getConfig<string>('consent.exportRoot');
            const timestamp = new Date().toISOString().replace(/[-:]/g, '');
            const sessionDir = timestamp.split('.')[0]?.replace('T', '_') ?? timestamp;
            const result = await client.invoke<Record<string, unknown>>('generate_consent_pdf', {
                export_root: exportRoot,
                session_dir: sessionDir,
                ...payload,
            });
            sendToRenderer('consent/pdf-status', {
                status: 'success',
                path: (result as { path?: string }).path,
                submitted_at: timestamp,
            });
            return { success: true, result };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            sendToRenderer('consent/pdf-status', {
                status: 'error',
                error: message,
            });
            return { success: false, error: message };
        }
    });

    ipcMain.handle('recording/start-monitor', async (_event, payload: { path?: string }) => {
        if (payload?.path) {
            registerZoomWatcher(payload.path);
            return { success: true };
        }
        return { success: false };
    });

    ipcMain.handle('recording/stop-monitor', async () => {
        zoomWatcher?.stop();
        return { success: true };
    });
};

const bootstrap = async (): Promise<void> => {
    ensureZoomPath();
    createWindow();

    const pythonExecutable = getConfig<string>('python.executable');
    const pythonScript = getConfig<string>('python.script');

    pythonClient = new PythonWorkerClient({
        pythonPath: pythonExecutable,
        scriptPath: pythonScript,
    });

    registerPythonListeners(pythonClient);
    registerIpcHandlers(pythonClient);

    registerZoomWatcher(getConfig<string>('zoom.recordingPath'));

    const themeCsvPath = resolveThemeCsvPath();
    disposeThemeHandlers = registerThemeIpcHandlers({
        workerClient: pythonClient,
        csvPath: themeCsvPath,
    });
};

app.whenReady().then(() => {
    void bootstrap();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    disposeThemeHandlers?.();
    zoomWatcher?.dispose();
    pythonClient?.dispose();
    mainWindow = null;
});

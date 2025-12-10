import path from 'node:path';
import os from 'node:os';
import Store from 'electron-store';

export type UploadProvider = 's3' | 'sftp' | 'box';

export interface AppConfigSchema {
  export_root: string;
  upload: {
    provider: UploadProvider;
    dest: string;
    credentials_path: string;
  };
  audio: {
    sample_rate: number;
    beep_enabled: boolean;
    bgm_enabled: boolean;
  };
  session: {
    talk_seconds: number;
    start_silence: number;
    end_silence: number;
    interval_seconds: number;
    break_every_minutes: number;
    break_length_minutes: number;
  };
  themes: {
    csv_path: string;
  };
  consent: {
    exportRoot: string;
    completed: boolean;
    participant_name: string;
    meeting_id: string;
    last_session_dir: string;
    last_pdf_path: string;
    last_submitted_at: string;
  };
  zoom: {
    recordingPath: string;
  };
  python: {
    executable: string;
    script: string;
  };
}

export const detectDefaultZoomPath = (): string => {
  const platform = process.platform;
  const homeDir = os.homedir();

  if (platform === 'darwin' || platform === 'win32') {
    return path.join(homeDir, 'Documents', 'Zoom');
  }

  return path.join(homeDir, 'Videos', 'Zoom');
};

const resolveDefaultExportRoot = (): string => {
  return path.join(os.homedir(), 'ZoomDuoSessions');
};

export const resolveDefaultWorkerScript = (): string => {
  return path.resolve(process.cwd(), 'backend', 'worker.py');
};

export const configStore = new Store<AppConfigSchema>({
  name: 'zoom-duo-config',
  defaults: {
    export_root: resolveDefaultExportRoot(),
    upload: {
      provider: 's3' as UploadProvider,
      dest: '',
      credentials_path: ''
    },
    audio: {
      sample_rate: 48000,
      beep_enabled: false,
      bgm_enabled: false,
    },
    session: {
      talk_seconds: 360,
      start_silence: 3,
      end_silence: 5,
      interval_seconds: 60,
      break_every_minutes: 30,
      break_length_minutes: 5,
    },
    themes: {
      csv_path: '',
    },
    consent: {
      exportRoot: resolveDefaultExportRoot(),
      completed: false,
      participant_name: '',
      meeting_id: '',
      last_session_dir: '',
      last_pdf_path: '',
      last_submitted_at: '',
    },
    zoom: {
      recordingPath: detectDefaultZoomPath(),
    },
    python: {
      executable: process.platform === 'win32' ? 'python.exe' : 'python3',
      script: resolveDefaultWorkerScript(),
    },
  },
});

export const getConfig = <T>(key: string): T => configStore.get(key) as T;

export const setConfig = (key: string, value: unknown): void => {
  configStore.set(key, value as never);
};

export const getAllConfig = (): AppConfigSchema => configStore.store;

export const resetPythonScriptDefault = (): void => {
  setConfig('python.script', resolveDefaultWorkerScript());
};

export const ensureZoomPath = (): void => {
  if (!configStore.has('zoom.recordingPath')) {
    setConfig('zoom.recordingPath', detectDefaultZoomPath());
  }
};

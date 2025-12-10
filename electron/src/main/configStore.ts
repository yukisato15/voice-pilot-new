import Store from "electron-store";
import { AppConfig } from "@common/config";

const defaults: AppConfig = {
  export_root: "/ExportRoot",
  zoom_recording_dir: "",
  upload: {
    provider: "s3",
    dest: "",
    credentials_path: ""
  },
  audio: {
    sample_rate: 48000,
    beep_enabled: false,
    bgm_enabled: false
  },
  session: {
    talk_seconds: 360,
    start_silence: 3,
    end_silence: 5,
    interval_seconds: 60,
    break_every_minutes: 30,
    break_length_minutes: 5
  },
  themes: {
    csv_path: ""
  },
  consent: {
    completed: false,
    participant_name: "",
    meeting_id: "",
    last_session_dir: "",
    last_pdf_path: "",
    last_submitted_at: ""
  }
};

const store = new Store<AppConfig>({ name: "config", defaults });

export function getConfig(): AppConfig {
  return (store as unknown as { store: AppConfig }).store;
}

export function updateConfig<T extends keyof AppConfig>(
  key: T,
  value: AppConfig[T]
) {
  (store as unknown as { set: (key: string, value: unknown) => void }).set(
    key as string,
    value
  );
  return (store as unknown as { store: AppConfig }).store;
}

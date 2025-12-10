export type UploadProvider = "s3" | "sftp" | "box";

export interface AppConfig {
  export_root: string;
  zoom_recording_dir: string;
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
    completed: boolean;
    participant_name: string;
    meeting_id: string;
    last_session_dir: string;
    last_pdf_path: string;
    last_submitted_at: string;
  };
}

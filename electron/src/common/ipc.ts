export type RecordingState = "idle" | "recording" | "converting" | "ready";

export interface RecordingStatus {
  state: RecordingState;
  file?: string;
}

export interface ThemeHashDuplicate {
  hash: string;
  theme_ids: string[];
}

export interface ThemeHashIndexResult {
  count: number;
  duplicates: ThemeHashDuplicate[];
}

export interface ThemeRecord {
  theme_id: string;
  category: string;
  title: string;
  role_A_prompt: string;
  role_B_prompt: string;
  hints: string[];
}

export interface ConsentSubmitResult {
  status: "ok" | "error";
  path?: string;
  session_dir?: string;
  submitted_at?: string;
  message?: string;
}

export interface ThemeSelectResult {
  canceled: boolean;
  path?: string;
}

export interface SelectDirectoryResult {
  canceled: boolean;
  path?: string;
}

export interface ZoomConfigChangedPayload {}

export interface ZoomDuoAPI {
  invoke<T = unknown>(channel: string, payload?: unknown): Promise<T>;
  on(channel: string, listener: (...args: unknown[]) => void): () => void;
}

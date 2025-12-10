# IPC コントラクト

## 概要
Zoom Duo Recorder は 3 つのレイヤー (Renderer, Electron Main, Python Worker) の間で非同期メッセージをやり取りします。本ドキュメントでは IPC チャンネル名と JSON ペイロード仕様を定義します。

```
Renderer (UI) <=> Electron Main <=> Python Worker
```

## Renderer → Main (`ipcRenderer.invoke`)
| チャンネル | ペイロード | 目的 |
|------------|-----------|------|
| `consent/show` | `{}` | 起動時モーダル表示要求。
| `consent/submit` | `{ "participant_name": string, "meeting_id": string, "checks": { "headphones": bool, ... }, "timestamp": string }` | 同意情報を送信し PDF 生成をトリガー。
| `config/get` | `{}` | 設定のロード。
| `config/update` | `{ "path": string, "value": any }` | 設定の部分更新 (例: Zoom フォルダパス)。
| `themes/request` | `{ "count": number }` | テーマの取得。初回は count=1。
| `recording/start-monitor` | `{ "path": string }` | 指定フォルダの監視開始。
| `recording/stop-monitor` | `{}` | 監視停止。
| `session/segment-complete` | `{ "segment_id": string, "hints_used": number[], "timings": { ... } }` | セグメント完了時にメタ情報を送信しキューへ挿入。
| `uploads/retry` | `{ "job_id": string }` | 失敗ジョブの再送要求。

## Main → Renderer (`ipcMain.handle` / `webContents.send`)
| チャンネル | ペイロード | 説明 |
|------------|-----------|------|
| `consent/pdf-status` | `{ "status": "pending"|"success"|"error", "path"?: string, "error"?: string }` | 同意 PDF の生成状態を報告。
| `config/changed` | `{ "path": string, "value": any }` | 設定変更の通知。
| `recording/status` | `{ "state": "idle"|"recording"|"converting"|"ready", "file"?: string }` | Zoom フォルダ監視結果。
| `session/segment-ready` | `{ "segment_id": string, "files": string[] }` | 変換完了ファイルが処理キュー入り。
| `uploads/progress` | `{ "job_id": string, "name": string, "status": "queued"|"uploading"|"success"|"failed", "retries": number }` | アップロード進捗。
| `alert/break` | `{ "kind": "30min", "starts_in_sec": number }` | 休憩通知。

## Main → Python (stdin JSON-RPC 風)
- **送信形式**: 1 行 1 JSON (`{"id":"uuid","action":"generate_consent_pdf",...}`)
- **共通フィールド**:
  - `id`: リクエスト一意識別子
  - `action`: 実行コマンド名
  - `payload`: コマンド固有のデータ

| `action` | `payload` | 説明 |
|----------|-----------|------|
| `generate_consent_pdf` | `{ "export_root": string, "session_dir": string, "participant_name": string, "meeting_id": string, "timestamp": string, "checks": {...} }` | 同意 PDF を生成。
| `prepare_segment` | `{ "session_dir": string, "segment": {...}, "files": {...} }` | 命名・メタ生成・キュー登録。
| `ffmpeg_lr_mix` | `{ "input_a": string, "input_b": string, "output": string }` | LR 合成。
| `ffmpeg_loudnorm` | `{ "input": string, "output": string, "params"?: {...} }` | ラウドネス正規化 (任意)。
| `upload_batch` | `{ "session_dir": string, "provider": string, "destination": string, "files": [string], "config": {...} }` | バッチアップロード。
| `themes/hash-index` | `{ "csv_path": string }` | テーマ CSV の読み込みと重複検出。

## Python → Main (stdout JSON)
- **成功レスポンス**: `{"id": "uuid", "status": "ok", "result": {...}}`
- **エラーレスポンス**: `{"id": "uuid", "status": "error", "error": {"code": string, "message": string, "details"?: any}}`
- **ストリーミングイベント**: `{"event": "upload_progress", "data": {...}}` のように `event` フィールドを持つ。

### 主なイベント
| `event` | `data` | 説明 |
|---------|--------|------|
| `upload_progress` | `{ "job_id": string, "status": "uploading"|"success"|"failed", "bytes_sent"?: number }` | アップロード進捗。
| `segment_ready` | `{ "segment_id": string, "files": {...} }` | メタ生成完了。
| `log` | `{ "level": "info"|"warning"|"error", "message": string }` | Python 側ログ。

## エラーハンドリングポリシー
- Node 側でタイムアウト (`action` ごとにデフォルト 60 秒など) を設定し、無応答時は再起動またはユーザー通知。
- `status=error` を受け取った場合、Renderer に `alert` を送信し UI で再試行選択を提供。
- Python プロセスの異常終了検知時は自動再起動を試行し、失敗したジョブは保留キューへ。

## 追加メモ
- 将来 gRPC/HTTP ベースに置き換える場合も、`action` 名とペイロード構造は同等に維持し互換性を確保。
- セキュリティ上、Renderer から受け取るパスは Main でバリデーションし、許可ディレクトリ外を防止。

# システムアーキテクチャ

## 全体構成
Zoom Duo Recorder は Electron を用いたデスクトップアプリで、フロント(UI)とバックエンド処理を明確に分離し、Python サブプロセスを通じてメディア処理・アップロード・PDF 生成を行います。

```
+----------------------+        IPC (Electron)       +----------------------+
|   Electron Main      | <-------------------------> |   Renderer (React)   |
|  - アプリライフサイクル |                            |  - UI ロジック          |
|  - Python プロセス制御 |                            |  - 状態管理            |
|  - 設定・永続化        |                            |  - 音声レベル取得       |
+----------+-----------+                            +-----------+----------+
           |                                                     |
           | child_process (JSON over stdout/stderr)             |
           v                                                     |
+----------------------+         gRPC/HTTP(任意)                 |
|   Python Worker      | ----------------------------------------+
|  - ffmpeg ラッパ       |
|  - アップロード I/F     |
|  - PDF 生成           |
|  - 命名・レポート生成    |
+----------------------+
```

## プロセス間通信
- **Main ⇄ Renderer**: Electron IPC (ContextBridge + `ipcRenderer.invoke/on`). UI からの操作コマンド、ステータス更新、モーダル制御などを扱う。
- **Main ⇄ Python**: Node.js `child_process` を利用し、JSON メッセージでリクエスト/レスポンス。長時間処理（ffmpeg, アップロード, PDF 生成）やバックグラウンドキュー操作を委譲する。
- **Python ⇄ ffmpeg**: `subprocess.run`/`subprocess.Popen` によるコマンド実行。ログは stdout/stderr を Main へ中継。

## モジュール構成
- `electron/src/main/`
  - `main.ts`: ウィンドウ生成、開発/本番でのロード先切替、アプリライフサイクル管理。
  - `ipcHandlers/`: UI からの IPC 要求 (`config`, `zoom`, `themes`, `consent` など) を集約。
  - `configStore.ts`: `electron-store` による設定永続化。
  - `pythonManager.ts`: Python ワーカーの起動・監視と JSON RPC ディスパッチ。
  - `zoomWatcher.ts`: `chokidar` を用いた Zoom 録画フォルダ監視。
- `electron/src/renderer/`
  - React + Vite を利用したモダン UI。オンボーディング、同意取得、セッション操作 UI をコンポーネント分割。
  - `hooks/`, `components/`, `screens/` でロールごとに整理。
- `backend/`
  - `worker.py`: Electron からの JSON メッセージを受信し、サービス層へディスパッチ。
  - `services/`: ffmpeg ラッパ、PDF 生成、アップロード、メタデータ生成、テーマ CSV 処理など。
- `legacy/renderer_legacy/`
  - 旧来のブラウザ向け UI。仕様参照用に保持し、現行ビルドには含めない。

## 設定・永続化
- `electron-store` により `config.json` スキーマを保持。初回起動時にデフォルト値を投入。
- 収録セッション管理はインメモリ状態管理（Redux/Recoil など）＋ `better-sqlite3` を利用した軽量キューに拡張可能。
- 同意チェックや操作ログは `app.log` としてローカル保存し、アップロード成否は `upload_report.csv` に記録。

## クロスプラットフォーム考慮
- macOS/Windows 双方で Zoom デフォルトフォルダを自動推定。ユーザーが手動で上書き可能。
- ヘッドホン診断は WebAudio API の `getUserMedia` でマイク入力を取得し、OS 依存実装との差異は UI でガイド。
- ffmpeg はバンドルまたは初回起動時に同意を取りつつ導入。実行パスは設定画面から変更可能にする。

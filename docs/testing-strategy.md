# テスト戦略

## テストレイヤー
1. **ユニットテスト**
   - Renderer: React コンポーネントとカスタムフック (`useSessionTimer`, `AudioLevelMeter` など) を Jest + Testing Library で検証。
   - Main: IPC ハンドラとファイル監視ロジックを `ava` または `jest` (Node 向け) でテスト。
   - Python: `pytest` で ffmpeg ラッパ、アップローダ、メタ生成の個別関数を検証。
2. **統合テスト**
   - Electron Main ⇄ Python ワーカー間をモックパイプで接続し、JSON プロトコルが期待どおり動作するか確認。
   - 疑似 Zoom フォルダ (テストフィクスチャ) に対してファイル監視 → 命名 → キュー投入が成立するか。
3. **エンドツーエンド (E2E)**
   - `spectron` もしくは `@playwright/test` + `electron-playwright` で、起動モーダルからアップロード完了までのシナリオを自動化。
   - ダミー音声ファイルを用いて LR 合成とアップロード処理 (ローカルダミーサーバ) を再現。

## テストデータ
- `tests/fixtures/zoom_session/` に `.zoom`, `.tmp`, `.m4a` のサンプルセットを用意。
- テーマ CSV は最小 5 行のテスト用データを準備し、重複ケースを含め重複検出を確認。
- アップロードはローカル HTTP サーバ (Flask) や SFTP モックサーバを使用。

## 自動化パイプライン
- GitHub Actions またはローカル CI で以下のジョブを定義:
  - `lint`: ESLint, Prettier, mypy (Python) など。
  - `test:renderer`, `test:main`, `test:python`, `test:e2e`。
  - macOS/Windows 両方でのビルド確認 (最小限でも macOS x86_64 + Windows x64)。

## カバレッジ目標
- ユニットテスト: 驚異的な網羅率は求めず、主要ロジック (タイマー、ファイル命名、アップロード制御) で 80% 以上。
- 統合テスト: キュー動作、IPC 例外ハンドリングなど重要フローを網羅。
- E2E: 起動 → 同意 → 進行 → 命名 → アップロード のハッピーパス + エラーケース (アップロード失敗 → 再試行)。

## 手動テストチェックリスト
- 初回起動時の権限ダイアログ (マイク、ファイルアクセス) を確認。
- ヘッドホン診断 NG → 再テスト → 続行の UI 動作。
- 30 分経過時の休憩アラート表示と再開操作。
- アップロード失敗時のリトライキュー挙動。

## バグ報告フロー
- UI から `app.log` と `upload_report.csv` を添付できるサポートエクスポート機能を計画。
- Issue テンプレートでは、Zoom バージョン、OS、ffmpeg バージョン、再現手順を必須項目にする。

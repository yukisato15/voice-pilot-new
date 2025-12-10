# セットアップ & デプロイ手順

## 開発環境構築
1. リポジトリをクローンし、`Voice Pilot_2` ディレクトリに移動。
2. Node.js 20+ と npm/pnpm をインストール。
3. Python 3.10+ を用意し、グローバルではなく仮想環境を推奨。
4. ffmpeg 6+ を導入し、`ffmpeg -version` で確認。
5. `electron/` ディレクトリで `npm install`、`backend/` で `pip install -r requirements.txt`。
6. `.env` または `config.json` を初期化し、デフォルト値を設定。

## 開発サーバ起動
```bash
# Terminal 1: Electron (Vite 等)
cd electron
npm run dev

# Terminal 2: Python ワーカー
cd backend
source .venv/bin/activate
python worker.py --dev
```
- Electron Main が Python ワーカーの起動/停止を担う実装に移行した後でも、デバッグ用に個別起動コマンドを維持。

## 初回セットアップフロー
1. アプリ起動時に ffmpeg/依存の存在チェック。
2. 未インストールの場合は同意ダイアログと自動導入スクリプト (macOS: Homebrew, Windows: winget/choco) を案内。
3. Zoom 録画フォルダの初期推定 (`~/Documents/Zoom` など) を行い、ユーザーに確認させる。
4. `config.json` に選択結果を保存。

## ビルド手順
```bash
# macOS
cd electron
npm run build
npx electron-builder --mac dmg

# Windows
npx electron-builder --win nsis
```
- Python ワーカーや `backend` のスクリプトを `resources/` 配下にバンドルし、起動時にパスを解決。
- ffmpeg バイナリはライセンス遵守の上で同梱するか、初回起動時にダウンロード。

## 配布前チェックリスト
- Acceptance 条件 (1-8) が満たされていること。
- macOS/Windows それぞれで同意 PDF、録画検出、アップロード動作を確認。
- `upload_report.csv` とログが意図した場所に出力されるか。
- 設定ファイルや認証情報が適切に暗号化またはキーチェーンに保存されるか。
- 自動更新を無効化した場合、ユーザーへのアップデート通知手段を準備。

## 配布パッケージ
- macOS: `.dmg` と `.zip` (Apple Notarization を計画)。
- Windows: `.exe` (NSIS) と `.msi` (任意)。コードサイニング証明書の取得を検討。
- リリースノートは README と同時に更新し、Known Issues を明記。

## 保守運用
- バージョンアップ時は設定スキーマ変更に備えてマイグレーションを実装。
- 重要ログは圧縮・ローテーションし、ユーザーが簡単に提出できる仕組みを提供。
- セキュリティ修正や依存更新を四半期ごとに棚卸し。

# Electron Frontend

Zoom Duo Recorder のデスクトップクライアント (Electron + React + TypeScript) 用ディレクトリです。

## セットアップ
```bash
cd electron
npm install
```

## 開発起動
```bash
npm run dev
```

コマンドは以下を同時に実行します。
- `ts-node-dev` で Electron Main プロセスをウォッチ
- Vite 開発サーバ (ポート 5173) で Renderer をホットリロード
- Electron 本体を development モードで起動

## 主なディレクトリ
- `src/main/`: BrowserWindow 制御、IPC、Python 連携、Zoom 監視ロジック
- `src/preload/`: `contextBridge` を通じて Renderer へ API を公開
- `src/renderer/`: React ベースの UI 実装。現状はスタブ
- `src/common/`: 共有型定義やユーティリティ（今後追加）

詳細な仕様はルート `docs/` を参照してください。

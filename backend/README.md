# Zoom Duo Recorder Backend

Python 3.10+ をターゲットにしたバックエンドワーカーです。Electron (Node.js) から JSON メッセージを受け取り、以下の処理を担当します。

- 同意 PDF 生成 (`Jinja2` + `weasyprint` or `wkhtmltopdf`)
- 録画ファイルの命名・メタデータ出力
- ffmpeg を用いた LR 合成・ラウドネス正規化
- S3 / SFTP / Box へのアップロード
- ログ・レポート出力と再試行キュー制御

## セットアップ
```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 開発起動
```bash
python worker.py --dev
```

## ディレクトリ構成
- `worker.py` : Electron との IPC 窓口
- `zoom_duo/services/` : ffmpeg ラッパ、アップローダ、PDF 生成などのビジネスロジック
- `zoom_duo/models/` : データクラス（今後追加）

詳細は `docs/` 配下の設計ドキュメントを参照してください。

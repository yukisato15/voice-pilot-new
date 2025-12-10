# RecPilot (AI学習用 Zoom 収録進行支援 Web ツール)

RecPilot は Zoom での会話収録現場において、進行担当者が 1 つの Web 画面でテーマ提示・タイマー管理・カンペ送信・メモ記録を効率よく行うためのツールです。ブラウザで完結し、参加者向けのカンペ画面 (`/prompt`) と進行者向けの操作画面 (`/control`) を WebSocket で連携します。

## 主な機能
- 60 分カウントダウンタイマー（Start / Stop / Reset）とタイムコード表示
- CSV から読み込むトークテーマ & ヒントの表示、前後移動
- 定型カンペボタンと任意入力によるメッセージ送信（Prompt 画面に即時反映）
- Prompt 画面では現在のトークテーマを大きく表示し、カンペと併せて時間情報（経過 / 残り）を小さく表示
- タイムコード付きメモ記録（組番号・セッション・カテゴリを添えて `report.csv` に追記）
- メモカテゴリはプリセット（現場トラブル/通信/機材/個人情報 等）から選択可能で、「その他」を選ぶと自由入力できます。
- WebSocket (Flask-SocketIO) によるリアルタイム更新

## ディレクトリ構成
- `recpilot/app.py` : Flask + SocketIO メインアプリケーション
- `recpilot/templates/` : `control.html`, `prompt.html`, `landing.html`
- `recpilot/static/` : Tailwind ベースの UI に必要な JS / CSS
- `recpilot/data/talk_themes.csv` : テーマ一覧データ（No / カテゴリ / テーマ内容 / ヒント）
- `recpilot/data/report.csv` : 記録ログ（日時 / 組番号 / セッション / タイムコード / 内容 / カテゴリ）
- `requirements.txt` : 必要パッケージ（Flask, Flask-SocketIO, eventlet 等）

## セットアップ
1. Python 3.11 以上を推奨（仮想環境推奨）
2. 依存パッケージをインストール
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. 必要に応じて `.env` を作成し `FLASK_SECRET_KEY` などを設定

## 起動方法
```bash
python recpilot/app.py
```

- デフォルトで `http://localhost:5000` が立ち上がります。
- 開発中は Threading サーバーでも動作しますが、SocketIO を安定利用したい場合は eventlet / gevent の導入を推奨します。

## Render へのデプロイ
- `requirements.txt` は Render でもそのまま使用します（`Flask==3.0.3`, `Flask-SocketIO==5.3.6`, `eventlet==0.33.3`, `gunicorn==21.2.0`, `python-dotenv==1.0.1`）。eventlet を含めないと `RuntimeError: eventlet worker requires eventlet 0.24.1 or higher` で起動できません。
- Start Command を開発用の `python recpilot/app.py` から変更してください。Render の Start Command 例:  
  `gunicorn --worker-class eventlet -w 2 --timeout 120 recpilot.app:app`  
  標準インスタンスであれば `-w` は 2〜3 で十分です。`Booting worker with pid ...` がログに出れば OK。
- デプロイ後、ブラウザの Network タブで `/socket.io` がステータス 101 で張れるかを確認してください。Control / Prompt を同時に開いても遅延が解消していれば設定完了です。

## 画面構成
- `/` : ランディング。Control / Prompt への導線
- `/control` : 進行者用操作画面
  - タイマー（60分固定、ブラウザ側 JavaScript で制御）
  - テーマ＆ヒント表示（`talk_themes.csv` を読み込み）
  - カンペ送信（定型 + 任意入力、WebSocket で prompt に送信）
  - 起動時に組番号 / セッション / 進行役 / 参加者のフルネームを登録してから UI を開始
  - タイムコード付きメモ記録（`report.csv` に追記）  
    └ カテゴリ選択→「タイムコードを記録」で即刻タイムスタンプ→必要なら詳細を書き「保存」で確定
  - 「完了」ボタンで収録回数（1〜3回目）ごとの CSV (`組_セッション_takeX.csv`) を作成、全工程終了後の「結果出力」でサマリー CSV (`組_セッション_summary.csv`) を出力可能
- `/prompt` : 参加者へ共有するカンペ画面
  - 黒背景・白文字で最新カンペ1行を大きく表示
  - WebSocket でリアルタイム更新
  - 収録開始時は 3→2→1→スタートのカウントダウン、終了時は 5→…→1→終了→「お疲れ様でした」を自動表示
  - 30分経過 / 残り15・10・5・3・1分 / 残り30秒・10秒などの節目で注意メッセージを表示し、残り1分未満はタイム表示を自動強調

## データファイル
- `recpilot/data/talk_themes.csv`
  - 列: `No,カテゴリ,テーマ内容,会話の例・ヒント`
  - ヒントは「・」や改行で区切って最大 3 行表示
- `recpilot/data/report.csv`
  - 列: `日時,組番号,セッション,タイムコード,内容,カテゴリ`
  - `/control` 画面でメモ保存時に追記
- `recpilot/data/exports/`
  - Finish ボタンからダウンロードした CSV の保存先（サーバー側にも書き出し）
  - `Export All` で生成したサマリー CSV も同ディレクトリに保存されます

## 今後の拡張候補
- Google Sheets 連携 (gspread) や OAuth 認証
- URL トークン / PIN によるアクセス制御
- Prompt 側の表示テーマ切り替えや複数同時セッション対応
- Render / Vercel / Cloud Run などへのデプロイ設定

## 開発の流れ（推奨）
1. Flask + SocketIO のローカル起動で UI を確認
2. `talk_themes.csv` を現場に合わせて更新
3. 収録後に `recpilot/data/report.csv` を Google Sheets 等に取り込んでレポート化
4. 必要であれば gspread 等でクラウド同期を追加

---

この README は Web UI ベースの RecPilot 仕様に沿って更新されています。以前の Electron 版資料は `legacy/` 配下や docs を参照してください。

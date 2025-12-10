# バックエンドプロセス設計

## 録画検出と状態管理
1. `chokidar` で Zoom 録画フォルダを監視 (`.zoom`, `.tmp`, `.m4a`)。
2. 新規ファイル検出時に `activeFiles` マップへ登録し、サイズ変化を追跡。
3. 一定秒数（例: 5 秒）サイズが増加していれば録画中と判定し、Renderer の録画インジケータを更新。
4. 更新が停止して 10 秒以上経過し、サイズが安定したら変換完了とみなし、処理キューに投入。
5. macOS のファイルロック取得が難しいため、サイズ安定＋更新時刻不変をもって確定とする。Windows では追加で共有ロック判定を併用。

## 処理キュー
- Node 側で `bullmq` などを利用してもよいが、初期は簡易な in-memory キューを Python ワーカーへ橋渡し。
- キュー項目には `segment_meta`, `file_paths`, `tasks (naming, pdf, upload)` を含める。
- 成功/失敗ステータスを Renderer へ順次通知し、UI でログを更新。

## ファイル命名・メタ生成
1. `export_root` と会議識別子をもとにセッションルートを生成。
2. セグメントごとにスラッグ化したテーマ名を利用してファイル名を組み立てる。
3. `00_session_meta.json` に環境情報とセグメント一覧を記録。
4. `01_theme_{segNo}_{slug}.json` にはテーマ・ヒント使用状況・タイムスタンプを記録。

## ffmpeg ラッパ
```python
def make_lr_stereo(mic_a, mic_b, out_path):
    cmd = [
        "ffmpeg", "-y",
        "-i", mic_a, "-i", mic_b,
        "-filter_complex",
        "[0:a]aformat=channel_layouts=mono[a0];"
        "[1:a]aformat=channel_layouts=mono[a1];"
        "[a0][a1]join=inputs=2:channel_layout=stereo[a]",
        "-map", "[a]", "-ar", "48000", "-c:a", "pcm_s16le", out_path
    ]
    run(cmd, check=True)
```
- 追加で `loudnorm` を適用する場合は第 2 段階のコマンドとして実行。
- エラーハンドリングは `CalledProcessError` をキャッチし、再試行キューへ戻す。

## アップロードワークフロー
1. Python 側で `upload.py` コマンド相当のエントリポイントを実装。
2. 共通パラメータ: `provider`, `src`, `dest`, `config`。
3. 各プロバイダは共通インターフェースを実装し、`chunk_size`, `retries`, `backoff` を設定。
4. 成功時に `upload_report.csv` へ追記。MD5 は事前に計算し、結果と比較。
5. 失敗時は再試行カウンタを増加させ、上限超過でユーザー通知。

## 同意 PDF 生成
1. Electron Renderer から同意フォーム入力値 (氏名, 会議 ID, 同意チェック, タイムスタンプ) を Main へ送信。
2. Main で Python ワーカーに `generate_consent_pdf` コマンドを送信。
3. Python 側で Jinja2 テンプレートに値を流し込み HTML を生成。
4. `wkhtmltopdf` or `weasyprint` を呼び出して `00_consent.pdf` を作成。
5. 完了イベントを Renderer へ返し、UI で同意完了を表示。

## ヘッドホン漏れ自己診断
1. Renderer で WebAudio API を使い `getUserMedia({audio:true})` でマイク入力を取得。
2. `AudioWorklet` もしくは `ScriptProcessor` で RMS レベルを算出。
3. 5 秒の平均レベルを算出し、`-40dBFS` を閾値として判定。
4. 結果を保持し、セッションメタにも記録する。

## ログとエラーハンドリング
- Node/Python 双方で構造化ログ (JSON Lines) を採用し、重大イベントは UI にバナー表示。
- 致命的エラー発生時は「再試行」「スキップ」「サポートに送信」オプションを提示。
- 予期せぬエラーは Sentry 等へのオプション送信も将来検討。

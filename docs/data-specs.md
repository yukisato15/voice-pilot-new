# データ仕様

## ディレクトリ構造
```
/ExportRoot/{YYYYMMDD_HHMMSS}_{MeetingID}/
  00_consent.pdf
  00_session_meta.json
  01_theme_{segNo}_{slug}.json
  A_{segNo}_{slug}.m4a
  B_{segNo}_{slug}.m4a
  AB_{segNo}_{slug}_LR.wav          # 任意
  AB_{segNo}_{slug}_cues.json       # 無音・ヒント・ビープログ
  upload_report.csv
```

- `slug`: テーマタイトルを正規化（小文字, スペース→ハイフン, 許可文字のみ）。
- `segNo`: セッション内で 1 からインクリメント。

## セッションメタ (`00_session_meta.json`)
```json
{
  "app_version": "1.0.0",
  "meeting_id": "XXXXXXXX",
  "started_at": "2025-10-17T10:00:00+09:00",
  "os": "macOS 14.5",
  "zoom_version": "6.1.x",
  "recording_folder": "/Users/.../Documents/Zoom",
  "sample_rate": 48000,
  "operator": "ParticipantA",
  "segments": [
    {
      "seg_no": 1,
      "theme_id": "T-000123",
      "title": "子どもの頃の定番おやつ",
      "talk_start": 3.0,
      "talk_end": 355.0,
      "end_silence": 5.0
    }
  ]
}
```
- `talk_start`, `talk_end` は無音区間を除いた実測値。計測できない場合は予定値を格納。

## キュー情報 (`AB_{segNo}_{slug}_cues.json`)
```json
{
  "start_silence_sec": 3.0,
  "end_silence_sec": 5.0,
  "hints_used": [3, 7, 12],
  "beep": false
}
```
- `hints_used`: 表示したヒント番号。UI 側で保持し、完了時に Python へ送信。

## テーマ CSV スキーマ
```
theme_id,category,title,role_A_prompt,role_B_prompt,
hint_01,hint_02,hint_03,hint_04,hint_05,
hint_06,hint_07,hint_08,hint_09,hint_10,
hint_11?,hint_12?,hint_13?,hint_14?,hint_15?
```
- 最大 15 ヒントまでを許容し、欠番は空文字で埋める。
- 重複検出: タイトルを正規化 (`lower`, 全角半角統一, 記号除去) したハッシュで判定。
- CSV は初回 100 行を同梱し、運用では 30 カテゴリ × 100 本（計 3,000 本）を扱う。

## 設定ファイル (`config.json`)
```json
{
  "export_root": "/ExportRoot",
  "zoom_recording_dir": "/Users/.../Documents/Zoom",
  "upload": {
    "provider": "s3",
    "dest": "s3://mybucket/datasets",
    "credentials_path": "/Users/.../aws-cred.json"
  },
  "audio": {
    "sample_rate": 48000,
    "beep_enabled": false,
    "bgm_enabled": false
  },
  "session": {
    "talk_seconds": 360,
    "start_silence": 3,
    "end_silence": 5,
    "interval_seconds": 60,
    "break_every_minutes": 30,
    "break_length_minutes": 5
  },
  "themes": {
    "csv_path": "/path/to/themes.csv"
  }
}
```
- 設定変更は UI から行い、`electron-store` 経由で保存。
- 認証情報は OS キーチェーン (`keytar`) に保存し、パスにはトークン名を格納。

## ログ・レポート
- `app.log`: UI 操作、重大イベント、エラー。ローテーションを 10MB 程度で設計。
- `upload_report.csv`: `file_name,size,md5,result,retries,timestamp` を追記記録。失敗時は再試行キューに rester。

# MyNews — 自分専用パーソナルニュース

好きな情報だけを1時間ごとに自動収集する、SmartNews風のPWA（ホーム画面に追加できるWebアプリ）。

## 仕組み
- `fetch_news.py` … `config.json` のキーワードごとに Google ニュース検索RSSを取得 → `docs/data.json` に保存（APIキー不要）
- `docs/` … 表示用のWebアプリ（GitHub Pagesで公開）
- `run.sh` … 収集 → git push をまとめて実行（launchdで1時間ごと）

## 興味キーワードの編集
`config.json` の `topics[].queries` を書き換えるだけ。
- 1行が1つの検索クエリ（Googleニュース検索と同じ書き方）
- `enabled: false` でそのトピックを一時停止
- `emoji` / `category` で表示の見た目とタブが決まる

例）好きなアーティストを追加:
```json
"queries": ["米津玄師 (ライブ OR ツアー OR チケット)", "新しい名前 ライブ"]
```

## 手動更新
```bash
/Users/shota/opt/anaconda3/bin/python3 fetch_news.py   # 収集のみ
./run.sh                                                # 収集＋push
```

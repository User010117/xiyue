# 曦月 - ピクセル制作ワークベンチ

[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

ピクセル画像・フレームシーケンスツール集。動画フレーム抽出、GIF処理、画像マット、スプライトシート合成などに対応。

AIピクセルショップK プレビュー

## 曦月ワークベンチ更新

- **モダンピクセル・ワークベンチ**：暖色キャンバス、墨紺ナビ、煉瓦色の主要操作、2px の硬い枠線とぼかしのない影を採用。AI 優先のカテゴリ、検索、最近使用、お気に入り、右側素材ドロワーは維持。
- **統一ピクセルアイコン**：20 ツール、6 カテゴリ、共通操作をローカル 16×16 SVG グリッドで統一し、外部フォントや大型画像を追加しない。
- **曦月工房**：旧高度工房の分割・拡縮・ワークフロー機能を維持し、内部名と旧ストレージキーも互換。
- **安全と性能**：API Key は既定でセッションのみ、アップロードはストリーム制限、RQ ID 永続化、大型ツールは遅延読み込み。
- **ショートカット**：`Ctrl/Cmd+K` で検索、`Esc` でワークベンチへ戻る。競合する単一キーは削除。
- **レスポンシブ**：デスクトップは 240px サイドバーと API 入力／履歴の2カラム、900px 未満はドロワー、390px は横スクロールなしの1カラム。
- **GIF ↔ フレーム**：初期タブは **複数画像→1枚**；入力はデフォルト **1枚を分割**（グリッド分割後に合成）。
- **Sprite Sheet 調整**：アニメプレビューに方向ボタン、**A/D** で選択フレーム切替（入力中を除く）；フレームごとのオフセット後に **再結合** でシート出力。
- **テストシーン**：ホーム先頭行に **Top-down** と **アーケード** のデモ。

## 機能モジュール

### 動画とフレーム

- **動画→フレーム**：動画アップロード、フレーム抽出、rembgマット、スプライトシート生成
- **GIF ↔ フレーム**：GIF からフレーム抽出、フレーム→GIF、複数画像→1枚（デフォルトタブ）、1枚をグリッド分割して再合成、分割、簡易ステッチ（上下/左右）
- **Sprite Sheet**：フレーム画像分割 / GIF合成
- **Sprite Sheet 調整**：分割プレビュー、フレーム選択、アニメプレビュー、**A/D** 等でフレーム移動、オフセット後の再結合出力

### 画像処理

- **ピクセル画像処理**：2つの入口
  - **通常処理**：スケール、内側ストローク、トリム、マット（グリーン/ブルーバック）
    - **RPGMAKER ワンクリック**：Gemini透かし除去 → 左上から連結領域マット(容差80/羽化5) → 144×144 → RPGMAKER出力
    - **RPGMAKER V2 ワンクリック（5行）**：透かし除去→256×256→先頭ピクセル連結領域マット→右64px・下透明64px→3/4行目64px下・3行目に2行目鏡像→5×3分割・各セル四辺8px裁断結合→144×240
    - **RPGMAKER V2 ワンクリック（4行）**：5行版と同じ後、下48px裁断→144×192
    - **1枚全アクション**：Gemini透かし除去 → 256×256 → 左上マット(容差80) → 右/下4px裁断 → 252×252
    - **RPGMAKER 生成**：3行分割、2行目反転複製、3行目48px下移動
  - **精密編集**：ブラシ、消しゴム、スーパー消しゴム（連結領域+容差）、背景色切替、アンドゥ(Ctrl+Z)、ズーム、パン
- **クロマキー**：グリーン/ブルーバック除去、抑色、エッジ平滑
- **ピクセル化**：ピクセルブロックスタイルに変換
- **拡大・縮小**：N×Mグリッド裁断・結合
- **Gemini 透かし除去**：Gemini生成画像の透かしを除去

### nanobanana シリーズ

- **nanobanana RPG Maker キャラ素材生成**：GeminiでRPG Makerキャラ素材生成
- **nanobanana ピクセルシーン**・**立ち絵生成**：Geminiリンク
- **nanob 全キャラアクション**：連生アクション V4Tx3 等

### 曦月工房（効率ツール）

- **曦月工房**：**カスタム縮尺**・**カスタムスライス**・**サイズ統一**・**シート調整 Pro** などのローカルツール。ログイン不要です。

### デモ・試験

- **Top-down テスト**、**アーケード テスト**：操作・レイヤー描画の試験用（本番パイプライン以外）。

### その他

- **Seedance 2.0 動画透かし除去**：ローカルバックエンド要。Seedance/即梦動画の「AI生成」を除去
- **素材・ゲームソース共有**：01-美術素材、Godotスクリプト、完成プロジェクト（AIピクセルショップK含む）

### Web ショートカット

- **Ctrl / Cmd + K**：全体ツール検索を開く。
- **Esc**：オーバーレイを閉じる、またはトップレベルツールからワークベンチへ戻る。

## 環境要件

- Python 3.11+
- Node.js 18+
- Redis
- FFmpeg（PATHに配置）
- （任意）Docker + Docker Compose

## ローカル開発

### 1. 依存関係インストール

```bash
# バックエンド
pip install -r backend/requirements.txt

# フロントエンド
cd frontend && npm install
```

### 2. Redis 起動

```bash
# Windows: RedisダウンロードまたはDocker
docker run -d -p 6379:6379 redis:7-alpine

# またはローカルにRedisをインストール・起動
```

### 3. サービス起動

```bash
# ターミナル1: API
cd pixelwork
set PYTHONPATH=%CD%
python -m uvicorn backend.app.main:app --reload --port 8000

# ターミナル2: Worker
set PYTHONPATH=%CD%
rq worker pixelwork --url redis://localhost:6379/0

# ターミナル3: フロントエンド
cd frontend && npm run dev
```

[http://localhost:5173](http://localhost:5173) を開く

### 4. rembg / U2Net（バックエンドのみ）

「動画→フレーム」フロントはクロマキー使用のためモデル不要。バックエンド+Workerでサーバー側マットを行う場合、初回にU2Net（約176MB）をダウンロード。

## GitHub Pages プレビュー

GitHub Actionsで`main`へのプッシュ時に自動ビルド・デプロイ。

**初回：Pages有効化**

1. [https://github.com/User010117/xiyue/settings/pages](https://github.com/User010117/xiyue/settings/pages) を開く
2. **Build and deployment**で**Source**を**GitHub Actions**に
3. 保存。以降`main`プッシュで自動デプロイ

**URL:** [https://User010117.github.io/xiyue/](https://User010117.github.io/xiyue/)

> 現在はフロントエンドのみデプロイ。GIF のフレーム抽出・合成、ピクセル画像処理（精密編集含む）、クロマキー、簡易ステッチ、Sprite Sheet、RPGMAKER ワンクリック、動画→フレームが利用可能。

## Docker

```bash
docker-compose up -d
```

- フロント: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:8000](http://localhost:8000)
- Redis: localhost:6379

## API


| メソッド   | パス                               | 説明              |
| ------ | -------------------------------- | --------------- |
| POST   | /jobs                            | タスク作成（動画アップロード） |
| GET    | /jobs/{id}                       | タスク状態取得         |
| GET    | /jobs/{id}/result?format=png|zip | 結果ダウンロード        |
| GET    | /jobs/{id}/index                 | インデックスJSON取得    |
| DELETE | /jobs/{id}                       | タスク削除           |


## インデックスJSON例

```json
{
  "version": "1.0",
  "frame_size": {"w": 256, "h": 256},
  "sheet_size": {"w": 3072, "h": 2048},
  "frames": [
    {"i": 0, "x": 0, "y": 0, "w": 256, "h": 256, "t": 0.000},
    {"i": 1, "x": 256, "y": 0, "w": 256, "h": 256, "t": 0.083}
  ]
}
```

## リンク

- **Bilibili**: [https://space.bilibili.com/285760](https://space.bilibili.com/285760)

## ドキュメント


| 文書                                                         | 内容                       |
| ---------------------------------------------------------- | ------------------------ |
| [DEV_DOC_video2timesheet.md](./DEV_DOC_video2timesheet.md) | 動画→フレーム / スプライトシート設計・API |
| [DEV_PLAN_extensions.md](./DEV_PLAN_extensions.md)         | 拡張計画と実装済み一覧              |
| [DEPLOY.md](./DEPLOY.md)                                   | プッシュ・CNB/EdgeOne・デプロイ注意  |
| [frontend/README.md](./frontend/README.md)                 | フロントエンド README           |

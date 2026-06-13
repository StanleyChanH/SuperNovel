# 📖 SuperNovel

[中文文档](./README_zh-CN.md) | [English](./README.md) | 日本語 | [Français](./README_fr-FR.md)
<div align="center">

✨ **コア機能** ✨

| モジュール | 主な機能 |
|---|---|
| 🎨 小説設定ワークショップ | 世界観構築 / キャラクター設計 / プロット設計図 |
| 📖 インテリジェント章生成 | 多段階生成によりプロットの一貫性を確保 |
| 🧠 状態追跡システム | キャラクター成長軌跡 / 伏線管理 |
| 🔍 セマンティック検索 | ベクトルベースの長期コンテキスト整合性 |
| 📚 ナレッジベース統合 | ローカルドキュメント参照に対応 |
| ✅ 自動校正機能 | プロットの矛盾と論理的衝突を検出 |
| 🌐 Apple スタイル Web UI | FastAPI バックエンド + レスポンシブブラウザインターフェース |

</div>

> 大規模言語モデルを基盤とした多機能小説ジェネレーターです。設定が統一され、論理が緻密な長編ストーリーを効率的に創作することを支援します。

---

## 📑 目次

1. [技術スタック](#-技術スタック)
2. [プロジェクト構成](#-プロジェクト構成)
3. [クイックスタート](#-クイックスタート)
4. [設定ガイド](#️-設定ガイド)
5. [使い方](#-使い方)
6. [FAQ](#-faq)

---

## 🔧 技術スタック

| レイヤー | 技術 |
|---|---|
| **バックエンド** | Python 3.11+, FastAPI, Uvicorn |
| **フロントエンド** | バニラ HTML/CSS/JS（Apple スタイルデザイン） |
| **LLM 統合** | LangChain + OpenAI SDK + Google Genai SDK + Azure SDK |
| **ベクトルデータベース** | ChromaDB（langchain-chroma 経由） |
| **パッケージマネージャー** | [uv](https://docs.astral.sh/uv/) |

10+ の LLM プロバイダーに対応：OpenAI、DeepSeek、Gemini、Azure OpenAI、Azure AI、Ollama、ML Studio、阿里雲百煉、火山エンジン、SiliconFlow、Grok。

---

## 🗂 プロジェクト構成

```
SuperNovel/
├── web/                           # Web アプリケーション
│   ├── app.py                     # FastAPI バックエンド（REST API + WebSocket）
│   └── static/
│       ├── index.html             # Apple スタイル SPA UI
│       ├── css/style.css          # スタイルシート
│       └── js/app.js              # フロントエンドロジック
│
├── novel_generator/               # コア生成エンジン
│   ├── architecture.py            # Step 1: 小説アーキテクチャ（4段階パイプライン）
│   ├── blueprint.py               # Step 2: 章ブループリント生成
│   ├── chapter.py                 # Step 3: 章ドラフト生成
│   ├── finalization.py            # Step 4: 最終化（要約/キャラクター/ベクトル更新）
│   ├── knowledge.py               # ナレッジベースファイルインポート
│   ├── vectorstore_utils.py       # ChromaDB 操作ラッパー
│   └── common.py                  # リトライロジック、テキストクリーニング、ログ
│
├── llm_adapters.py                # LLM アダプターファクトリー（10+ プロバイダー）
├── embedding_adapters.py          # Embedding アダプターファクトリー（6+ プロバイダー）
├── config_manager.py              # 設定の読み込み/保存（JSON、アトミック書き込み）
├── consistency_checker.py         # LLM 駆動の整合性校正
├── prompt_definitions.py          # 中国語プロンプトテンプレート
├── prompt_definitions_en.py       # 英語プロンプトテンプレート
├── chapter_directory_parser.py    # ブループリントテキストパーサー
├── utils.py                       # ファイル I/O、文字数カウントユーティリティ
├── config.example.json            # 設定テンプレート
├── pyproject.toml                 # プロジェクトメタデータと依存関係
└── tests/                         # ユニットテスト
```

---

## 🚀 クイックスタート

### 前提条件

- **Python 3.11+**
- **[uv](https://docs.astral.sh/uv/)** パッケージマネージャー（推奨）または pip

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/StanleyChanH/SuperNovel
cd SuperNovel

# uv で依存関係をインストール（推奨）
uv sync

# または pip で
pip install -e .
```

### Web アプリの起動

```bash
# uv を使用（推奨）
uv run novel-web

# または uvicorn を直接使用
uv run python -m uvicorn web.app:app --host 0.0.0.0 --port 8000

# または pip 環境で
python -m uvicorn web.app:app --host 0.0.0.0 --port 8000
```

ブラウザで **http://localhost:8000** を開いてください。

---

## ⚙️ 設定ガイド

### 初回設定

1. ブラウザで `http://localhost:8000` を開く
2. **Config** タブに移動
3. LLM プロバイダー設定を追加（API Key、Base URL、モデル名など）
4. オプションで Embedding プロバイダー設定を追加
5. **Save Config** をクリック

### 設定構造（`config.json`）

```json
{
  "llm_configs": {
    "My GPT": {
      "api_key": "sk-...",
      "base_url": "https://api.openai.com/v1",
      "interface_format": "OpenAI",
      "model_name": "gpt-4o-mini",
      "temperature": 0.7,
      "max_tokens": 4096,
      "timeout": 600
    }
  },
  "embedding_configs": {
    "My Embedding": {
      "api_key": "sk-...",
      "base_url": "https://api.openai.com/v1",
      "interface_format": "OpenAI",
      "model_name": "text-embedding-ada-002",
      "retrieval_k": 4
    }
  }
}
```

---

## 📘 使い方

### 生成パイプライン

```
Step 1: アーキテクチャ生成 → Novel_architecture.txt
Step 2: ブループリント生成 → Novel_directory.txt
Step 3: 章ドラフト生成   → chapters/chapter_N.txt
Step 4: 章の最終化       → 要約、キャラクター、ベクトルを更新
```

### 手順

1. **小説パラメータを設定** — テーマ、ジャンル、章数、章ごとの文字数、出力ディレクトリを入力。

2. **Step 1: アーキテクチャ生成** — 世界観、キャラクターダイナミクス、初期キャラクター状態、プロットアーキテクチャを作成。

3. **Step 2: ブループリント生成** — 各章のタイトル、位置づけ、役割、クリフハンガー、伏線を生成。

4. **Step 3: 章ドラフト生成** — 章番号を選択して生成をクリック。システムは自動的にアーキテクチャ、ブループリント、要約、キャラクター状態、前章からコンテキストを検索します。

5. **Step 4: 章の最終化** — グローバル要約、キャラクター状態、ベクトルデータベースを更新。

6. **整合性チェック（任意）** — 設定と章内容を比較し、矛盾や論理的衝突を検出。

7. **手順 3–4 を繰り返し** すべての章を生成・確定します。

### ベクトル検索のヒント

- Embedding インターフェースとモデル名を明示的に設定してください。
- ローカル Ollama の Embedding を使用する場合は、先にサービスを起動してください：
  ```bash
  ollama serve
  ollama pull nomic-embed-text
  ```
- Embedding モデルを切り替えた後は `vectorstore` ディレクトリをクリアしてください。

---

## ❓ FAQ

### Q: "Expecting value: line 1 column 1 (char 0)"

API が JSON 以外のコンテンツを返しました（HTML エラーページの可能性）。API Key、Base URL、ネットワーク接続を確認してください。

### Q: HTTP 504 Gateway Timeout

API エンドポイントの安定性とネットワーク接続を確認してください。LLM 設定でタイムアウト値を増やすことも検討してください。

### Q: Embedding プロバイダーを切り替えるには？

Config タブで Embedding 設定を追加または編集し、保存してください。

---

## 🤝 貢献

貢献は歓迎します！[CONTRIBUTING.md](./.github/CONTRIBUTING.md) のガイドラインをご覧ください。

## 📄 ライセンス

本プロジェクトはオープンソースです。自由に使用・改変できます。

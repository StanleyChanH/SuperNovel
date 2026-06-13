# 📖 SuperNovel

中文文档 | [English](./README.md) | [日本語](./README_ja.md) | [Français](./README_fr-FR.md)
<div align="center">

✨ **核心功能** ✨

| 功能模块 | 关键能力 |
|---|---|
| 🎨 小说设定工坊 | 世界观架构 / 角色设定 / 剧情蓝图 |
| 📖 智能章节生成 | 多阶段生成保障剧情连贯性 |
| 🧠 状态追踪系统 | 角色发展轨迹 / 伏笔管理系统 |
| 🔍 语义检索引擎 | 基于向量的长程上下文一致性维护 |
| 📚 知识库集成 | 支持本地文档参考 |
| ✅ 自动审校机制 | 检测剧情矛盾与逻辑冲突 |
| 🌐 Apple 风格 Web UI | FastAPI 后端 + 响应式浏览器界面 |

</div>

> 一款基于大语言模型的多功能小说生成器，助您高效创作逻辑严谨、设定统一的长篇故事。

---

## 📑 目录导航

1. [技术栈](#-技术栈)
2. [项目架构](#-项目架构)
3. [快速开始](#-快速开始)
4. [配置指南](#⚙️-配置指南)
5. [使用教程](#📘-使用教程)
6. [疑难解答](#❓-疑难解答)

---

## 🔧 技术栈

| 层级 | 技术 |
|---|---|
| **后端** | Python 3.11+, FastAPI, Uvicorn |
| **前端** | 原生 HTML/CSS/JS（Apple 风格设计） |
| **LLM 集成** | LangChain + OpenAI SDK + Google Genai SDK + Azure SDK |
| **向量数据库** | ChromaDB（通过 langchain-chroma） |
| **包管理** | [uv](https://docs.astral.sh/uv/) |

支持 10+ LLM 提供商：OpenAI、DeepSeek、Gemini、Azure OpenAI、Azure AI、Ollama、ML Studio、阿里云百炼、火山引擎、硅基流动、Grok。

---

## 🗂 项目架构

```
SuperNovel/
├── web/                           # Web 应用
│   ├── app.py                     # FastAPI 后端（REST API + WebSocket）
│   └── static/
│       ├── index.html             # Apple 风格单页 UI
│       ├── css/style.css          # 样式表
│       └── js/app.js              # 前端逻辑
│
├── novel_generator/               # 核心生成引擎
│   ├── architecture.py            # Step 1: 小说架构（4 阶段流水线）
│   ├── blueprint.py               # Step 2: 章节蓝图生成
│   ├── chapter.py                 # Step 3: 章节草稿生成
│   ├── finalization.py            # Step 4: 定稿（摘要/角色/向量更新）
│   ├── knowledge.py               # 知识库文件导入
│   ├── vectorstore_utils.py       # ChromaDB 操作封装
│   └── common.py                  # 重试机制、文本清洗、日志
│
├── llm_adapters.py                # LLM 适配器工厂（10+ 提供商）
├── embedding_adapters.py          # Embedding 适配器工厂（6+ 提供商）
├── config_manager.py              # 配置加载/保存（JSON，原子写入）
├── consistency_checker.py         # LLM 驱动的一致性审校
├── prompt_definitions.py          # 中文提示词模板
├── prompt_definitions_en.py       # 英文提示词模板
├── chapter_directory_parser.py    # 蓝图文本解析器
├── utils.py                       # 文件 I/O、字数统计工具
├── config.example.json            # 配置模板
├── pyproject.toml                 # 项目元数据与依赖
└── tests/                         # 单元测试
```

---

## 🚀 快速开始

### 环境要求

- **Python 3.11+**
- **[uv](https://docs.astral.sh/uv/)** 包管理器（推荐）或 pip

### 安装

```bash
# 克隆项目
git clone https://github.com/StanleyChanH/SuperNovel
cd SuperNovel

# 使用 uv 安装依赖（推荐）
uv sync

# 或使用 pip
pip install -e .
```

### 启动 Web 应用

```bash
# 使用 uv（推荐）
uv run novel-web

# 或直接使用 uvicorn
uv run python -m uvicorn web.app:app --host 0.0.0.0 --port 8000

# 或在 pip 环境中
python -m uvicorn web.app:app --host 0.0.0.0 --port 8000
```

在浏览器中打开 **http://localhost:8000**

---

## ⚙️ 配置指南

### 首次配置

1. 在浏览器中打开 `http://localhost:8000`
2. 进入 **配置** 标签页
3. 添加 LLM 提供商配置（API Key、Base URL、模型名称等）
4. 可选添加 Embedding 提供商配置
5. 点击 **保存配置**

### 配置结构（`config.json`）

```json
{
  "llm_configs": {
    "我的 GPT": {
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
    "我的 Embedding": {
      "api_key": "sk-...",
      "base_url": "https://api.openai.com/v1",
      "interface_format": "OpenAI",
      "model_name": "text-embedding-ada-002",
      "retrieval_k": 4
    }
  },
  "choose_configs": {
    "architecture_llm": "我的 GPT",
    "chapter_outline_llm": "我的 GPT",
    "final_chapter_llm": "我的 GPT",
    "consistency_review_llm": "我的 GPT"
  }
}
```

### 支持的 LLM 提供商

| 提供商 | 接口格式 | 说明 |
|---|---|---|
| OpenAI | `"OpenAI"` | 官方 API |
| DeepSeek | `"DeepSeek"` | DeepSeek API |
| Google Gemini | `"Gemini"` | Google Genai SDK |
| Azure OpenAI | `"Azure OpenAI"` | Azure 托管 OpenAI |
| Azure AI | `"Azure AI"` | Azure AI Inference |
| Ollama | `"Ollama"` | 本地模型 |
| ML Studio | `"ML Studio"` | 本地 OpenAI 兼容 |
| 阿里云百炼 | `"阿里云百炼"` | 阿里云 |
| 火山引擎 | `"火山引擎"` | 字节跳动火山引擎 |
| 硅基流动 | `"硅基流动"` | SiliconFlow |
| Grok | `"Grok"` | xAI Grok |

---

## 📘 使用教程

### 生成流水线

```
Step 1: 生成小说架构 → Novel_architecture.txt
Step 2: 生成章节蓝图 → Novel_directory.txt
Step 3: 生成章节草稿 → chapters/chapter_N.txt
Step 4: 定稿当前章节 → 更新摘要、角色状态、向量库
```

### 详细步骤

1. **设置小说参数** — 输入主题、类型、章节数、每章字数和输出目录。

2. **Step 1: 生成小说架构** — 创建世界观、角色动力学、初始角色状态表和情节架构。

3. **Step 2: 生成章节蓝图** — 生成每章的标题、定位、作用、悬念和伏笔。

4. **Step 3: 生成章节草稿** — 选择章节号后点击生成。系统会自动从架构、蓝图、摘要、角色状态和前文中检索上下文，通过语义搜索确保连贯性。

5. **Step 4: 定稿当前章节** — 更新全局摘要、角色状态、向量数据库，并在字数不足时可选扩写。

6. **一致性审校（可选）** — 比对设定与章节内容，检测剧情矛盾和逻辑冲突。

7. **重复步骤 3–4** 直到所有章节生成并定稿。

### 向量检索提示

- 在配置中明确设置 Embedding 接口格式和模型名称。
- 使用本地 Ollama 的 Embedding 时需先启动服务：
  ```bash
  ollama serve
  ollama pull nomic-embed-text
  ```
- 切换不同 Embedding 模型后建议清空 `vectorstore` 目录。

---

## ❓ 疑难解答

### Q: "Expecting value: line 1 column 1 (char 0)"

API 返回了非 JSON 内容（可能是 HTML 错误页面）。请检查 API Key、Base URL 和网络连接。

### Q: HTTP 504 Gateway Timeout

检查 API 端点稳定性和网络连接。可以考虑在 LLM 配置中增加超时时间。

### Q: 如何切换 Embedding 提供商？

在配置标签页中添加或编辑 Embedding 配置，然后保存即可。

---

## 🤝 参与贡献

欢迎贡献！请参阅 [CONTRIBUTING.md](./.github/CONTRIBUTING.md) 了解贡献指南。

## 📄 许可证

本项目开源，可自由使用和修改。

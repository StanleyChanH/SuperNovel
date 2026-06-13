# CLAUDE.md — SuperNovel 项目指南

> 本文件为 Claude Code 提供项目上下文，帮助理解架构、约定和开发决策。

## 项目概述

基于大语言模型的长篇小说生成工具，具备世界观构建、角色设计、分章节生成、语义检索一致性维护和自动审校等能力。通过 FastAPI Web 后端 + Apple 风格前端界面提供全流程操作。

- **语言**: Python 3.11+（推荐 3.12–3.14）
- **Web 框架**: FastAPI + Uvicorn
- **前端**: 原生 HTML/CSS/JS（Apple 风格单页应用）
- **LLM 集成**: LangChain + OpenAI SDK + Google Genai SDK + Azure SDK
- **向量数据库**: ChromaDB（通过 langchain-chroma）
- **文本处理**: NLTK（分句）
- **包管理**: uv（pyproject.toml）

## 项目结构

```
SuperNovel/
├── web/                               # Web 应用层
│   ├── app.py                         # FastAPI 后端（REST API + WebSocket）
│   └── static/
│       ├── index.html                 # Apple 风格单页 UI
│       ├── css/style.css              # 样式表
│       └── js/app.js                  # 前端逻辑
│
├── novel_generator/                   # 核心生成引擎
│   ├── __init__.py                    # 公开 API 导出
│   ├── common.py                      # 重试机制、文本清洗、日志
│   ├── architecture.py                # Step1: 小说架构生成（4 步流水线）
│   ├── blueprint.py                   # Step2: 章节蓝图生成（支持分块）
│   ├── chapter.py                     # Step3: 章节草稿生成（提示词构建 + LLM 调用）
│   ├── finalization.py                # Step4: 定稿（摘要/角色/向量库更新）
│   ├── knowledge.py                   # 知识库文件导入
│   └── vectorstore_utils.py           # ChromaDB 操作封装
│
├── config_manager.py                  # 配置加载/保存（JSON，原子写入）
├── config.example.json                # 配置模板
├── llm_adapters.py                    # LLM 适配器工厂（10+ 提供商）
├── embedding_adapters.py              # Embedding 适配器工厂（6+ 提供商）
├── prompt_definitions.py              # 中文提示词（雪花写作法等）
├── prompt_definitions_en.py           # 英文提示词
├── consistency_checker.py             # 一致性审校（LLM 驱动）
├── chapter_directory_parser.py        # 章节蓝图文本解析器
├── utils.py                           # 文件 I/O、字数统计工具
├── pyproject.toml                     # 项目元数据与依赖
│
└── tests/
    └── test_chapter_directory_parser.py   # 蓝图解析器单元测试
```

## 核心生成流水线

```
用户输入 (topic, genre, chapters, word_count)
     │
     ▼
Step1: Novel_architecture_generate (architecture.py)
  ├── 1a. core_seed_prompt → 核心种子
  ├── 1b. character_dynamics_prompt → 角色动力学
  ├── 1c. create_character_state_prompt → 初始角色状态表
  ├── 1d. world_building_prompt → 世界观
  ├── 1e. plot_architecture_prompt → 三幕式情节
  └── 输出: Novel_architecture.txt + character_state.txt
  （支持断点续传 via partial_architecture.json）
     │
     ▼
Step2: Chapter_blueprint_generate (blueprint.py)
  ├── 单次生成（章节数 ≤ chunk_size）
  └── 分块生成（大章节数，每次生成一批）
  输出: Novel_directory.txt
     │
     ▼
Step3: generate_chapter_draft (chapter.py)
  ├── 读取上下文（架构/目录/摘要/角色状态/前3章）
  ├── 生成当前章节摘要（summarize_recent_chapters）
  ├── 知识库检索（关键词生成 → 向量检索 → 内容过滤）
  └── LLM 生成章节正文
  输出: chapters/chapter_N.txt
     │
     ▼
Step4: finalize_chapter (finalization.py)
  ├── 更新 global_summary.txt（LLM 增量更新）
  ├── 更新 character_state.txt（LLM 增量更新）
  ├── 向量库插入新章节分段
  └── 可选扩写（字数不足时）
     │
     ▼
[可选] check_consistency (consistency_checker.py)
  └── LLM 比对设定 vs 章节内容，检测冲突
```

## 适配器模式

### LLM 适配器（llm_adapters.py）

工厂函数 `create_llm_adapter(interface_format, ...)` 根据格式字符串返回对应适配器：

| interface_format | 适配器类 | 底层实现 |
|---|---|---|
| `"OpenAI"` | `OpenAIAdapter` | `langchain_openai.ChatOpenAI` |
| `"DeepSeek"` | `DeepSeekAdapter` | `langchain_openai.ChatOpenAI` |
| `"Gemini"` | `GeminiAdapter` | `google.genai.Client` |
| `"Azure OpenAI"` | `AzureOpenAIAdapter` | `langchain_openai.AzureChatOpenAI` |
| `"Azure AI"` | `AzureAIAdapter` | `azure.ai.inference.ChatCompletionsClient` |
| `"Ollama"` | `OllamaAdapter` | `langchain_openai.ChatOpenAI`（OpenAI 兼容） |
| `"ML Studio"` | `MLStudioAdapter` | `langchain_openai.ChatOpenAI`（OpenAI 兼容） |
| `"阿里云百炼"` | `OpenAIAdapter` | 复用 OpenAI 适配器 |
| `"火山引擎"` | `VolcanoEngineAIAdapter` | `openai.OpenAI` |
| `"硅基流动"` | `SiliconFlowAdapter` | `openai.OpenAI` |
| `"Grok"` | `GrokAdapter` | `openai.OpenAI` |

**新增提供商**：继承 `BaseLLMAdapter`，实现 `invoke(prompt) -> str`，然后在 `create_llm_adapter` 工厂中注册。

### Embedding 适配器（embedding_adapters.py）

工厂函数 `create_embedding_adapter(interface_format, ...)` 返回对应适配器：

| interface_format | 适配器类 |
|---|---|
| `"OpenAI"` | `OpenAIEmbeddingAdapter` |
| `"Azure OpenAI"` | `AzureOpenAIEmbeddingAdapter` |
| `"Ollama"` | `OllamaEmbeddingAdapter` |
| `"ML Studio"` | `MLStudioEmbeddingAdapter` |
| `"Gemini"` | `GeminiEmbeddingAdapter` |
| `"SiliconFlow"` | `SiliconFlowEmbeddingAdapter` |

**新增提供商**：继承 `BaseEmbeddingAdapter`，实现 `embed_documents(texts)` 和 `embed_query(query)`。

## 配置体系

`config.json` 存储所有配置，结构如下：

```json
{
  "llm_configs": {             // 命名 LLM 配置组（可多个）
    "配置名": {
      "api_key": "", "base_url": "", "model_name": "",
      "temperature": 0.7, "max_tokens": 8192, "timeout": 600,
      "interface_format": "OpenAI"
    }
  },
  "embedding_configs": { ... }, // 命名 Embedding 配置组
  "choose_configs": {           // 各步骤使用哪个 LLM 配置
    "prompt_draft_llm": "...",
    "chapter_outline_llm": "...",
    "architecture_llm": "...",
    "final_chapter_llm": "...",
    "consistency_review_llm": "..."
  },
  "other_params": { ... },      // 小说参数
  "proxy_setting": { ... },     // 代理设置
  "webdav_config": { ... }      // WebDAV（定义但未使用）
}
```

- 配置读写通过 `config_manager.py`，使用线程锁 `_config_lock` 和原子写入（tempfile + os.replace）

## Web 应用架构

### 后端（web/app.py）

- **框架**: FastAPI，提供 REST API + WebSocket
- **API 前缀**: 所有生成相关端点在 `/api/generate/`，配置在 `/api/config`，内容在 `/api/content/`
- **WebSocket**: `/ws` 端点用于实时日志推送（`ConnectionManager` 管理连接）
- **线程模型**: 生成操作通过 `asyncio.run_in_executor` 在线程池中执行，通过 WebSocket 广播日志
- **日志广播**: `manager.make_log_func()` 返回可传递给生成器的日志回调函数

### 前端（web/static/）

- **单页应用**: `index.html` 包含所有 UI，通过 JavaScript 动态切换视图
- **Apple 风格设计**: 圆角、毛玻璃效果、渐变背景
- **实时日志**: 通过 WebSocket 连接接收生成进度
- **无构建步骤**: 纯 HTML/CSS/JS，无需 npm 或打包工具

### API 端点概览

| 端点 | 方法 | 功能 |
|---|---|---|
| `/api/config` | GET/POST | 获取/保存配置 |
| `/api/config/test-llm` | POST | 测试 LLM 连接 |
| `/api/config/test-embedding` | POST | 测试 Embedding 连接 |
| `/api/generate/architecture` | POST | 生成小说架构 |
| `/api/generate/blueprint` | POST | 生成章节蓝图 |
| `/api/generate/chapter` | POST | 生成章节草稿 |
| `/api/generate/finalize` | POST | 定稿章节 |
| `/api/generate/consistency` | POST | 一致性审校 |
| `/api/generate/prompt-preview` | POST | 预览提示词 |
| `/api/generate/batch` | POST | 批量生成 |
| `/api/content/{type}` | GET/POST | 读取/保存内容文件 |
| `/api/chapters` | GET | 列出所有章节 |
| `/api/chapter/{num}` | GET/POST | 读取/保存单章 |
| `/api/knowledge/import` | POST | 导入知识库文件 |
| `/api/knowledge/clear` | POST | 清空向量库 |
| `/api/roles/*` | various | 角色库 CRUD |
| `/ws` | WebSocket | 实时日志推送 |

## 输出文件结构

```
<filepath>/
├── Novel_architecture.txt          # 小说完整设定
├── Novel_directory.txt             # 章节蓝图（标题+定位+作用+悬念+伏笔+简述）
├── character_state.txt             # 角色状态文档
├── global_summary.txt              # 全局前文摘要
├── plot_arcs.txt                   # 剧情要点/未解决冲突
├── partial_architecture.json       # 架构生成断点续传文件
├── chapters/
│   ├── chapter_1.txt               # 定稿章节
│   ├── chapter_2.txt
│   └── ...
├── vectorstore/                    # ChromaDB 持久化数据
└── 角色库/                          # 角色文件（按分类组织）
    ├── 全部/
    ├── 分类A/
    └── ...
```

## 开发约定

### 代码风格
- 文件头统一 `# -*- coding: utf-8 -*-`
- 日志使用 Python `logging` 模块，写入 `app.log`
- 异常处理：捕获后 logging + traceback，API 层返回 JSON 错误响应
- 所有 LLM 调用通过 `invoke_with_cleaning()` 包装（自动清理 ````markdown` 标记 + 重试）

### 线程安全
- FastAPI 异步端点中通过 `asyncio.run_in_executor` 调用同步生成函数
- 配置文件读写通过 `threading.RLock()` 保护
- 文件写入使用原子操作（tempfile + os.replace）

### 提示词管理
- 所有提示词集中存放在 `prompt_definitions.py`（中文）和 `prompt_definitions_en.py`（英文）
- 提示词使用 Python f-string 的 `.format()` 占位符
- 新增提示词时需同时更新中英文两个文件

### 向量库
- 使用 ChromaDB + LangChain 集成，持久化到 `<filepath>/vectorstore/`
- 通过 `LCEmbeddingWrapper` 将自定义适配器桥接到 LangChain 的 Embeddings 接口
- 章节文本按 500 字分段后存入向量库

## 运行与测试

```bash
# 安装依赖（使用 uv）
uv sync

# 运行 Web UI
uv run novel-web
# 或
uv run python -m uvicorn web.app:app --host 0.0.0.0 --port 8000

# 运行测试
uv run python -m pytest tests/
```

### 兼容方式（pip）
```bash
pip install -e .
python -m uvicorn web.app:app --host 0.0.0.0 --port 8000
python -m pytest tests/
```

## 已知扩展点

1. **新增 LLM 提供商**: 在 `llm_adapters.py` 中新增适配器类 + 在 `create_llm_adapter` 工厂注册
2. **新增 Embedding 提供商**: 在 `embedding_adapters.py` 中新增适配器类 + 在工厂注册
3. **新增提示词模板**: 在 `prompt_definitions.py` / `prompt_definitions_en.py` 中添加
4. **新增 API 端点**: 在 `web/app.py` 中添加路由 + 在 `web/static/js/app.js` 中添加前端调用
5. **新增生成步骤**: 在 `novel_generator/` 中新增模块，在 `web/app.py` 中添加 API 端点
6. **WebDAV 同步**: `webdav_config` 已定义但功能未实现

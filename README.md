# 📖 SuperNovel

[中文文档](./README_zh-CN.md) | English | [日本語](./README_ja.md) | [Français](./README_fr-FR.md)
<div align="center">

✨ **Core Features** ✨

| Module | Key Capabilities |
|---|---|
| 🎨 Novel Setting Workshop | Worldbuilding / Character Design / Plot Blueprint |
| 📖 Intelligent Chapter Generation | Multi-stage generation to ensure plot coherence |
| 🧠 State Tracking System | Character development trajectory / Foreshadowing management |
| 🔍 Semantic Search Engine | Vector-based long-term context consistency |
| 📚 Knowledge Base Integration | Supports local document references |
| ✅ Automatic Proofreading | Detects plot contradictions and logical conflicts |
| 🌐 Apple-style Web UI | FastAPI backend + responsive browser interface |

</div>

> A multifunctional novel generator built on large language models. Helps you efficiently create long-form stories with consistent settings and rigorous logic.

---

## 📑 Table of Contents

1. [Tech Stack](#-tech-stack)
2. [Project Structure](#-project-structure)
3. [Quick Start](#-quick-start)
4. [Configuration Guide](#⚙️-configuration-guide)
5. [User Guide](#📘-user-guide)
6. [FAQ](#❓-faq)

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Frontend** | Vanilla HTML/CSS/JS (Apple-style design) |
| **LLM Integration** | LangChain + OpenAI SDK + Google Genai SDK + Azure SDK |
| **Vector Database** | ChromaDB (via langchain-chroma) |
| **Package Manager** | [uv](https://docs.astral.sh/uv/) |

Supports 10+ LLM providers: OpenAI, DeepSeek, Gemini, Azure OpenAI, Azure AI, Ollama, ML Studio, 阿里云百炼, 火山引擎, 硅基流动, Grok.

---

## 🗂 Project Structure

```
SuperNovel/
├── web/                           # Web application
│   ├── app.py                     # FastAPI backend (REST API + WebSocket)
│   └── static/
│       ├── index.html             # Apple-style single-page UI
│       ├── css/style.css          # Stylesheet
│       └── js/app.js              # Frontend logic
│
├── novel_generator/               # Core generation engine
│   ├── architecture.py            # Step 1: Novel architecture (4-stage pipeline)
│   ├── blueprint.py               # Step 2: Chapter blueprint generation
│   ├── chapter.py                 # Step 3: Chapter draft generation
│   ├── finalization.py            # Step 4: Finalization (summary/roles/vectors)
│   ├── knowledge.py               # Knowledge base file import
│   ├── vectorstore_utils.py       # ChromaDB operations
│   └── common.py                  # Retry logic, text cleaning, logging
│
├── llm_adapters.py                # LLM adapter factory (10+ providers)
├── embedding_adapters.py          # Embedding adapter factory (6+ providers)
├── config_manager.py              # Config load/save (JSON, atomic writes)
├── consistency_checker.py         # LLM-driven consistency proofreading
├── prompt_definitions.py          # Chinese prompt templates
├── prompt_definitions_en.py       # English prompt templates
├── chapter_directory_parser.py    # Blueprint text parser
├── utils.py                       # File I/O, word count utilities
├── config.example.json            # Configuration template
├── pyproject.toml                 # Project metadata & dependencies
└── tests/                         # Unit tests
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+**
- **[uv](https://docs.astral.sh/uv/)** package manager (recommended) or pip

### Installation

```bash
# Clone the repository
git clone https://github.com/StanleyChanH/SuperNovel
cd SuperNovel

# Install dependencies with uv (recommended)
uv sync

# Or with pip
pip install -r requirements.txt
```

### Run the Web App

```bash
# With uv (recommended)
uv run novel-web

# Or directly with uvicorn
uv run python -m uvicorn web.app:app --host 0.0.0.0 --port 8000

# Or with pip environment
python -m uvicorn web.app:app --host 0.0.0.0 --port 8000
```

Open your browser and navigate to **http://localhost:8000**

### Legacy Desktop App (Optional)

The CustomTkinter desktop UI is available as an optional extra:

```bash
uv sync --extra desktop
uv run python main.py
```

---

## ⚙️ Configuration Guide

### First-Time Setup

1. Open the web UI at `http://localhost:8000`
2. Navigate to the **Config** tab
3. Add your LLM provider configuration (API key, base URL, model name, etc.)
4. Optionally add an Embedding provider configuration
5. Click **Save Config**

### Configuration Structure (`config.json`)

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
  },
  "choose_configs": {
    "architecture_llm": "My GPT",
    "chapter_outline_llm": "My GPT",
    "final_chapter_llm": "My GPT",
    "consistency_review_llm": "My GPT"
  }
}
```

### Supported LLM Providers

| Provider | Interface Format | Notes |
|---|---|---|
| OpenAI | `"OpenAI"` | Official API |
| DeepSeek | `"DeepSeek"` | DeepSeek API |
| Google Gemini | `"Gemini"` | Google Genai SDK |
| Azure OpenAI | `"Azure OpenAI"` | Azure-hosted OpenAI |
| Azure AI | `"Azure AI"` | Azure AI Inference |
| Ollama | `"Ollama"` | Local models |
| ML Studio | `"ML Studio"` | Local OpenAI-compatible |
| 阿里云百炼 | `"阿里云百炼"` | Alibaba Cloud |
| 火山引擎 | `"火山引擎"` | ByteDance Volcano Engine |
| 硅基流动 | `"硅基流动"` | SiliconFlow |
| Grok | `"Grok"` | xAI Grok |

---

## 📘 User Guide

### Generation Pipeline

```
Step 1: Generate Architecture → Novel_architecture.txt
Step 2: Generate Blueprint    → Novel_directory.txt
Step 3: Generate Chapter      → chapters/chapter_N.txt
Step 4: Finalize Chapter      → Updates summary, characters, vectors
```

### Step-by-Step Workflow

1. **Set novel parameters** — Enter topic, genre, chapter count, words per chapter, and output directory.

2. **Step 1: Generate Architecture** — Creates worldbuilding, character dynamics, initial character states, and plot architecture.

3. **Step 2: Generate Blueprint** — Produces chapter titles, positions, roles, cliffhangers, and plot hooks for all chapters.

4. **Step 3: Generate Chapter** — Select a chapter number and click generate. The system automatically retrieves context from the architecture, blueprint, summaries, character states, and previous chapters via semantic search.

5. **Step 4: Finalize Chapter** — Updates the global summary, character states, vector database, and optionally expands the chapter if word count is insufficient.

6. **Consistency Check (Optional)** — Compares settings against chapter content to detect contradictions.

7. **Repeat Steps 3–4** until all chapters are generated and finalized.

### Vector Retrieval Tips

- Explicitly set the embedding interface and model name in the config.
- For local Ollama embeddings, start the service first:
  ```bash
  ollama serve
  ollama pull nomic-embed-text
  ```
- Clear the `vectorstore` directory after switching embedding models.

---

## ❓ FAQ

### Q: "Expecting value: line 1 column 1 (char 0)"

The API returned non-JSON content (possibly an HTML error page). Check your API key, base URL, and network connectivity.

### Q: HTTP 504 Gateway Timeout

Check the stability of your API endpoint and network connection. Consider increasing the timeout value in your LLM config.

### Q: How do I switch Embedding providers?

Add or edit an embedding configuration in the Config tab, then save.

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./.github/CONTRIBUTING.md) for guidelines.

## 📄 License

This project is open source. Feel free to use and modify.

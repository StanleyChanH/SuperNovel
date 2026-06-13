# 📖 SuperNovel

[中文文档](./README_zh-CN.md) | [English](./README.md) | [日本語](./README_ja.md) | [Français](./README_fr-FR.md) | Sawcuengh

<div align="center">

✨ **Gij Gunghnangz Cojyinh** ✨

| Gunghnangz Moegsiz | Gij Nangzlig Guenhdoh |
|---|---|
| 🎨 Siujsoz Dinzsez Gunghfangh | Seiqgaih gvanhgouz / Gohgyah dizcinz / Gij Gyangmujlwd |
| 📖 Canghgiet Sengcwngz Nangzlig | Doengh gaidaij sengcwngz baujcwngz gij gyangmujlwd mbouj bienh |
| 🧠 Dungzciengj Doica Genjdungz | Gohgyah fazcanj gveilwd / Genjdungz genjli gvanhvenj dungzciengj |
| 🔍 Yiyi Gijca Genjdungz Yinzbingz | Doengh veizciz genjca dauhcingh ndaej ndaej gvanhhoz |
| 📚 Cihswz Goj Cizbungz | Hojyungh doengh banhfap caenhcuengh ndaej gvanhhoz |
| ✅ Swjdoengh Genjgauh Gveiciz | Genjcat gij gyangmujlwd doenghcaeuq yijcoz |
| 🌐 Apple Fwnghgveiz Web UI | FastAPI bauhdoz + doengh gvanh giekou |

</div>

> Doengh gij gij swnjgenh siujsoz sengcwngz doenghgiuj gij daih'yoz yiyi moediz, hoj mwngz ndaej sij ndaej hawjlwd.

---

## 📑 Muhloeg

1. [Gij Gijsuz](#-gij-gijsuz)
2. [Gij Gveilwd Gouzdiz](#-gij-gveilwd-gouzdiz)
3. [Doengh Lij Swnh](#-doengh-lij-swnh)
4. [Beihci Dozdoz](#️-beihci-dozdoz)
5. [Sijyungh Dozdoz](#-sijyungh-dozdoz)
6. [Doenghcaeuq Gijca](#-doenghcaeuq-gijca)

---

## 🔧 Gij Gijsuz

| Doenghsoq | Gijsuz |
|---|---|
| **Bauhdoz** | Python 3.11+, FastAPI, Uvicorn |
| **Doengh gvanh** | HTML/CSS/JS (Apple dizcinz) |
| **LLM** | LangChain + OpenAI SDK + Google Genai SDK + Azure SDK |
| **Veizciz Swhkoj** | ChromaDB |
| **Gienj Gunghgiuj** | [uv](https://docs.astral.sh/uv/) |

Doengh 10+ LLM: OpenAI, DeepSeek, Gemini, Azure OpenAI, Ollama, doengh.

---

## 🗂 Gij Gveilwd Gouzdiz

```
SuperNovel/
├── web/                    # Web caeuq
│   ├── app.py              # FastAPI bauhdoz
│   └── static/             # HTML/CSS/JS
├── novel_generator/        # Doengh sengcwngz yinzqinh
│   ├── architecture.py     # Step 1: Siujsoz gveilwd
│   ├── blueprint.py        # Step 2: Canghgiet lwd
│   ├── chapter.py          # Step 3: Canghgiet sengcwngz
│   └── finalization.py     # Step 4: Dinzgouj
├── llm_adapters.py         # LLM gienjgouz
├── embedding_adapters.py   # Embedding gienjgouz
├── config_manager.py       # Beihci genjli
├── consistency_checker.py  # Doenghcaeuq genjcat
├── prompt_definitions.py   # Cungguek dinzciz
├── pyproject.toml          # Doengh gvanh
└── tests/                  # Doengh genj
```

---

## 🚀 Doengh Lij Swnh

```bash
git clone https://github.com/StanleyChanH/SuperNovel
cd SuperNovel
uv sync
uv run novel-web
```

Doengh doenghlij doengh **http://localhost:8000**

---

## ⚙️ Beihci Dozdoz

1. Doenghlij `http://localhost:8000`
2. Doengh **Config** doengh
3. Doengh LLM beihci (API Key, URL, moediz)
4. Doengh **Save Config**

---

## 📘 Sijyungh Dozdoz

```
Step 1 → Novel_architecture.txt
Step 2 → Novel_directory.txt
Step 3 → chapters/chapter_N.txt
Step 4 → Cingqsin doengh doengh
```

Doengh Step 1-4, doengh canghgiet sengcwngz caeuq dinzgouj.

---

## ❓ Doenghcaeuq Gijca

### Q: "Expecting value" doengh
API mbouj dauhcingh JSON. Genjcat API Key caeuq doenghlij.

### Q: 504 Timeout
Genjcat doenghlij caeuq gvanhgouz.

---

## 🤝 Doengh Doengh

Doengh [CONTRIBUTING.md](./.github/CONTRIBUTING.md) doengh.

## 📄 Cuzgez

Gij gohyenz neix doengh gyaih, hoj mwngz ndaej yungh caeuq doengh.

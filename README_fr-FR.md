# 📖 SuperNovel

[中文文档](./README_zh-CN.md) | [English](./README.md) | [日本語](./README_ja.md) | Français
<div align="center">

✨ **Fonctionnalités Principales** ✨

| Module | Capacités Clés |
|---|---|
| 🎨 Atelier de Configuration | Création d'univers / Conception de personnages / Plan d'intrigue |
| 📖 Génération Intelligente de Chapitres | Génération multi-étapes pour assurer la cohérence de l'intrigue |
| 🧠 Système de Suivi d'État | Trajectoire de développement des personnages / Gestion des présages |
| 🔍 Moteur de Recherche Sémantique | Cohérence du contexte à long terme basée sur les vecteurs |
| 📚 Intégration de Base de Connaissances | Prise en charge des références de documents locaux |
| ✅ Relecture Automatique | Détecte les contradictions d'intrigue et les conflits logiques |
| 🌐 Interface Web style Apple | Backend FastAPI + interface navigateur responsive |

</div>

> Un générateur de romans polyvalent basé sur de grands modèles de langage. Il vous aide à créer efficacement des histoires longues avec des paramètres cohérents et une logique rigoureuse.

---

## 📑 Table des Matières

1. [Stack Technique](#-stack-technique)
2. [Structure du Projet](#-structure-du-projet)
3. [Démarrage Rapide](#-démarrage-rapide)
4. [Guide de Configuration](#️-guide-de-configuration)
5. [Guide de l'Utilisateur](#-guide-de-lutilisateur)
6. [FAQ](#-faq)

---

## 🔧 Stack Technique

| Couche | Technologie |
|---|---|
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Frontend** | HTML/CSS/JS natif (design style Apple) |
| **Intégration LLM** | LangChain + OpenAI SDK + Google Genai SDK + Azure SDK |
| **Base de données vectorielle** | ChromaDB (via langchain-chroma) |
| **Gestionnaire de paquets** | [uv](https://docs.astral.sh/uv/) |

Supporte 10+ fournisseurs LLM : OpenAI, DeepSeek, Gemini, Azure OpenAI, Azure AI, Ollama, ML Studio, Alibaba Cloud, Volcano Engine, SiliconFlow, Grok.

---

## 🗂 Structure du Projet

```
SuperNovel/
├── web/                           # Application web
│   ├── app.py                     # Backend FastAPI (REST API + WebSocket)
│   └── static/
│       ├── index.html             # Interface SPA style Apple
│       ├── css/style.css          # Feuille de styles
│       └── js/app.js              # Logique frontend
│
├── novel_generator/               # Moteur de génération principal
│   ├── architecture.py            # Étape 1 : Architecture du roman (pipeline en 4 étapes)
│   ├── blueprint.py               # Étape 2 : Génération du blueprint des chapitres
│   ├── chapter.py                 # Étape 3 : Génération du brouillon du chapitre
│   ├── finalization.py            # Étape 4 : Finalisation (résumé/personnages/vecteurs)
│   ├── knowledge.py               # Import de fichiers dans la base de connaissances
│   ├── vectorstore_utils.py       # Opérations ChromaDB
│   └── common.py                  # Logique de retry, nettoyage de texte, journalisation
│
├── llm_adapters.py                # Fabrique d'adaptateurs LLM (10+ fournisseurs)
├── embedding_adapters.py          # Fabrique d'adaptateurs Embedding (6+ fournisseurs)
├── config_manager.py              # Chargement/sauvegarde de config (JSON, écriture atomique)
├── consistency_checker.py         # Relecture de cohérence pilotée par LLM
├── prompt_definitions.py          # Modèles de prompts en chinois
├── prompt_definitions_en.py       # Modèles de prompts en anglais
├── chapter_directory_parser.py    # Analyseur de texte de blueprint
├── utils.py                       # E/S fichier, utilitaires de comptage de mots
├── config.example.json            # Modèle de configuration
├── pyproject.toml                 # Métadonnées du projet et dépendances
└── tests/                         # Tests unitaires
```

---

## 🚀 Démarrage Rapide

### Prérequis

- **Python 3.11+**
- Gestionnaire de paquets **[uv](https://docs.astral.sh/uv/)** (recommandé) ou pip

### Installation

```bash
# Cloner le dépôt
git clone https://github.com/StanleyChanH/SuperNovel
cd SuperNovel

# Installer les dépendances avec uv (recommandé)
uv sync

# Ou avec pip
pip install -e .
```

### Lancer l'application Web

```bash
# Avec uv (recommandé)
uv run novel-web

# Ou directement avec uvicorn
uv run python -m uvicorn web.app:app --host 0.0.0.0 --port 8000

# Ou dans un environnement pip
python -m uvicorn web.app:app --host 0.0.0.0 --port 8000
```

Ouvrez votre navigateur et accédez à **http://localhost:8000**

---

## ⚙️ Guide de Configuration

### Configuration initiale

1. Ouvrez l'interface web à `http://localhost:8000`
2. Allez dans l'onglet **Config**
3. Ajoutez la configuration de votre fournisseur LLM (clé API, URL de base, nom du modèle, etc.)
4. Ajoutez facultativement une configuration Embedding
5. Cliquez sur **Save Config**

### Structure de configuration (`config.json`)

```json
{
  "llm_configs": {
    "Mon GPT": {
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
    "Mon Embedding": {
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

## 📘 Guide de l'Utilisateur

### Pipeline de génération

```
Étape 1 : Générer l'architecture → Novel_architecture.txt
Étape 2 : Générer le blueprint   → Novel_directory.txt
Étape 3 : Générer le chapitre    → chapters/chapter_N.txt
Étape 4 : Finaliser le chapitre  → Mise à jour résumé, personnages, vecteurs
```

### Étapes détaillées

1. **Définir les paramètres du roman** — Saisissez le thème, le genre, le nombre de chapitres, les mots par chapitre et le répertoire de sortie.

2. **Étape 1 : Générer l'architecture** — Crée la construction du monde, la dynamique des personnages, les états initiaux et l'architecture de l'intrigue.

3. **Étape 2 : Générer le blueprint** — Produit les titres, positions, rôles, cliffhangers et indices de chaque chapitre.

4. **Étape 3 : Générer le brouillon** — Sélectionnez un numéro de chapitre et cliquez sur générer. Le système récupère automatiquement le contexte à partir de l'architecture, du blueprint, des résumés, des états des personnages et des chapitres précédents via la recherche sémantique.

5. **Étape 4 : Finaliser le chapitre** — Met à jour le résumé global, les états des personnages et la base de données vectorielle.

6. **Vérification de cohérence (facultatif)** — Compare les paramètres au contenu du chapitre pour détecter les contradictions.

7. **Répétez les étapes 3–4** jusqu'à ce que tous les chapitres soient générés et finalisés.

### Conseils de recherche vectorielle

- Définissez explicitement l'interface d'embedding et le nom du modèle dans la configuration.
- Pour les embeddings locaux Ollama, démarrez d'abord le service :
  ```bash
  ollama serve
  ollama pull nomic-embed-text
  ```
- Videz le répertoire `vectorstore` après avoir changé de modèle d'embedding.

---

## ❓ FAQ

### Q : "Expecting value: line 1 column 1 (char 0)"

L'API a renvoyé du contenu non-JSON (probablement une page d'erreur HTML). Vérifiez votre clé API, l'URL de base et la connexion réseau.

### Q : HTTP 504 Gateway Timeout

Vérifiez la stabilité de votre point de terminaison API et la connexion réseau. Envisagez d'augmenter la valeur de timeout dans la configuration LLM.

### Q : Comment changer de fournisseur d'Embedding ?

Ajoutez ou modifiez une configuration Embedding dans l'onglet Config, puis sauvegardez.

---

## 🤝 Contribuer

Les contributions sont les bienvenues ! Consultez [CONTRIBUTING.md](./.github/CONTRIBUTING.md) pour les directives.

## 📄 Licence

Ce projet est open source. Libre d'utilisation et de modification.

# -*- coding: utf-8 -*-
"""
FastAPI backend for SuperNovel web application.
Provides REST API and WebSocket endpoints for all novel generation operations.
"""
import os
import sys
import logging
import asyncio
import json
import shutil
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Ensure project root is on sys.path so existing modules resolve correctly
# ---------------------------------------------------------------------------
PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config_manager import load_config, save_config
from llm_adapters import create_llm_adapter
from embedding_adapters import create_embedding_adapter
from utils import read_file, save_string_to_txt, get_word_count
from consistency_checker import check_consistency

from novel_generator import (
    Novel_architecture_generate,
    Chapter_blueprint_generate,
    build_chapter_prompt,
    generate_chapter_draft,
    finalize_chapter,
    enrich_chapter_text,
    import_knowledge_file,
    clear_vector_store,
)

logging.basicConfig(
    filename="app.log",
    filemode="a",
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CONFIG_FILE = os.path.join(PROJECT_ROOT, "config.json")
WEB_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(WEB_DIR, "static")

CONTENT_TYPE_MAP = {
    "architecture": "Novel_architecture.txt",
    "blueprint": "Novel_directory.txt",
    "character_state": "character_state.txt",
    "summary": "global_summary.txt",
    "plot_arcs": "plot_arcs.txt",
}

# ---------------------------------------------------------------------------
# Pydantic request / response models
# ---------------------------------------------------------------------------

class ConfigBody(BaseModel):
    config: dict


class TestLLMBody(BaseModel):
    interface_format: str
    api_key: str
    base_url: str
    model_name: str
    temperature: float = 0.7
    max_tokens: int = 2048
    timeout: int = 600


class TestEmbeddingBody(BaseModel):
    interface_format: str
    api_key: str
    base_url: str
    model_name: str


class ArchitectureBody(BaseModel):
    filepath: str
    llm_config_name: str
    topic: Optional[str] = ""
    genre: Optional[str] = ""
    num_chapters: Optional[int] = 10
    word_number: Optional[int] = 2000
    user_guidance: Optional[str] = ""


class BlueprintBody(BaseModel):
    filepath: str
    llm_config_name: str
    num_chapters: Optional[int] = 10
    user_guidance: Optional[str] = ""


class ChapterBody(BaseModel):
    filepath: str
    llm_config_name: str
    embedding_config_name: str
    novel_number: int
    word_number: Optional[int] = 2000
    user_guidance: Optional[str] = ""
    characters_involved: Optional[str] = ""
    key_items: Optional[str] = ""
    scene_location: Optional[str] = ""
    time_constraint: Optional[str] = ""
    custom_prompt_text: Optional[str] = None


class FinalizeBody(BaseModel):
    filepath: str
    llm_config_name: str
    embedding_config_name: str
    novel_number: int
    word_number: Optional[int] = 2000


class ConsistencyBody(BaseModel):
    filepath: str
    llm_config_name: str
    novel_number: int


class PromptPreviewBody(BaseModel):
    filepath: str
    llm_config_name: str
    embedding_config_name: str
    novel_number: int
    word_number: Optional[int] = 2000
    user_guidance: Optional[str] = ""
    characters_involved: Optional[str] = ""
    key_items: Optional[str] = ""
    scene_location: Optional[str] = ""
    time_constraint: Optional[str] = ""


class BatchBody(BaseModel):
    filepath: str
    llm_config_name: str
    embedding_config_name: str
    start_chapter: int
    end_chapter: int
    word_number: Optional[int] = 2000
    user_guidance: Optional[str] = ""


class ContentSaveBody(BaseModel):
    filepath: str
    content: str


class ChapterSaveBody(BaseModel):
    filepath: str
    content: str


class KnowledgeClearBody(BaseModel):
    filepath: str


class RoleSaveBody(BaseModel):
    filepath: str
    category: str
    role_name: str
    content: str


class RoleDeleteBody(BaseModel):
    filepath: str
    category: str
    role_name: str


class RoleContentBody(BaseModel):
    filepath: str
    category: str
    role_name: str


class RoleAnalyzeBody(BaseModel):
    filepath: str
    llm_config_name: str
    text: str


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="SuperNovel", version="1.0.0")

if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        logger.info("WebSocket client connected. Total: %d", len(self.active))

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
        logger.info("WebSocket client disconnected. Total: %d", len(self.active))

    async def broadcast(self, message: str):
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)

    def broadcast_sync(self, message: str):
        """Thread-safe broadcast from synchronous code (generation threads)."""
        if self._loop is None or not self.active:
            return
        asyncio.run_coroutine_threadsafe(self.broadcast(message), self._loop)

    def make_log_func(self):
        """Return a callable suitable for passing as log_func to generators."""
        def log_func(msg: str):
            self.broadcast_sync(json.dumps({"type": "log", "message": msg}))
        return log_func


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Helper: adapter factories from saved config
# ---------------------------------------------------------------------------
def _load_full_config() -> dict:
    return load_config(CONFIG_FILE)


def create_llm_from_config(config: dict, config_name: str):
    """Instantiate an LLM adapter from a named entry in llm_configs."""
    llm_cfg = config.get("llm_configs", {}).get(config_name)
    if not llm_cfg:
        raise ValueError(f"LLM config '{config_name}' not found")
    return create_llm_adapter(
        interface_format=llm_cfg["interface_format"],
        base_url=llm_cfg["base_url"],
        model_name=llm_cfg["model_name"],
        api_key=llm_cfg["api_key"],
        temperature=llm_cfg.get("temperature", 0.7),
        max_tokens=llm_cfg.get("max_tokens", 2048),
        timeout=llm_cfg.get("timeout", 600),
    )


def create_embedding_from_config(config: dict, config_name: str):
    """Instantiate an embedding adapter from a named entry in embedding_configs."""
    emb_cfg = config.get("embedding_configs", {}).get(config_name)
    if not emb_cfg:
        raise ValueError(f"Embedding config '{config_name}' not found")
    return create_embedding_adapter(
        interface_format=emb_cfg["interface_format"],
        api_key=emb_cfg["api_key"],
        base_url=emb_cfg["base_url"],
        model_name=emb_cfg["model_name"],
    )


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup():
    manager.set_loop(asyncio.get_running_loop())


# ---------------------------------------------------------------------------
# Static route
# ---------------------------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return HTMLResponse(content=read_file(index_path))
    return HTMLResponse(content="<h1>SuperNovel</h1><p>Static files not found.</p>", status_code=404)


# ---------------------------------------------------------------------------
# Config endpoints
# ---------------------------------------------------------------------------
@app.get("/api/config")
async def api_get_config():
    try:
        cfg = _load_full_config()
        return {"status": "ok", "config": cfg}
    except Exception as e:
        logger.exception("Failed to load config")
        return {"status": "error", "message": str(e)}


@app.post("/api/config")
async def api_save_config(body: dict):
    try:
        ok = save_config(body, CONFIG_FILE)
        if ok:
            return {"status": "ok"}
        return {"status": "error", "message": "Failed to write config file"}
    except Exception as e:
        logger.exception("Failed to save config")
        return {"status": "error", "message": str(e)}


@app.post("/api/config/test-llm")
async def api_test_llm(body: TestLLMBody):
    try:
        adapter = create_llm_adapter(
            interface_format=body.interface_format,
            base_url=body.base_url,
            model_name=body.model_name,
            api_key=body.api_key,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
            timeout=body.timeout,
        )
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(None, adapter.invoke, "Please reply 'OK'")
        if response:
            return {"status": "ok", "response": response}
        return {"status": "error", "message": "No response from LLM"}
    except Exception as e:
        logger.exception("LLM test failed")
        return {"status": "error", "message": str(e)}


@app.post("/api/config/test-embedding")
async def api_test_embedding(body: TestEmbeddingBody):
    try:
        adapter = create_embedding_adapter(
            interface_format=body.interface_format,
            api_key=body.api_key,
            base_url=body.base_url,
            model_name=body.model_name,
        )
        loop = asyncio.get_running_loop()
        embeddings = await loop.run_in_executor(None, adapter.embed_query, "test")
        if embeddings and len(embeddings) > 0:
            return {"status": "ok", "dimensions": len(embeddings)}
        return {"status": "error", "message": "No embedding vector returned"}
    except Exception as e:
        logger.exception("Embedding test failed")
        return {"status": "error", "message": str(e)}


# ---------------------------------------------------------------------------
# Generation endpoints
# ---------------------------------------------------------------------------
@app.post("/api/generate/architecture")
async def api_generate_architecture(body: ArchitectureBody):
    try:
        cfg = _load_full_config()
        llm_cfg = cfg["llm_configs"][body.llm_config_name]
        log_func = manager.make_log_func()
        loop = asyncio.get_running_loop()

        def _run():
            log_func("Starting architecture generation...")
            Novel_architecture_generate(
                interface_format=llm_cfg["interface_format"],
                api_key=llm_cfg["api_key"],
                base_url=llm_cfg["base_url"],
                llm_model=llm_cfg["model_name"],
                topic=body.topic,
                genre=body.genre,
                number_of_chapters=body.num_chapters,
                word_number=body.word_number,
                filepath=body.filepath,
                user_guidance=body.user_guidance,
                temperature=llm_cfg.get("temperature", 0.7),
                max_tokens=llm_cfg.get("max_tokens", 2048),
                timeout=llm_cfg.get("timeout", 600),
            )
            log_func("Architecture generation completed.")

        await loop.run_in_executor(None, _run)
        return {"status": "ok"}
    except Exception as e:
        logger.exception("Architecture generation failed")
        return {"status": "error", "message": str(e)}


@app.post("/api/generate/blueprint")
async def api_generate_blueprint(body: BlueprintBody):
    try:
        cfg = _load_full_config()
        llm_cfg = cfg["llm_configs"][body.llm_config_name]
        log_func = manager.make_log_func()
        loop = asyncio.get_running_loop()

        def _run():
            log_func("Starting blueprint generation...")
            Chapter_blueprint_generate(
                interface_format=llm_cfg["interface_format"],
                api_key=llm_cfg["api_key"],
                base_url=llm_cfg["base_url"],
                llm_model=llm_cfg["model_name"],
                filepath=body.filepath,
                number_of_chapters=body.num_chapters,
                user_guidance=body.user_guidance,
                temperature=llm_cfg.get("temperature", 0.7),
                max_tokens=llm_cfg.get("max_tokens", 4096),
                timeout=llm_cfg.get("timeout", 600),
            )
            log_func("Blueprint generation completed.")

        await loop.run_in_executor(None, _run)
        return {"status": "ok"}
    except Exception as e:
        logger.exception("Blueprint generation failed")
        return {"status": "error", "message": str(e)}


@app.post("/api/generate/chapter")
async def api_generate_chapter(body: ChapterBody):
    try:
        cfg = _load_full_config()
        llm_cfg = cfg["llm_configs"][body.llm_config_name]
        emb_cfg = cfg["embedding_configs"][body.embedding_config_name]
        log_func = manager.make_log_func()
        loop = asyncio.get_running_loop()

        def _run():
            log_func(f"Starting chapter {body.novel_number} generation...")
            generate_chapter_draft(
                api_key=llm_cfg["api_key"],
                base_url=llm_cfg["base_url"],
                model_name=llm_cfg["model_name"],
                filepath=body.filepath,
                novel_number=body.novel_number,
                word_number=body.word_number,
                temperature=llm_cfg.get("temperature", 0.7),
                user_guidance=body.user_guidance,
                characters_involved=body.characters_involved,
                key_items=body.key_items,
                scene_location=body.scene_location,
                time_constraint=body.time_constraint,
                embedding_api_key=emb_cfg["api_key"],
                embedding_url=emb_cfg["base_url"],
                embedding_interface_format=emb_cfg["interface_format"],
                embedding_model_name=emb_cfg["model_name"],
                embedding_retrieval_k=emb_cfg.get("retrieval_k", 2),
                interface_format=llm_cfg["interface_format"],
                max_tokens=llm_cfg.get("max_tokens", 2048),
                timeout=llm_cfg.get("timeout", 600),
                custom_prompt_text=body.custom_prompt_text,
            )
            log_func(f"Chapter {body.novel_number} generation completed.")

        await loop.run_in_executor(None, _run)
        return {"status": "ok"}
    except Exception as e:
        logger.exception("Chapter generation failed")
        return {"status": "error", "message": str(e)}


@app.post("/api/generate/finalize")
async def api_generate_finalize(body: FinalizeBody):
    try:
        cfg = _load_full_config()
        llm_cfg = cfg["llm_configs"][body.llm_config_name]
        emb_cfg = cfg["embedding_configs"][body.embedding_config_name]
        log_func = manager.make_log_func()
        loop = asyncio.get_running_loop()

        def _run():
            log_func(f"Starting finalization for chapter {body.novel_number}...")
            finalize_chapter(
                novel_number=body.novel_number,
                word_number=body.word_number,
                api_key=llm_cfg["api_key"],
                base_url=llm_cfg["base_url"],
                model_name=llm_cfg["model_name"],
                temperature=llm_cfg.get("temperature", 0.7),
                filepath=body.filepath,
                embedding_api_key=emb_cfg["api_key"],
                embedding_url=emb_cfg["base_url"],
                embedding_interface_format=emb_cfg["interface_format"],
                embedding_model_name=emb_cfg["model_name"],
                interface_format=llm_cfg["interface_format"],
                max_tokens=llm_cfg.get("max_tokens", 2048),
                timeout=llm_cfg.get("timeout", 600),
            )
            log_func(f"Chapter {body.novel_number} finalization completed.")

        await loop.run_in_executor(None, _run)
        return {"status": "ok"}
    except Exception as e:
        logger.exception("Finalization failed")
        return {"status": "error", "message": str(e)}


@app.post("/api/generate/consistency")
async def api_generate_consistency(body: ConsistencyBody):
    try:
        cfg = _load_full_config()
        llm_cfg = cfg["llm_configs"][body.llm_config_name]
        log_func = manager.make_log_func()
        loop = asyncio.get_running_loop()

        def _run():
            log_func(f"Starting consistency check for chapter {body.novel_number}...")
            arch_path = os.path.join(body.filepath, "Novel_architecture.txt")
            char_path = os.path.join(body.filepath, "character_state.txt")
            summary_path = os.path.join(body.filepath, "global_summary.txt")
            chapter_path = os.path.join(body.filepath, "chapters", f"chapter_{body.novel_number}.txt")
            plot_path = os.path.join(body.filepath, "plot_arcs.txt")

            novel_setting = read_file(arch_path)
            character_state = read_file(char_path)
            global_summary = read_file(summary_path)
            chapter_text = read_file(chapter_path)
            plot_arcs = read_file(plot_path)

            result = check_consistency(
                novel_setting=novel_setting,
                character_state=character_state,
                global_summary=global_summary,
                chapter_text=chapter_text,
                api_key=llm_cfg["api_key"],
                base_url=llm_cfg["base_url"],
                model_name=llm_cfg["model_name"],
                temperature=0.3,
                plot_arcs=plot_arcs,
                interface_format=llm_cfg["interface_format"],
                max_tokens=llm_cfg.get("max_tokens", 2048),
                timeout=llm_cfg.get("timeout", 600),
            )
            log_func("Consistency check completed.")
            return result

        result = await loop.run_in_executor(None, _run)
        return {"status": "ok", "result": result}
    except Exception as e:
        logger.exception("Consistency check failed")
        return {"status": "error", "message": str(e)}


@app.post("/api/generate/prompt-preview")
async def api_prompt_preview(body: PromptPreviewBody):
    try:
        cfg = _load_full_config()
        llm_cfg = cfg["llm_configs"][body.llm_config_name]
        emb_cfg = cfg["embedding_configs"][body.embedding_config_name]
        log_func = manager.make_log_func()
        loop = asyncio.get_running_loop()

        def _run():
            log_func(f"Building prompt preview for chapter {body.novel_number}...")
            return build_chapter_prompt(
                api_key=llm_cfg["api_key"],
                base_url=llm_cfg["base_url"],
                model_name=llm_cfg["model_name"],
                filepath=body.filepath,
                novel_number=body.novel_number,
                word_number=body.word_number,
                temperature=llm_cfg.get("temperature", 0.7),
                user_guidance=body.user_guidance,
                characters_involved=body.characters_involved,
                key_items=body.key_items,
                scene_location=body.scene_location,
                time_constraint=body.time_constraint,
                embedding_api_key=emb_cfg["api_key"],
                embedding_url=emb_cfg["base_url"],
                embedding_interface_format=emb_cfg["interface_format"],
                embedding_model_name=emb_cfg["model_name"],
                embedding_retrieval_k=emb_cfg.get("retrieval_k", 2),
                interface_format=llm_cfg["interface_format"],
                max_tokens=llm_cfg.get("max_tokens", 2048),
                timeout=llm_cfg.get("timeout", 600),
            )

        prompt_text = await loop.run_in_executor(None, _run)
        return {"status": "ok", "prompt": prompt_text}
    except Exception as e:
        logger.exception("Prompt preview failed")
        return {"status": "error", "message": str(e)}


@app.post("/api/generate/batch")
async def api_generate_batch(body: BatchBody):
    try:
        cfg = _load_full_config()
        llm_cfg = cfg["llm_configs"][body.llm_config_name]
        emb_cfg = cfg["embedding_configs"][body.embedding_config_name]
        log_func = manager.make_log_func()
        loop = asyncio.get_running_loop()

        def _run():
            results = []
            for ch_num in range(body.start_chapter, body.end_chapter + 1):
                log_func(f"[Batch] Generating chapter {ch_num}...")
                try:
                    generate_chapter_draft(
                        api_key=llm_cfg["api_key"],
                        base_url=llm_cfg["base_url"],
                        model_name=llm_cfg["model_name"],
                        filepath=body.filepath,
                        novel_number=ch_num,
                        word_number=body.word_number,
                        temperature=llm_cfg.get("temperature", 0.7),
                        user_guidance=body.user_guidance,
                        characters_involved="",
                        key_items="",
                        scene_location="",
                        time_constraint="",
                        embedding_api_key=emb_cfg["api_key"],
                        embedding_url=emb_cfg["base_url"],
                        embedding_interface_format=emb_cfg["interface_format"],
                        embedding_model_name=emb_cfg["model_name"],
                        embedding_retrieval_k=emb_cfg.get("retrieval_k", 2),
                        interface_format=llm_cfg["interface_format"],
                        max_tokens=llm_cfg.get("max_tokens", 2048),
                        timeout=llm_cfg.get("timeout", 600),
                    )

                    finalize_chapter(
                        novel_number=ch_num,
                        word_number=body.word_number,
                        api_key=llm_cfg["api_key"],
                        base_url=llm_cfg["base_url"],
                        model_name=llm_cfg["model_name"],
                        temperature=llm_cfg.get("temperature", 0.7),
                        filepath=body.filepath,
                        embedding_api_key=emb_cfg["api_key"],
                        embedding_url=emb_cfg["base_url"],
                        embedding_interface_format=emb_cfg["interface_format"],
                        embedding_model_name=emb_cfg["model_name"],
                        interface_format=llm_cfg["interface_format"],
                        max_tokens=llm_cfg.get("max_tokens", 2048),
                        timeout=llm_cfg.get("timeout", 600),
                    )
                    results.append({"chapter": ch_num, "status": "ok"})
                    log_func(f"[Batch] Chapter {ch_num} generated and finalized.")
                except Exception as exc:
                    results.append({"chapter": ch_num, "status": "error", "message": str(exc)})
                    log_func(f"[Batch] Chapter {ch_num} failed: {exc}")
            log_func("Batch generation completed.")
            return results

        results = await loop.run_in_executor(None, _run)
        return {"status": "ok", "results": results}
    except Exception as e:
        logger.exception("Batch generation failed")
        return {"status": "error", "message": str(e)}


# ---------------------------------------------------------------------------
# Content endpoints
# ---------------------------------------------------------------------------
@app.get("/api/content/{content_type}")
async def api_get_content(content_type: str, filepath: str = ""):
    if content_type not in CONTENT_TYPE_MAP:
        return {"status": "error", "message": f"Unknown content type: {content_type}"}
    if not filepath:
        return {"status": "error", "message": "filepath query parameter is required"}
    file_path = os.path.join(filepath, CONTENT_TYPE_MAP[content_type])
    content = read_file(file_path)
    return {"status": "ok", "content": content}


@app.post("/api/content/{content_type}")
async def api_save_content(content_type: str, body: ContentSaveBody):
    if content_type not in CONTENT_TYPE_MAP:
        return {"status": "error", "message": f"Unknown content type: {content_type}"}
    try:
        file_path = os.path.join(body.filepath, CONTENT_TYPE_MAP[content_type])
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        save_string_to_txt(body.content, file_path)
        return {"status": "ok"}
    except Exception as e:
        logger.exception("Failed to save content")
        return {"status": "error", "message": str(e)}


@app.get("/api/chapters")
async def api_list_chapters(filepath: str = ""):
    if not filepath:
        return {"status": "error", "message": "filepath query parameter is required"}
    chapters_dir = os.path.join(filepath, "chapters")
    if not os.path.isdir(chapters_dir):
        return {"status": "ok", "chapters": []}
    chapters = []
    for f in sorted(os.listdir(chapters_dir)):
        if f.startswith("chapter_") and f.endswith(".txt"):
            try:
                num = int(f.replace("chapter_", "").replace(".txt", ""))
                full_path = os.path.join(chapters_dir, f)
                content = read_file(full_path)
                chapters.append({
                    "number": num,
                    "filename": f,
                    "word_count": get_word_count(content),
                })
            except ValueError:
                continue
    return {"status": "ok", "chapters": chapters}


@app.get("/api/chapter/{num}")
async def api_get_chapter(num: int, filepath: str = ""):
    if not filepath:
        return {"status": "error", "message": "filepath query parameter is required"}
    chapter_path = os.path.join(filepath, "chapters", f"chapter_{num}.txt")
    content = read_file(chapter_path)
    if not content:
        return {"status": "error", "message": f"Chapter {num} not found"}
    return {"status": "ok", "content": content, "word_count": get_word_count(content)}


@app.post("/api/chapter/{num}")
async def api_save_chapter(num: int, body: ChapterSaveBody):
    try:
        chapters_dir = os.path.join(body.filepath, "chapters")
        os.makedirs(chapters_dir, exist_ok=True)
        chapter_path = os.path.join(chapters_dir, f"chapter_{num}.txt")
        save_string_to_txt(body.content, chapter_path)
        return {"status": "ok"}
    except Exception as e:
        logger.exception("Failed to save chapter")
        return {"status": "error", "message": str(e)}


# ---------------------------------------------------------------------------
# Knowledge endpoints
# ---------------------------------------------------------------------------
@app.post("/api/knowledge/import")
async def api_import_knowledge(
    filepath: str = "",
    embedding_config_name: str = "",
    file: UploadFile = File(...),
):
    if not filepath:
        return {"status": "error", "message": "filepath is required"}
    if not embedding_config_name:
        return {"status": "error", "message": "embedding_config_name is required"}
    try:
        cfg = _load_full_config()
        emb_cfg = cfg["embedding_configs"][embedding_config_name]

        # Save uploaded file to a temp location
        tmp_dir = os.path.join(filepath, "tmp_uploads")
        os.makedirs(tmp_dir, exist_ok=True)
        tmp_path = os.path.join(tmp_dir, file.filename)
        contents = await file.read()
        with open(tmp_path, "wb") as f:
            f.write(contents)

        log_func = manager.make_log_func()
        loop = asyncio.get_running_loop()

        def _run():
            log_func(f"Importing knowledge file: {file.filename}")
            import_knowledge_file(
                embedding_api_key=emb_cfg["api_key"],
                embedding_url=emb_cfg["base_url"],
                embedding_interface_format=emb_cfg["interface_format"],
                embedding_model_name=emb_cfg["model_name"],
                file_path=tmp_path,
                filepath=filepath,
            )
            # Clean up temp file
            try:
                os.remove(tmp_path)
            except OSError:
                pass
            log_func("Knowledge file imported.")

        await loop.run_in_executor(None, _run)
        return {"status": "ok"}
    except Exception as e:
        logger.exception("Knowledge import failed")
        return {"status": "error", "message": str(e)}


@app.post("/api/knowledge/clear")
async def api_clear_knowledge(body: KnowledgeClearBody):
    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, clear_vector_store, body.filepath)
        if result:
            return {"status": "ok"}
        return {"status": "error", "message": "No vector store found to clear"}
    except Exception as e:
        logger.exception("Knowledge clear failed")
        return {"status": "error", "message": str(e)}


# ---------------------------------------------------------------------------
# Role library endpoints
# ---------------------------------------------------------------------------
def _role_library_dir(filepath: str) -> str:
    return os.path.join(filepath, "角色库")


def _sanitize_name(name: str) -> str:
    """Remove path-unsafe characters from role/category names."""
    invalid = set('<>:"/\\|?*')
    return "".join(c for c in name if c not in invalid and ord(c) >= 32).strip(" .")


@app.get("/api/roles/categories")
async def api_role_categories(filepath: str = ""):
    if not filepath:
        return {"status": "error", "message": "filepath is required"}
    lib_dir = _role_library_dir(filepath)
    if not os.path.isdir(lib_dir):
        return {"status": "ok", "categories": []}
    categories = [
        d for d in os.listdir(lib_dir
        ) if os.path.isdir(os.path.join(lib_dir, d))
    ]
    return {"status": "ok", "categories": categories}


@app.get("/api/roles/list/{category}")
async def api_role_list(category: str, filepath: str = ""):
    if not filepath:
        return {"status": "error", "message": "filepath is required"}
    cat_dir = os.path.join(_role_library_dir(filepath), category)
    if not os.path.isdir(cat_dir):
        return {"status": "ok", "roles": []}
    roles = [
        f.replace(".txt", "")
        for f in os.listdir(cat_dir)
        if f.endswith(".txt")
    ]
    return {"status": "ok", "roles": roles}


@app.post("/api/roles/content")
async def api_role_content(body: RoleContentBody):
    role_path = os.path.join(_role_library_dir(body.filepath), body.category, f"{body.role_name}.txt")
    content = read_file(role_path)
    if not content:
        return {"status": "error", "message": "Role not found"}
    return {"status": "ok", "content": content}


@app.post("/api/roles/save")
async def api_role_save(body: RoleSaveBody):
    try:
        cat_dir = os.path.join(_role_library_dir(body.filepath), _sanitize_name(body.category))
        os.makedirs(cat_dir, exist_ok=True)
        role_path = os.path.join(cat_dir, f"{_sanitize_name(body.role_name)}.txt")
        save_string_to_txt(body.content, role_path)
        return {"status": "ok"}
    except Exception as e:
        logger.exception("Failed to save role")
        return {"status": "error", "message": str(e)}


@app.delete("/api/roles/delete")
async def api_role_delete(body: RoleDeleteBody):
    try:
        role_path = os.path.join(
            _role_library_dir(body.filepath), body.category, f"{body.role_name}.txt"
        )
        if os.path.exists(role_path):
            os.remove(role_path)
            return {"status": "ok"}
        return {"status": "error", "message": "Role not found"}
    except Exception as e:
        logger.exception("Failed to delete role")
        return {"status": "error", "message": str(e)}


@app.post("/api/roles/analyze")
async def api_role_analyze(body: RoleAnalyzeBody):
    """Use LLM to analyze text and extract character information."""
    try:
        cfg = _load_full_config()
        llm_cfg = cfg["llm_configs"][body.llm_config_name]
        loop = asyncio.get_running_loop()

        def _run():
            adapter = create_llm_adapter(
                interface_format=llm_cfg["interface_format"],
                base_url=llm_cfg["base_url"],
                model_name=llm_cfg["model_name"],
                api_key=llm_cfg["api_key"],
                temperature=0.3,
                max_tokens=llm_cfg.get("max_tokens", 2048),
                timeout=llm_cfg.get("timeout", 600),
            )
            prompt = (
                "请分析以下文本，提取其中的角色信息，包括：姓名、年龄、性别、外貌描述、"
                "性格特点、背景故事、与其他角色的关系等。请用结构化的格式输出。\n\n"
                f"文本内容：\n{body.text}"
            )
            return adapter.invoke(prompt)

        result = await loop.run_in_executor(None, _run)
        return {"status": "ok", "analysis": result}
    except Exception as e:
        logger.exception("Role analysis failed")
        return {"status": "error", "message": str(e)}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            # Keep connection alive; client may send pings or commands
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    """Entry point for `uv run novel-web` or `python -m web.app`."""
    import uvicorn
    uvicorn.run("web.app:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()

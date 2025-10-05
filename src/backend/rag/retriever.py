import json
import os
from pathlib import Path
from typing import List, Dict, Optional

import faiss
import numpy as np
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()

EMBED_MODEL = "text-embedding-3-large"

# Cache para índices por agente
_index_cache = {}
_meta_cache = {}


def _get_agent_index_dir(agent_id: str) -> Path:
    """Retorna o diretório do índice para um agente específico."""
    base_dir = Path(__file__).parent
    return base_dir / "index" / agent_id


def _load_agent_index(agent_id: str) -> tuple[Optional[faiss.Index], Optional[List[Dict]]]:
    """Carrega o índice FAISS e metadata para um agente específico."""
    if agent_id in _index_cache and agent_id in _meta_cache:
        return _index_cache[agent_id], _meta_cache[agent_id]
    
    index_dir = _get_agent_index_dir(agent_id)
    index_path = index_dir / "faiss.index"
    meta_path = index_dir / "meta.json"
    
    if not index_path.exists() or not meta_path.exists():
        # Fallback para índice global se não existir específico
        fallback_dir = Path(__file__).parent / "index"
        fallback_index = fallback_dir / "faiss.index"
        fallback_meta = fallback_dir / "meta.json"
        
        if fallback_index.exists() and fallback_meta.exists():
            index_path = fallback_index
            meta_path = fallback_meta
        else:
            return None, None
    
    try:
        index = faiss.read_index(str(index_path))
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        
        _index_cache[agent_id] = index
        _meta_cache[agent_id] = meta
        
        return index, meta
    except Exception:
        return None, None


def _embed_query(q: str) -> np.ndarray:
    e = client.embeddings.create(model=EMBED_MODEL, input=[q]).data[0].embedding
    v = np.array([e], dtype="float32")
    faiss.normalize_L2(v)
    return v


def search_chunks(query: str, k: int = 6, agent_id: str = "tutor", filters: Optional[Dict] = None):
    """Busca chunks com configurações específicas por agente."""
    if not query or not query.strip():
        return []

    index, meta = _load_agent_index(agent_id)
    if index is None or meta is None:
        return []

    vec = _embed_query(query)
    D, I = index.search(vec, k)
    hits = []
    
    for idx, score in zip(I[0], D[0]):
        if idx < 0:
            continue
        doc = meta[idx]
        
        # Aplicar filtros se fornecidos
        if filters:
            if "source" in filters and filters["source"] not in doc.get("source", ""):
                continue
            if "subject" in filters and filters["subject"] not in doc.get("subject", ""):
                continue
        
        hits.append({
            "id": doc["id"],
            "source": doc["source"],
            "score": float(score),
            "snippet": doc["text"][:1200],
            "agent_id": agent_id,
        })
    
    return hits
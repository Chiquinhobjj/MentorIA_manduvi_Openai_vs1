import json
from pathlib import Path

import faiss
import numpy as np
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()

INDEX_DIR = Path(__file__).parent / "index"
META = json.loads((INDEX_DIR / "meta.json").read_text(encoding="utf-8"))
INDEX = faiss.read_index(str(INDEX_DIR / "faiss.index"))

EMBED_MODEL = "text-embedding-3-large"


def _embed_query(q: str) -> np.ndarray:
    e = client.embeddings.create(model=EMBED_MODEL, input=[q]).data[0].embedding
    v = np.array([e], dtype="float32")
    faiss.normalize_L2(v)
    return v


def search_chunks(query: str, k: int = 6):
    if not query or not query.strip():
        return []
    vec = _embed_query(query)
    D, I = INDEX.search(vec, k)
    hits = []
    for idx, score in zip(I[0], D[0]):
        if idx < 0:
            continue
        doc = META[idx]
        hits.append({
            "id": doc["id"],
            "source": doc["source"],
            "score": float(score),
            "snippet": doc["text"][:1200],
        })
    return hits



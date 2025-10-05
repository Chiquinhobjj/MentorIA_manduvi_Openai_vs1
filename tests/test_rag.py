import os
import pytest


def test_env_key_present():
    assert os.getenv("OPENAI_API_KEY"), "Defina OPENAI_API_KEY no ambiente/venv"


def test_retriever_runs_topk():
    from src.backend.rag.retriever import search_chunks
    hits = search_chunks("matemática", k=2)
    assert isinstance(hits, list)
    if not hits:
        pytest.skip("Sem hits: rode ingestão e garanta PDFs em src/backend/rag/data/")



import json
from pathlib import Path
from typing import List, Dict

import faiss
import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
from pypdf import PdfReader

load_dotenv()
client = OpenAI()

DATA_DIR = Path(__file__).parent / "data"
INDEX_DIR = Path(__file__).parent / "index"
INDEX_DIR.mkdir(exist_ok=True, parents=True)

EMBED_MODEL = "text-embedding-3-large"


def read_pdf(path: Path) -> str:
    pdf = PdfReader(str(path))
    return "\n".join((p.extract_text() or "") for p in pdf.pages)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def chunk_text(text: str, max_tokens: int = 800, overlap: int = 150) -> List[str]:
    paras = [p.strip() for p in text.split("\n") if p.strip()]
    chunks, buf, count = [], [], 0
    for p in paras:
        toks = max(1, len(p) // 4)
        if count + toks > max_tokens and buf:
            joined = "\n".join(buf)
            chunks.append(joined)
            keep_chars = max(0, len(joined) - overlap * 4)
            buf = [joined[-keep_chars:]] if keep_chars > 0 else []
            count = len(buf[0]) // 4 if buf else 0
        buf.append(p)
        count += toks
    if buf:
        chunks.append("\n".join(buf))
    return chunks


def embed_texts(texts: List[str]) -> np.ndarray:
    resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
    vecs = [d.embedding for d in resp.data]
    return np.array(vecs, dtype="float32")


def main() -> None:
    docs: List[Dict] = []
    if not DATA_DIR.exists():
        print(f"Diretório de dados não existe: {DATA_DIR}")
        return

    for f in DATA_DIR.rglob("*"):
        if f.is_dir():
            continue
        suffix = f.suffix.lower()
        if suffix == ".pdf":
            text = read_pdf(f)
        elif suffix in {".md", ".txt"}:
            text = read_text(f)
        else:
            continue

        for i, c in enumerate(chunk_text(text)):
            docs.append({"id": f"{f.name}::#{i}", "source": f.name, "text": c})

    if not docs:
        print(f"Nenhum documento encontrado em {DATA_DIR}.")
        return

    print(f"Chunks: {len(docs)} — gerando embeddings ({EMBED_MODEL})…")
    embs = embed_texts([d["text"] for d in docs])

    faiss.normalize_L2(embs)
    index = faiss.IndexFlatIP(embs.shape[1])
    index.add(embs)

    faiss.write_index(index, str(INDEX_DIR / "faiss.index"))
    (INDEX_DIR / "meta.json").write_text(json.dumps(docs, ensure_ascii=False), encoding="utf-8")
    print(f"OK! Índice salvo em {INDEX_DIR}/ (faiss.index + meta.json)")


if __name__ == "__main__":
    main()



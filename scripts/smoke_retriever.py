import sys
from src.backend.rag.retriever import search_chunks


def main() -> None:
    query = " ".join(sys.argv[1:]) or "frações 5º ano"
    hits = search_chunks(query, k=3)
    if not hits:
        print("Sem hits (rode a ingestão e confira PDFs em src/backend/rag/data/).")
        return
    for i, h in enumerate(hits, 1):
        print(f"[{i}] {h['source']}  score={h['score']:.4f}")
        print(h["snippet"][:200].replace("\n", " "), "...\n")


if __name__ == "__main__":
    main()



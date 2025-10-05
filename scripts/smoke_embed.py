from openai import OpenAI
import os, sys


def main() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        print("ERRO: defina OPENAI_API_KEY no ambiente.", file=sys.stderr)
        sys.exit(1)
    client = OpenAI()
    e = client.embeddings.create(model="text-embedding-3-large", input=["ok"])
    dim = len(e.data[0].embedding)
    print(f"Embedding OK. Dimensão: {dim} (esperado: 3072)")


if __name__ == "__main__":
    main()



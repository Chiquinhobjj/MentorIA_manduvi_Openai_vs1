import os
import asyncio
from typing import Optional

from agents import Agent, Runner, SQLiteSession


def build_agent() -> Agent:
    return Agent(
        name="Mentor Virtual",
        instructions=(
            "Você é um mentor virtual encorajador, claro e personalizado. "
            "Conduza o onboarding com uma pergunta inicial e ofereça sugestões rápidas. "
            "Formate respostas em Markdown com listas, destaques e checklists quando útil. "
            "Mantenha o contexto ao longo da conversa."
        ),
        # Deixe o modelo padrão da lib, a configuração pode ser ajustada via env se necessário.
    )


async def run_onboarding(session: SQLiteSession, user_input: Optional[str] = None) -> str:
    agent = build_agent()

    if not user_input:
        onboarding = (
            "Olá! Eu sou seu Mentor Virtual, aqui para te ajudar a alcançar seus objetivos de aprendizado.\n\n"
            "Para começarmos, me diga: **o que você gostaria de aprender** ou **em qual área** você busca orientação hoje?\n\n"
            "Sugestões:\n"
            "- [Quero criar um plano de estudos]\n"
            "- [Preciso de ajuda com um conceito específico]\n"
            "- [Estou buscando novas habilidades para minha carreira]"
        )
        # Executa o agente para produzir uma continuação contextual a partir do prompt de onboarding
        result = await Runner.run(agent, onboarding, session=session)
        return result.final_output

    result = await Runner.run(agent, user_input, session=session)
    return result.final_output


async def main() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("Defina OPENAI_API_KEY no ambiente antes de executar.")

    session = SQLiteSession("mentor_session")

    # Exemplo 1: iniciar com onboarding padrão
    onboarding_reply = await run_onboarding(session)
    print("\n--- Resposta de Onboarding ---\n")
    print(onboarding_reply)

    # Exemplo 2: seguir a conversa com uma entrada do usuário (ajuste conforme desejar)
    followup = await run_onboarding(session, "Quero aprender Python do zero. Como começo?")
    print("\n--- Seguimento ---\n")
    print(followup)


if __name__ == "__main__":
    asyncio.run(main())



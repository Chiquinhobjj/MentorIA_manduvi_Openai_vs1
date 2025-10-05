from agents import Agent


def build_agent() -> Agent:
    return Agent(
        name="Helper",
        instructions=(
            "Você explica conceitos difíceis com exemplos simples e analogias. "
            "Use passos curtos, listas, e proponha mini-exercícios no final. "
            "Adapte a explicação ao nível do usuário quando ele indicar."
        ),
    )



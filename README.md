# ⚡ Arqos Engine — AE-LITE Mode

> **Versão**: 2.0.0 (Lite)  
> **Classificação**: Minimal Operational  
> **Foco**: Rapidez, Determinismo e Baixo Consumo

O **AE-LITE** é a versão minimalista do Arqos Engine, desenhada especificamente para cenários onde a velocidade e a simplicidade são prioridade. Ele remove complexidades cognitivas e dependências pesadas para oferecer um runtime leve e previsível.

---

## 🎯 Para que serve?

Ideal para ambientes de desenvolvimento e validação contínua:

*   **Testes Rápidos**: Validação de lógica sem subir bancos de dados pesados.
*   **Pipelines CI/CD**: Execução em ambientes de integração contínua (GitHub Actions, Jenkins).
*   **Prototipagem**: Criação rápida de provas de conceito.
*   **Debugging**: Rastreamento fácil de erros devido ao comportamento determinístico.

**❌ O que ele NÃO faz?**
*   Não aprende autonomamente (Learning desativado).
*   Não persiste memória a longo prazo (apenas sessão).
*   Não executa orquestração complexa paralela.

---

## 🧩 Arquitetura Simplificada

O AE-LITE opera com um subconjunto estrito de módulos:

### 1. AE0 — Harbor (Bootstrap Lite)
*   **Função**: Inicialização ultra-rápida (< 5s).
*   **Diferença**: Pula validações profundas de contratos cognitivos e ignora verificações de GPU/IA pesada.
*   **Garantia**: "Fail-fast" — falha imediatamente se o ambiente não estiver ok.

### 2. AE1 — DNABase (Memória Volátil)
*   **Função**: Gerenciamento de contexto da sessão atual.
*   **Diferença**: Usa apenas memória RAM (In-Memory). Nada é salvo no disco após o fim da execução.
*   **Garantia**: Isolamento total entre execuções.

### 3. AE2 — Strategos (Orquestrador Sequencial)
*   **Função**: Decide qual ferramenta chamar.
*   **Diferença**: Executa tarefas uma por uma (sequencial), sem paralelismo complexo.
*   **Garantia**: Determinismo — a mesma entrada sempre gera o mesmo plano de execução.

### 4. AE3 — Pipeline (Toolkit Básico)
*   **Função**: Executa as ações reais.
*   **Ferramentas Disponíveis** (Apenas 5 essenciais):
    1.  **UserIntentParser**: Entende o que você quer.
    2.  **InputValidator**: Valida dados básicos.
    3.  **ChainOfThought**: Raciocínio lógico simples.
    4.  **InsightSummarizer**: Resumidor de texto.
    5.  **ClauseGeneration**: Geração de texto simples.

---

## 📋 Feature Matrix
| Feature | Status |
| :--- | :--- |
| **Short-term Memory** | ❌ (Session only) |
| **Long-term Memory** | ❌ |
| **Vector Search** | ❌ |
| **Parallel Execution** | ❌ |
| **Self-Healing** | ❌ |
| **Determinism** | ✅ Strict |

## 🔗 Quick Links
*   [Compat Contract](../docs/compat_contract.yaml): O que é garantido funcionar.
*   [Migration Guide](../docs/migration_guide.md): Como migrar para Fullstack.
*   [Errors](../docs/errors.md): Códigos de erro padrão.
*   [Example Flow](../examples/lite/echo.flow.json): Exemplo executável.

---

## 🚀 Como Usar

O modo Lite é ativado através da flag de ambiente ou configuração:

```bash
# Exemplo de execução
npm run start:lite
```

Ou configurando no seu `.env`:

```ini
ARQOS_MODE=lite
```

---

> **Nota**: Este modo é totalmente compatível com a API do modo Fullstack. Código escrito para o Lite funcionará no Fullstack sem alterações.

"""
Integração com IA (Anthropic Claude ou OpenAI GPT-4o) para extrair
dados estruturados de texto de alvarás.
"""
import json
import logging
from typing import Optional

import anthropic
import openai

from app.config import get_settings
from app.schemas import DadosExtradosIA

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Prompt do Sistema ─────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Você é um especialista em análise de documentos jurídicos e administrativos brasileiros,
com foco em Alvarás e Licenças municipais e estaduais.

Sua tarefa é analisar o texto extraído de um documento de alvará e retornar um JSON estruturado.

## Tipos de Alvará reconhecidos:
- **SANITARIO**: Alvará Sanitário, Licença Sanitária, VISA (Vigilância Sanitária)
- **BOMBEIROS**: Auto de Vistoria do Corpo de Bombeiros (AVCB), Certificado de Aprovação (CA), Licença do Corpo de Bombeiros
- **FUNCIONAMENTO**: Alvará de Funcionamento, Licença de Funcionamento, Alvará de Localização
- **AMA**: AMA (Alvará de Meio Ambiente), Licença Ambiental (LP, LI, LO), CETESB

## Regras de extração:
1. CNPJ deve estar no formato XX.XXX.XXX/XXXX-XX
2. Datas devem estar em formato ISO 8601 (YYYY-MM-DD)
3. Se um campo não puder ser determinado com certeza, retorne null
4. O campo "confianca" (0-100) indica sua confiança geral na extração
5. Se o documento for ilegível ou não for um alvará, retorne tipo_alvara: "DESCONHECIDO"

## Formato de saída (JSON puro, sem markdown):
{
  "razao_social": "Nome da empresa ou null",
  "cnpj": "XX.XXX.XXX/XXXX-XX ou null",
  "tipo_alvara": "SANITARIO | BOMBEIROS | FUNCIONAMENTO | AMA | DESCONHECIDO",
  "numero_protocolo": "número ou null",
  "data_emissao": "YYYY-MM-DD ou null",
  "data_vencimento": "YYYY-MM-DD ou null",
  "confianca": 0-100,
  "observacoes": "observações relevantes ou null"
}"""

USER_PROMPT_TEMPLATE = """Analise o seguinte texto extraído de um documento de alvará e extraia as informações solicitadas.

## Texto do documento:
{texto}

Retorne APENAS o JSON, sem nenhum texto adicional, markdown ou explicação."""


# ── Extratores ────────────────────────────────────────────────────────────────

async def extrair_dados_com_ia(texto: str) -> DadosExtradosIA:
    """
    Tenta extrair dados via IA. Se falhar (sem créditos, sem chave, erro de rede),
    usa o extrator por regex como fallback automático.
    """
    from app.services.regex_extractor import extrair_dados_por_regex

    if not texto or not texto.strip():
        logger.warning("Texto vazio recebido para extração.")
        return DadosExtradosIA()

    chave = settings.anthropic_api_key or settings.openai_api_key
    if not chave:
        logger.info("Nenhuma chave de API configurada — usando extrator por regex.")
        return extrair_dados_por_regex(texto)

    texto_truncado = texto[:15000]
    user_message = USER_PROMPT_TEMPLATE.format(texto=texto_truncado)

    try:
        if settings.ai_provider == "anthropic":
            return await _extrair_com_anthropic(user_message)
        return await _extrair_com_openai(user_message)
    except Exception as exc:
        logger.warning("IA indisponível (%s) — usando extrator por regex como fallback.", exc)
        return extrair_dados_por_regex(texto)


async def _extrair_com_anthropic(user_message: str) -> DadosExtradosIA:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    conteudo = response.content[0].text
    return _parsear_resposta_ia(conteudo)


async def _extrair_com_openai(user_message: str) -> DadosExtradosIA:
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    response = await client.chat.completions.create(
        model="gpt-4o",
        max_tokens=1024,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
    )

    conteudo = response.choices[0].message.content
    return _parsear_resposta_ia(conteudo)


def _parsear_resposta_ia(conteudo: str) -> DadosExtradosIA:
    """Faz parse do JSON retornado pela IA com fallback seguro."""
    try:
        # Remove possível markdown ```json ... ```
        conteudo_limpo = conteudo.strip()
        if conteudo_limpo.startswith("```"):
            linhas = conteudo_limpo.split("\n")
            conteudo_limpo = "\n".join(linhas[1:-1])

        dados = json.loads(conteudo_limpo)
        return DadosExtradosIA(**dados)

    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Falha ao parsear resposta da IA: %s\nConteúdo: %s", exc, conteudo)
        return DadosExtradosIA(
            observacoes=f"Falha ao parsear resposta: {conteudo[:200]}"
        )

"""
Extrator de dados de alvarás baseado em padrões de texto (regex).
Funciona offline, sem dependência de IA externa.
Cobre os principais formatos emitidos por prefeituras e órgãos brasileiros.
"""
import re
import logging
from datetime import date, datetime
from typing import Optional

from app.models import TipoAlvara
from app.schemas import DadosExtradosIA

logger = logging.getLogger(__name__)

# ── Classificação de tipo ─────────────────────────────────────────────────────

_PADROES_TIPO: list[tuple[TipoAlvara, list[str]]] = [
    (TipoAlvara.BOMBEIROS, [
        r"corpo\s+de\s+bombeiros", r"\bAVCB\b", r"certificado\s+de\s+aprova[çc][ãa]o",
        r"vistoria\s+do\s+corpo", r"bombeiro", r"\bCA\b.*bombeiro",
    ]),
    (TipoAlvara.SANITARIO, [
        r"alvará\s+sanitário", r"licen[çc]a\s+sanit", r"vigil[âa]ncia\s+sanit",
        r"\bVISA\b", r"sanit[áa]rio", r"saúde\b.*licen[çc]", r"secretaria.*saúde",
    ]),
    (TipoAlvara.AMA, [
        r"\bAMA\b", r"licen[çc]a\s+ambiental", r"meio\s+ambiente",
        r"\bCETESB\b", r"\bIBAMA\b", r"\bLP\b.*licen[çc]a", r"\bLI\b.*licen[çc]a",
        r"\bLO\b.*licen[çc]a", r"ambiental",
    ]),
    (TipoAlvara.FUNCIONAMENTO, [
        r"alvará\s+de\s+funcionamento", r"alvará\s+de\s+localiza[çc][ãa]o",
        r"licen[çc]a\s+de\s+funcionamento", r"funcionamento", r"localiza[çc][ãa]o",
        r"alvará\s+de\s+atividade", r"exercício\s+de\s+atividade",
    ]),
]


def _classificar_tipo(texto: str) -> TipoAlvara:
    # Prioriza o TÍTULO (primeiras 3 linhas) sobre o corpo do documento
    linhas = texto.strip().splitlines()
    titulo = " ".join(linhas[:3]).lower()

    for tipo, padroes in _PADROES_TIPO:
        for padrao in padroes:
            if re.search(padrao, titulo):
                return tipo

    # Fallback: conta ocorrências no texto completo e escolhe a maior pontuação
    texto_lower = texto.lower()
    pontos: dict[TipoAlvara, int] = {}
    for tipo, padroes in _PADROES_TIPO:
        score = sum(len(re.findall(p, texto_lower)) for p in padroes)
        if score:
            pontos[tipo] = score

    if pontos:
        return max(pontos, key=lambda t: pontos[t])
    return TipoAlvara.DESCONHECIDO


# ── CNPJ ──────────────────────────────────────────────────────────────────────

def _extrair_cnpj(texto: str) -> Optional[str]:
    padrao = r"\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}"
    matches = re.findall(padrao, texto)
    for m in matches:
        digits = re.sub(r"\D", "", m)
        if len(digits) == 14 and not _cnpj_invalido(digits):
            return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"
    return None


def _cnpj_invalido(digits: str) -> bool:
    return len(set(digits)) == 1  # Sequência de dígitos iguais


# ── Datas ─────────────────────────────────────────────────────────────────────

_MESES_PT = {
    "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4,
    "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
    "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
}

_PADROES_DATA = [
    # DD/MM/YYYY ou DD-MM-YYYY
    (r"\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b", "dmy"),
    # YYYY-MM-DD (ISO)
    (r"\b(\d{4})-(\d{2})-(\d{2})\b", "ymd"),
    # DD de Mês de YYYY
    (r"\b(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\b", "dmy_pt"),
    # DD/MM/YY
    (r"\b(\d{2})[\/](\d{2})[\/](\d{2})\b", "dmy_short"),
]


def _parsear_data(texto_data: str, formato: str) -> Optional[date]:
    try:
        if formato == "dmy":
            d, m, y = texto_data.split("/") if "/" in texto_data else texto_data.split("-")
            return date(int(y), int(m), int(d))
        if formato == "ymd":
            partes = texto_data.split("-")
            return date(int(partes[0]), int(partes[1]), int(partes[2]))
        if formato == "dmy_pt":
            match = re.match(r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})", texto_data, re.I)
            if match:
                d, mes_str, y = match.groups()
                m = _MESES_PT.get(mes_str.lower())
                if m:
                    return date(int(y), m, int(d))
        if formato == "dmy_short":
            d, m, y = texto_data.split("/")
            y_int = int(y)
            y_int += 2000 if y_int < 50 else 1900
            return date(y_int, int(m), int(d))
    except (ValueError, AttributeError):
        pass
    return None


def _extrair_datas(texto: str) -> tuple[Optional[date], Optional[date]]:
    """Retorna (data_emissao, data_vencimento)."""
    candidatas: list[date] = []

    # Busca datas precedidas por palavras-chave de vencimento
    padroes_vencimento = [
        r"validade\s+at[eé][:.]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})",
        r"v[aá]lido\s+at[eé][:.]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})",
        r"vencimento[:.]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})",
        r"expira[çc][ãa]o[:.]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})",
        r"prazo\s+de\s+validade[:.]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})",
        r"válida?\s+até\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})",
        r"(\d{2}[\/\-]\d{2}[\/\-]\d{4}).*?(?:validade|vencimento)",
    ]

    data_venc: Optional[date] = None
    for padrao in padroes_vencimento:
        m = re.search(padrao, texto, re.IGNORECASE)
        if m:
            data_venc = _parsear_data(m.group(1), "dmy")
            if data_venc:
                break

    # Busca datas precedidas por palavras-chave de emissão
    padroes_emissao = [
        r"(?:emiss[ãa]o|emitido|gerado\s+em|expedido)[:.]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})",
        r"data[:.]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})",
        r"(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s*(?:\d{2}:\d{2})?.*?(?:emiss[ãa]o|emitido|gerado)",
    ]

    data_emis: Optional[date] = None
    for padrao in padroes_emissao:
        m = re.search(padrao, texto, re.IGNORECASE)
        if m:
            data_emis = _parsear_data(m.group(1), "dmy")
            if data_emis:
                break

    # Se não achou por palavras-chave, pega todas as datas e tenta inferir
    if not data_venc or not data_emis:
        todas: list[date] = []
        for padrao, fmt in _PADROES_DATA:
            for match in re.finditer(padrao, texto):
                grupos = match.groups()
                texto_data = "/".join(grupos)
                d = _parsear_data(texto_data, fmt)
                if d and d.year >= 2000:
                    todas.append(d)

        hoje = date.today()
        futuras = sorted([d for d in todas if d >= hoje])
        passadas = sorted([d for d in todas if d < hoje], reverse=True)

        if not data_venc and futuras:
            data_venc = futuras[0]
        if not data_emis and passadas:
            data_emis = passadas[0]

    return data_emis, data_venc


# ── Razão Social ──────────────────────────────────────────────────────────────

# Palavras que indicam rótulo de campo — não são nomes de empresa
_LABELS_CAMPO = re.compile(
    r"^(CNPJ|CPF|endere[çc]o|atividade|ocupa[çc][ãa]o|finalidade|divis[ãa]o|"
    r"descri[çc][ãa]o|telefone|data|n[úu]mero|c[óo]digo|protocolo|inscri[çc][ãa]o|"
    r"nome\s+fantasia|pedido|par[âa]metro|observa[çc]).*",
    re.IGNORECASE
)


def _e_nome_valido(nome: str) -> bool:
    """Retorna False se o texto for um rótulo de campo ou muito curto."""
    nome = nome.strip()
    if len(nome) < 4 or len(nome) > 120:
        return False
    if _LABELS_CAMPO.match(nome):
        return False
    if re.match(r"^\d", nome):   # começa com número
        return False
    return True


def _extrair_razao_social(texto: str) -> Optional[str]:
    padroes = [
        # Nome imediatamente após o CNPJ (linha seguinte)
        r"CNPJ[:/]?\s*[\d\.\-/]+\s*\n\s*([^\n\d]{4,80})",
        # Razão Social seguida de nova linha com o nome (formato tabular)
        r"raz[ãa]o\s+social\s*\n\s*([^\n\d]{4,80})",
        # Razão Social na mesma linha
        r"raz[ãa]o\s+social\s*[:\-]?\s*([A-Za-záéíóúâêîôûãõçàüÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ][^\n\d]{3,80})",
        r"nome\s+empresarial\s*[:\-]?\s*([A-Za-záéíóúâêîôûãõçàüÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ][^\n\d]{3,80})",
        r"(?:requerente|titular|interessado)\s*[:\-]?\s*([A-Za-záéíóúâêîôûãõçàüÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ][^\n\d]{3,80})",
        # Padrão com sufixo jurídico na mesma linha
        r"([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ][A-Za-záéíóúâêîôûãõçàüÁÉÍÓÚÂÊÎÔÛÃÕÇÀÜ\s\.]{5,60}(?:LTDA|ME|EPP|S\.A\.|EIRELI|SLU|SS|MICRO)\b)",
    ]
    for padrao in padroes:
        m = re.search(padrao, texto, re.IGNORECASE | re.MULTILINE)
        if m:
            nome = m.group(1).strip().rstrip(".,;: ")
            nome = re.sub(r"\s+\d{3}[\.\d]+$", "", nome).strip()
            if _e_nome_valido(nome):
                return nome
    return None


# ── Número do Protocolo ───────────────────────────────────────────────────────

def _extrair_protocolo(texto: str) -> Optional[str]:
    padroes = [
        r"(?:protocolo|n[úu]mero|n[°º]\.?|proc(?:esso)?)[\s.:]*(\d[\d\.\-\/]{3,20})",
        r"alvará\s+(?:n[°º]\.?\s*|de\s+)?(\d[\d\.\-\/]{3,20})",
        r"licen[çc]a\s+(?:n[°º]\.?\s*)?(\d[\d\.\-\/]{3,20})",
        r"\bNº\.?\s*(\d[\d\.\-\/]{3,20})",
    ]
    for padrao in padroes:
        m = re.search(padrao, texto, re.IGNORECASE)
        if m:
            proto = m.group(1).strip().rstrip(".,;:")
            if len(proto) >= 4:
                return proto
    return None


# ── Função principal ──────────────────────────────────────────────────────────

def extrair_dados_por_regex(texto: str) -> DadosExtradosIA:
    """
    Extrai dados estruturados de um texto de alvará usando regex.
    Retorna DadosExtradosIA com os campos encontrados.
    """
    if not texto or not texto.strip():
        return DadosExtradosIA()

    tipo = _classificar_tipo(texto)
    cnpj = _extrair_cnpj(texto)
    razao_social = _extrair_razao_social(texto)
    protocolo = _extrair_protocolo(texto)
    data_emissao, data_vencimento = _extrair_datas(texto)

    # Calcula confiança baseada em quantos campos foram encontrados
    campos = [tipo != TipoAlvara.DESCONHECIDO, bool(cnpj), bool(razao_social),
              bool(protocolo), bool(data_vencimento)]
    confianca = int(sum(campos) / len(campos) * 100)

    logger.info(
        "Extração regex: tipo=%s cnpj=%s venc=%s confiança=%d%%",
        tipo.value, cnpj, data_vencimento, confianca
    )

    return DadosExtradosIA(
        razao_social=razao_social,
        cnpj=cnpj,
        tipo_alvara=tipo,
        numero_protocolo=protocolo,
        data_emissao=data_emissao.isoformat() if data_emissao else None,
        data_vencimento=data_vencimento.isoformat() if data_vencimento else None,
        confianca=confianca,
        observacoes="Extraído por padrões de texto (sem IA)",
    )

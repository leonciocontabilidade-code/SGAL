"""
Extração de texto de PDFs e imagens usando PyMuPDF.
"""
import io
import logging
from pathlib import Path

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}


def extrair_texto(caminho_arquivo: str) -> str:
    """
    Extrai texto de um PDF ou imagem.
    Para imagens, converte para PDF internamente e aplica extração.
    Retorna o texto concatenado de todas as páginas.
    """
    path = Path(caminho_arquivo)
    ext = path.suffix.lower()

    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Formato não suportado: {ext}")

    if ext == ".pdf":
        return _extrair_de_pdf(caminho_arquivo)
    return _extrair_de_imagem(caminho_arquivo)


def _extrair_de_pdf(caminho: str) -> str:
    doc = fitz.open(caminho)
    paginas: list[str] = []

    for num_pagina, pagina in enumerate(doc, start=1):
        texto = pagina.get_text("text")

        # Se a página não tem texto (PDF escaneado), tenta OCR via pymupdf
        if not texto.strip():
            logger.info("Página %d sem texto detectável, aplicando OCR...", num_pagina)
            texto = _ocr_pagina(pagina)

        paginas.append(texto)

    doc.close()
    return "\n--- PÁGINA SEPARADORA ---\n".join(paginas)


def _extrair_de_imagem(caminho: str) -> str:
    """Abre a imagem como documento PyMuPDF e extrai texto via OCR."""
    doc = fitz.open(caminho)
    pagina = doc[0]
    texto = _ocr_pagina(pagina)
    doc.close()
    return texto


def _ocr_pagina(pagina: fitz.Page) -> str:
    """
    Aplica OCR em uma página usando PyMuPDF (requer Tesseract instalado).
    Fallback: retorna string vazia se OCR não estiver disponível.
    """
    try:
        # get_textpage_ocr requer tesseract instalado no sistema
        tp = pagina.get_textpage_ocr(language="por", dpi=300, full=True)
        return pagina.get_text(textpage=tp)
    except Exception as exc:
        logger.warning("OCR falhou: %s. Retornando texto vazio.", exc)
        return ""


def obter_primeira_pagina_como_bytes(caminho: str) -> bytes:
    """Renderiza a primeira página como PNG para preview."""
    doc = fitz.open(caminho)
    pagina = doc[0]
    mat = fitz.Matrix(2.0, 2.0)  # 2x zoom para melhor qualidade
    pix = pagina.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")
    doc.close()
    return img_bytes

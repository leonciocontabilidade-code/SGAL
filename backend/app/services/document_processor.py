"""
Extração de texto de PDFs e imagens usando PyMuPDF (com fallback para pypdf).
"""
import io
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    import fitz  # PyMuPDF
    FITZ_AVAILABLE = True
except Exception:
    FITZ_AVAILABLE = False
    logger.warning("PyMuPDF não disponível. Usando pypdf como fallback.")

SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}


def extrair_texto(caminho_arquivo: str) -> str:
    """
    Extrai texto de um PDF ou imagem.
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
    if FITZ_AVAILABLE:
        return _extrair_de_pdf_fitz(caminho)
    return _extrair_de_pdf_pypdf(caminho)


def _extrair_de_pdf_fitz(caminho: str) -> str:
    doc = fitz.open(caminho)
    paginas: list[str] = []

    for num_pagina, pagina in enumerate(doc, start=1):
        texto = pagina.get_text("text")

        if not texto.strip():
            logger.info("Página %d sem texto detectável, aplicando OCR...", num_pagina)
            texto = _ocr_pagina(pagina)

        paginas.append(texto)

    doc.close()
    return "\n--- PÁGINA SEPARADORA ---\n".join(paginas)


def _extrair_de_pdf_pypdf(caminho: str) -> str:
    from pypdf import PdfReader
    reader = PdfReader(caminho)
    paginas: list[str] = []
    for pagina in reader.pages:
        texto = pagina.extract_text() or ""
        paginas.append(texto)
    return "\n--- PÁGINA SEPARADORA ---\n".join(paginas)


def _extrair_de_imagem(caminho: str) -> str:
    """Abre a imagem como documento PyMuPDF e extrai texto via OCR."""
    if not FITZ_AVAILABLE:
        logger.warning("PyMuPDF indisponível, não é possível processar imagens.")
        return ""
    doc = fitz.open(caminho)
    pagina = doc[0]
    texto = _ocr_pagina(pagina)
    doc.close()
    return texto


def _ocr_pagina(pagina) -> str:
    try:
        tp = pagina.get_textpage_ocr(language="por", dpi=300, full=True)
        return pagina.get_text(textpage=tp)
    except Exception as exc:
        logger.warning("OCR falhou: %s. Retornando texto vazio.", exc)
        return ""


def obter_primeira_pagina_como_bytes(caminho: str) -> bytes:
    """Renderiza a primeira página como PNG para preview."""
    if not FITZ_AVAILABLE:
        return b""
    doc = fitz.open(caminho)
    pagina = doc[0]
    mat = fitz.Matrix(2.0, 2.0)
    pix = pagina.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")
    doc.close()
    return img_bytes

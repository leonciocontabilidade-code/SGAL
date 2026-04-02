"""
Serviço de alertas: detecta alvarás críticos e envia e-mail via SMTP.
Se SMTP não estiver configurado, registra no log (simulação).
"""
import logging
import smtplib
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alvara, HistoricoAlerta, StatusVencimento, StatusProcessamento
from app.config import get_settings

logger = logging.getLogger(__name__)


async def verificar_e_disparar_alertas(db: AsyncSession) -> dict:
    """
    Varre todos os alvarás processados e dispara alertas para os que
    estão na zona Amarela ou Vermelha, ainda não notificados e não resolvidos.
    """
    resultado = {"amarelos": 0, "vermelhos": 0, "erros": 0}

    stmt = select(Alvara).where(
        Alvara.status_processamento == StatusProcessamento.CONCLUIDO,
        Alvara.data_vencimento.isnot(None),
        Alvara.alerta_resolvido == False,  # noqa: E712
    )
    alvaras = (await db.execute(stmt)).scalars().all()

    for alvara in alvaras:
        try:
            status = alvara.status_vencimento
            await _processar_alerta(db, alvara, status, resultado)
        except Exception as exc:
            logger.error("Erro ao processar alerta alvara_id=%d: %s", alvara.id, exc)
            resultado["erros"] += 1

    await db.commit()
    logger.info("Verificação de alertas concluída: %s", resultado)
    return resultado


async def _processar_alerta(
    db: AsyncSession,
    alvara: Alvara,
    status: Optional[StatusVencimento],
    resultado: dict,
) -> None:
    if status == StatusVencimento.VERMELHO and not alvara.alerta_enviado_vermelho:
        mensagem = _montar_mensagem_alerta(alvara, "VERMELHO")
        await _registrar_alerta(db, alvara.id, "VERMELHO", mensagem)
        alvara.alerta_enviado_vermelho = True
        if not alvara.alerta_enviado_amarelo:
            alvara.alerta_enviado_amarelo = True
        resultado["vermelhos"] += 1
        await enviar_email_alerta(alvara, mensagem)

    elif status == StatusVencimento.AMARELO and not alvara.alerta_enviado_amarelo:
        mensagem = _montar_mensagem_alerta(alvara, "AMARELO")
        await _registrar_alerta(db, alvara.id, "AMARELO", mensagem)
        alvara.alerta_enviado_amarelo = True
        resultado["amarelos"] += 1
        await enviar_email_alerta(alvara, mensagem)


def _montar_mensagem_alerta(alvara: Alvara, tipo: str) -> str:
    dias = alvara.dias_para_vencer
    vencimento_str = alvara.data_vencimento.strftime("%d/%m/%Y") if alvara.data_vencimento else "N/A"

    if tipo == "VERMELHO":
        if dias is not None and dias < 0:
            urgencia = f"VENCIDO há {abs(dias)} dias"
        else:
            urgencia = f"vence em {dias} dias ({vencimento_str})"
    else:
        urgencia = f"vence em {dias} dias ({vencimento_str})"

    return (
        f"[ALERTA {tipo}] Alvará {alvara.tipo.value} | "
        f"Empresa: {alvara.razao_social or 'N/I'} | "
        f"CNPJ: {alvara.cnpj or 'N/I'} | "
        f"Protocolo: {alvara.numero_protocolo or 'N/I'} | "
        f"Situação: {urgencia}"
    )


async def _registrar_alerta(
    db: AsyncSession, alvara_id: int, tipo: str, mensagem: str
) -> None:
    historico = HistoricoAlerta(
        alvara_id=alvara_id,
        tipo_alerta=tipo,
        mensagem=mensagem,
    )
    db.add(historico)


async def _get_smtp_config() -> dict:
    """Lê config SMTP do banco de dados; fallback para variáveis de ambiente."""
    from app.database import AsyncSessionLocal
    from app.models import Configuracao
    from sqlalchemy import select

    settings = get_settings()
    base = {
        "host": settings.smtp_host,
        "port": settings.smtp_port,
        "user": settings.smtp_user,
        "password": settings.smtp_password,
        "from_addr": settings.smtp_from or settings.smtp_user,
        "tls": settings.smtp_tls,
    }
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Configuracao).where(Configuracao.chave.in_([
                    "smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from", "smtp_tls"
                ]))
            )
            configs = {r.chave: r.valor for r in result.scalars().all()}
            if configs.get("smtp_host"):
                base["host"]      = configs.get("smtp_host", base["host"])
                base["port"]      = int(configs.get("smtp_port") or base["port"])
                base["user"]      = configs.get("smtp_user", base["user"])
                base["password"]  = configs.get("smtp_password", base["password"])
                base["from_addr"] = configs.get("smtp_from") or configs.get("smtp_user") or base["from_addr"]
                tls_val           = configs.get("smtp_tls", "")
                base["tls"]       = tls_val.lower() not in ("false", "0", "no") if tls_val else base["tls"]
    except Exception as exc:
        logger.warning("Falha ao ler SMTP do banco: %s", exc)
    return base


async def enviar_email_alerta(alvara: Alvara, mensagem: str) -> None:
    """
    Envia e-mail real via SMTP. Lê configuração do banco (painel de config)
    com fallback para variáveis de ambiente.
    """
    smtp = await _get_smtp_config()

    if not smtp["host"] or not smtp["user"] or not alvara.email_contato:
        logger.warning("📧 [SMTP não configurado] %s", mensagem)
        return

    dias = alvara.dias_para_vencer
    cor_status = "#dc2626" if "VERMELHO" in mensagem or (dias is not None and dias < 0) else "#ca8a04"
    vencimento_fmt = alvara.data_vencimento.strftime("%d/%m/%Y") if alvara.data_vencimento else "N/A"

    TIPO_LABELS = {
        "SANITARIO": "Alvará Sanitário",
        "BOMBEIROS": "Certificado do Bombeiros",
        "FUNCIONAMENTO": "Alvará de Localização e Funcionamento",
        "AMA": "Alvará Ambiental",
        "DESCONHECIDO": "Desconhecido",
    }
    tipo_label = TIPO_LABELS.get(alvara.tipo.value, alvara.tipo.value)

    html = f"""
    <html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:30px auto;background:white;border-radius:10px;
                border-top:4px solid {cor_status};box-shadow:0 2px 8px rgba(0,0,0,.1);">
      <div style="background:#08332C;padding:20px 30px;border-radius:10px 10px 0 0;">
        <h1 style="color:#C6B185;margin:0;font-size:20px;">⚠️ SGAL — Alerta de Vencimento</h1>
      </div>
      <div style="padding:30px;">
        <p style="color:#555;margin-top:0;">O seguinte alvará requer atenção:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px;color:#888;width:40%;">Empresa</td>
              <td style="padding:8px;font-weight:bold;color:#222;">{alvara.razao_social or 'Não identificado'}</td></tr>
          <tr style="background:#f9f9f9;">
              <td style="padding:8px;color:#888;">CNPJ</td>
              <td style="padding:8px;color:#222;">{alvara.cnpj or 'N/I'}</td></tr>
          <tr><td style="padding:8px;color:#888;">Tipo</td>
              <td style="padding:8px;color:#222;">{tipo_label}</td></tr>
          <tr style="background:#f9f9f9;">
              <td style="padding:8px;color:#888;">Protocolo</td>
              <td style="padding:8px;color:#222;">{alvara.numero_protocolo or 'N/I'}</td></tr>
          <tr><td style="padding:8px;color:#888;">Vencimento</td>
              <td style="padding:8px;font-weight:bold;color:{cor_status};">{vencimento_fmt}</td></tr>
        </table>
        <div style="margin-top:20px;padding:15px;background:{cor_status}20;
                    border-left:4px solid {cor_status};border-radius:4px;">
          <strong style="color:{cor_status};">
            {"🔴 VENCIDO" if dias is not None and dias < 0 else f"⚠️ Vence em {dias} dias" if dias is not None else "⚠️ Atenção"}
          </strong>
        </div>
      </div>
      <div style="padding:15px 30px;background:#f9f9f9;border-radius:0 0 10px 10px;
                  font-size:12px;color:#999;text-align:center;">
        Mensagem gerada automaticamente pelo SGAL — Sistema de Gestão de Alvarás e Licenças
      </div>
    </div>
    </body></html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = smtp["from_addr"]
        msg["To"] = alvara.email_contato
        msg["Subject"] = f"[SGAL] {'🔴 VENCIDO' if dias is not None and dias < 0 else '⚠️ Alerta'} — {alvara.razao_social or alvara.cnpj}"
        msg.attach(MIMEText(mensagem, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(smtp["host"], smtp["port"], timeout=15) as server:
            server.ehlo()
            if smtp["tls"]:
                server.starttls()
                server.ehlo()
            if smtp["password"]:
                server.login(smtp["user"], smtp["password"])
            server.send_message(msg)

        logger.info("✅ E-mail de alerta enviado para %s (alvará %d)", alvara.email_contato, alvara.id)
    except Exception as exc:
        logger.error("❌ Falha ao enviar e-mail para %s: %s", alvara.email_contato, exc)

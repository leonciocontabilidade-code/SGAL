import { useState } from "react";
import { AlertTriangle, XCircle, Bell, CheckCircle2 } from "lucide-react";
import { api } from "../services/api";

const TIPO_LABELS = {
  SANITARIO: "Alvará Sanitário",
  BOMBEIROS: "Certificado do Bombeiros",
  FUNCIONAMENTO: "Alvará de Localização e Funcionamento",
  AMA: "Alvará Ambiental",
  DESCONHECIDO: "Desconhecido",
};

export function AlertPanel({ alvaras, onResolvido }) {
  const criticos = alvaras.filter(
    (a) =>
      (a.status_vencimento === "VERMELHO" || a.status_vencimento === "AMARELO") &&
      !a.alerta_resolvido
  );

  if (criticos.length === 0) return null;

  const vermelhos = criticos.filter((a) => a.status_vencimento === "VERMELHO");
  const amarelos = criticos.filter((a) => a.status_vencimento === "AMARELO");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          Alertas Ativos ({criticos.length})
        </h3>
      </div>

      {vermelhos.map((a) => (
        <AlertItem key={a.id} alvara={a} tipo="VERMELHO" onResolvido={onResolvido} />
      ))}
      {amarelos.map((a) => (
        <AlertItem key={a.id} alvara={a} tipo="AMARELO" onResolvido={onResolvido} />
      ))}
    </div>
  );
}

function AlertItem({ alvara, tipo, onResolvido }) {
  const isVermelho = tipo === "VERMELHO";
  const dias = alvara.dias_para_vencer;
  const [resolvendo, setResolvendo] = useState(false);

  const textoSituacao =
    dias === null
      ? "Sem data de vencimento"
      : dias < 0
      ? `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? "s" : ""}`
      : `Vence em ${dias} dia${dias !== 1 ? "s" : ""}`;

  const tipoLabel = TIPO_LABELS[alvara.tipo] || alvara.tipo;

  const marcarResolvido = async () => {
    setResolvendo(true);
    try {
      await api.alvaras.resolverAlerta(alvara.id);
      onResolvido?.();
    } catch {
      // silencioso — o dashboard vai recarregar em 5 min de qualquer forma
    } finally {
      setResolvendo(false);
    }
  };

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        isVermelho
          ? "bg-red-50 border-red-200"
          : "bg-yellow-50 border-yellow-200"
      }`}
    >
      {isVermelho ? (
        <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isVermelho ? "text-red-800" : "text-yellow-800"}`}>
          {alvara.razao_social || "Empresa não identificada"}
        </p>
        <p className={`text-xs mt-0.5 ${isVermelho ? "text-red-600" : "text-yellow-600"}`}>
          {tipoLabel} • {textoSituacao}
        </p>
        {alvara.cnpj && (
          <p className="text-xs text-gray-400 mt-0.5">{alvara.cnpj}</p>
        )}
        {alvara.email_contato && (
          <p className="text-xs text-gray-400 mt-0.5">📧 {alvara.email_contato}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isVermelho ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {isVermelho ? "CRÍTICO" : "ATENÇÃO"}
        </span>
        <button
          onClick={marcarResolvido}
          disabled={resolvendo}
          title="Marcar como resolvido"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {resolvendo ? "..." : "Resolvido"}
        </button>
      </div>
    </div>
  );
}

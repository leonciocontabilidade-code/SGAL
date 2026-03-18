import { AlertTriangle, XCircle, Bell } from "lucide-react";

export function AlertPanel({ alvaras }) {
  const criticos = alvaras.filter(
    (a) => a.status_vencimento === "VERMELHO" || a.status_vencimento === "AMARELO"
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
        <AlertItem key={a.id} alvara={a} tipo="VERMELHO" />
      ))}
      {amarelos.map((a) => (
        <AlertItem key={a.id} alvara={a} tipo="AMARELO" />
      ))}
    </div>
  );
}

function AlertItem({ alvara, tipo }) {
  const isVermelho = tipo === "VERMELHO";
  const dias = alvara.dias_para_vencer;

  const textoSituacao =
    dias === null
      ? "Sem data de vencimento"
      : dias < 0
      ? `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? "s" : ""}`
      : `Vence em ${dias} dia${dias !== 1 ? "s" : ""}`;

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
          {alvara.tipo} • {textoSituacao}
        </p>
        {alvara.cnpj && (
          <p className="text-xs text-gray-400 mt-0.5">{alvara.cnpj}</p>
        )}
      </div>
      <span
        className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
          isVermelho ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
        }`}
      >
        {isVermelho ? "CRÍTICO" : "ATENÇÃO"}
      </span>
    </div>
  );
}

const CONFIG = {
  VERDE: {
    label: "Em dia",
    classes: "bg-green-100 text-green-800 border border-green-200",
    dot: "bg-green-500",
  },
  AMARELO: {
    label: "Atenção",
    classes: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    dot: "bg-yellow-500",
  },
  VERMELHO: {
    label: "Crítico",
    classes: "bg-red-100 text-red-800 border border-red-200",
    dot: "bg-red-500 animate-pulse",
  },
};

const PROCESSAMENTO = {
  PENDENTE: { label: "Pendente", classes: "bg-gray-100 text-gray-600 border border-gray-200" },
  PROCESSANDO: { label: "Processando...", classes: "bg-blue-100 text-blue-700 border border-blue-200" },
  CONCLUIDO: null,
  ERRO: { label: "Erro", classes: "bg-red-100 text-red-700 border border-red-200" },
};

export function StatusBadge({ statusVencimento, statusProcessamento }) {
  // Se não concluiu o processamento, mostra status de processamento
  if (statusProcessamento && statusProcessamento !== "CONCLUIDO") {
    const cfg = PROCESSAMENTO[statusProcessamento];
    if (cfg) {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.classes}`}>
          {statusProcessamento === "PROCESSANDO" && (
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          )}
          {cfg.label}
        </span>
      );
    }
  }

  if (!statusVencimento) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
        Sem vencimento
      </span>
    );
  }

  const cfg = CONFIG[statusVencimento];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.classes}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function TipoBadge({ tipo }) {
  const cores = {
    SANITARIO: "bg-purple-100 text-purple-700 border-purple-200",
    BOMBEIROS: "bg-orange-100 text-orange-700 border-orange-200",
    FUNCIONAMENTO: "bg-blue-100 text-blue-700 border-blue-200",
    AMA: "bg-teal-100 text-teal-700 border-teal-200",
    DESCONHECIDO: "bg-gray-100 text-gray-600 border-gray-200",
  };

  const labels = {
    SANITARIO: "Alvará Sanitário",
    BOMBEIROS: "Certificado do Bombeiros",
    FUNCIONAMENTO: "Alvará de Localização e Funcionamento",
    AMA: "Alvará Ambiental",
    DESCONHECIDO: "Desconhecido",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cores[tipo] || cores.DESCONHECIDO}`}>
      {labels[tipo] || tipo}
    </span>
  );
}

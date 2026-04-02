import { useState, useCallback } from "react";
import {
  FileText, RefreshCw, CheckCircle, AlertTriangle,
  XCircle, HelpCircle, Filter, Trash2, Edit2, ChevronUp, ChevronDown, Bell,
  Download, ChevronLeft, ChevronRight, Settings, User
} from "lucide-react";
import { useDashboard } from "../hooks/useDashboard";
import { UploadZone } from "./UploadZone";
import { AlertPanel } from "./AlertPanel";
import { StatsCard } from "./StatsCard";
import { StatusBadge, TipoBadge } from "./StatusBadge";
import { EditModal } from "./EditModal";
import { NovoAlvaraManual } from "./NovoAlvaraManual";
import { ConfigModal } from "./ConfigModal";
import { api } from "../services/api";

const TIPOS = [
  { value: "TODOS",        label: "Todos os tipos" },
  { value: "SANITARIO",   label: "Alvará Sanitário" },
  { value: "BOMBEIROS",   label: "Certificado do Bombeiros" },
  { value: "FUNCIONAMENTO", label: "Alvará de Localização e Funcionamento" },
  { value: "AMA",          label: "Alvará Ambiental" },
];

const TIPO_LABELS = {
  SANITARIO: "Alvará Sanitário",
  BOMBEIROS: "Certificado do Bombeiros",
  FUNCIONAMENTO: "Alvará de Localização e Funcionamento",
  AMA: "Alvará Ambiental",
  DESCONHECIDO: "Desconhecido",
};

const COLUNAS = [
  { key: "razao_social", label: "Empresa" },
  { key: "cnpj", label: "CNPJ" },
  { key: "tipo", label: "Tipo" },
  { key: "numero_protocolo", label: "Protocolo" },
  { key: "data_vencimento", label: "Vencimento" },
  { key: "dias_para_vencer", label: "Dias" },
  { key: "status_vencimento", label: "Status" },
  { key: "confianca_extracao", label: "IA%" },
  { key: "status_renovacao", label: "Renovação" },
];

const RENOVACAO_BADGE = {
  NAO_INICIADA:    { label: "—",               cls: "text-gray-400" },
  EM_ANDAMENTO:    { label: "Em Andamento",     cls: "bg-blue-100 text-blue-700" },
  AGUARDANDO_DOCS: { label: "Aguard. Docs",     cls: "bg-orange-100 text-orange-700" },
  RENOVADO:        { label: "Renovado ✓",       cls: "bg-green-100 text-green-700" },
  CANCELADO:       { label: "Cancelado",        cls: "bg-red-100 text-red-700" },
};

const MESES_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

function labelMes(dataStr) {
  if (!dataStr) return "Sem data";
  const d = new Date(dataStr + "T00:00:00");
  return `${MESES_PT[d.getMonth()]} ${d.getFullYear()}`;
}

function agruparPorMes(lista) {
  const grupos = {};
  for (const a of lista) {
    const chave = a.data_vencimento
      ? new Date(a.data_vencimento + "T00:00:00").toISOString().slice(0, 7)
      : "9999-99";
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(a);
  }
  return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
}

export function Dashboard({ onLogout, usuario }) {
  const { data, loading, error, recarregar } = useDashboard();
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroStatus, setFiltroStatus] = useState(null);
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState({ key: "data_vencimento", dir: "asc" });
  const [agrupar, setAgrupar] = useState(true);
  const [abaUpload, setAbaUpload] = useState("pdf");
  const [deletando, setDeletando] = useState(null);
  const [editando, setEditando] = useState(null);
  const [configAberto, setConfigAberto] = useState(false);
  const [notificando, setNotificando] = useState(null);
  const [toasts, setToasts] = useState([]);

  const alvaras = data?.alvaras ?? [];
  const stats = data?.stats;
  const totalFiltrado = data?.total_filtrado ?? alvaras.length;
  const totalPaginas = data?.total_paginas ?? 1;
  const paginaAtual = data?.pagina ?? 1;

  const toggleFiltroStatus = (status) =>
    setFiltroStatus((prev) => (prev === status ? null : status));

  // Filtro e ordenação local (sobre a página atual)
  const filtrados = alvaras
    .filter((a) => filtroTipo === "TODOS" || a.tipo === filtroTipo)
    .filter((a) => {
      if (!filtroStatus) return true;
      if (filtroStatus === "SEM_DATA") return !a.data_vencimento;
      return a.status_vencimento === filtroStatus;
    })
    .filter((a) => {
      if (!busca) return true;
      const q = busca.toLowerCase();
      return (
        a.razao_social?.toLowerCase().includes(q) ||
        a.cnpj?.includes(q) ||
        a.numero_protocolo?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const { key, dir } = ordenacao;
      if (!a[key] && !b[key]) return 0;
      if (!a[key]) return 1;
      if (!b[key]) return -1;
      const va = a[key] ?? "";
      const vb = b[key] ?? "";
      if (va === vb) return 0;
      const cmp = va < vb ? -1 : 1;
      return dir === "asc" ? cmp : -cmp;
    });

  const toggleOrdenacao = (key) => {
    setOrdenacao((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
  };

  const addToast = (msg, tipo = "success") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  const deletar = async (id) => {
    if (!confirm("Deseja remover este alvará?")) return;
    setDeletando(id);
    try {
      await api.alvaras.deletar(id);
      recarregar();
    } finally {
      setDeletando(null);
    }
  };

  const notificar = async (id) => {
    setNotificando(id);
    try {
      await api.alvaras.notificar(id);
      addToast("Notificação enviada com sucesso!");
    } catch (e) {
      addToast(e.message, "error");
    } finally {
      setNotificando(null);
    }
  };

  const formatarData = (data) => {
    if (!data) return "—";
    return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
  };

  const corLinhaPorStatus = (status) => {
    if (status === "VERMELHO") return "bg-red-50 hover:bg-red-100/70";
    if (status === "AMARELO") return "bg-yellow-50 hover:bg-yellow-100/70";
    return "hover:bg-gray-50";
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const exportarCSV = useCallback(() => {
    const headers = ["Empresa", "CNPJ", "Tipo", "Protocolo", "Emissão", "Vencimento", "Dias", "Status", "Confiança IA (%)", "E-mail Contato"];
    const rows = filtrados.map((a) => [
      a.razao_social || "",
      a.cnpj || "",
      TIPO_LABELS[a.tipo] || a.tipo,
      a.numero_protocolo || "",
      a.data_emissao || "",
      a.data_vencimento || "",
      a.dias_para_vencer ?? "",
      a.status_vencimento || "SEM_DATA",
      a.confianca_extracao ?? "",
      a.email_contato || "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alvaras_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filtrados]);

  // ── Backup do banco ────────────────────────────────────────────────────────
  const baixarBackup = useCallback(async () => {
    const token = sessionStorage.getItem("sgal_token");
    const res = await fetch("/api/admin/backup", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sgal_backup_${new Date().toISOString().slice(0, 10)}.db`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#EADAB8" }}>
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${t.tipo === "error" ? "bg-red-600" : "bg-green-700"}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Modal de edição */}
      {editando && (
        <EditModal
          alvara={editando}
          onClose={() => setEditando(null)}
          onSaved={recarregar}
        />
      )}

      {/* Modal de configurações */}
      {configAberto && (
        <ConfigModal
          onClose={() => setConfigAberto(false)}
          isAdmin={usuario?.admin}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 shadow-md" style={{ backgroundColor: "#08332C" }}>
        <div className="w-full px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "#0C483E" }}>
              <FileText className="w-6 h-6" style={{ color: "#C6B185" }} />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: "#C6B185" }}>SGAL</h1>
              <p className="text-xs" style={{ color: "#EADAB8", opacity: 0.7 }}>Gestão de Alvarás e Licenças</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Usuário logado */}
            {usuario?.nome && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: "#0C483E" }}>
                <User className="w-3.5 h-3.5" style={{ color: "#C6B185" }} />
                <span className="text-xs font-medium" style={{ color: "#EADAB8" }}>{usuario.nome}</span>
              </div>
            )}
            <button
              onClick={recarregar}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
              style={{ color: "#C6B185" }}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              onClick={() => setConfigAberto(true)}
              title="Configurações"
              className="p-2 rounded-lg transition-opacity hover:opacity-80"
              style={{ color: "#C6B185", backgroundColor: "#0C483E" }}
            >
              <Settings className="w-4 h-4" />
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-xs px-3 py-1.5 rounded-lg transition-opacity"
                style={{ color: "#EADAB8", backgroundColor: "#052B25" }}
              >
                Sair
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full px-4 py-4 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
            Erro ao carregar dados: {error}
          </div>
        )}

        {/* Cards de estatísticas */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatsCard label="Total" valor={stats.total} cor="azul" icone={FileText} />
            <StatsCard label="Em dia" valor={stats.verdes} cor="verde" icone={CheckCircle} sublabel="> 60 dias"
              onClick={() => toggleFiltroStatus("VERDE")} ativo={filtroStatus === "VERDE"} />
            <StatsCard label="Atenção" valor={stats.amarelos} cor="amarelo" icone={AlertTriangle} sublabel="15–60 dias"
              onClick={() => toggleFiltroStatus("AMARELO")} ativo={filtroStatus === "AMARELO"} />
            <StatsCard label="Crítico" valor={stats.vermelhos} cor="vermelho" icone={XCircle} sublabel="< 15 dias / vencido"
              onClick={() => toggleFiltroStatus("VERMELHO")} ativo={filtroStatus === "VERMELHO"} />
            <StatsCard label="Sem data" valor={stats.sem_vencimento} cor="cinza" icone={HelpCircle}
              onClick={() => toggleFiltroStatus("SEM_DATA")} ativo={filtroStatus === "SEM_DATA"} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Upload */}
          <div className="lg:col-span-1 space-y-4">
            <section className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: "white", borderTop: "3px solid #0C483E" }}>
              <div className="flex border-b" style={{ borderColor: "#EADAB8" }}>
                {[{ key: "pdf", label: "Upload PDF" }, { key: "manual", label: "Cadastro Manual" }].map((aba) => (
                  <button
                    key={aba.key}
                    onClick={() => setAbaUpload(aba.key)}
                    className="flex-1 px-4 py-3 text-sm font-semibold transition-colors"
                    style={abaUpload === aba.key
                      ? { backgroundColor: "#08332C", color: "#C6B185" }
                      : { color: "#0C483E" }}
                  >
                    {aba.label}
                  </button>
                ))}
              </div>
              <div className="p-5">
                {abaUpload === "pdf"
                  ? <UploadZone onUploadSuccess={recarregar} />
                  : <NovoAlvaraManual onSalvo={recarregar} />
                }
              </div>
            </section>

            {alvaras.length > 0 && (
              <section className="rounded-xl shadow-sm p-6" style={{ backgroundColor: "white", borderTop: "3px solid #C6B185" }}>
                <AlertPanel alvaras={alvaras} onResolvido={recarregar} />
              </section>
            )}
          </div>

          {/* Tabela */}
          <div className="lg:col-span-3">
            <section className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: "white" }}>
              {/* Toolbar */}
              <div className="px-4 py-3 border-b flex flex-col gap-2" style={{ borderColor: "#EADAB8" }}>
                {filtroStatus && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Filtro ativo:</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
                      filtroStatus === "VERDE" ? "bg-green-100 text-green-700" :
                      filtroStatus === "AMARELO" ? "bg-yellow-100 text-yellow-700" :
                      filtroStatus === "VERMELHO" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {filtroStatus === "VERDE" ? "Em dia" : filtroStatus === "AMARELO" ? "Atenção" : filtroStatus === "VERMELHO" ? "Crítico" : "Sem data"}
                      <button onClick={() => setFiltroStatus(null)} className="ml-1 hover:opacity-70">✕</button>
                    </span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Buscar por empresa, CNPJ ou protocolo..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ border: "1px solid #C6B185" }}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="w-4 h-4" style={{ color: "#0C483E" }} />
                    <select
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                      className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ border: "1px solid #C6B185", color: "#08332C" }}
                    >
                      {TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setAgrupar((v) => !v)}
                      title={agrupar ? "Desagrupar meses" : "Agrupar por mês"}
                      className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                      style={agrupar
                        ? { backgroundColor: "#EADAB8", color: "#08332C", border: "1px solid #C6B185" }
                        : { backgroundColor: "white", color: "#0C483E", border: "1px solid #C6B185" }}
                    >
                      📅 Por mês
                    </button>
                    <button
                      onClick={exportarCSV}
                      title="Exportar para CSV"
                      className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors hover:opacity-80"
                      style={{ backgroundColor: "#08332C", color: "#C6B185", border: "1px solid #0C483E" }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </button>
                    <button
                      onClick={baixarBackup}
                      title="Baixar backup do banco de dados"
                      className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors hover:opacity-80"
                      style={{ backgroundColor: "#5a3e1b", color: "#EADAB8", border: "1px solid #8a6030" }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Backup
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "#08332C" }}>
                      {COLUNAS.map((col) => (
                        <th
                          key={col.key}
                          onClick={() => toggleOrdenacao(col.key)}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                          style={{ color: "#C6B185" }}
                        >
                          <span className="flex items-center gap-1">
                            {col.label}
                            {ordenacao.key === col.key ? (
                              ordenacao.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            ) : null}
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase" style={{ color: "#C6B185" }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading && (
                      <tr>
                        <td colSpan={COLUNAS.length + 1} className="text-center py-12 text-gray-400">
                          Carregando...
                        </td>
                      </tr>
                    )}
                    {!loading && filtrados.length === 0 && (
                      <tr>
                        <td colSpan={COLUNAS.length + 1} className="text-center py-12 text-gray-400">
                          Nenhum alvará encontrado.
                        </td>
                      </tr>
                    )}
                    {!loading && (agrupar
                      ? agruparPorMes(filtrados).flatMap(([chave, grupo]) => [
                          <tr key={`mes-${chave}`}>
                            <td colSpan={COLUNAS.length + 1} className="px-4 pt-4 pb-1">
                              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#0C483E" }}>
                                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#C6B185" }} />
                                {chave === "9999-99" ? "Sem data de vencimento" : labelMes(grupo[0]?.data_vencimento)}
                                <span className="font-normal" style={{ color: "#0C483E", opacity: 0.6 }}>({grupo.length})</span>
                              </span>
                            </td>
                          </tr>,
                          ...grupo.map((alvara) => (
                            <LinhaAlvara key={alvara.id} alvara={alvara} formatarData={formatarData}
                              corLinha={corLinhaPorStatus} deletando={deletando} onDeletar={deletar}
                              onEditar={setEditando} notificando={notificando} onNotificar={notificar} />
                          ))
                        ])
                      : filtrados.map((alvara) => (
                          <LinhaAlvara key={alvara.id} alvara={alvara} formatarData={formatarData}
                            corLinha={corLinhaPorStatus} deletando={deletando} onDeletar={deletar}
                            onEditar={setEditando} notificando={notificando} onNotificar={notificar} />
                        ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer: contagem + paginação */}
              <div className="px-4 py-3 border-t flex items-center justify-between text-xs" style={{ color: "#0C483E", borderColor: "#EADAB8" }}>
                <span>
                  {filtrados.length} de {totalFiltrado} alvará{totalFiltrado !== 1 ? "s" : ""}
                  {totalPaginas > 1 && ` — página ${paginaAtual} de ${totalPaginas}`}
                </span>
                {totalPaginas > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => recarregar(paginaAtual - 1)}
                      disabled={paginaAtual <= 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2">{paginaAtual}/{totalPaginas}</span>
                    <button
                      onClick={() => recarregar(paginaAtual + 1)}
                      disabled={paginaAtual >= totalPaginas}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function ConfiancaBadge({ valor }) {
  if (valor == null) return <span className="text-gray-300">—</span>;
  const cor =
    valor >= 80 ? "text-green-600" :
    valor >= 50 ? "text-yellow-600" :
                  "text-red-500";
  return <span className={`font-semibold text-xs ${cor}`}>{valor}%</span>;
}

function LinhaAlvara({ alvara, formatarData, corLinha, deletando, onDeletar, onEditar, notificando, onNotificar }) {
  const dias = alvara.dias_para_vencer;
  return (
    <tr className={`transition-colors ${corLinha(alvara.status_vencimento)}`}>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-800 truncate max-w-[180px]">
          {alvara.razao_social || <span className="text-gray-400 italic">Não identificado</span>}
        </p>
        <p className="text-xs text-gray-400 truncate max-w-[180px]">{alvara.nome_arquivo}</p>
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{alvara.cnpj || "—"}</td>
      <td className="px-4 py-3"><TipoBadge tipo={alvara.tipo} /></td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{alvara.numero_protocolo || "—"}</td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-medium">
        {formatarData(alvara.data_vencimento)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {dias !== null && dias !== undefined ? (
          <span className={`font-semibold ${
            dias < 0 ? "text-red-600" :
            dias <= 15 ? "text-red-500" :
            dias <= 60 ? "text-yellow-600" : "text-green-600"
          }`}>
            {dias < 0 ? `−${Math.abs(dias)}d` : `${dias}d`}
          </span>
        ) : "—"}
      </td>
      <td className="px-4 py-3">
        <StatusBadge
          statusVencimento={alvara.status_vencimento}
          statusProcessamento={alvara.status_processamento}
        />
      </td>
      <td className="px-4 py-3">
        <ConfiancaBadge valor={alvara.confianca_extracao} />
      </td>
      <td className="px-4 py-3">
        {(() => {
          const r = RENOVACAO_BADGE[alvara.status_renovacao] || RENOVACAO_BADGE.NAO_INICIADA;
          return r.label === "—"
            ? <span className={r.cls}>—</span>
            : <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.cls}`}>{r.label}</span>;
        })()}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEditar(alvara)}
            className="p-1.5 rounded transition-colors"
            style={{ color: "#0C483E" }}
            title="Editar dados"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNotificar(alvara.id)}
            disabled={notificando === alvara.id}
            className="p-1.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
            title="Enviar notificação"
          >
            <Bell className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeletar(alvara.id)}
            disabled={deletando === alvara.id}
            className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Remover"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

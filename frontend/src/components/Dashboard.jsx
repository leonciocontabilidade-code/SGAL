import { useState } from "react";
import {
  FileText, RefreshCw, CheckCircle, AlertTriangle,
  XCircle, HelpCircle, Filter, Trash2, Edit2, ChevronUp, ChevronDown, Bell
} from "lucide-react";
import { useDashboard } from "../hooks/useDashboard";
import { UploadZone } from "./UploadZone";
import { AlertPanel } from "./AlertPanel";
import { StatsCard } from "./StatsCard";
import { StatusBadge, TipoBadge } from "./StatusBadge";
import { EditModal } from "./EditModal";
import { api } from "../services/api";

const TIPOS = ["TODOS", "SANITARIO", "BOMBEIROS", "FUNCIONAMENTO", "AMA"];

const COLUNAS = [
  { key: "razao_social", label: "Empresa" },
  { key: "cnpj", label: "CNPJ" },
  { key: "tipo", label: "Tipo" },
  { key: "numero_protocolo", label: "Protocolo" },
  { key: "data_vencimento", label: "Vencimento" },
  { key: "dias_para_vencer", label: "Dias" },
  { key: "status_vencimento", label: "Status" },
];

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
      ? new Date(a.data_vencimento + "T00:00:00").toISOString().slice(0, 7) // "YYYY-MM"
      : "9999-99";
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(a);
  }
  return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
}

export function Dashboard() {
  const { data, loading, error, recarregar } = useDashboard();
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState({ key: "data_vencimento", dir: "asc" });
  const [agrupar, setAgrupar] = useState(true);
  const [deletando, setDeletando] = useState(null);
  const [editando, setEditando] = useState(null);
  const [notificando, setNotificando] = useState(null);
  const [toasts, setToasts] = useState([]);

  const alvaras = data?.alvaras ?? [];
  const stats = data?.stats;

  const filtrados = alvaras
    .filter((a) => filtroTipo === "TODOS" || a.tipo === filtroTipo)
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
      // Nulos sempre no final
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
      const res = await api.alvaras.notificar(id);
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${t.tipo === "error" ? "bg-red-600" : "bg-green-600"}`}>
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
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">SGAL</h1>
              <p className="text-xs text-gray-400">Gestão de Alvarás e Licenças</p>
            </div>
          </div>
          <button
            onClick={recarregar}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
            Erro ao carregar dados: {error}
          </div>
        )}

        {/* Cards de estatísticas */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatsCard label="Total" valor={stats.total} cor="azul" icone={FileText} />
            <StatsCard label="Em dia" valor={stats.verdes} cor="verde" icone={CheckCircle} sublabel="> 60 dias" />
            <StatsCard label="Atenção" valor={stats.amarelos} cor="amarelo" icone={AlertTriangle} sublabel="15–60 dias" />
            <StatsCard label="Crítico" valor={stats.vermelhos} cor="vermelho" icone={XCircle} sublabel="< 15 dias / vencido" />
            <StatsCard label="Sem data" valor={stats.sem_vencimento} cor="cinza" icone={HelpCircle} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload */}
          <div className="lg:col-span-1 space-y-6">
            <section className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Novo Documento</h2>
              <UploadZone onUploadSuccess={recarregar} />
            </section>

            {/* Painel de alertas */}
            {alvaras.length > 0 && (
              <section className="bg-white rounded-xl shadow-sm border p-6">
                <AlertPanel alvaras={alvaras} />
              </section>
            )}
          </div>

          {/* Tabela */}
          <div className="lg:col-span-2">
            <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Toolbar */}
              <div className="px-6 py-4 border-b flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Buscar por empresa, CNPJ ou protocolo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {t === "TODOS" ? "Todos os tipos" : t}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setAgrupar((v) => !v)}
                    title={agrupar ? "Desagrupar meses" : "Agrupar por mês"}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      agrupar
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    📅 {agrupar ? "Por mês" : "Por mês"}
                  </button>
                </div>
              </div>

              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      {COLUNAS.map((col) => (
                        <th
                          key={col.key}
                          onClick={() => toggleOrdenacao(col.key)}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                        >
                          <span className="flex items-center gap-1">
                            {col.label}
                            {ordenacao.key === col.key ? (
                              ordenacao.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            ) : null}
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ações</th>
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
                              <span className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                                {chave === "9999-99" ? "Sem data de vencimento" : labelMes(grupo[0]?.data_vencimento)}
                                <span className="font-normal text-gray-400">({grupo.length})</span>
                              </span>
                            </td>
                          </tr>,
                          ...grupo.map((alvara) => <LinhaAlvara key={alvara.id} alvara={alvara} formatarData={formatarData} corLinha={corLinhaPorStatus} deletando={deletando} onDeletar={deletar} onEditar={setEditando} notificando={notificando} onNotificar={notificar} />)
                        ])
                      : filtrados.map((alvara) => <LinhaAlvara key={alvara.id} alvara={alvara} formatarData={formatarData} corLinha={corLinhaPorStatus} deletando={deletando} onDeletar={deletar} onEditar={setEditando} notificando={notificando} onNotificar={notificar} />)
                    )}
                  </tbody>
                </table>
              </div>

              {filtrados.length > 0 && (
                <div className="px-6 py-3 border-t text-xs text-gray-400">
                  {filtrados.length} de {alvaras.length} alvará{alvaras.length !== 1 ? "s" : ""}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
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
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEditar(alvara)}
            className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
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

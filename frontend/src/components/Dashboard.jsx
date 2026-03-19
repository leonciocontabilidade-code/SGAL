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
import { NovoAlvaraManual } from "./NovoAlvaraManual";
import { api } from "../services/api";

const TIPOS = [
  { value: "TODOS",        label: "Todos os tipos" },
  { value: "SANITARIO",   label: "Alvará Sanitário" },
  { value: "BOMBEIROS",   label: "Certificado do Bombeiros" },
  { value: "FUNCIONAMENTO", label: "Alvará de Localização e Funcionamento" },
  { value: "AMA",          label: "Alvará Ambiental" },
];

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

export function Dashboard({ onLogout }) {
  const { data, loading, error, recarregar } = useDashboard();
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState({ key: "data_vencimento", dir: "asc" });
  const [agrupar, setAgrupar] = useState(true);
  const [abaUpload, setAbaUpload] = useState("pdf"); // "pdf" | "manual"
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
      {/* Header */}
      <header className="sticky top-0 z-10 shadow-md" style={{ backgroundColor: "#08332C" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "#0C483E" }}>
              <FileText className="w-6 h-6" style={{ color: "#C6B185" }} />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: "#C6B185" }}>SGAL</h1>
              <p className="text-xs" style={{ color: "#EADAB8", opacity: 0.7 }}>Gestão de Alvarás e Licenças</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={recarregar}
              disabled={loading}
              className="flex items-center gap-2 text-sm transition-opacity disabled:opacity-50"
              style={{ color: "#C6B185" }}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-xs px-3 py-1 rounded-lg transition-opacity"
                style={{ color: "#EADAB8", backgroundColor: "#052B25" }}
              >
                Sair
              </button>
            )}
          </div>
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
            <section className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: "white", borderTop: "3px solid #0C483E" }}>
              {/* Abas */}
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

            {/* Painel de alertas */}
            {alvaras.length > 0 && (
              <section className="rounded-xl shadow-sm p-6" style={{ backgroundColor: "white", borderTop: "3px solid #C6B185" }}>
                <AlertPanel alvaras={alvaras} />
              </section>
            )}
          </div>

          {/* Tabela */}
          <div className="lg:col-span-2">
            <section className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: "white" }}>
              {/* Toolbar */}
              <div className="px-6 py-4 border-b flex flex-col sm:flex-row gap-3" style={{ borderColor: "#EADAB8" }}>
                <input
                  type="text"
                  placeholder="Buscar por empresa, CNPJ ou protocolo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ border: "1px solid #C6B185", focusRingColor: "#0C483E" }}
                />
                <div className="flex items-center gap-2">
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
                          ...grupo.map((alvara) => <LinhaAlvara key={alvara.id} alvara={alvara} formatarData={formatarData} corLinha={corLinhaPorStatus} deletando={deletando} onDeletar={deletar} onEditar={setEditando} notificando={notificando} onNotificar={notificar} />)
                        ])
                      : filtrados.map((alvara) => <LinhaAlvara key={alvara.id} alvara={alvara} formatarData={formatarData} corLinha={corLinhaPorStatus} deletando={deletando} onDeletar={deletar} onEditar={setEditando} notificando={notificando} onNotificar={notificar} />)
                    )}
                  </tbody>
                </table>
              </div>

              {filtrados.length > 0 && (
                <div className="px-6 py-3 border-t text-xs" style={{ color: "#0C483E", borderColor: "#EADAB8" }}>
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

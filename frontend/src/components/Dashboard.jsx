import { useState, useCallback } from "react";
import {
  FileText, RefreshCw, CheckCircle, AlertTriangle,
  XCircle, HelpCircle, Filter, Trash2, Edit2, ChevronUp, ChevronDown, Bell,
  Download, ChevronLeft, ChevronRight, Settings, User, RotateCcw,
  ShieldAlert, Flame, Building2, Leaf, LayoutDashboard, List, Plus
} from "lucide-react";
import { useDashboard } from "../hooks/useDashboard";
import { UploadZone } from "./UploadZone";
import { AlertPanel } from "./AlertPanel";
import { StatusBadge, TipoBadge } from "./StatusBadge";
import { EditModal } from "./EditModal";
import { NovoAlvaraManual } from "./NovoAlvaraManual";
import { ConfigModal } from "./ConfigModal";
import { api } from "../services/api";

const TIPOS_FILTRO = [
  { value: "TODOS",         label: "Todos os tipos" },
  { value: "SANITARIO",    label: "Alvará Sanitário" },
  { value: "BOMBEIROS",    label: "Certificado do Bombeiros" },
  { value: "FUNCIONAMENTO",label: "Alvará de Funcionamento" },
  { value: "AMA",          label: "Alvará Ambiental" },
];

const TIPO_LABELS = {
  SANITARIO:     "Alvará Sanitário",
  BOMBEIROS:     "Certificado do Bombeiros",
  FUNCIONAMENTO: "Alvará de Localização e Funcionamento",
  AMA:           "Alvará Ambiental",
  DESCONHECIDO:  "Desconhecido",
};

const TIPO_CONFIG = {
  SANITARIO:     { label: "Sanitário",     icone: ShieldAlert, cor: "#0284c7", corFundo: "#e0f2fe", corBorda: "#7dd3fc" },
  BOMBEIROS:     { label: "Bombeiros",     icone: Flame,       cor: "#dc2626", corFundo: "#fee2e2", corBorda: "#fca5a5" },
  FUNCIONAMENTO: { label: "Funcionamento", icone: Building2,   cor: "#7c3aed", corFundo: "#ede9fe", corBorda: "#c4b5fd" },
  AMA:           { label: "Ambiental",     icone: Leaf,        cor: "#16a34a", corFundo: "#dcfce7", corBorda: "#86efac" },
};

const COLUNAS = [
  { key: "razao_social",        label: "Empresa" },
  { key: "cnpj",               label: "CNPJ" },
  { key: "tipo",               label: "Tipo" },
  { key: "numero_protocolo",   label: "Protocolo" },
  { key: "data_vencimento",    label: "Vencimento" },
  { key: "dias_para_vencer",   label: "Dias" },
  { key: "status_vencimento",  label: "Status" },
  { key: "confianca_extracao", label: "IA%" },
  { key: "status_renovacao",   label: "Renovação" },
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

// ── Cabeçalho de seção ────────────────────────────────────────────────────────
function SecaoHeader({ icone: Icone, titulo, subtitulo }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: "#0C483E20" }}>
          <Icone className="w-4 h-4" style={{ color: "#0C483E" }} />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#08332C" }}>{titulo}</h2>
          {subtitulo && <p className="text-xs text-gray-500">{subtitulo}</p>}
        </div>
      </div>
      <div className="flex-1 h-px" style={{ backgroundColor: "#C6B185", opacity: 0.4 }} />
    </div>
  );
}

// ── Card de estatística ────────────────────────────────────────────────────────
function StatCard({ label, valor, sublabel, cor, icone: Icone, onClick, ativo }) {
  const CORES = {
    azul:     { fundo: "#e0f2fe", texto: "#0284c7", borda: "#7dd3fc", selecionado: "#0284c7" },
    verde:    { fundo: "#dcfce7", texto: "#16a34a", borda: "#86efac", selecionado: "#16a34a" },
    amarelo:  { fundo: "#fef9c3", texto: "#ca8a04", borda: "#fde047", selecionado: "#ca8a04" },
    vermelho: { fundo: "#fee2e2", texto: "#dc2626", borda: "#fca5a5", selecionado: "#dc2626" },
    cinza:    { fundo: "#f3f4f6", texto: "#6b7280", borda: "#d1d5db", selecionado: "#6b7280" },
  };
  const c = CORES[cor] || CORES.cinza;
  return (
    <button
      onClick={onClick}
      className="rounded-xl p-4 text-left transition-all w-full"
      style={{
        backgroundColor: ativo ? c.selecionado : "white",
        border: `2px solid ${ativo ? c.selecionado : c.borda}`,
        boxShadow: ativo ? `0 4px 12px ${c.selecionado}40` : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <Icone className="w-5 h-5" style={{ color: ativo ? "white" : c.texto }} />
        <span className="text-2xl font-black" style={{ color: ativo ? "white" : c.texto }}>{valor}</span>
      </div>
      <p className="text-sm font-semibold" style={{ color: ativo ? "rgba(255,255,255,0.9)" : "#374151" }}>{label}</p>
      {sublabel && <p className="text-xs mt-0.5" style={{ color: ativo ? "rgba(255,255,255,0.7)" : "#9ca3af" }}>{sublabel}</p>}
    </button>
  );
}

// ── Card por tipo ─────────────────────────────────────────────────────────────
function CardTipo({ tipo, alvaras, filtroTipo, filtroStatus, onFiltrar }) {
  const cfg = TIPO_CONFIG[tipo];
  const Icone = cfg.icone;
  const lista = alvaras.filter((a) => a.tipo === tipo);
  const total = lista.length;
  const criticos = lista.filter((a) => a.status_vencimento === "VERMELHO").length;
  const atencao  = lista.filter((a) => a.status_vencimento === "AMARELO").length;
  const emDia    = lista.filter((a) => a.status_vencimento === "VERDE").length;
  const ativo    = filtroTipo === tipo;

  return (
    <div
      className="rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md"
      style={{
        border: `2px solid ${ativo ? cfg.cor : cfg.corBorda}`,
        boxShadow: ativo ? `0 4px 16px ${cfg.cor}30` : "0 1px 3px rgba(0,0,0,0.06)",
        transform: ativo ? "translateY(-1px)" : "none",
      }}
      onClick={() => onFiltrar(tipo, null)}
    >
      {/* Header do card */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: ativo ? cfg.cor : cfg.corFundo }}>
        <div className="flex items-center gap-2">
          <Icone className="w-4 h-4" style={{ color: ativo ? "white" : cfg.cor }} />
          <span className="text-sm font-bold" style={{ color: ativo ? "white" : cfg.cor }}>{cfg.label}</span>
        </div>
        <span className="text-xl font-black" style={{ color: ativo ? "white" : cfg.cor }}>{total}</span>
      </div>
      {/* Sub-contagens clicáveis */}
      <div className="grid grid-cols-3 divide-x bg-white" style={{ borderTop: `1px solid ${cfg.corBorda}` }}>
        {[
          { val: criticos, label: "Crítico",  filtro: "VERMELHO", cor: "#dc2626" },
          { val: atencao,  label: "Atenção",  filtro: "AMARELO",  cor: "#d97706" },
          { val: emDia,    label: "Em dia",   filtro: "VERDE",    cor: "#16a34a" },
        ].map(({ val, label, filtro, cor }) => {
          const subAtivo = filtroTipo === tipo && filtroStatus === filtro;
          return (
            <button
              key={filtro}
              onClick={(e) => { e.stopPropagation(); onFiltrar(tipo, filtro); }}
              className="py-2 px-1 text-center transition-colors hover:bg-gray-50"
              style={{ backgroundColor: subAtivo ? `${cor}15` : undefined }}
            >
              <div className="text-sm font-black" style={{ color: cor }}>{val}</div>
              <div className="text-[10px] text-gray-500 font-medium">{label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
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
  const [editandoAba, setEditandoAba] = useState("dados");
  const [configAberto, setConfigAberto] = useState(false);
  const [notificando, setNotificando] = useState(null);
  const [toasts, setToasts] = useState([]);

  const alvaras = data?.alvaras ?? [];
  const stats = data?.stats;
  const totalFiltrado = data?.total_filtrado ?? alvaras.length;
  const totalPaginas = data?.total_paginas ?? 1;
  const paginaAtual = data?.pagina ?? 1;

  const handleFiltrarTipo = (tipo, status) => {
    if (filtroTipo === tipo && filtroStatus === status) {
      setFiltroTipo("TODOS");
      setFiltroStatus(null);
    } else {
      setFiltroTipo(tipo);
      setFiltroStatus(status);
    }
  };

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
      const va = a[key] ?? "", vb = b[key] ?? "";
      if (va === vb) return 0;
      const cmp = va < vb ? -1 : 1;
      return dir === "asc" ? cmp : -cmp;
    });

  const toggleOrdenacao = (key) =>
    setOrdenacao((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );

  const addToast = (msg, tipo = "success") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  const deletar = async (id) => {
    if (!confirm("Deseja remover este alvará?")) return;
    setDeletando(id);
    try { await api.alvaras.deletar(id); recarregar(); }
    finally { setDeletando(null); }
  };

  const notificar = async (id) => {
    setNotificando(id);
    try { await api.alvaras.notificar(id); addToast("Notificação enviada!"); }
    catch (e) { addToast(e.message, "error"); }
    finally { setNotificando(null); }
  };

  const abrirRenovacao = (alvara) => { setEditando(alvara); setEditandoAba("renovacao"); };
  const abrirEdicao   = (alvara) => { setEditando(alvara); setEditandoAba("dados"); };

  const formatarData = (data) => {
    if (!data) return "—";
    return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
  };

  const corLinha = (status) => {
    if (status === "VERMELHO") return "bg-red-50 hover:bg-red-100/60";
    if (status === "AMARELO") return "bg-yellow-50 hover:bg-yellow-100/60";
    return "hover:bg-gray-50";
  };

  const exportarCSV = useCallback(() => {
    const headers = ["Empresa","CNPJ","Tipo","Protocolo","Emissão","Vencimento","Dias","Status","IA%","E-mail"];
    const rows = filtrados.map((a) => [
      a.razao_social||"", a.cnpj||"", TIPO_LABELS[a.tipo]||a.tipo,
      a.numero_protocolo||"", a.data_emissao||"", a.data_vencimento||"",
      a.dias_para_vencer??"", a.status_vencimento||"SEM_DATA",
      a.confianca_extracao??"", a.email_contato||"",
    ]);
    const csv = [headers,...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `alvaras_${new Date().toISOString().slice(0,10)}.csv`; link.click();
    URL.revokeObjectURL(url);
  }, [filtrados]);

  const baixarBackup = useCallback(async () => {
    const token = sessionStorage.getItem("sgal_token");
    const res = await fetch("/api/admin/backup", { headers: token ? {Authorization:`Bearer ${token}`} : {} });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `sgal_backup_${new Date().toISOString().slice(0,10)}.db`; link.click();
    URL.revokeObjectURL(url);
  }, []);

  const temFiltroAtivo = filtroTipo !== "TODOS" || filtroStatus !== null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f0ece4" }}>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${t.tipo==="error"?"bg-red-600":"bg-green-700"}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {editando && (
        <EditModal alvara={editando} abaInicial={editandoAba}
          onClose={() => { setEditando(null); setEditandoAba("dados"); }}
          onSaved={recarregar} />
      )}
      {configAberto && (
        <ConfigModal onClose={() => setConfigAberto(false)} isAdmin={usuario?.admin} />
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 shadow-lg" style={{ backgroundColor: "#08332C" }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "#0C483E" }}>
              <FileText className="w-5 h-5" style={{ color: "#C6B185" }} />
            </div>
            <div>
              <h1 className="text-base font-black tracking-wide" style={{ color: "#C6B185" }}>SGAL</h1>
              <p className="text-[11px]" style={{ color: "#EADAB8", opacity: 0.65 }}>Gestão de Alvarás e Licenças</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {usuario?.nome && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#0C483E" }}>
                <User className="w-3.5 h-3.5" style={{ color: "#C6B185" }} />
                <span className="text-xs font-semibold" style={{ color: "#EADAB8" }}>{usuario.nome}</span>
              </div>
            )}
            <button onClick={recarregar} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 transition-opacity hover:opacity-80"
              style={{ color: "#C6B185" }}>
              <RefreshCw className={`w-4 h-4 ${loading?"animate-spin":""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button onClick={() => setConfigAberto(true)} title="Configurações"
              className="p-2 rounded-lg hover:opacity-80" style={{ color: "#C6B185", backgroundColor: "#0C483E" }}>
              <Settings className="w-4 h-4" />
            </button>
            {onLogout && (
              <button onClick={onLogout} className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: "#EADAB8", backgroundColor: "#052B25" }}>
                Sair
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-8">

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm font-medium">
            ⚠ Erro ao carregar dados: {error}
          </div>
        )}

        {/* ── SEÇÃO 1: PAINEL GERAL ───────────────────────────────────────── */}
        {stats && (
          <section>
            <SecaoHeader icone={LayoutDashboard} titulo="Painel Geral" subtitulo="Resumo de todos os alvarás" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard label="Total Cadastrado" valor={stats.total} cor="azul" icone={FileText} />
              <StatCard label="Em Dia" valor={stats.verdes} cor="verde" icone={CheckCircle} sublabel="> 60 dias"
                onClick={() => { setFiltroTipo("TODOS"); setFiltroStatus((s) => s==="VERDE"?null:"VERDE"); }}
                ativo={filtroTipo==="TODOS" && filtroStatus==="VERDE"} />
              <StatCard label="Atenção" valor={stats.amarelos} cor="amarelo" icone={AlertTriangle} sublabel="15 a 60 dias"
                onClick={() => { setFiltroTipo("TODOS"); setFiltroStatus((s) => s==="AMARELO"?null:"AMARELO"); }}
                ativo={filtroTipo==="TODOS" && filtroStatus==="AMARELO"} />
              <StatCard label="Crítico / Vencido" valor={stats.vermelhos} cor="vermelho" icone={XCircle} sublabel="< 15 dias"
                onClick={() => { setFiltroTipo("TODOS"); setFiltroStatus((s) => s==="VERMELHO"?null:"VERMELHO"); }}
                ativo={filtroTipo==="TODOS" && filtroStatus==="VERMELHO"} />
              <StatCard label="Sem Data" valor={stats.sem_vencimento} cor="cinza" icone={HelpCircle}
                onClick={() => { setFiltroTipo("TODOS"); setFiltroStatus((s) => s==="SEM_DATA"?null:"SEM_DATA"); }}
                ativo={filtroTipo==="TODOS" && filtroStatus==="SEM_DATA"} />
            </div>
          </section>
        )}

        {/* ── SEÇÃO 2: POR TIPO DE ALVARÁ ─────────────────────────────────── */}
        <section>
          <SecaoHeader icone={Filter} titulo="Por Tipo de Alvará" subtitulo="Clique para filtrar a lista abaixo" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.keys(TIPO_CONFIG).map((tipo) => (
              <CardTipo key={tipo} tipo={tipo} alvaras={alvaras}
                filtroTipo={filtroTipo} filtroStatus={filtroStatus} onFiltrar={handleFiltrarTipo} />
            ))}
          </div>
        </section>

        {/* ── SEÇÃO 3: GESTÃO ─────────────────────────────────────────────── */}
        <section>
          <SecaoHeader icone={List} titulo="Alvarás Cadastrados" subtitulo={`${alvaras.length} registro${alvaras.length!==1?"s":""} no sistema`} />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

            {/* ── Coluna lateral ────────────────────── */}
            <div className="lg:col-span-1 space-y-4">

              {/* Painel: Adicionar Alvará */}
              <div className="rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: "white", border: "1px solid #e5e7eb" }}>
                <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "#08332C" }}>
                  <Plus className="w-4 h-4" style={{ color: "#C6B185" }} />
                  <h3 className="text-sm font-bold" style={{ color: "#C6B185" }}>Adicionar Alvará</h3>
                </div>
                <div className="flex border-b" style={{ borderColor: "#f3f4f6" }}>
                  {[{ key:"pdf", label:"Upload PDF"}, {key:"manual", label:"Cadastro Manual"}].map((aba) => (
                    <button key={aba.key} onClick={() => setAbaUpload(aba.key)}
                      className="flex-1 px-3 py-2.5 text-xs font-semibold transition-colors"
                      style={abaUpload===aba.key
                        ? { backgroundColor:"#f0ece4", color:"#08332C", borderBottom:"2px solid #08332C" }
                        : { color:"#6b7280" }}>
                      {aba.label}
                    </button>
                  ))}
                </div>
                <div className="p-4">
                  {abaUpload==="pdf" ? <UploadZone onUploadSuccess={recarregar} /> : <NovoAlvaraManual onSalvo={recarregar} />}
                </div>
              </div>

              {/* Painel: Alertas */}
              {alvaras.length > 0 && (
                <div className="rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: "white", border: "1px solid #e5e7eb" }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "#7c2d12" }}>
                    <Bell className="w-4 h-4 text-orange-200" />
                    <h3 className="text-sm font-bold text-orange-100">Alertas Ativos</h3>
                  </div>
                  <div className="p-4">
                    <AlertPanel alvaras={alvaras} onResolvido={recarregar} />
                  </div>
                </div>
              )}
            </div>

            {/* ── Tabela principal ──────────────────── */}
            <div className="lg:col-span-3">
              <div className="rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: "white", border: "1px solid #e5e7eb" }}>

                {/* Barra de filtros */}
                <div className="px-5 py-4 space-y-3" style={{ borderBottom: "1px solid #f3f4f6", backgroundColor: "#fafafa" }}>
                  {/* Filtros ativos */}
                  {temFiltroAtivo && (
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-gray-500 font-medium">Filtros ativos:</span>
                      {filtroTipo !== "TODOS" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold bg-indigo-100 text-indigo-700">
                          {TIPO_CONFIG[filtroTipo]?.label || filtroTipo}
                          <button onClick={() => setFiltroTipo("TODOS")} className="ml-1 hover:opacity-70">✕</button>
                        </span>
                      )}
                      {filtroStatus && (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold ${
                          filtroStatus==="VERDE"?"bg-green-100 text-green-700":
                          filtroStatus==="AMARELO"?"bg-yellow-100 text-yellow-700":
                          filtroStatus==="VERMELHO"?"bg-red-100 text-red-700":"bg-gray-100 text-gray-600"}`}>
                          {filtroStatus==="VERDE"?"Em dia":filtroStatus==="AMARELO"?"Atenção":filtroStatus==="VERMELHO"?"Crítico":"Sem data"}
                          <button onClick={() => setFiltroStatus(null)} className="ml-1 hover:opacity-70">✕</button>
                        </span>
                      )}
                      <button onClick={() => { setFiltroTipo("TODOS"); setFiltroStatus(null); }}
                        className="text-gray-400 hover:text-gray-600 underline ml-1">Limpar tudo</button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text" placeholder="Buscar por empresa, CNPJ ou protocolo..."
                      value={busca} onChange={(e) => setBusca(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C483E]"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0C483E]">
                        {TIPOS_FILTRO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <button onClick={() => setAgrupar((v) => !v)} title="Agrupar por mês"
                        className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                        style={agrupar
                          ? { backgroundColor:"#08332C", color:"#C6B185", border:"1px solid #0C483E" }
                          : { backgroundColor:"white", color:"#374151", border:"1px solid #d1d5db" }}>
                        📅 Por mês
                      </button>
                      <button onClick={exportarCSV}
                        className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:opacity-80"
                        style={{ backgroundColor:"#08332C", color:"#C6B185", border:"1px solid #0C483E" }}>
                        <Download className="w-3.5 h-3.5" /> CSV
                      </button>
                      <button onClick={baixarBackup}
                        className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:opacity-80"
                        style={{ backgroundColor:"#5a3e1b", color:"#EADAB8", border:"1px solid #8a6030" }}>
                        <Download className="w-3.5 h-3.5" /> Backup
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
                          <th key={col.key} onClick={() => toggleOrdenacao(col.key)}
                            className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
                            style={{ color: "#C6B185" }}>
                            <span className="flex items-center gap-1">
                              {col.label}
                              {ordenacao.key===col.key
                                ? ordenacao.dir==="asc" ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>
                                : null}
                            </span>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider" style={{ color: "#C6B185" }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loading && (
                        <tr><td colSpan={COLUNAS.length+1} className="text-center py-16 text-gray-400 text-sm">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-300" />
                          Carregando...
                        </td></tr>
                      )}
                      {!loading && filtrados.length===0 && (
                        <tr><td colSpan={COLUNAS.length+1} className="text-center py-16 text-gray-400 text-sm">
                          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                          Nenhum alvará encontrado{temFiltroAtivo ? " para os filtros selecionados" : ""}.
                        </td></tr>
                      )}
                      {!loading && (agrupar
                        ? agruparPorMes(filtrados).flatMap(([chave, grupo]) => [
                            <tr key={`mes-${chave}`}>
                              <td colSpan={COLUNAS.length+1} className="px-4 pt-5 pb-2" style={{ backgroundColor: "#f9f7f3" }}>
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#C6B185" }} />
                                  <span className="text-xs font-black uppercase tracking-widest" style={{ color: "#08332C" }}>
                                    {chave==="9999-99" ? "Sem data de vencimento" : labelMes(grupo[0]?.data_vencimento)}
                                  </span>
                                  <span className="text-xs text-gray-400 font-medium">({grupo.length} alvará{grupo.length!==1?"s":""})</span>
                                </div>
                              </td>
                            </tr>,
                            ...grupo.map((alvara) => (
                              <LinhaAlvara key={alvara.id} alvara={alvara} formatarData={formatarData}
                                corLinha={corLinha} deletando={deletando} onDeletar={deletar}
                                onEditar={abrirEdicao} onRenovar={abrirRenovacao}
                                notificando={notificando} onNotificar={notificar} />
                            ))
                          ])
                        : filtrados.map((alvara) => (
                            <LinhaAlvara key={alvara.id} alvara={alvara} formatarData={formatarData}
                              corLinha={corLinha} deletando={deletando} onDeletar={deletar}
                              onEditar={abrirEdicao} onRenovar={abrirRenovacao}
                              notificando={notificando} onNotificar={notificar} />
                          ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Rodapé da tabela */}
                <div className="px-5 py-3 flex items-center justify-between text-xs" style={{ borderTop:"1px solid #f3f4f6", backgroundColor:"#fafafa" }}>
                  <span className="text-gray-500">
                    <span className="font-semibold text-gray-700">{filtrados.length}</span> de <span className="font-semibold text-gray-700">{totalFiltrado}</span> alvará{totalFiltrado!==1?"s":""}
                    {totalPaginas>1 && ` — página ${paginaAtual} de ${totalPaginas}`}
                  </span>
                  {totalPaginas>1 && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => recarregar(paginaAtual-1)} disabled={paginaAtual<=1}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-30">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 py-1 rounded-lg border border-gray-200 text-gray-700 font-medium">{paginaAtual}/{totalPaginas}</span>
                      <button onClick={() => recarregar(paginaAtual+1)} disabled={paginaAtual>=totalPaginas}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-30">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

function ConfiancaBadge({ valor }) {
  if (valor==null) return <span className="text-gray-300 text-xs">—</span>;
  const cor = valor>=80?"text-green-600":valor>=50?"text-yellow-600":"text-red-500";
  return <span className={`font-bold text-xs ${cor}`}>{valor}%</span>;
}

function LinhaAlvara({ alvara, formatarData, corLinha, deletando, onDeletar, onEditar, onRenovar, notificando, onNotificar }) {
  const dias = alvara.dias_para_vencer;
  const renovBadge = RENOVACAO_BADGE[alvara.status_renovacao] || RENOVACAO_BADGE.NAO_INICIADA;
  return (
    <tr className={`transition-colors ${corLinha(alvara.status_vencimento)}`}>
      <td className="px-4 py-3">
        <p className="font-semibold text-gray-800 truncate max-w-[180px] text-sm">
          {alvara.razao_social || <span className="text-gray-400 italic text-xs">Não identificado</span>}
        </p>
        <p className="text-xs text-gray-400 truncate max-w-[180px] mt-0.5">{alvara.nome_arquivo}</p>
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs font-mono">{alvara.cnpj||"—"}</td>
      <td className="px-4 py-3"><TipoBadge tipo={alvara.tipo} /></td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{alvara.numero_protocolo||"—"}</td>
      <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-sm font-semibold">{formatarData(alvara.data_vencimento)}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        {dias!==null && dias!==undefined ? (
          <span className={`font-black text-sm ${dias<0?"text-red-600":dias<=15?"text-red-500":dias<=60?"text-yellow-600":"text-green-600"}`}>
            {dias<0?`−${Math.abs(dias)}d`:`${dias}d`}
          </span>
        ) : <span className="text-gray-300 text-xs">—</span>}
      </td>
      <td className="px-4 py-3">
        <StatusBadge statusVencimento={alvara.status_vencimento} statusProcessamento={alvara.status_processamento} />
      </td>
      <td className="px-4 py-3"><ConfiancaBadge valor={alvara.confianca_extracao} /></td>
      <td className="px-4 py-3">
        {renovBadge.label==="—"
          ? <span className={renovBadge.cls + " text-xs"}>—</span>
          : <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${renovBadge.cls}`}>{renovBadge.label}</span>
        }
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-0.5">
          <button onClick={() => onEditar(alvara)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Editar dados"
            style={{ color: "#0C483E" }}>
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => onRenovar(alvara)}
            className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="Gerenciar renovação"
            style={{ color: "#2563eb" }}>
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={() => onNotificar(alvara.id)} disabled={notificando===alvara.id}
            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40"
            title="Enviar notificação">
            <Bell className="w-4 h-4" />
          </button>
          <button onClick={() => onDeletar(alvara.id)} disabled={deletando===alvara.id}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            title="Remover">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

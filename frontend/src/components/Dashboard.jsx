import { useState, useCallback } from "react";
import {
  FileText, RefreshCw, CheckCircle, AlertTriangle,
  XCircle, HelpCircle, Trash2, Edit2, ChevronUp, ChevronDown, Bell,
  Download, ChevronLeft, ChevronRight, Settings, User, RotateCcw,
  ShieldAlert, Flame, Building2, Leaf, Plus, Search, X,
  LayoutDashboard, List, AlertOctagon, Menu
} from "lucide-react";
import { useDashboard } from "../hooks/useDashboard";
import { UploadZone } from "./UploadZone";
import { AlertPanel } from "./AlertPanel";
import { StatusBadge, TipoBadge } from "./StatusBadge";
import { EditModal } from "./EditModal";
import { NovoAlvaraManual } from "./NovoAlvaraManual";
import { ConfigModal } from "./ConfigModal";
import { api } from "../services/api";

const TIPO_LABELS = {
  SANITARIO:     "Alvará Sanitário",
  BOMBEIROS:     "Certificado do Bombeiros",
  FUNCIONAMENTO: "Alvará de Localização e Funcionamento",
  AMA:           "Alvará Ambiental",
  DESCONHECIDO:  "Desconhecido",
};

const TIPO_CONFIG = {
  SANITARIO:     { label: "Sanitário",     icone: ShieldAlert, cor: "#0284c7", corFundo: "#e0f2fe", dot: "#0284c7" },
  BOMBEIROS:     { label: "Bombeiros",     icone: Flame,       cor: "#dc2626", corFundo: "#fee2e2", dot: "#dc2626" },
  FUNCIONAMENTO: { label: "Funcionamento", icone: Building2,   cor: "#7c3aed", corFundo: "#ede9fe", dot: "#7c3aed" },
  AMA:           { label: "Ambiental",     icone: Leaf,        cor: "#16a34a", corFundo: "#dcfce7", dot: "#16a34a" },
};

const STATUS_CONFIG = {
  VERMELHO: { label: "Crítico / Vencido", cor: "#dc2626", fundo: "#fee2e2", icone: XCircle },
  AMARELO:  { label: "Atenção",           cor: "#d97706", fundo: "#fef9c3", icone: AlertTriangle },
  VERDE:    { label: "Em Dia",            cor: "#16a34a", fundo: "#dcfce7", icone: CheckCircle },
  SEM_DATA: { label: "Sem Data",          cor: "#6b7280", fundo: "#f3f4f6", icone: HelpCircle },
};

const RENOVACAO_BADGE = {
  NAO_INICIADA:    { label: "—",               cls: "text-gray-400" },
  EM_ANDAMENTO:    { label: "Em Andamento",     cls: "bg-blue-100 text-blue-700" },
  AGUARDANDO_DOCS: { label: "Aguard. Docs",     cls: "bg-orange-100 text-orange-700" },
  RENOVADO:        { label: "Renovado ✓",       cls: "bg-green-100 text-green-700" },
  CANCELADO:       { label: "Cancelado",        cls: "bg-red-100 text-red-700" },
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

function ConfiancaBadge({ valor }) {
  if (valor == null) return <span className="text-gray-300 text-xs">—</span>;
  const cor = valor >= 80 ? "text-green-600" : valor >= 50 ? "text-yellow-600" : "text-red-500";
  return <span className={`font-bold text-xs ${cor}`}>{valor}%</span>;
}

// ── Dot de status ─────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const cores = { VERMELHO: "#dc2626", AMARELO: "#d97706", VERDE: "#16a34a" };
  return (
    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: cores[status] || "#9ca3af" }} />
  );
}

// ── Item no menu lateral ──────────────────────────────────────────────────────
function SidebarNavItem({ label, count, icone: Icone, ativo, cor, onClick, indent = false }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all text-sm"
      style={{
        paddingLeft: indent ? "2rem" : "0.75rem",
        backgroundColor: ativo ? "rgba(198,177,133,0.18)" : "transparent",
        color: ativo ? "#C6B185" : "rgba(234,218,184,0.75)",
        fontWeight: ativo ? "700" : "500",
      }}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        {Icone && <Icone className="w-4 h-4 flex-shrink-0" style={{ color: ativo ? "#C6B185" : cor || "rgba(234,218,184,0.6)" }} />}
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined && (
        <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: ativo ? "#C6B185" : "rgba(198,177,133,0.2)", color: ativo ? "#08332C" : "#C6B185" }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Alvará no menu lateral ────────────────────────────────────────────────────
function SidebarAlvaraItem({ alvara, onEditar, onRenovar }) {
  const cfg = TIPO_CONFIG[alvara.tipo];
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group transition-colors"
      style={{ backgroundColor: "transparent" }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(198,177,133,0.1)"}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
      onClick={() => onEditar(alvara)}
    >
      <StatusDot status={alvara.status_vencimento} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: "#EADAB8" }}>
          {alvara.razao_social || <span className="italic opacity-50">Sem nome</span>}
        </p>
        <p className="text-[10px] truncate" style={{ color: "rgba(234,218,184,0.5)" }}>
          {cfg?.label || alvara.tipo} {alvara.cnpj ? `· ${alvara.cnpj.slice(0,14)}` : ""}
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRenovar(alvara); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
        style={{ color: "#60a5fa" }}
        title="Renovação"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Linha da tabela ───────────────────────────────────────────────────────────
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
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs font-mono">{alvara.cnpj || "—"}</td>
      <td className="px-4 py-3"><TipoBadge tipo={alvara.tipo} /></td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{alvara.numero_protocolo || "—"}</td>
      <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-sm font-semibold">{formatarData(alvara.data_vencimento)}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        {dias !== null && dias !== undefined ? (
          <span className={`font-black text-sm ${dias < 0 ? "text-red-600" : dias <= 15 ? "text-red-500" : dias <= 60 ? "text-yellow-600" : "text-green-600"}`}>
            {dias < 0 ? `−${Math.abs(dias)}d` : `${dias}d`}
          </span>
        ) : <span className="text-gray-300 text-xs">—</span>}
      </td>
      <td className="px-4 py-3">
        <StatusBadge statusVencimento={alvara.status_vencimento} statusProcessamento={alvara.status_processamento} />
      </td>
      <td className="px-4 py-3"><ConfiancaBadge valor={alvara.confianca_extracao} /></td>
      <td className="px-4 py-3">
        {renovBadge.label === "—"
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
          <button onClick={() => onNotificar(alvara.id)} disabled={notificando === alvara.id}
            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40"
            title="Enviar notificação">
            <Bell className="w-4 h-4" />
          </button>
          <button onClick={() => onDeletar(alvara.id)} disabled={deletando === alvara.id}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            title="Remover">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export function Dashboard({ onLogout, usuario }) {
  const { data, loading, error, recarregar } = useDashboard();
  const [filtroTipo, setFiltroTipo]       = useState("TODOS");
  const [filtroStatus, setFiltroStatus]   = useState(null);
  const [busca, setBusca]                 = useState("");
  const [sidebarBusca, setSidebarBusca]   = useState("");
  const [ordenacao, setOrdenacao]         = useState({ key: "data_vencimento", dir: "asc" });
  const [agrupar, setAgrupar]             = useState(true);
  const [abaUpload, setAbaUpload]         = useState("pdf");
  const [deletando, setDeletando]         = useState(null);
  const [editando, setEditando]           = useState(null);
  const [editandoAba, setEditandoAba]     = useState("dados");
  const [configAberto, setConfigAberto]   = useState(false);
  const [notificando, setNotificando]     = useState(null);
  const [toasts, setToasts]               = useState([]);
  const [addAberto, setAddAberto]         = useState(false);
  const [alertasAberto, setAlertasAberto] = useState(false);
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const [tipoExpandido, setTipoExpandido] = useState(null);

  const alvaras      = data?.alvaras ?? [];
  const stats        = data?.stats;
  const totalFiltrado = data?.total_filtrado ?? alvaras.length;
  const totalPaginas  = data?.total_paginas ?? 1;
  const paginaAtual   = data?.pagina ?? 1;

  // Lista do sidebar: todos os alvarás, ordenados por urgência
  const alvarasSidebar = alvaras
    .filter((a) => {
      if (!sidebarBusca) return true;
      const q = sidebarBusca.toLowerCase();
      return (
        a.razao_social?.toLowerCase().includes(q) ||
        a.cnpj?.includes(q) ||
        a.numero_protocolo?.toLowerCase().includes(q)
      );
    })
    .filter((a) => {
      if (filtroTipo !== "TODOS" && a.tipo !== filtroTipo) return false;
      if (filtroStatus) {
        if (filtroStatus === "SEM_DATA") return !a.data_vencimento;
        return a.status_vencimento === filtroStatus;
      }
      return true;
    })
    .sort((a, b) => {
      const ordem = { VERMELHO: 0, AMARELO: 1, VERDE: 2 };
      const oa = ordem[a.status_vencimento] ?? 3;
      const ob = ordem[b.status_vencimento] ?? 3;
      return oa !== ob ? oa - ob : (a.razao_social || "").localeCompare(b.razao_social || "");
    });

  // Contagens por tipo e status para o sidebar
  const contagem = {
    total: alvaras.length,
    porTipo: Object.fromEntries(Object.keys(TIPO_CONFIG).map((t) => [t, alvaras.filter((a) => a.tipo === t).length])),
    porStatus: {
      VERMELHO: alvaras.filter((a) => a.status_vencimento === "VERMELHO").length,
      AMARELO:  alvaras.filter((a) => a.status_vencimento === "AMARELO").length,
      VERDE:    alvaras.filter((a) => a.status_vencimento === "VERDE").length,
      SEM_DATA: alvaras.filter((a) => !a.data_vencimento).length,
    },
    porTipoStatus: Object.fromEntries(
      Object.keys(TIPO_CONFIG).map((t) => [t, {
        VERMELHO: alvaras.filter((a) => a.tipo === t && a.status_vencimento === "VERMELHO").length,
        AMARELO:  alvaras.filter((a) => a.tipo === t && a.status_vencimento === "AMARELO").length,
        VERDE:    alvaras.filter((a) => a.tipo === t && a.status_vencimento === "VERDE").length,
      }])
    ),
  };

  // Filtros para a tabela principal
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
    if (status === "AMARELO")  return "bg-yellow-50 hover:bg-yellow-100/60";
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

  const alertasAtivos = alvaras.filter((a) => !a.alerta_resolvido && (a.status_vencimento === "VERMELHO" || a.status_vencimento === "AMARELO")).length;

  const filtroLabel = () => {
    const parts = [];
    if (filtroTipo !== "TODOS") parts.push(TIPO_CONFIG[filtroTipo]?.label || filtroTipo);
    if (filtroStatus) parts.push(STATUS_CONFIG[filtroStatus]?.label || filtroStatus);
    return parts.length ? parts.join(" · ") : "Todos os Alvarás";
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#f0ece4" }}>

      {/* ── Toasts ─────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white pointer-events-auto ${t.tipo === "error" ? "bg-red-600" : "bg-green-700"}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── Modais ─────────────────────────────────────────────────────────── */}
      {editando && (
        <EditModal alvara={editando} abaInicial={editandoAba}
          onClose={() => { setEditando(null); setEditandoAba("dados"); }}
          onSaved={recarregar} />
      )}
      {configAberto && (
        <ConfigModal onClose={() => setConfigAberto(false)} isAdmin={usuario?.admin} />
      )}

      {/* ── Modal Adicionar Alvará ──────────────────────────────────────────── */}
      {addAberto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: "#08332C" }}>
              <h2 className="text-base font-bold" style={{ color: "#C6B185" }}>Adicionar Alvará</h2>
              <button onClick={() => setAddAberto(false)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: "#C6B185" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex border-b border-gray-100">
              {[{ key: "pdf", label: "Upload PDF" }, { key: "manual", label: "Cadastro Manual" }].map((aba) => (
                <button key={aba.key} onClick={() => setAbaUpload(aba.key)}
                  className="flex-1 px-4 py-3 text-sm font-semibold transition-colors"
                  style={abaUpload === aba.key
                    ? { backgroundColor: "#f0ece4", color: "#08332C", borderBottom: "2px solid #08332C" }
                    : { color: "#6b7280" }}>
                  {aba.label}
                </button>
              ))}
            </div>
            <div className="p-5">
              {abaUpload === "pdf"
                ? <UploadZone onUploadSuccess={() => { recarregar(); setAddAberto(false); }} />
                : <NovoAlvaraManual onSalvo={() => { recarregar(); setAddAberto(false); }} />
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Alertas ─────────────────────────────────────────────────── */}
      {alertasAberto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ backgroundColor: "#7c2d12" }}>
              <h2 className="text-base font-bold text-orange-100">Alertas Ativos</h2>
              <button onClick={() => setAlertasAberto(false)} className="p-1.5 rounded-lg hover:opacity-70 text-orange-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <AlertPanel alvaras={alvaras} onResolvido={recarregar} />
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SIDEBAR                                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <aside
        className="flex flex-col flex-shrink-0 transition-all duration-300"
        style={{
          width: sidebarAberta ? "272px" : "64px",
          backgroundColor: "#08332C",
          minHeight: "100vh",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(198,177,133,0.15)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#0C483E" }}>
            <FileText className="w-4 h-4" style={{ color: "#C6B185" }} />
          </div>
          {sidebarAberta && (
            <div className="min-w-0">
              <p className="text-sm font-black tracking-wide" style={{ color: "#C6B185" }}>SGAL</p>
              <p className="text-[10px] leading-tight" style={{ color: "rgba(234,218,184,0.55)" }}>Gestão de Alvarás</p>
            </div>
          )}
          <button
            onClick={() => setSidebarAberta((v) => !v)}
            className="ml-auto p-1 rounded-lg hover:opacity-70 flex-shrink-0"
            style={{ color: "rgba(198,177,133,0.6)" }}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {sidebarAberta && (
          <>
            {/* Busca rápida */}
            <div className="px-3 py-3 flex-shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(234,218,184,0.4)" }} />
                <input
                  type="text"
                  placeholder="Buscar empresa..."
                  value={sidebarBusca}
                  onChange={(e) => setSidebarBusca(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.07)",
                    color: "#EADAB8",
                    border: "1px solid rgba(198,177,133,0.2)",
                  }}
                />
                {sidebarBusca && (
                  <button onClick={() => setSidebarBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                    <X className="w-3 h-3" style={{ color: "#C6B185" }} />
                  </button>
                )}
              </div>
            </div>

            {/* Nav: Visão Geral */}
            <div className="px-3 pb-1 flex-shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-1" style={{ color: "rgba(198,177,133,0.4)" }}>Visão Geral</p>
              <SidebarNavItem
                label="Todos os Alvarás"
                count={contagem.total}
                icone={LayoutDashboard}
                ativo={filtroTipo === "TODOS" && !filtroStatus}
                onClick={() => { setFiltroTipo("TODOS"); setFiltroStatus(null); setSidebarBusca(""); }}
              />
            </div>

            {/* Nav: Por Tipo */}
            <div className="px-3 pb-1 flex-shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-1 mt-3" style={{ color: "rgba(198,177,133,0.4)" }}>Por Tipo</p>
              {Object.entries(TIPO_CONFIG).map(([tipo, cfg]) => {
                const Icone = cfg.icone;
                const tipoAtivo = filtroTipo === tipo;
                const expandido = tipoExpandido === tipo;
                const c = contagem.porTipo[tipo] || 0;
                const ts = contagem.porTipoStatus[tipo] || {};
                return (
                  <div key={tipo}>
                    <div className="flex items-center">
                      <SidebarNavItem
                        label={cfg.label}
                        count={c}
                        icone={Icone}
                        cor={cfg.cor}
                        ativo={tipoAtivo && !filtroStatus}
                        onClick={() => {
                          setFiltroTipo(tipo);
                          setFiltroStatus(null);
                          setTipoExpandido((v) => v === tipo ? null : tipo);
                        }}
                      />
                    </div>
                    {/* Sub-itens de status por tipo */}
                    {(tipoAtivo || expandido) && (
                      <div className="ml-2 mb-1">
                        {[
                          { s: "VERMELHO", label: "Crítico", cor: "#dc2626", count: ts.VERMELHO || 0 },
                          { s: "AMARELO",  label: "Atenção",  cor: "#d97706", count: ts.AMARELO  || 0 },
                          { s: "VERDE",    label: "Em Dia",   cor: "#16a34a", count: ts.VERDE    || 0 },
                        ].map(({ s, label, cor, count }) => count > 0 && (
                          <button
                            key={s}
                            onClick={() => { setFiltroTipo(tipo); setFiltroStatus(s === filtroStatus ? null : s); }}
                            className="w-full flex items-center justify-between pl-6 pr-3 py-1.5 rounded-lg text-xs transition-all"
                            style={{
                              color: filtroTipo === tipo && filtroStatus === s ? "#EADAB8" : "rgba(234,218,184,0.55)",
                              backgroundColor: filtroTipo === tipo && filtroStatus === s ? "rgba(198,177,133,0.12)" : "transparent",
                              fontWeight: filtroTipo === tipo && filtroStatus === s ? "700" : "500",
                            }}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cor }} />
                              {label}
                            </span>
                            <span className="text-[10px] font-bold" style={{ color: cor }}>{count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Nav: Por Status */}
            <div className="px-3 pb-1 flex-shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-1 mt-3" style={{ color: "rgba(198,177,133,0.4)" }}>Por Status</p>
              {Object.entries(STATUS_CONFIG).map(([s, cfg]) => {
                const Icone = cfg.icone;
                const c = contagem.porStatus[s] || 0;
                return (
                  <SidebarNavItem
                    key={s}
                    label={cfg.label}
                    count={c}
                    icone={Icone}
                    cor={cfg.cor}
                    ativo={filtroStatus === s && filtroTipo === "TODOS"}
                    onClick={() => {
                      setFiltroTipo("TODOS");
                      setFiltroStatus((prev) => prev === s ? null : s);
                    }}
                  />
                );
              })}
            </div>

            {/* Lista de alvarás */}
            {alvarasSidebar.length > 0 && (
              <div className="px-3 pb-2 flex-shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-1 mt-3" style={{ color: "rgba(198,177,133,0.4)" }}>
                  Empresas ({alvarasSidebar.length})
                </p>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ minHeight: 0 }}>
              {alvarasSidebar.map((a) => (
                <SidebarAlvaraItem key={a.id} alvara={a} onEditar={abrirEdicao} onRenovar={abrirRenovacao} />
              ))}
              {alvarasSidebar.length === 0 && sidebarBusca && (
                <p className="text-xs text-center py-4" style={{ color: "rgba(234,218,184,0.35)" }}>
                  Nenhuma empresa encontrada
                </p>
              )}
            </div>
          </>
        )}

        {/* Botões de ação (sidebar expandida) */}
        <div className="flex-shrink-0 px-3 py-3 space-y-1.5" style={{ borderTop: "1px solid rgba(198,177,133,0.15)" }}>
          {sidebarAberta ? (
            <>
              <button
                onClick={() => setAddAberto(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: "#C6B185", color: "#08332C" }}
              >
                <Plus className="w-4 h-4" />
                Adicionar Alvará
              </button>
              {alertasAtivos > 0 && (
                <button
                  onClick={() => setAlertasAberto(true)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ backgroundColor: "rgba(220,38,38,0.15)", color: "#fca5a5" }}
                >
                  <span className="flex items-center gap-2"><Bell className="w-4 h-4" /> Alertas</span>
                  <span className="text-xs font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full">{alertasAtivos}</span>
                </button>
              )}
              <div className="flex items-center gap-1.5 pt-1">
                <button onClick={() => setConfigAberto(true)}
                  className="flex-1 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium hover:opacity-80"
                  style={{ color: "rgba(234,218,184,0.6)", backgroundColor: "rgba(255,255,255,0.05)" }}>
                  <Settings className="w-3.5 h-3.5" /> Config.
                </button>
                {onLogout && (
                  <button onClick={onLogout}
                    className="flex-1 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium hover:opacity-80"
                    style={{ color: "rgba(234,218,184,0.6)", backgroundColor: "rgba(255,255,255,0.05)" }}>
                    Sair
                  </button>
                )}
              </div>
              {usuario?.nome && (
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(198,177,133,0.5)" }} />
                  <span className="text-xs truncate" style={{ color: "rgba(234,218,184,0.5)" }}>{usuario.nome}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => setAddAberto(true)} title="Adicionar Alvará"
                className="p-2.5 rounded-lg hover:opacity-80"
                style={{ backgroundColor: "#C6B185", color: "#08332C" }}>
                <Plus className="w-4 h-4" />
              </button>
              {alertasAtivos > 0 && (
                <button onClick={() => setAlertasAberto(true)} title="Alertas" className="relative p-2 rounded-lg" style={{ color: "#fca5a5" }}>
                  <Bell className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center">{alertasAtivos}</span>
                </button>
              )}
              <button onClick={() => setConfigAberto(true)} title="Configurações"
                className="p-2 rounded-lg hover:opacity-70" style={{ color: "rgba(234,218,184,0.6)" }}>
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Barra superior ─────────────────────────────────────────────── */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 shadow-sm"
          style={{ backgroundColor: "#0C483E" }}>
          <div>
            <h1 className="text-sm font-bold" style={{ color: "#C6B185" }}>{filtroLabel()}</h1>
            <p className="text-xs" style={{ color: "rgba(234,218,184,0.6)" }}>
              {filtrados.length} registro{filtrados.length !== 1 ? "s" : ""} encontrado{filtrados.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={recarregar} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 hover:opacity-80"
              style={{ color: "#C6B185" }}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button onClick={exportarCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
              style={{ backgroundColor: "rgba(198,177,133,0.15)", color: "#C6B185" }}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={baixarBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80"
              style={{ backgroundColor: "rgba(198,177,133,0.15)", color: "#EADAB8" }}>
              <Download className="w-3.5 h-3.5" /> Backup
            </button>
          </div>
        </header>

        {/* ── Stats strip ────────────────────────────────────────────────── */}
        {stats && (
          <div className="flex-shrink-0 px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total", valor: stats.total,        cor: "#0284c7", fundo: "#e0f2fe", icone: FileText,       status: null,       tipo: true },
                { label: "Crítico",  valor: stats.vermelhos,  cor: "#dc2626", fundo: "#fee2e2", icone: XCircle,        status: "VERMELHO",  tipo: false },
                { label: "Atenção",  valor: stats.amarelos,   cor: "#d97706", fundo: "#fef9c3", icone: AlertTriangle,  status: "AMARELO",   tipo: false },
                { label: "Em Dia",   valor: stats.verdes,     cor: "#16a34a", fundo: "#dcfce7", icone: CheckCircle,    status: "VERDE",     tipo: false },
              ].map(({ label, valor, cor, fundo, icone: Icone, status, tipo }) => {
                const ativo = status ? (filtroStatus === status && filtroTipo === "TODOS") : (filtroTipo === "TODOS" && !filtroStatus);
                return (
                  <button
                    key={label}
                    onClick={() => {
                      if (status) {
                        setFiltroTipo("TODOS");
                        setFiltroStatus((s) => s === status ? null : status);
                      } else {
                        setFiltroTipo("TODOS");
                        setFiltroStatus(null);
                      }
                    }}
                    className="rounded-xl p-4 text-left transition-all"
                    style={{
                      backgroundColor: ativo ? cor : "white",
                      border: `2px solid ${ativo ? cor : "#e5e7eb"}`,
                      boxShadow: ativo ? `0 4px 12px ${cor}40` : "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Icone className="w-4 h-4" style={{ color: ativo ? "rgba(255,255,255,0.8)" : cor }} />
                      <span className="text-2xl font-black" style={{ color: ativo ? "white" : cor }}>{valor}</span>
                    </div>
                    <p className="text-xs font-semibold" style={{ color: ativo ? "rgba(255,255,255,0.85)" : "#374151" }}>{label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm font-medium flex-shrink-0">
            ⚠ Erro ao carregar dados: {error}
          </div>
        )}

        {/* ── Área da tabela ─────────────────────────────────────────────── */}
        <div className="flex-1 px-6 pb-6 min-w-0">
          <div className="rounded-xl overflow-hidden shadow-sm h-full flex flex-col" style={{ backgroundColor: "white", border: "1px solid #e5e7eb" }}>

            {/* Barra de filtros internos */}
            <div className="flex-shrink-0 px-5 py-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center"
              style={{ borderBottom: "1px solid #f3f4f6", backgroundColor: "#fafafa" }}>

              {/* Filtros ativos */}
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {(filtroTipo !== "TODOS" || filtroStatus) && (
                  <>
                    <span className="text-xs text-gray-400 font-medium">Filtros:</span>
                    {filtroTipo !== "TODOS" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                        {TIPO_CONFIG[filtroTipo]?.label || filtroTipo}
                        <button onClick={() => setFiltroTipo("TODOS")} className="ml-1 hover:opacity-70">✕</button>
                      </span>
                    )}
                    {filtroStatus && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: `${STATUS_CONFIG[filtroStatus]?.cor}20`, color: STATUS_CONFIG[filtroStatus]?.cor }}>
                        {STATUS_CONFIG[filtroStatus]?.label || filtroStatus}
                        <button onClick={() => setFiltroStatus(null)} className="ml-1 hover:opacity-70">✕</button>
                      </span>
                    )}
                    <button onClick={() => { setFiltroTipo("TODOS"); setFiltroStatus(null); }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline">Limpar</button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text" placeholder="Buscar..."
                    value={busca} onChange={(e) => setBusca(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C483E]"
                    style={{ width: "200px" }}
                  />
                </div>
                <button onClick={() => setAgrupar((v) => !v)} title="Agrupar por mês"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={agrupar
                    ? { backgroundColor: "#08332C", color: "#C6B185", border: "1px solid #0C483E" }
                    : { backgroundColor: "white", color: "#374151", border: "1px solid #d1d5db" }}>
                  📅 Por mês
                </button>
              </div>
            </div>

            {/* Tabela */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr style={{ backgroundColor: "#08332C" }}>
                    {COLUNAS.map((col) => (
                      <th key={col.key} onClick={() => toggleOrdenacao(col.key)}
                        className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
                        style={{ color: "#C6B185" }}>
                        <span className="flex items-center gap-1">
                          {col.label}
                          {ordenacao.key === col.key
                            ? ordenacao.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            : null}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider" style={{ color: "#C6B185" }}>Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr><td colSpan={COLUNAS.length + 1} className="text-center py-16 text-gray-400 text-sm">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-300" />
                      Carregando...
                    </td></tr>
                  )}
                  {!loading && filtrados.length === 0 && (
                    <tr><td colSpan={COLUNAS.length + 1} className="text-center py-16 text-gray-400 text-sm">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                      Nenhum alvará encontrado{(filtroTipo !== "TODOS" || filtroStatus) ? " para os filtros selecionados" : ""}.
                    </td></tr>
                  )}
                  {!loading && (agrupar
                    ? agruparPorMes(filtrados).flatMap(([chave, grupo]) => [
                        <tr key={`mes-${chave}`}>
                          <td colSpan={COLUNAS.length + 1} className="px-4 pt-5 pb-2" style={{ backgroundColor: "#f9f7f3" }}>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#C6B185" }} />
                              <span className="text-xs font-black uppercase tracking-widest" style={{ color: "#08332C" }}>
                                {chave === "9999-99" ? "Sem data de vencimento" : labelMes(grupo[0]?.data_vencimento)}
                              </span>
                              <span className="text-xs text-gray-400 font-medium">({grupo.length} alvará{grupo.length !== 1 ? "s" : ""})</span>
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

            {/* Rodapé paginação */}
            <div className="flex-shrink-0 px-5 py-3 flex items-center justify-between text-xs"
              style={{ borderTop: "1px solid #f3f4f6", backgroundColor: "#fafafa" }}>
              <span className="text-gray-500">
                <span className="font-semibold text-gray-700">{filtrados.length}</span> de{" "}
                <span className="font-semibold text-gray-700">{totalFiltrado}</span> alvará{totalFiltrado !== 1 ? "s" : ""}
                {totalPaginas > 1 && ` — página ${paginaAtual} de ${totalPaginas}`}
              </span>
              {totalPaginas > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => recarregar(paginaAtual - 1)} disabled={paginaAtual <= 1}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-30">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 py-1 rounded-lg border border-gray-200 text-gray-700 font-medium">{paginaAtual}/{totalPaginas}</span>
                  <button onClick={() => recarregar(paginaAtual + 1)} disabled={paginaAtual >= totalPaginas}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-30">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

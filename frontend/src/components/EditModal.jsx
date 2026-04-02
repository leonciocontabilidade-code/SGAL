import { useState, useEffect } from "react";
import { X, Save, Loader2, Search, CheckCircle, Mail, RefreshCw, ExternalLink, Send, FileText, ClipboardList } from "lucide-react";
import { api } from "../services/api";

const TIPOS = [
  { value: "SANITARIO",     label: "Alvará Sanitário" },
  { value: "BOMBEIROS",     label: "Certificado do Bombeiros" },
  { value: "FUNCIONAMENTO", label: "Alvará de Localização e Funcionamento" },
  { value: "AMA",           label: "Alvará Ambiental" },
  { value: "DESCONHECIDO",  label: "Desconhecido" },
];

const STATUS_RENOVACAO = {
  NAO_INICIADA:    { label: "Não Iniciada",          cor: "bg-gray-100 text-gray-600",     dot: "#9ca3af" },
  EM_ANDAMENTO:    { label: "Em Andamento",           cor: "bg-blue-100 text-blue-700",     dot: "#3b82f6" },
  AGUARDANDO_DOCS: { label: "Aguardando Documentos", cor: "bg-orange-100 text-orange-700", dot: "#f97316" },
  RENOVADO:        { label: "Renovado ✓",             cor: "bg-green-100 text-green-700",   dot: "#22c55e" },
  CANCELADO:       { label: "Cancelado",              cor: "bg-red-100 text-red-700",       dot: "#ef4444" },
};

// Portais de renovação por tipo de alvará
const PORTAIS_RENOVACAO = {
  SANITARIO:     { url: "https://sigvisa.saude.mg.gov.br/", label: "Portal Vigilância Sanitária MG" },
  BOMBEIROS:     { url: "https://servicos.bombeiros.mg.gov.br/", label: "Portal CBMMG" },
  FUNCIONAMENTO: { url: "https://redesim.gov.br/", label: "Portal Redesim" },
  AMA:           { url: "https://www.siam.mg.gov.br/", label: "Portal SIAM/MG" },
  DESCONHECIDO:  { url: "https://www.google.com/search?q=renovar+alvara+prefeitura", label: "Pesquisar portal" },
};

function formatarCNPJ(valor) {
  const digits = valor.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function ConfiancaBadge({ valor }) {
  if (valor == null) return null;
  const cor =
    valor >= 80 ? "bg-green-100 text-green-700" :
    valor >= 50 ? "bg-yellow-100 text-yellow-700" :
                  "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cor}`}>
      🤖 IA: {valor}%
    </span>
  );
}

export function EditModal({ alvara, onClose, onSaved, abaInicial = "dados" }) {
  const [abaAtiva, setAbaAtiva] = useState(abaInicial);
  const [form, setForm] = useState({
    razao_social: alvara.razao_social || "",
    cnpj: alvara.cnpj || "",
    tipo: alvara.tipo || "DESCONHECIDO",
    numero_protocolo: alvara.numero_protocolo || "",
    data_emissao: alvara.data_emissao || "",
    data_vencimento: alvara.data_vencimento || "",
    email_contato: alvara.email_contato || "",
    // Renovação
    status_renovacao: alvara.status_renovacao || "NAO_INICIADA",
    data_protocolo_renovacao: alvara.data_protocolo_renovacao || "",
    numero_protocolo_renovacao: alvara.numero_protocolo_renovacao || "",
    observacoes_renovacao: alvara.observacoes_renovacao || "",
    data_renovacao_efetiva: alvara.data_renovacao_efetiva || "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [cnpjOk, setCnpjOk] = useState(false);
  const [erroCNPJ, setErroCNPJ] = useState(null);
  const [enviandoNotif, setEnviandoNotif] = useState(false);
  const [notifOk, setNotifOk] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const handleCNPJ = (e) => {
    const formatado = formatarCNPJ(e.target.value);
    setCnpjOk(false);
    setErroCNPJ(null);
    setForm((f) => ({ ...f, cnpj: formatado }));
  };

  const buscarCNPJ = async () => {
    const digits = form.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) { setErroCNPJ("CNPJ deve ter 14 dígitos"); return; }
    setBuscandoCNPJ(true);
    setErroCNPJ(null);
    setCnpjOk(false);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não encontrado na Receita Federal");
      const dados = await res.json();
      setForm((f) => ({ ...f, razao_social: dados.razao_social || f.razao_social, cnpj: formatarCNPJ(digits) }));
      setCnpjOk(true);
    } catch (e) {
      setErroCNPJ(e.message);
    } finally {
      setBuscandoCNPJ(false);
    }
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const payload = {};
      if (form.razao_social) payload.razao_social = form.razao_social;
      if (form.cnpj) payload.cnpj = form.cnpj;
      payload.tipo = form.tipo;
      if (form.numero_protocolo) payload.numero_protocolo = form.numero_protocolo;
      if (form.data_emissao) payload.data_emissao = form.data_emissao;
      if (form.data_vencimento) payload.data_vencimento = form.data_vencimento;
      payload.email_contato = form.email_contato || null;
      // Renovação
      payload.status_renovacao = form.status_renovacao;
      payload.data_protocolo_renovacao = form.data_protocolo_renovacao || null;
      payload.numero_protocolo_renovacao = form.numero_protocolo_renovacao || null;
      payload.observacoes_renovacao = form.observacoes_renovacao || null;
      payload.data_renovacao_efetiva = form.data_renovacao_efetiva || null;

      await api.alvaras.atualizar(alvara.id, payload);
      onSaved();
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const enviarNotificacao = async () => {
    setEnviandoNotif(true);
    setNotifOk(false);
    try {
      await api.alvaras.notificarRenovacao(alvara.id);
      setNotifOk(true);
      setTimeout(() => setNotifOk(false), 3000);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviandoNotif(false);
    }
  };

  const labelStyle = "block text-xs font-semibold uppercase tracking-wide mb-1.5";
  const inputStyle = "w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C483E] border-gray-200";
  const portal = PORTAIS_RENOVACAO[form.tipo] || PORTAIS_RENOVACAO.DESCONHECIDO;
  const statusInfo = STATUS_RENOVACAO[form.status_renovacao] || STATUS_RENOVACAO.NAO_INICIADA;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10" style={{ borderColor: "#EADAB8" }}>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold" style={{ color: "#08332C" }}>Editar Alvará</h2>
              <ConfiancaBadge valor={alvara.confianca_extracao} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[340px]">{alvara.nome_arquivo}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b" style={{ borderColor: "#EADAB8" }}>
          <button
            onClick={() => setAbaAtiva("dados")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors border-b-2 ${
              abaAtiva === "dados"
                ? "border-[#08332C] text-[#08332C]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <FileText className="w-4 h-4" />
            Dados do Alvará
          </button>
          <button
            onClick={() => setAbaAtiva("renovacao")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors border-b-2 ${
              abaAtiva === "renovacao"
                ? "border-[#08332C] text-[#08332C]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Renovação
            {form.status_renovacao !== "NAO_INICIADA" && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusInfo.cor}`}>
                {statusInfo.label}
              </span>
            )}
          </button>
        </div>

        {/* Aba: Dados */}
        {abaAtiva === "dados" && (
          <div className="px-6 py-5 space-y-4">
            {/* CNPJ */}
            <div>
              <label className={labelStyle} style={{ color: "#0C483E" }}>CNPJ</label>
              <div className="flex gap-2">
                <input
                  type="text" value={form.cnpj} onChange={handleCNPJ}
                  placeholder="XX.XXX.XXX/XXXX-XX"
                  className={inputStyle + (cnpjOk ? " border-green-400" : "")}
                  onKeyDown={(e) => { if (e.key === "Enter") buscarCNPJ(); }}
                />
                <button
                  onClick={buscarCNPJ} disabled={buscandoCNPJ}
                  className="px-3 py-2.5 rounded-lg text-white text-sm font-medium flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
                  style={{ backgroundColor: "#0C483E" }}
                >
                  {buscandoCNPJ ? <Loader2 className="w-4 h-4 animate-spin" /> : cnpjOk ? <CheckCircle className="w-4 h-4 text-green-300" /> : <Search className="w-4 h-4" />}
                  RFB
                </button>
              </div>
              {erroCNPJ && <p className="text-xs text-red-500 mt-1">{erroCNPJ}</p>}
              {cnpjOk && <p className="text-xs text-green-600 mt-1">✓ Dados preenchidos pela Receita Federal</p>}
            </div>

            <div>
              <label className={labelStyle} style={{ color: "#0C483E" }}>Razão Social</label>
              <input type="text" value={form.razao_social} onChange={set("razao_social")} placeholder="Nome da empresa" className={inputStyle} />
            </div>

            <div>
              <label className={labelStyle} style={{ color: "#0C483E" }}>Tipo de Alvará</label>
              <select value={form.tipo} onChange={set("tipo")} className={inputStyle}>
                {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelStyle} style={{ color: "#0C483E" }}>Número do Protocolo</label>
              <input type="text" value={form.numero_protocolo} onChange={set("numero_protocolo")} placeholder="Ex: 10288/2025" className={inputStyle} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelStyle} style={{ color: "#0C483E" }}>Data de Emissão</label>
                <input type="date" value={form.data_emissao} onChange={set("data_emissao")} className={inputStyle} />
              </div>
              <div>
                <label className={labelStyle} style={{ color: "#0C483E" }}>Data de Vencimento</label>
                <input type="date" value={form.data_vencimento} onChange={set("data_vencimento")} className={inputStyle} />
              </div>
            </div>

            <div>
              <label className={labelStyle} style={{ color: "#0C483E" }}>
                <Mail className="w-3.5 h-3.5 inline mr-1" />
                E-mail para alertas
              </label>
              <input type="email" value={form.email_contato} onChange={set("email_contato")} placeholder="responsavel@empresa.com.br" className={inputStyle} />
              <p className="text-xs text-gray-400 mt-1">Usado para envio de alertas e notificações de renovação.</p>
            </div>
          </div>
        )}

        {/* Aba: Renovação */}
        {abaAtiva === "renovacao" && (
          <div className="px-6 py-5 space-y-5">

            {/* Status atual em destaque */}
            <div className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: "#f8f6f0", border: "1px solid #EADAB8" }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Status da Renovação</p>
                <span className={`inline-flex items-center gap-2 text-sm font-bold px-3 py-1 rounded-full ${statusInfo.cor}`}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: statusInfo.dot }} />
                  {statusInfo.label}
                </span>
              </div>
              <a
                href={portal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#08332C" }}
                title={portal.label}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Acessar Portal
              </a>
            </div>

            {/* Selecionar status */}
            <div>
              <label className={labelStyle} style={{ color: "#0C483E" }}>Atualizar Status</label>
              <select value={form.status_renovacao} onChange={set("status_renovacao")} className={inputStyle}>
                {Object.entries(STATUS_RENOVACAO).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Protocolo de renovação */}
            <div>
              <label className={labelStyle} style={{ color: "#0C483E" }}>
                <ClipboardList className="w-3.5 h-3.5 inline mr-1" />
                Número do Protocolo de Renovação
              </label>
              <input
                type="text"
                value={form.numero_protocolo_renovacao}
                onChange={set("numero_protocolo_renovacao")}
                placeholder="Ex: 2025/00123"
                className={inputStyle}
              />
            </div>

            {/* Datas de renovação */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelStyle} style={{ color: "#0C483E" }}>Data do Protocolo</label>
                <input type="date" value={form.data_protocolo_renovacao} onChange={set("data_protocolo_renovacao")} className={inputStyle} />
                <p className="text-xs text-gray-400 mt-1">Quando foi protocolado</p>
              </div>
              <div>
                <label className={labelStyle} style={{ color: "#0C483E" }}>Data de Renovação</label>
                <input type="date" value={form.data_renovacao_efetiva} onChange={set("data_renovacao_efetiva")} className={inputStyle} />
                <p className="text-xs text-gray-400 mt-1">Quando foi renovado</p>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className={labelStyle} style={{ color: "#0C483E" }}>Observações do Processo</label>
              <textarea
                value={form.observacoes_renovacao}
                onChange={set("observacoes_renovacao")}
                placeholder="Anotações sobre o andamento, pendências, contatos realizados..."
                rows={4}
                className={inputStyle + " resize-none"}
              />
            </div>

            {/* Enviar ao cliente */}
            <div className="rounded-xl p-4" style={{ backgroundColor: "#f0f7f4", border: "1px solid #b2d8cc" }}>
              <p className="text-xs font-semibold text-[#0C483E] mb-1">Notificar Cliente</p>
              <p className="text-xs text-gray-500 mb-3">
                Envia o status atual da renovação para{" "}
                <span className="font-medium text-[#0C483E]">{alvara.email_contato || "e-mail não cadastrado"}</span>
              </p>
              <button
                onClick={enviarNotificacao}
                disabled={enviandoNotif || !alvara.email_contato}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#0C483E" }}
              >
                {enviandoNotif ? <Loader2 className="w-4 h-4 animate-spin" /> : notifOk ? <CheckCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {notifOk ? "Enviado!" : "Enviar atualização ao cliente"}
              </button>
              {!alvara.email_contato && (
                <p className="text-xs text-orange-600 mt-2">⚠ Cadastre o e-mail na aba "Dados" para habilitar.</p>
              )}
            </div>
          </div>
        )}

        {erro && (
          <div className="mx-6 mb-2">
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white" style={{ borderColor: "#EADAB8" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50" style={{ borderColor: "#C6B185" }}>
            Cancelar
          </button>
          <button
            onClick={salvar} disabled={salvando}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
            style={{ backgroundColor: "#08332C" }}
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

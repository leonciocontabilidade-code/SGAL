import { useState, useEffect } from "react";
import { X, Save, Loader2, Search, CheckCircle, Mail } from "lucide-react";
import { api } from "../services/api";

const TIPOS = [
  { value: "SANITARIO",     label: "Alvará Sanitário" },
  { value: "BOMBEIROS",     label: "Certificado do Bombeiros" },
  { value: "FUNCIONAMENTO", label: "Alvará de Localização e Funcionamento" },
  { value: "AMA",           label: "Alvará Ambiental" },
  { value: "DESCONHECIDO",  label: "Desconhecido" },
];

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

export function EditModal({ alvara, onClose, onSaved }) {
  const [form, setForm] = useState({
    razao_social: alvara.razao_social || "",
    cnpj: alvara.cnpj || "",
    tipo: alvara.tipo || "DESCONHECIDO",
    numero_protocolo: alvara.numero_protocolo || "",
    data_emissao: alvara.data_emissao || "",
    data_vencimento: alvara.data_vencimento || "",
    email_contato: alvara.email_contato || "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [cnpjOk, setCnpjOk] = useState(false);
  const [erroCNPJ, setErroCNPJ] = useState(null);

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
    if (digits.length !== 14) {
      setErroCNPJ("CNPJ deve ter 14 dígitos");
      return;
    }
    setBuscandoCNPJ(true);
    setErroCNPJ(null);
    setCnpjOk(false);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não encontrado na Receita Federal");
      const dados = await res.json();
      setForm((f) => ({
        ...f,
        razao_social: dados.razao_social || f.razao_social,
        cnpj: formatarCNPJ(digits),
      }));
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

      await api.alvaras.atualizar(alvara.id, payload);
      onSaved();
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const labelStyle = "block text-xs font-semibold uppercase tracking-wide mb-1.5";
  const inputStyle = "w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C483E] border-gray-200";

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

        {/* Campos */}
        <div className="px-6 py-5 space-y-4">

          {/* CNPJ com busca RFB */}
          <div>
            <label className={labelStyle} style={{ color: "#0C483E" }}>CNPJ</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.cnpj}
                onChange={handleCNPJ}
                placeholder="XX.XXX.XXX/XXXX-XX"
                className={inputStyle + (cnpjOk ? " border-green-400" : "")}
                onKeyDown={(e) => { if (e.key === "Enter") buscarCNPJ(); }}
              />
              <button
                onClick={buscarCNPJ}
                disabled={buscandoCNPJ}
                title="Buscar na Receita Federal"
                className="px-3 py-2.5 rounded-lg text-white text-sm font-medium flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
                style={{ backgroundColor: "#0C483E" }}
              >
                {buscandoCNPJ
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : cnpjOk
                    ? <CheckCircle className="w-4 h-4 text-green-300" />
                    : <Search className="w-4 h-4" />}
                RFB
              </button>
            </div>
            {erroCNPJ && <p className="text-xs text-red-500 mt-1">{erroCNPJ}</p>}
            {cnpjOk && <p className="text-xs text-green-600 mt-1">✓ Dados preenchidos pela Receita Federal</p>}
          </div>

          {/* Razão Social */}
          <div>
            <label className={labelStyle} style={{ color: "#0C483E" }}>Razão Social</label>
            <input
              type="text"
              value={form.razao_social}
              onChange={set("razao_social")}
              placeholder="Nome da empresa"
              className={inputStyle}
            />
          </div>

          {/* Tipo */}
          <div>
            <label className={labelStyle} style={{ color: "#0C483E" }}>Tipo de Alvará</label>
            <select value={form.tipo} onChange={set("tipo")} className={inputStyle}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Protocolo */}
          <div>
            <label className={labelStyle} style={{ color: "#0C483E" }}>Número do Protocolo</label>
            <input
              type="text"
              value={form.numero_protocolo}
              onChange={set("numero_protocolo")}
              placeholder="Ex: 10288/2025"
              className={inputStyle}
            />
          </div>

          {/* Datas */}
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

          {/* E-mail de contato para alertas */}
          <div>
            <label className={labelStyle} style={{ color: "#0C483E" }}>
              <Mail className="w-3.5 h-3.5 inline mr-1" />
              E-mail para alertas
            </label>
            <input
              type="email"
              value={form.email_contato}
              onChange={set("email_contato")}
              placeholder="responsavel@empresa.com.br"
              className={inputStyle}
            />
            <p className="text-xs text-gray-400 mt-1">Usado para envio automático de alertas de vencimento.</p>
          </div>

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white" style={{ borderColor: "#EADAB8" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50"
            style={{ borderColor: "#C6B185" }}
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
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

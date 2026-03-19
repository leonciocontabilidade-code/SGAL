import { useState } from "react";
import { Search, Loader2, CheckCircle, Save, X } from "lucide-react";
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

const labelStyle = "block text-xs font-semibold uppercase tracking-wide mb-1";
const inputStyle = "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C483E] border-gray-200";

export function NovoAlvaraManual({ onSalvo }) {
  const [form, setForm] = useState({
    cnpj: "", razao_social: "", tipo: "DESCONHECIDO",
    numero_protocolo: "", data_emissao: "", data_vencimento: "",
  });
  const [buscando, setBuscando] = useState(false);
  const [cnpjOk, setCnpjOk] = useState(false);
  const [erroCNPJ, setErroCNPJ] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

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
    setBuscando(true);
    setErroCNPJ(null);
    setCnpjOk(false);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não encontrado na Receita Federal");
      const dados = await res.json();
      setForm((f) => ({ ...f, razao_social: dados.razao_social || f.razao_social }));
      setCnpjOk(true);
    } catch (e) {
      setErroCNPJ(e.message);
    } finally {
      setBuscando(false);
    }
  };

  const limpar = () => {
    setForm({ cnpj: "", razao_social: "", tipo: "DESCONHECIDO", numero_protocolo: "", data_emissao: "", data_vencimento: "" });
    setCnpjOk(false); setErroCNPJ(null); setErro(null);
  };

  const salvar = async () => {
    if (!form.razao_social && !form.cnpj) { setErro("Informe ao menos o CNPJ ou Razão Social"); return; }
    setSalvando(true); setErro(null);
    try {
      const payload = { tipo: form.tipo };
      if (form.cnpj) payload.cnpj = form.cnpj;
      if (form.razao_social) payload.razao_social = form.razao_social;
      if (form.numero_protocolo) payload.numero_protocolo = form.numero_protocolo;
      if (form.data_emissao) payload.data_emissao = form.data_emissao;
      if (form.data_vencimento) payload.data_vencimento = form.data_vencimento;
      await api.alvaras.criar(payload);
      limpar();
      onSalvo?.();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* CNPJ + busca RFB */}
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
            disabled={buscando}
            title="Buscar na Receita Federal"
            className="px-3 py-2 rounded-lg text-white text-xs font-medium flex items-center gap-1 whitespace-nowrap disabled:opacity-60"
            style={{ backgroundColor: "#0C483E" }}
          >
            {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : cnpjOk ? <CheckCircle className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
            RFB
          </button>
        </div>
        {erroCNPJ && <p className="text-xs text-red-500 mt-1">{erroCNPJ}</p>}
        {cnpjOk && <p className="text-xs text-green-600 mt-1">✓ Preenchido pela Receita Federal</p>}
      </div>

      {/* Razão Social */}
      <div>
        <label className={labelStyle} style={{ color: "#0C483E" }}>Razão Social</label>
        <input type="text" value={form.razao_social} onChange={set("razao_social")} placeholder="Nome da empresa" className={inputStyle} />
      </div>

      {/* Tipo */}
      <div>
        <label className={labelStyle} style={{ color: "#0C483E" }}>Tipo de Alvará</label>
        <select value={form.tipo} onChange={set("tipo")} className={inputStyle}>
          {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Protocolo */}
      <div>
        <label className={labelStyle} style={{ color: "#0C483E" }}>Nº Protocolo</label>
        <input type="text" value={form.numero_protocolo} onChange={set("numero_protocolo")} placeholder="Ex: 10288/2025" className={inputStyle} />
      </div>

      {/* Datas */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelStyle} style={{ color: "#0C483E" }}>Emissão</label>
          <input type="date" value={form.data_emissao} onChange={set("data_emissao")} className={inputStyle} />
        </div>
        <div>
          <label className={labelStyle} style={{ color: "#0C483E" }}>Vencimento</label>
          <input type="date" value={form.data_vencimento} onChange={set("data_vencimento")} className={inputStyle} />
        </div>
      </div>

      {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{erro}</p>}

      {/* Botões */}
      <div className="flex gap-2 pt-1">
        <button onClick={limpar} className="flex-1 py-2 rounded-lg border text-sm text-gray-500 hover:bg-gray-50" style={{ borderColor: "#C6B185" }}>
          <X className="w-3.5 h-3.5 inline mr-1" />Limpar
        </button>
        <button
          onClick={salvar}
          disabled={salvando}
          className="flex-1 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5"
          style={{ backgroundColor: "#08332C" }}
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </button>
      </div>
    </div>
  );
}

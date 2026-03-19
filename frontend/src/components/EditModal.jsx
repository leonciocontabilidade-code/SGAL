import { useState, useEffect } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { api } from "../services/api";

const TIPOS = [
  { value: "SANITARIO",     label: "Alvará Sanitário" },
  { value: "BOMBEIROS",     label: "Certificado do Bombeiros" },
  { value: "FUNCIONAMENTO", label: "Alvará de Localização e Funcionamento" },
  { value: "AMA",           label: "Alvará Ambiental" },
  { value: "DESCONHECIDO",  label: "Desconhecido" },
];

export function EditModal({ alvara, onClose, onSaved }) {
  const [form, setForm] = useState({
    razao_social: alvara.razao_social || "",
    cnpj: alvara.cnpj || "",
    tipo: alvara.tipo || "DESCONHECIDO",
    numero_protocolo: alvara.numero_protocolo || "",
    data_emissao: alvara.data_emissao || "",
    data_vencimento: alvara.data_vencimento || "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  // Fecha com ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

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

      await api.alvaras.atualizar(alvara.id, payload);
      onSaved();
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-bold text-gray-900">Editar Alvará</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[300px]">{alvara.nome_arquivo}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Campos */}
        <div className="px-6 py-5 space-y-4">
          <Campo label="Razão Social" valor={form.razao_social} onChange={set("razao_social")} placeholder="Nome da empresa" />
          <Campo label="CNPJ" valor={form.cnpj} onChange={set("cnpj")} placeholder="XX.XXX.XXX/XXXX-XX" />

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Tipo de Alvará
            </label>
            <select
              value={form.tipo}
              onChange={set("tipo")}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <Campo label="Número do Protocolo" valor={form.numero_protocolo} onChange={set("numero_protocolo")} placeholder="Ex: 10288/2025" />

          <div className="grid grid-cols-2 gap-4">
            <CampoData label="Data de Emissão" valor={form.data_emissao} onChange={set("data_emissao")} />
            <CampoData label="Data de Vencimento" valor={form.data_vencimento} onChange={set("data_vencimento")} />
          </div>

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, valor, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={valor}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function CampoData({ label, valor, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <input
        type="date"
        value={valor}
        onChange={onChange}
        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

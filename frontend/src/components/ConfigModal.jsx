import { useState, useEffect } from "react";
import {
  X, Settings, Mail, Globe, Users, Save, Loader2, CheckCircle,
  Plus, Trash2, Eye, EyeOff, Shield, User, Key, ToggleLeft, ToggleRight
} from "lucide-react";
import { api } from "../services/api";

const TIPOS_PORTAL = [
  { key: "portal_SANITARIO",     label: "Alvará Sanitário" },
  { key: "portal_BOMBEIROS",     label: "Certificado do Bombeiros" },
  { key: "portal_FUNCIONAMENTO", label: "Alvará de Localização e Funcionamento" },
  { key: "portal_AMA",           label: "Alvará Ambiental" },
  { key: "portal_DESCONHECIDO",  label: "Tipo Desconhecido" },
];

const labelStyle = "block text-xs font-semibold uppercase tracking-wide mb-1.5 text-[#0C483E]";
const inputStyle = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0C483E]";

export function ConfigModal({ onClose, isAdmin }) {
  const [aba, setAba] = useState("smtp");
  const [configs, setConfigs] = useState({});
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [msg, setMsg] = useState(null); // {tipo: "ok"|"erro", texto}
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Novo usuário
  const [novoUser, setNovoUser] = useState({ username: "", nome: "", email: "", senha: "", admin: false });
  const [criandoUser, setCriandoUser] = useState(false);
  const [mostrarFormUser, setMostrarFormUser] = useState(false);

  // Alterar senha própria
  const [senhaForm, setSenhaForm] = useState({ senha_atual: "", nova_senha: "", confirmar: "" });
  const [trocandoSenha, setTrocandoSenha] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const c = await api.admin.getConfiguracoes();
      setConfigs(c);
      if (isAdmin) {
        const u = await api.admin.listarUsuarios();
        setUsuarios(u);
      }
    } catch (e) {
      setMsg({ tipo: "erro", texto: e.message });
    } finally {
      setLoading(false);
    }
  };

  const setConfig = (chave) => (e) => setConfigs((c) => ({ ...c, [chave]: e.target.value }));

  const salvarConfigs = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      const payload = {};
      // SMTP
      ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from", "smtp_tls"].forEach(
        (k) => { payload[k] = configs[k] ?? ""; }
      );
      // Portais
      TIPOS_PORTAL.forEach(({ key }) => { payload[key] = configs[key] ?? ""; });
      await api.admin.salvarConfiguracoes(payload);
      setMsg({ tipo: "ok", texto: "Configurações salvas com sucesso!" });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ tipo: "erro", texto: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const testarSMTP = async () => {
    setTestando(true);
    setMsg(null);
    try {
      const res = await api.admin.testarSMTP();
      setMsg({ tipo: "ok", texto: res.mensagem });
    } catch (e) {
      setMsg({ tipo: "erro", texto: e.message });
    } finally {
      setTestando(false);
    }
  };

  const criarUsuario = async () => {
    if (!novoUser.username || !novoUser.nome || !novoUser.senha) {
      setMsg({ tipo: "erro", texto: "Preencha usuário, nome e senha." });
      return;
    }
    setCriandoUser(true);
    setMsg(null);
    try {
      const u = await api.admin.criarUsuario(novoUser);
      setUsuarios((prev) => [...prev, u]);
      setNovoUser({ username: "", nome: "", email: "", senha: "", admin: false });
      setMostrarFormUser(false);
      setMsg({ tipo: "ok", texto: `Usuário '${u.username}' criado com sucesso.` });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ tipo: "erro", texto: e.message });
    } finally {
      setCriandoUser(false);
    }
  };

  const toggleAdmin = async (usuario) => {
    try {
      const updated = await api.admin.atualizarUsuario(usuario.id, { admin: !usuario.admin });
      setUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? updated : u)));
    } catch (e) {
      setMsg({ tipo: "erro", texto: e.message });
    }
  };

  const toggleAtivo = async (usuario) => {
    try {
      const updated = await api.admin.atualizarUsuario(usuario.id, { ativo: !usuario.ativo });
      setUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? updated : u)));
    } catch (e) {
      setMsg({ tipo: "erro", texto: e.message });
    }
  };

  const trocarSenha = async () => {
    if (!senhaForm.senha_atual || !senhaForm.nova_senha) {
      setMsg({ tipo: "erro", texto: "Preencha todos os campos." });
      return;
    }
    if (senhaForm.nova_senha !== senhaForm.confirmar) {
      setMsg({ tipo: "erro", texto: "As novas senhas não coincidem." });
      return;
    }
    setTrocandoSenha(true);
    setMsg(null);
    try {
      await api.admin.alterarSenha(senhaForm.senha_atual, senhaForm.nova_senha);
      setSenhaForm({ senha_atual: "", nova_senha: "", confirmar: "" });
      setMsg({ tipo: "ok", texto: "Senha alterada com sucesso!" });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ tipo: "erro", texto: e.message });
    } finally {
      setTrocandoSenha(false);
    }
  };

  const abas = [
    { id: "smtp",     label: "E-mail SMTP",  icon: Mail },
    { id: "portais",  label: "Portais",       icon: Globe },
    { id: "usuarios", label: "Usuários",      icon: Users },
    { id: "senha",    label: "Minha Senha",   icon: Key },
  ].filter((a) => a.id !== "usuarios" || isAdmin);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#EADAB8", backgroundColor: "#08332C" }}>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" style={{ color: "#C6B185" }} />
            <h2 className="text-base font-bold" style={{ color: "#C6B185" }}>Configurações do Sistema</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b overflow-x-auto" style={{ borderColor: "#EADAB8" }}>
          {abas.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setAba(id); setMsg(null); }}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                aba === id ? "border-[#08332C] text-[#08332C]" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* ── SMTP ── */}
              {aba === "smtp" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    Configure o servidor SMTP para envio de alertas e notificações. Estas configurações têm prioridade sobre as variáveis de ambiente.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelStyle}>Servidor SMTP (Host)</label>
                      <input type="text" value={configs.smtp_host || ""} onChange={setConfig("smtp_host")}
                        placeholder="smtp.gmail.com" className={inputStyle} />
                    </div>
                    <div>
                      <label className={labelStyle}>Porta</label>
                      <input type="number" value={configs.smtp_port || "587"} onChange={setConfig("smtp_port")}
                        placeholder="587" className={inputStyle} />
                    </div>
                  </div>

                  <div>
                    <label className={labelStyle}>Usuário (e-mail de envio)</label>
                    <input type="email" value={configs.smtp_user || ""} onChange={setConfig("smtp_user")}
                      placeholder="noreply@leonciocontabil.com.br" className={inputStyle} />
                  </div>

                  <div>
                    <label className={labelStyle}>Senha do e-mail</label>
                    <div className="relative">
                      <input
                        type={mostrarSenha ? "text" : "password"}
                        value={configs.smtp_password || ""}
                        onChange={setConfig("smtp_password")}
                        placeholder="Senha do e-mail"
                        className={inputStyle + " pr-10"}
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Para Gmail: use uma "Senha de app" (não a senha da conta).</p>
                  </div>

                  <div>
                    <label className={labelStyle}>Remetente (De:)</label>
                    <input type="email" value={configs.smtp_from || ""} onChange={setConfig("smtp_from")}
                      placeholder="SGAL <noreply@leonciocontabil.com.br>" className={inputStyle} />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className={labelStyle + " mb-0"}>Usar TLS (recomendado)</label>
                    <button
                      onClick={() => setConfigs((c) => ({ ...c, smtp_tls: c.smtp_tls === "false" ? "true" : "false" }))}
                      className="flex items-center gap-2"
                    >
                      {configs.smtp_tls === "false"
                        ? <ToggleLeft className="w-8 h-8 text-gray-400" />
                        : <ToggleRight className="w-8 h-8" style={{ color: "#0C483E" }} />}
                      <span className="text-sm text-gray-600">{configs.smtp_tls === "false" ? "Desativado" : "Ativado"}</span>
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={testarSMTP}
                      disabled={testando}
                      className="px-4 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 disabled:opacity-60"
                      style={{ borderColor: "#C6B185", color: "#0C483E" }}
                    >
                      {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      Testar Conexão
                    </button>
                  </div>
                </div>
              )}

              {/* ── Portais ── */}
              {aba === "portais" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    Configure as URLs dos portais de renovação para cada tipo de alvará. Ao clicar em "Acessar Portal" no modal de renovação, o sistema abrirá a URL configurada aqui.
                  </p>
                  {TIPOS_PORTAL.map(({ key, label }) => (
                    <div key={key}>
                      <label className={labelStyle}>{label}</label>
                      <input
                        type="url"
                        value={configs[key] || ""}
                        onChange={setConfig(key)}
                        placeholder="https://..."
                        className={inputStyle}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* ── Usuários ── */}
              {aba === "usuarios" && isAdmin && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">{usuarios.length} usuário(s) cadastrado(s)</p>
                    <button
                      onClick={() => setMostrarFormUser((v) => !v)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white"
                      style={{ backgroundColor: "#08332C" }}
                    >
                      <Plus className="w-4 h-4" />
                      Novo usuário
                    </button>
                  </div>

                  {/* Formulário novo usuário */}
                  {mostrarFormUser && (
                    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "#f8f6f0", border: "1px solid #EADAB8" }}>
                      <h3 className="text-sm font-bold" style={{ color: "#08332C" }}>Criar novo usuário</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelStyle}>Usuário (login)</label>
                          <input type="text" value={novoUser.username}
                            onChange={(e) => setNovoUser((u) => ({ ...u, username: e.target.value.toLowerCase() }))}
                            placeholder="joao.silva" className={inputStyle} />
                        </div>
                        <div>
                          <label className={labelStyle}>Nome completo</label>
                          <input type="text" value={novoUser.nome}
                            onChange={(e) => setNovoUser((u) => ({ ...u, nome: e.target.value }))}
                            placeholder="João Silva" className={inputStyle} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelStyle}>E-mail (opcional)</label>
                          <input type="email" value={novoUser.email}
                            onChange={(e) => setNovoUser((u) => ({ ...u, email: e.target.value }))}
                            placeholder="joao@leoncio.com.br" className={inputStyle} />
                        </div>
                        <div>
                          <label className={labelStyle}>Senha inicial</label>
                          <input type="password" value={novoUser.senha}
                            onChange={(e) => setNovoUser((u) => ({ ...u, senha: e.target.value }))}
                            placeholder="••••••••" className={inputStyle} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id="admin-check" checked={novoUser.admin}
                          onChange={(e) => setNovoUser((u) => ({ ...u, admin: e.target.checked }))}
                          className="w-4 h-4 accent-[#08332C]" />
                        <label htmlFor="admin-check" className="text-sm text-gray-700 flex items-center gap-1">
                          <Shield className="w-4 h-4 text-amber-600" />
                          Administrador (acesso total às configurações)
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={criarUsuario} disabled={criandoUser}
                          className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 disabled:opacity-60"
                          style={{ backgroundColor: "#0C483E" }}>
                          {criandoUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Criar
                        </button>
                        <button onClick={() => setMostrarFormUser(false)}
                          className="px-4 py-2 rounded-lg text-sm text-gray-500 border border-gray-200">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de usuários */}
                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                    {usuarios.map((u) => (
                      <div key={u.id} className={`flex items-center justify-between p-4 ${!u.ativo ? "opacity-50 bg-gray-50" : "bg-white"}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                            style={{ backgroundColor: u.admin ? "#08332C" : "#6b7280" }}>
                            {u.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{u.nome}</p>
                            <p className="text-xs text-gray-400">@{u.username}
                              {u.admin && <span className="ml-2 text-amber-600 font-medium">⭐ Admin</span>}
                              {!u.ativo && <span className="ml-2 text-red-500">Inativo</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleAdmin(u)}
                            title={u.admin ? "Remover admin" : "Tornar admin"}
                            className="p-1.5 rounded text-xs text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleAtivo(u)}
                            title={u.ativo ? "Desativar" : "Ativar"}
                            className={`p-1.5 rounded text-xs ${u.ativo ? "text-gray-400 hover:text-red-500 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}
                          >
                            {u.ativo ? <Trash2 className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Minha Senha ── */}
              {aba === "senha" && (
                <div className="space-y-4 max-w-sm">
                  <p className="text-xs text-gray-500">Troque sua senha de acesso.</p>
                  <div>
                    <label className={labelStyle}>Senha atual</label>
                    <input type="password" value={senhaForm.senha_atual}
                      onChange={(e) => setSenhaForm((f) => ({ ...f, senha_atual: e.target.value }))}
                      placeholder="••••••••" className={inputStyle} />
                  </div>
                  <div>
                    <label className={labelStyle}>Nova senha</label>
                    <input type="password" value={senhaForm.nova_senha}
                      onChange={(e) => setSenhaForm((f) => ({ ...f, nova_senha: e.target.value }))}
                      placeholder="••••••••" className={inputStyle} />
                  </div>
                  <div>
                    <label className={labelStyle}>Confirmar nova senha</label>
                    <input type="password" value={senhaForm.confirmar}
                      onChange={(e) => setSenhaForm((f) => ({ ...f, confirmar: e.target.value }))}
                      placeholder="••••••••" className={inputStyle} />
                  </div>
                  <button
                    onClick={trocarSenha}
                    disabled={trocandoSenha}
                    className="px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-60"
                    style={{ backgroundColor: "#08332C" }}
                  >
                    {trocandoSenha ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    Alterar senha
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Mensagem de feedback */}
        {msg && (
          <div className={`mx-6 mb-2 rounded-lg px-3 py-2 text-sm flex items-center gap-2 ${
            msg.tipo === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"
          }`}>
            {msg.tipo === "ok" ? <CheckCircle className="w-4 h-4 shrink-0" /> : null}
            {msg.texto}
          </div>
        )}

        {/* Footer */}
        {(aba === "smtp" || aba === "portais") && isAdmin && (
          <div className="px-6 py-4 border-t flex justify-end" style={{ borderColor: "#EADAB8" }}>
            <button
              onClick={salvarConfigs}
              disabled={salvando}
              className="px-5 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: "#08332C" }}
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Configurações
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

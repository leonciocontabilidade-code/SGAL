import { useState } from "react";
import { Lock, User } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: "", senha: "" });
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username.trim(), senha: form.senha }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.token) {
        sessionStorage.setItem("sgal_token", data.token);
        sessionStorage.setItem("sgal_auth", "1");
        sessionStorage.setItem("sgal_username", data.username || "");
        sessionStorage.setItem("sgal_nome", data.nome || "");
        sessionStorage.setItem("sgal_admin", data.admin ? "1" : "0");
        onLogin(data);
      } else {
        setErro(data.detail || "Usuário ou senha inválidos.");
      }
    } catch {
      setErro("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", borderRadius: "8px", padding: "12px 16px",
    fontSize: "14px", outline: "none", backgroundColor: "#0C483E",
    color: "#EADAB8", border: "1px solid #C6B185",
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#08332C" }}>
      <div className="w-full max-w-sm shadow-2xl rounded-3xl overflow-hidden">

        {/* Logo */}
        <div style={{ backgroundColor: "#EADAB8", position: "relative" }}>
          <img
            src="/logo-leoncio.png"
            alt="Leoncio Assessoria Empresarial"
            style={{ width: "100%", display: "block", objectFit: "cover", objectPosition: "center", maxHeight: "260px" }}
          />
          <p className="text-xs font-semibold tracking-widest uppercase text-center py-3" style={{ color: "#0C483E" }}>
            Sistema de Gestão de Alvarás
          </p>
        </div>

        {/* Divisor dourado */}
        <div style={{ height: "4px", backgroundColor: "#C6B185" }} />

        {/* Formulário */}
        <div className="px-8 py-8" style={{ backgroundColor: "#08332C" }}>
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4" style={{ color: "#C6B185" }} />
            <span className="text-sm font-semibold" style={{ color: "#C6B185" }}>Acesso Restrito</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "#EADAB8" }}>
                Usuário
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#C6B185" }} />
                <input
                  type="text"
                  value={form.username}
                  onChange={set("username")}
                  placeholder="admin"
                  required
                  autoComplete="username"
                  style={{ ...inputStyle, paddingLeft: "40px" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "#EADAB8" }}>
                Senha
              </label>
              <input
                type="password"
                value={form.senha}
                onChange={set("senha")}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={inputStyle}
              />
            </div>

            {erro && <p className="text-xs text-red-300">{erro}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#C6B185", color: "#08332C" }}
            >
              {loading ? "Verificando..." : "Entrar"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

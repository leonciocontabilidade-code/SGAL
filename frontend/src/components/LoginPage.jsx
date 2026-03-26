import { useState } from "react";
import { Lock } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function LoginPage({ onLogin }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.token) {
        sessionStorage.setItem("sgal_token", data.token);
        sessionStorage.setItem("sgal_auth", "1");
        onLogin();
      } else {
        setErro(data.detail || "Senha incorreta.");
      }
    } catch {
      setErro("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#08332C" }}>
      <div className="w-full max-w-sm shadow-2xl rounded-3xl overflow-hidden">

        {/* Topo — Logo preenche toda a área bege */}
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

        {/* Baixo — Formulário sobre fundo verde escuro */}
        <div className="px-8 py-8" style={{ backgroundColor: "#08332C" }}>
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4" style={{ color: "#C6B185" }} />
            <span className="text-sm font-semibold" style={{ color: "#C6B185" }}>Acesso Restrito</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: "#EADAB8" }}>
                Senha de acesso
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: "#0C483E", color: "#EADAB8", border: "1px solid #C6B185" }}
              />
            </div>

            {erro && (
              <p className="text-xs text-red-300">{erro}</p>
            )}

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

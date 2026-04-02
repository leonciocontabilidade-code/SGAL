const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

function getToken() {
  return sessionStorage.getItem("sgal_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    sessionStorage.removeItem("sgal_token");
    sessionStorage.removeItem("sgal_auth");
    window.dispatchEvent(new Event("sgal:logout"));
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Erro na requisição");
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  admin: {
    getConfiguracoes: () => request("/admin/configuracoes"),
    salvarConfiguracoes: (dados) =>
      request("/admin/configuracoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configuracoes: dados }),
      }),
    testarSMTP: () => request("/admin/testar-smtp", { method: "POST" }),
    listarUsuarios: () => request("/admin/usuarios"),
    criarUsuario: (dados) =>
      request("/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      }),
    atualizarUsuario: (id, dados) =>
      request(`/admin/usuarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      }),
    desativarUsuario: (id) => request(`/admin/usuarios/${id}`, { method: "DELETE" }),
    alterarSenha: (senhaAtual, novaSenha) =>
      request("/admin/alterar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha_atual: senhaAtual, nova_senha: novaSenha }),
      }),
  },

  dashboard: {
    obter: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))
      ).toString();
      return request(`/dashboard/${qs ? `?${qs}` : ""}`);
    },
    verificarAlertas: () => request("/dashboard/verificar-alertas", { method: "POST" }),
  },

  alvaras: {
    listar: (params = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))
      ).toString();
      return request(`/alvaras/${qs ? `?${qs}` : ""}`);
    },
    obter: (id) => request(`/alvaras/${id}`),
    atualizar: (id, dados) =>
      request(`/alvaras/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      }),
    deletar: (id) => request(`/alvaras/${id}`, { method: "DELETE" }),
    listarAlertas: (id) => request(`/alvaras/${id}/alertas`),
    notificar: (id) => request(`/alvaras/${id}/notificar`, { method: "POST" }),
    resolverAlerta: (id) => request(`/alvaras/${id}/resolver-alerta`, { method: "POST" }),
    notificarRenovacao: (id) => request(`/alvaras/${id}/notificar-renovacao`, { method: "POST" }),
    criar: (dados) =>
      request("/alvaras/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      }),
    upload: (arquivo) => {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      return request("/alvaras/upload", { method: "POST", body: formData });
    },
  },
};

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Erro na requisição");
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  dashboard: {
    obter: () => request("/dashboard/"),
    verificarAlertas: () => request("/dashboard/verificar-alertas", { method: "POST" }),
  },

  alvaras: {
    listar: (tipo) => request(`/alvaras/${tipo ? `?tipo=${tipo}` : ""}`),
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

import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";

export function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const resultado = await api.dashboard.obter();
      setData(resultado);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    // Recarrega a cada 5 minutos
    const intervalo = setInterval(carregar, 5 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  return { data, loading, error, recarregar: carregar };
}

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);

  const enviar = useCallback(async (arquivo) => {
    try {
      setUploading(true);
      setErro(null);
      setResultado(null);
      const res = await api.alvaras.upload(arquivo);
      setResultado(res);
      return res;
    } catch (err) {
      setErro(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  return { enviar, uploading, resultado, erro };
}

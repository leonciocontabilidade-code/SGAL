import { useState, useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { LoginPage } from "./components/LoginPage";

export default function App() {
  const [autenticado, setAutenticado] = useState(() => {
    const auth = sessionStorage.getItem("sgal_auth") === "1";
    const token = sessionStorage.getItem("sgal_token");
    if (auth && !token) {
      sessionStorage.removeItem("sgal_auth");
      return false;
    }
    return auth;
  });

  const [usuario, setUsuario] = useState(() => ({
    username: sessionStorage.getItem("sgal_username") || "admin",
    nome:     sessionStorage.getItem("sgal_nome")     || "Usuário",
    admin:    sessionStorage.getItem("sgal_admin")    === "1",
  }));

  useEffect(() => {
    const handler = () => {
      ["sgal_auth", "sgal_token", "sgal_username", "sgal_nome", "sgal_admin"].forEach(
        (k) => sessionStorage.removeItem(k)
      );
      setAutenticado(false);
      setUsuario({ username: "", nome: "", admin: false });
    };
    window.addEventListener("sgal:logout", handler);
    return () => window.removeEventListener("sgal:logout", handler);
  }, []);

  const handleLogin = (data) => {
    sessionStorage.setItem("sgal_username", data.username || "");
    sessionStorage.setItem("sgal_nome",     data.nome     || "Usuário");
    sessionStorage.setItem("sgal_admin",    data.admin    ? "1" : "0");
    setUsuario({ username: data.username, nome: data.nome, admin: data.admin });
    setAutenticado(true);
  };

  const handleLogout = () => {
    ["sgal_auth", "sgal_token", "sgal_username", "sgal_nome", "sgal_admin"].forEach(
      (k) => sessionStorage.removeItem(k)
    );
    setAutenticado(false);
    setUsuario({ username: "", nome: "", admin: false });
  };

  if (!autenticado) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <Dashboard usuario={usuario} onLogout={handleLogout} />;
}

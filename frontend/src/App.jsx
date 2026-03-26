import { useState, useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { LoginPage } from "./components/LoginPage";

export default function App() {
  const [autenticado, setAutenticado] = useState(
    () => sessionStorage.getItem("sgal_auth") === "1"
  );

  // Escuta evento de logout disparado pelo api.js em caso de token expirado (401)
  useEffect(() => {
    const handler = () => {
      sessionStorage.removeItem("sgal_auth");
      sessionStorage.removeItem("sgal_token");
      setAutenticado(false);
    };
    window.addEventListener("sgal:logout", handler);
    return () => window.removeEventListener("sgal:logout", handler);
  }, []);

  if (!autenticado) {
    return <LoginPage onLogin={() => setAutenticado(true)} />;
  }

  return (
    <Dashboard
      onLogout={() => {
        sessionStorage.removeItem("sgal_auth");
        sessionStorage.removeItem("sgal_token");
        setAutenticado(false);
      }}
    />
  );
}

import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { LoginPage } from "./components/LoginPage";

export default function App() {
  const [autenticado, setAutenticado] = useState(
    () => sessionStorage.getItem("sgal_auth") === "1"
  );

  if (!autenticado) {
    return <LoginPage onLogin={() => setAutenticado(true)} />;
  }

  return <Dashboard onLogout={() => { sessionStorage.removeItem("sgal_auth"); setAutenticado(false); }} />;
}

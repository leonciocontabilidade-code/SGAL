"""
Script de configuração da chave API do SGAL.
Use este script no lugar do .bat para evitar problemas com caracteres especiais.
"""
import tkinter as tk
from tkinter import messagebox
from pathlib import Path

ENV_PATH = Path(__file__).parent / "backend" / ".env"

TEMPLATE = """\
# Banco de dados - SQLite local, sem instalacao extra
DATABASE_URL=sqlite+aiosqlite:///./sgal.db

# Provedor de IA
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY={chave}

# Thresholds de alerta (dias)
ALERT_YELLOW_DAYS=60
ALERT_RED_DAYS=15

# Upload
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE_MB=20

DEBUG=false
"""


def salvar():
    chave = entry.get().strip()
    if not chave.startswith("sk-ant-"):
        messagebox.showerror(
            "Chave inválida",
            "A chave deve começar com 'sk-ant-'\n\nObtenha a chave em:\nhttps://console.anthropic.com"
        )
        return
    if len(chave) < 80:
        messagebox.showerror(
            "Chave incompleta",
            f"A chave tem apenas {len(chave)} caracteres — está truncada!\n\n"
            "Uma chave válida tem mais de 100 caracteres.\n\n"
            "Como copiar corretamente:\n"
            "1. Abra console.anthropic.com\n"
            "2. Vá em API Keys → clique no ícone de cópia ao lado da chave\n"
            "3. Volte aqui e clique em 'Colar'"
        )
        return

    ENV_PATH.write_text(TEMPLATE.format(chave=chave), encoding="utf-8")
    messagebox.showinfo(
        "Sucesso!",
        f"Chave salva com sucesso!\n\n"
        f"Agora reinicie o SGAL pelo atalho na Área de Trabalho."
    )
    root.destroy()


def colar():
    try:
        texto = root.clipboard_get().strip()
        entry.delete(0, tk.END)
        entry.insert(0, texto)
    except Exception:
        pass


root = tk.Tk()
root.title("SGAL — Configurar Chave API")
root.geometry("520x240")
root.resizable(False, False)
root.configure(bg="#f3f4f6")

# Lê chave atual se existir
chave_atual = ""
if ENV_PATH.exists():
    for linha in ENV_PATH.read_text(encoding="utf-8").splitlines():
        if linha.startswith("ANTHROPIC_API_KEY="):
            chave_atual = linha.split("=", 1)[1].strip()

tk.Label(root, text="SGAL — Configurar Chave API Anthropic",
         font=("Segoe UI", 13, "bold"), bg="#f3f4f6", fg="#1e3a5f").pack(pady=(20, 4))

tk.Label(root, text="Obtenha sua chave em: console.anthropic.com → API Keys",
         font=("Segoe UI", 9), bg="#f3f4f6", fg="#6b7280").pack()

frame = tk.Frame(root, bg="#f3f4f6")
frame.pack(pady=16, padx=30, fill="x")

entry = tk.Entry(frame, font=("Consolas", 10), width=52, show="*",
                 relief="solid", bd=1)
entry.pack(side="left", ipady=6, padx=(0, 6))
if chave_atual:
    entry.insert(0, chave_atual)

tk.Button(frame, text="Colar", command=colar,
          font=("Segoe UI", 9), relief="solid", bd=1,
          bg="white", cursor="hand2").pack(side="left", ipady=5)

# Contador de caracteres
lbl_contador = tk.Label(root, text="0 caracteres (mínimo: 100)",
                        font=("Segoe UI", 9), bg="#f3f4f6", fg="#9ca3af")
lbl_contador.pack()

def atualizar_contador(*_):
    n = len(entry.get().strip())
    if n == 0:
        cor, txt = "#9ca3af", f"0 caracteres (mínimo: 100)"
    elif n < 80:
        cor, txt = "#ef4444", f"⚠ {n} caracteres — chave incompleta!"
    else:
        cor, txt = "#16a34a", f"✓ {n} caracteres — OK"
    lbl_contador.config(text=txt, fg=cor)

entry.bind("<KeyRelease>", atualizar_contador)
entry.bind("<ButtonRelease>", atualizar_contador)

# Checkbox mostrar/ocultar
def toggle_visibilidade():
    entry.config(show="" if var_mostrar.get() else "*")

var_mostrar = tk.BooleanVar()
tk.Checkbutton(root, text="Mostrar chave", variable=var_mostrar,
               command=toggle_visibilidade, bg="#f3f4f6",
               font=("Segoe UI", 9)).pack()

tk.Button(root, text="  Salvar Chave  ", command=salvar,
          font=("Segoe UI", 11, "bold"), bg="#2563eb", fg="white",
          relief="flat", cursor="hand2", padx=10, pady=6).pack(pady=14)

root.mainloop()

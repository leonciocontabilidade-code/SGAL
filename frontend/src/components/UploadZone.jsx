import { useCallback, useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { useUpload } from "../hooks/useDashboard";

export function UploadZone({ onUploadSuccess }) {
  const [dragOver, setDragOver] = useState(false);
  const [arquivos, setArquivos] = useState([]);
  const { enviar, uploading } = useUpload();

  const processarArquivos = useCallback(
    async (lista) => {
      const novos = Array.from(lista).map((f) => ({
        file: f,
        status: "aguardando",
        erro: null,
        id: null,
      }));
      setArquivos((prev) => [...prev, ...novos]);

      for (const item of novos) {
        setArquivos((prev) =>
          prev.map((a) => (a.file === item.file ? { ...a, status: "enviando" } : a))
        );
        try {
          const res = await enviar(item.file);
          setArquivos((prev) =>
            prev.map((a) =>
              a.file === item.file ? { ...a, status: "sucesso", id: res.id } : a
            )
          );
          onUploadSuccess?.();
        } catch (err) {
          setArquivos((prev) =>
            prev.map((a) =>
              a.file === item.file ? { ...a, status: "erro", erro: err.message } : a
            )
          );
        }
      }
    },
    [enviar, onUploadSuccess]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      processarArquivos(e.dataTransfer.files);
    },
    [processarArquivos]
  );

  const onInputChange = useCallback(
    (e) => processarArquivos(e.target.files),
    [processarArquivos]
  );

  const remover = (file) =>
    setArquivos((prev) => prev.filter((a) => a.file !== file));

  return (
    <div className="space-y-4">
      {/* Zona de Drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-all cursor-pointer
          ${dragOver
            ? "border-blue-500 bg-blue-50 scale-[1.01]"
            : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50"
          }`}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp"
          onChange={onInputChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div className={`p-4 rounded-full transition-colors ${dragOver ? "bg-blue-100" : "bg-gray-100"}`}>
          <Upload className={`w-8 h-8 ${dragOver ? "text-blue-600" : "text-gray-400"}`} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-700">
            Arraste documentos ou <span className="text-blue-600">clique para selecionar</span>
          </p>
          <p className="text-sm text-gray-400 mt-1">
            PDF, PNG, JPG, TIFF — até 20MB por arquivo
          </p>
        </div>
      </div>

      {/* Lista de arquivos */}
      {arquivos.length > 0 && (
        <ul className="space-y-2">
          {arquivos.map((item, idx) => (
            <li
              key={idx}
              className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm"
            >
              <FileText className="w-5 h-5 text-gray-400 shrink-0" />
              <span className="flex-1 truncate text-sm text-gray-700">{item.file.name}</span>

              {item.status === "enviando" && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              )}
              {item.status === "sucesso" && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              {item.status === "erro" && (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="w-4 h-4" /> {item.erro}
                </span>
              )}
              {(item.status === "aguardando" || item.status === "sucesso" || item.status === "erro") && (
                <button onClick={() => remover(item.file)} className="text-gray-300 hover:text-gray-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

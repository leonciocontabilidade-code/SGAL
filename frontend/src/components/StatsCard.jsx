export function StatsCard({ label, valor, cor, icone: Icone, sublabel, onClick, ativo }) {
  const cores = {
    verde:   { base: "bg-green-50  border-green-200  text-green-700",  ativo: "bg-green-600  border-green-700  text-white" },
    amarelo: { base: "bg-yellow-50 border-yellow-200 text-yellow-700", ativo: "bg-yellow-500 border-yellow-600 text-white" },
    vermelho:{ base: "bg-red-50    border-red-200    text-red-700",    ativo: "bg-red-600    border-red-700    text-white" },
    azul:    { base: "bg-blue-50   border-blue-200   text-blue-700",   ativo: "bg-blue-600   border-blue-700   text-white" },
    cinza:   { base: "bg-gray-50   border-gray-200   text-gray-600",   ativo: "bg-gray-500   border-gray-600   text-white" },
  };

  const set = cores[cor] || cores.cinza;
  const cls = ativo ? set.ativo : set.base;
  const interativo = !!onClick;

  return (
    <div
      className={`rounded-xl border p-5 flex items-center gap-4 transition-all duration-150 ${cls} ${interativo ? "cursor-pointer select-none" : ""} ${ativo ? "shadow-md scale-[1.03] ring-2 ring-offset-1 ring-current" : interativo ? "hover:shadow-md hover:scale-[1.02]" : ""}`}
      onClick={onClick}
      title={interativo ? (ativo ? `Remover filtro: ${label}` : `Filtrar por: ${label}`) : undefined}
    >
      {Icone && (
        <div className={`p-2 rounded-lg ${ativo ? "bg-white/20" : "bg-white/60"}`}>
          <Icone className="w-6 h-6" />
        </div>
      )}
      <div>
        <p className="text-3xl font-bold">{valor}</p>
        <p className="text-sm font-medium opacity-90">{label}</p>
        {sublabel && <p className="text-xs opacity-70 mt-0.5">{sublabel}</p>}
        {ativo && <p className="text-xs font-semibold mt-1 opacity-90">● Filtro ativo</p>}
      </div>
    </div>
  );
}

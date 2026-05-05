export default function BarChart({ data }) {
  // data: [{ label, count }]
  if (!data || data.length === 0) {
    return <p className="text-slate-500 text-sm">No missed entries recorded.</p>
  }

  const max = Math.max(...data.map((d) => d.count))

  return (
    <div className="space-y-2.5">
      {data.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-slate-400 text-sm w-20 shrink-0 capitalize">{label}</span>
          <div className="flex-1 h-5 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-slate-400 text-sm w-6 text-right shrink-0">{count}</span>
        </div>
      ))}
    </div>
  )
}

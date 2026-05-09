import { toDateStr } from '../lib/streaks'

const DAYS_SHOWN = 91 // 13 complete weeks

function cellColor(log) {
  if (!log) return 'bg-slate-700/50'
  if (log.completed) return 'bg-emerald-500'
  return 'bg-red-800'
}

function cellTitle(dateStr, log) {
  if (!log) return dateStr
  if (log.completed) return `${dateStr} ✓`
  return `${dateStr} ✗${log.missed_reason ? ' — ' + log.missed_reason : ''}`
}

export default function Heatmap({ logs }) {
  // Build a map of date → log for fast lookup
  const logMap = {}
  for (const l of logs) logMap[l.date] = l

  // Build array of last DAYS_SHOWN days, oldest first
  const today = new Date()
  const cells = []
  for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = toDateStr(d)
    cells.push({ dateStr, log: logMap[dateStr] ?? null, isFuture: false })
  }

  // Group into weeks (columns of 7)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-1 min-w-0">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map(({ dateStr, log }) => (
              <div
                key={dateStr}
                title={cellTitle(dateStr, log)}
                aria-label={cellTitle(dateStr, log)}
                role="img"
                className={`w-3 h-3 rounded-sm ${cellColor(log)} transition-opacity hover:opacity-75`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-600">
        <span>13 weeks ago</span>
        <span>Today</span>
      </div>
    </div>
  )
}

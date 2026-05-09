import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toDateStr, calcStreaks } from '../lib/streaks'
import Heatmap from '../components/Heatmap'
import BarChart from '../components/BarChart'

function StatPill({ label, value, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-950/60 border border-indigo-500/20 text-indigo-300',
    emerald: 'bg-emerald-950/60 border border-emerald-500/20 text-emerald-300',
    amber: 'bg-amber-950/60 border border-amber-500/20 text-amber-300',
  }
  return (
    <div className={`rounded-2xl px-4 py-5 text-center ${colors[color]}`}>
      <p className="text-3xl font-black">{value}</p>
      <p className="text-xs mt-1 opacity-70">{label}</p>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [logsByHabit, setLogsByHabit] = useState({})
  const [allLogs, setAllLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 91); return toDateStr(d) })()
    const [{ data: habitsData }, { data: logsData }] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).eq('active', true).order('created_at'),
      supabase.from('habit_logs').select('*').eq('user_id', user.id).gte('date', cutoff)
    ])
    const byHabit = {}
    for (const l of logsData ?? []) {
      if (!byHabit[l.habit_id]) byHabit[l.habit_id] = []
      byHabit[l.habit_id].push(l)
    }
    setHabits(habitsData ?? [])
    setLogsByHabit(byHabit)
    setAllLogs(logsData ?? [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { load() }, [load])

  // Missed reasons breakdown
  const reasonCounts = {}
  for (const l of allLogs) {
    if (!l.completed && l.missed_reason) {
      reasonCounts[l.missed_reason] = (reasonCounts[l.missed_reason] ?? 0) + 1
    }
  }
  const reasonData = Object.entries(reasonCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  // Completion rate helpers
  function rateForRange(startDate, endDate) {
    const completed = allLogs.filter(
      (l) => l.completed && l.date >= startDate && l.date <= endDate
    ).length
    const total = allLogs.filter(
      (l) => l.date >= startDate && l.date <= endDate
    ).length
    if (total === 0) return null
    return Math.round((completed / total) * 100)
  }

  const today = new Date()
  const todayStr = toDateStr(today)

  // This week (Mon–today)
  const weekStartDate = new Date(today)
  const dow = today.getDay()
  weekStartDate.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  const weekRate = rateForRange(toDateStr(weekStartDate), todayStr)

  // This month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthRate = rateForRange(toDateStr(monthStart), todayStr)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div aria-label="Loading" role="status" className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full motion-safe:animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-5 pt-12 pb-4 safe-top">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-6">
        {/* Summary metrics */}
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Completion rate</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatPill
              label="This week"
              value={weekRate !== null ? `${weekRate}%` : '—'}
              color="indigo"
            />
            <StatPill
              label="This month"
              value={monthRate !== null ? `${monthRate}%` : '—'}
              color="emerald"
            />
          </div>
        </div>

        {/* Per-habit heatmaps */}
        {habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-slate-400">No active habits to display.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Consistency (90 days)</h2>
            {habits.map((habit) => {
              const logs = logsByHabit[habit.id] ?? []
              const { current, best } = calcStreaks(logs, habit.frequency, habit.window_type)
              return (
                <div key={habit.id} className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-white font-medium">{habit.name}</p>
                    <div className="flex gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Current</p>
                        <p className="text-white font-bold flex items-center gap-1 justify-end">
                          <span className="text-sm">🔥</span>{current}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Best</p>
                        <p className="text-white font-bold flex items-center gap-1 justify-end">
                          <span className="text-sm">🏆</span>{best}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Heatmap logs={logs} />
                </div>
              )
            })}
          </div>
        )}

        {/* Missed reasons */}
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Missed reasons</h2>
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4">
            <BarChart data={reasonData} />
          </div>
        </div>
      </div>
    </div>
  )
}

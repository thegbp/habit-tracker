import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toDateStr, isDueToday, completedThisPeriod, calcStreaks } from '../lib/streaks'
import MissDialog from '../components/MissDialog'
import SettingsModal from '../components/SettingsModal'

function FrequencyBadge({ habit }) {
  const labels = { daily: 'Daily', weekly: habit.window_type === 'specific' ? 'Weekly' : 'Weekly (any)', monthly: 'Monthly' }
  return (
    <span className="text-xs text-slate-500">{labels[habit.frequency] ?? habit.frequency}</span>
  )
}

export default function Today() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState({}) // habitId → [logs]
  const [todayLogs, setTodayLogs] = useState({}) // habitId → log
  const [loading, setLoading] = useState(true)
  const [missTarget, setMissTarget] = useState(null) // habit being missed
  const [showSettings, setShowSettings] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const today = toDateStr(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: habitsData }, { data: logsData }] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).eq('active', true).order('created_at'),
      supabase.from('habit_logs').select('*').eq('user_id', user.id)
        .gte('date', (() => { const d = new Date(); d.setDate(d.getDate() - 91); return toDateStr(d) })())
    ])

    const allHabits = habitsData ?? []
    const allLogs = logsData ?? []

    // Group logs by habit
    const byHabit = {}
    for (const l of allLogs) {
      if (!byHabit[l.habit_id]) byHabit[l.habit_id] = []
      byHabit[l.habit_id].push(l)
    }

    // Today's log by habit
    const todayMap = {}
    for (const l of allLogs) {
      if (l.date === today) todayMap[l.habit_id] = l
    }

    setHabits(allHabits)
    setLogs(byHabit)
    setTodayLogs(todayMap)
    setLoading(false)
  }, [user.id, today])

  useEffect(() => { load() }, [load])

  // Habits due today
  const dueHabits = habits.filter((h) => {
    if (!isDueToday(h, logs[h.id] ?? [])) return false
    // For weekly/monthly 'any': still show if already completed this period (to show state)
    return true
  })

  // Already done this period (for weekly/monthly display)
  function isCompletedThisPeriod(habit) {
    if (habit.frequency === 'daily') return !!todayLogs[habit.id]?.completed
    return completedThisPeriod(habit, logs[habit.id] ?? [])
  }

  const allResolved = dueHabits.every((h) => todayLogs[h.id] !== undefined)
  const showBanner = !bannerDismissed && dueHabits.length > 0 && !allResolved

  async function markComplete(habit) {
    const existing = todayLogs[habit.id]
    if (existing) {
      await supabase.from('habit_logs').update({ completed: true, missed_reason: null }).eq('id', existing.id)
    } else {
      await supabase.from('habit_logs').insert({ habit_id: habit.id, user_id: user.id, date: today, completed: true })
    }
    load()
  }

  async function markMissed(habit, reason) {
    const existing = todayLogs[habit.id]
    if (existing) {
      await supabase.from('habit_logs').update({ completed: false, missed_reason: reason || null }).eq('id', existing.id)
    } else {
      await supabase.from('habit_logs').insert({ habit_id: habit.id, user_id: user.id, date: today, completed: false, missed_reason: reason || null })
    }
    setMissTarget(null)
    load()
  }

  function getStreak(habit) {
    return calcStreaks(logs[habit.id] ?? [], habit.frequency, habit.window_type).current
  }

  function getStatus(habit) {
    const log = todayLogs[habit.id]
    if (!log) {
      // For weekly/monthly, check if done this period
      if (habit.frequency !== 'daily' && isCompletedThisPeriod(habit)) return 'period-done'
      return 'pending'
    }
    return log.completed ? 'done' : 'missed'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4 safe-top">
        <div>
          <h1 className="text-2xl font-bold text-white">Today</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* EOD banner */}
      {showBanner && (
        <div className="mx-5 mb-3 bg-amber-500/15 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-amber-400 text-lg">⏰</span>
            <p className="text-amber-300 text-sm font-medium">
              {dueHabits.filter((h) => getStatus(h) === 'pending').length} habit{dueHabits.filter((h) => getStatus(h) === 'pending').length !== 1 ? 's' : ''} still to check in today
            </p>
          </div>
          <button onClick={() => setBannerDismissed(true)} className="text-amber-500 hover:text-amber-300 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Habit list */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
        {dueHabits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">✨</div>
            <p className="text-slate-400">No habits scheduled for today.</p>
            <p className="text-slate-500 text-sm mt-1">Add some in the Habits tab.</p>
          </div>
        ) : (
          dueHabits.map((habit) => {
            const status = getStatus(habit)
            const streak = getStreak(habit)
            return (
              <div
                key={habit.id}
                className={`bg-slate-800/80 border rounded-2xl p-4 transition-colors ${
                  status === 'done' || status === 'period-done'
                    ? 'border-emerald-500/30'
                    : status === 'missed'
                    ? 'border-red-500/30'
                    : 'border-slate-700/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Completion button */}
                  <button
                    onClick={() => status !== 'done' && status !== 'period-done' && markComplete(habit)}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      status === 'done' || status === 'period-done'
                        ? 'bg-emerald-500 border-emerald-500'
                        : status === 'missed'
                        ? 'bg-red-500/20 border-red-500'
                        : 'border-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    {(status === 'done' || status === 'period-done') && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {status === 'missed' && (
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${status === 'missed' ? 'text-slate-400 line-through' : 'text-white'}`}>
                      {habit.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <FrequencyBadge habit={habit} />
                      {todayLogs[habit.id]?.missed_reason && (
                        <span className="text-xs text-red-400 capitalize">{todayLogs[habit.id].missed_reason}</span>
                      )}
                    </div>
                  </div>

                  {/* Streak */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-base">🔥</span>
                    <span className="text-white font-semibold text-sm">{streak}</span>
                  </div>

                  {/* Miss button */}
                  {status === 'pending' && (
                    <button
                      onClick={() => setMissTarget(habit)}
                      className="shrink-0 text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                    >
                      Miss
                    </button>
                  )}
                  {(status === 'done' || status === 'period-done') && (
                    <button
                      onClick={() => setMissTarget(habit)}
                      className="shrink-0 text-xs text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      Undo
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {missTarget && (
        <MissDialog
          habitName={missTarget.name}
          onConfirm={(reason) => markMissed(missTarget, reason)}
          onCancel={() => setMissTarget(null)}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

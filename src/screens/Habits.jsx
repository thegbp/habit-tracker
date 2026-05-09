import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import HabitForm from '../components/HabitForm'
import { useFocusTrap } from '../lib/useFocusTrap'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function HabitRow({ habit, onEdit, onArchive }) {
  function meta() {
    if (habit.frequency === 'daily') return 'Every day'
    if (habit.frequency === 'monthly') return 'Once a month'
    if (habit.frequency === 'weekly') {
      if (habit.window_type === 'specific') return `Every ${DAYS[habit.day_of_week]}`
      return 'Once a week (any day)'
    }
    return habit.frequency
  }

  return (
    <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl px-4 py-3.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{habit.name}</p>
        {/* UI Polish: text-slate-400 for WCAG AA contrast on card bg */}
        <p className="text-slate-400 text-xs mt-0.5">{meta()}</p>
      </div>
      <button
        onClick={() => onEdit(habit)}
        className="text-slate-500 hover:text-indigo-400 transition-colors p-1"
        aria-label="Edit habit"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
      <button
        onClick={() => onArchive(habit)}
        className="text-slate-500 hover:text-red-400 transition-colors p-1"
        aria-label="Archive habit"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      </button>
    </div>
  )
}

export default function Habits() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [archived, setArchived] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const formTrapRef = useFocusTrap(showForm ? () => { setShowForm(false); setEditTarget(null) } : undefined)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')
    const all = data ?? []
    setHabits(all.filter((h) => h.active))
    setArchived(all.filter((h) => !h.active))
    setLoading(false)
  }, [user.id])

  useEffect(() => { load() }, [load])

  async function handleSave(form) {
    setSaving(true)
    const dayOfWeek = form.frequency === 'weekly' && form.window_type === 'specific'
      ? form.day_of_week
      : null

    const { error } = editTarget
      ? await supabase.from('habits').update({
          name: form.name,
          frequency: form.frequency,
          window_type: form.window_type,
          day_of_week: dayOfWeek,
          schedulable: form.schedulable,
        }).eq('id', editTarget.id)
      : await supabase.from('habits').insert({
          user_id: user.id,
          name: form.name,
          frequency: form.frequency,
          window_type: form.window_type,
          day_of_week: dayOfWeek,
          schedulable: form.schedulable,
          active: true,
        })

    setSaving(false)
    if (error) {
      console.error('handleSave failed:', error.message)
      return
    }
    setShowForm(false)
    setEditTarget(null)
    load()
  }

  async function handleArchive(habit) {
    const { error } = await supabase.from('habits').update({ active: false }).eq('id', habit.id)
    if (error) { console.error('handleArchive failed:', error.message); return }
    load()
  }

  async function handleRestore(habit) {
    const { error } = await supabase.from('habits').update({ active: true }).eq('id', habit.id)
    if (error) { console.error('handleRestore failed:', error.message); return }
    load()
  }

  function openEdit(habit) {
    setEditTarget(habit)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditTarget(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-12 pb-4 safe-top">
        <h1 className="text-2xl font-bold text-white">Habits</h1>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          aria-label="Add new habit"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/30"
        >
          <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div aria-label="Loading" role="status" className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full motion-safe:animate-spin" />
          </div>
        ) : (
          <>
            {habits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-slate-400">No habits yet.</p>
                <p className="text-slate-500 text-sm mt-1">Tap + to add your first one.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {habits.map((h) => (
                  <HabitRow key={h.id} habit={h} onEdit={openEdit} onArchive={handleArchive} />
                ))}
              </div>
            )}

            {/* Archived section */}
            {archived.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-3"
                >
                  <svg className={`w-4 h-4 transition-transform ${showArchived ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  Archived ({archived.length})
                </button>
                {showArchived && (
                  <div className="space-y-2.5">
                    {archived.map((h) => (
                      <div key={h.id} className="bg-slate-900/50 border border-slate-700/40 rounded-2xl px-4 py-3.5 flex items-center gap-3 opacity-60">
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-400 font-medium truncate">{h.name}</p>
                        </div>
                        <button
                          onClick={() => handleRestore(h)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div role="dialog" aria-modal="true" aria-labelledby="habit-form-title" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div ref={formTrapRef} className="w-full max-w-sm bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/60 p-6">
            <h2 id="habit-form-title" className="text-lg font-semibold text-white mb-5">
              {editTarget ? 'Edit habit' : 'New habit'}
            </h2>
            <HabitForm
              initial={editTarget ?? undefined}
              onSave={handleSave}
              onCancel={closeForm}
              saving={saving}
            />
          </div>
        </div>
      )}
    </div>
  )
}

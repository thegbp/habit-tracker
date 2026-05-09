import { useState } from 'react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DEFAULT = {
  name: '',
  frequency: 'daily',
  window_type: 'any',
  day_of_week: 1,
  schedulable: false,
  active: true,
}

export default function HabitForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...DEFAULT, ...initial })

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label htmlFor="habit-name" className="block text-sm font-medium text-slate-300 mb-1.5">Habit name</label>
        <input
          id="habit-name"
          autoFocus
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Morning run"
          maxLength={80}
          className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
        />
      </div>

      {/* Frequency */}
      <div>
        <p id="frequency-label" className="block text-sm font-medium text-slate-300 mb-1.5">Frequency</p>
        <div role="group" aria-labelledby="frequency-label" className="flex gap-2">
          {['daily', 'weekly', 'monthly'].map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={form.frequency === f}
              onClick={() => set('frequency', f)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                form.frequency === f
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'border-slate-600 text-slate-400 hover:border-slate-500'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly options */}
      {form.frequency === 'weekly' && (
        <div>
          <p id="schedule-label" className="block text-sm font-medium text-slate-300 mb-1.5">Schedule</p>
          <div role="group" aria-labelledby="schedule-label" className="flex gap-2 mb-3">
            {['any', 'specific'].map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={form.window_type === w}
                onClick={() => set('window_type', w)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  form.window_type === w
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                {w === 'any' ? 'Any day' : 'Specific day'}
              </button>
            ))}
          </div>
          {form.window_type === 'specific' && (
            <div className="flex gap-1.5">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set('day_of_week', i)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    form.day_of_week === i
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-400 font-medium hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-colors"
        >
          {saving ? 'Saving…' : 'Save habit'}
        </button>
      </div>
    </form>
  )
}

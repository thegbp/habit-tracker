import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToPush, unsubscribeFromPush, getPushSubscription } from '../lib/push'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsModal({ onClose }) {
  const { user } = useAuth()
  const [time, setTime] = useState('21:00')
  const [enabled, setEnabled] = useState(true)
  const [pushActive, setPushActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('notification_time, notification_enabled')
        .eq('id', user.id)
        .single()
      if (data) {
        setTime(data.notification_time?.slice(0, 5) ?? '21:00')
        setEnabled(data.notification_enabled ?? true)
      }
      const sub = await getPushSubscription()
      setPushActive(!!sub)
    }
    load()
  }, [user.id])

  async function saveProfile() {
    setSaving(true)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const { error } = await supabase
      .from('profiles')
      .update({
        notification_time: time + ':00',
        notification_timezone: tz,
        notification_enabled: enabled,
      })
      .eq('id', user.id)
    setSaving(false)
    setMsg(error ? 'Failed to save.' : 'Saved!')
    setTimeout(() => setMsg(''), 2000)
  }

  async function togglePush() {
    setPushLoading(true)
    try {
      if (pushActive) {
        await unsubscribeFromPush()
        setPushActive(false)
        setMsg('Push notifications disabled.')
      } else {
        await subscribeToPush()
        setPushActive(true)
        setMsg('Push notifications enabled!')
      }
    } catch (err) {
      setMsg(err.message)
    }
    setPushLoading(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/60 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-700/60">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Notification time */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              EOD check-in time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Enable notifications</span>
            <button
              onClick={() => setEnabled((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-white font-semibold transition-colors"
          >
            {saving ? 'Saving…' : 'Save notification settings'}
          </button>

          {/* Push subscription */}
          <div className="pt-2 border-t border-slate-700/60">
            <p className="text-sm text-slate-400 mb-3">
              {pushActive
                ? 'Push notifications are active on this device.'
                : 'Enable push to get notified if you have incomplete habits.'}
            </p>
            <button
              onClick={togglePush}
              disabled={pushLoading}
              className={`w-full py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 ${
                pushActive
                  ? 'border border-red-500/50 text-red-400 hover:bg-red-500/10'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {pushLoading ? 'Working…' : pushActive ? 'Disable push notifications' : 'Enable push notifications'}
            </button>
          </div>

          {msg && <p className="text-sm text-indigo-400 text-center">{msg}</p>}

          {/* Sign out */}
          <div className="pt-2 border-t border-slate-700/60">
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 text-sm text-slate-500 hover:text-red-400 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

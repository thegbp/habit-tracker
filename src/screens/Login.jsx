import { useState } from 'react'
import { supabase, supabaseMisconfigured } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin }
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 bg-slate-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Habit Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">Build streaks, one day at a time.</p>
        </div>

        {supabaseMisconfigured && (
          <div className="mb-4 bg-amber-500/15 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-300 text-sm">
            <strong>Missing Supabase config.</strong> Copy <code className="text-amber-200">.env.example</code> to <code className="text-amber-200">.env</code> and fill in your Supabase URL and anon key, then restart the dev server.
          </div>
        )}

        {sent ? (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-white font-semibold mb-2">Check your inbox</h2>
            <p className="text-slate-400 text-sm">
              We sent a magic link to <span className="text-white">{email}</span>. Click it to sign in.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-white font-semibold transition-colors shadow-lg shadow-indigo-500/20"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
            <p className="text-center text-xs text-slate-500">
              No password needed — we'll email you a sign-in link.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

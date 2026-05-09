import { useState } from 'react'
import { useFocusTrap } from '../lib/useFocusTrap'

const PRESET_REASONS = ['forgot', 'too busy', 'travelling', 'unwell', 'other']

export default function MissDialog({ habitName, onConfirm, onCancel }) {
  const [step, setStep] = useState('confirm') // 'confirm' | 'reason'
  const [selected, setSelected] = useState('')
  const [custom, setCustom] = useState('')
  const trapRef = useFocusTrap(onCancel)

  function handleConfirm() {
    setStep('reason')
  }

  function handleSubmit() {
    const reason = selected === 'other' ? (custom.trim() || 'other') : selected
    onConfirm(reason)
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="miss-dialog-title" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div ref={trapRef} className="w-full max-w-sm bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/60 overflow-hidden">
        {step === 'confirm' ? (
          <>
            <div className="p-6">
              <h2 id="miss-dialog-title" className="text-lg font-semibold text-white mb-2">Mark as missed?</h2>
              <p className="text-slate-400 text-sm">
                This will reset your streak for{' '}
                <span className="text-white font-medium">{habitName}</span>.
              </p>
            </div>
            <div className="flex border-t border-slate-700/60">
              <button
                onClick={onCancel}
                className="flex-1 py-4 text-slate-400 font-medium hover:text-white transition-colors"
              >
                Cancel
              </button>
              <div className="w-px bg-slate-700/60" />
              <button
                onClick={handleConfirm}
                className="flex-1 py-4 text-red-400 font-semibold hover:text-red-300 transition-colors"
              >
                Mark missed
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white mb-1">What happened?</h2>
              <p className="text-slate-400 text-sm mb-4">Optional — helps you spot patterns.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {PRESET_REASONS.map((r) => (
                  <button
                    key={r}
                    aria-pressed={selected === r}
                    onClick={() => setSelected(r)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      selected === r
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'border-slate-600 text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {selected === 'other' && (
                <input
                  autoFocus
                  type="text"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="Describe what happened…"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>
            <div className="flex border-t border-slate-700/60">
              <button
                onClick={onCancel}
                className="flex-1 py-4 text-slate-400 font-medium hover:text-white transition-colors"
              >
                Cancel
              </button>
              <div className="w-px bg-slate-700/60" />
              <button
                onClick={handleSubmit}
                className="flex-1 py-4 text-indigo-400 font-semibold hover:text-indigo-300 transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

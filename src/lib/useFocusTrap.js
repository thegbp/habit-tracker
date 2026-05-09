import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Traps focus within a modal element and calls onEscape when Escape is pressed.
 * Attach the returned ref to the modal's root container element.
 *
 * @param {() => void} onEscape - Called when the user presses Escape
 * @returns {React.RefObject}
 */
export function useFocusTrap(onEscape) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Focus the first focusable element on mount
    const focusable = [...el.querySelectorAll(FOCUSABLE)]
    if (focusable.length) focusable[0].focus()

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onEscape?.()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = [...el.querySelectorAll(FOCUSABLE)]
      if (!focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        // Shift+Tab from first → wrap to last
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        // Tab from last → wrap to first
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onEscape])

  return ref
}

/** Returns 'YYYY-MM-DD' for a Date object using local time. */
export function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Returns the ISO Monday of the week containing `date`. */
function weekStart(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Returns 'YYYY-MM' for a Date. */
function toMonthStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Calculates current and best streaks for a habit.
 * @param {Array} logs  - habit_logs rows (any order, any date range)
 * @param {string} frequency - 'daily' | 'weekly' | 'monthly'
 * @param {string} windowType - 'any' | 'specific' (weekly only)
 * @returns {{ current: number, best: number }}
 */
export function calcStreaks(logs, frequency, windowType = 'any') {
  const completed = logs.filter((l) => l.completed)
  if (completed.length === 0) return { current: 0, best: 0 }

  if (frequency === 'daily') return dailyStreaks(completed)
  if (frequency === 'weekly') return weeklyStreaks(completed)
  if (frequency === 'monthly') return monthlyStreaks(completed)
  return { current: 0, best: 0 }
}

function dailyStreaks(completed) {
  const dates = new Set(completed.map((l) => l.date))
  const today = toDateStr(new Date())

  // Current streak
  let current = 0
  let cursor = new Date()
  if (!dates.has(today)) cursor.setDate(cursor.getDate() - 1)
  while (dates.has(toDateStr(cursor))) {
    current++
    cursor.setDate(cursor.getDate() - 1)
  }

  // Best streak — walk sorted date list
  const sorted = [...dates].sort()
  let best = 0
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diff = Math.round((curr - prev) / 86400000)
    if (diff === 1) {
      run++
      best = Math.max(best, run)
    } else {
      run = 1
    }
  }
  best = Math.max(best, run, current)

  return { current, best }
}

function weeklyStreaks(completed) {
  // Bucket completions by ISO week start string
  const weeks = new Set(
    completed.map((l) => toDateStr(weekStart(new Date(l.date))))
  )
  const sortedWeeks = [...weeks].sort()

  // Current streak
  let current = 0
  let cursor = weekStart(new Date())
  while (weeks.has(toDateStr(cursor))) {
    current++
    cursor.setDate(cursor.getDate() - 7)
  }

  // Best streak
  let best = 0, run = 1
  for (let i = 1; i < sortedWeeks.length; i++) {
    const prev = new Date(sortedWeeks[i - 1])
    const curr = new Date(sortedWeeks[i])
    const diff = Math.round((curr - prev) / (7 * 86400000))
    if (diff === 1) { run++; best = Math.max(best, run) } else { run = 1 }
  }
  best = Math.max(best, run, current)

  return { current, best }
}

function monthlyStreaks(completed) {
  const months = new Set(completed.map((l) => toMonthStr(new Date(l.date))))
  const sortedMonths = [...months].sort()

  // Current streak
  let current = 0
  let cursor = new Date()
  cursor.setDate(1)
  while (months.has(toMonthStr(cursor))) {
    current++
    cursor.setMonth(cursor.getMonth() - 1)
  }

  // Best streak
  let best = 0, run = 1
  for (let i = 1; i < sortedMonths.length; i++) {
    const [py, pm] = sortedMonths[i - 1].split('-').map(Number)
    const [cy, cm] = sortedMonths[i].split('-').map(Number)
    const diff = (cy - py) * 12 + (cm - pm)
    if (diff === 1) { run++; best = Math.max(best, run) } else { run = 1 }
  }
  best = Math.max(best, run, current)

  return { current, best }
}

/**
 * Determines whether a habit is due today.
 */
export function isDueToday(habit) {
  const today = new Date()
  const dow = today.getDay() // 0=Sun

  if (habit.frequency === 'daily') return true

  if (habit.frequency === 'weekly') {
    if (habit.window_type === 'specific') return habit.day_of_week === dow
    // 'any' — show every day of the week
    return true
  }

  if (habit.frequency === 'monthly') return true

  return false
}

/**
 * Returns true if the habit has already been completed in the current period
 * (week for weekly, month for monthly).
 */
export function completedThisPeriod(habit, logs) {
  const completed = logs.filter((l) => l.completed)
  if (habit.frequency === 'weekly') {
    const start = weekStart(new Date())
    return completed.some((l) => new Date(l.date) >= start)
  }
  if (habit.frequency === 'monthly') {
    const now = new Date()
    return completed.some((l) => {
      const d = new Date(l.date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
  }
  return false
}

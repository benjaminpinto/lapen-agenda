export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const two = (n) => String(n).padStart(2, '0')

/** "Sáb 10/02" for a date "2099-02-10". */
export function dayTitle(date) {
  const [year, month, day] = date.split('-').map(Number)
  return `${WEEKDAYS[new Date(year, month - 1, day).getDay()]} ${two(day)}/${two(month)}`
}

/** Every date from `start` to `end` (inclusive), as "YYYY-MM-DD". Capped, so a wrong period cannot freeze the page. */
export function daysBetween(start, end, cap = 62) {
  const days = []
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const last = new Date(ey, em - 1, ed)
  for (let day = new Date(sy, sm - 1, sd); day <= last && days.length < cap; day.setDate(day.getDate() + 1)) {
    days.push(`${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}`)
  }
  return days
}

export const windowKey = (w) => `${w.court_id}|${w.date}|${w.time}`

/** The grid of each day: times in rows, courts in columns. */
export function buildDays(schedule) {
  const byDate = new Map()
  for (const window of schedule.windows) {
    if (!byDate.has(window.date)) byDate.set(window.date, [])
    byDate.get(window.date).push(window)
  }
  const order = new Map(schedule.courts.map((court, index) => [court.id, index]))
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, windows]) => ({
    date,
    times: [...new Set(windows.map((w) => w.time))].sort(),
    courtIds: [...new Set(windows.map((w) => w.court_id))].sort((a, b) => (order.get(a) ?? a) - (order.get(b) ?? b)),
    windows: new Map(windows.map((w) => [windowKey(w), w])),
  }))
}

// Clay-court palette: a tone per category, plus the category name on every card (never color alone)
const TONES = [
  'border-amber-500 bg-amber-50',
  'border-stone-600 bg-stone-100',
  'border-orange-600 bg-orange-50',
  'border-yellow-700 bg-yellow-50',
  'border-red-400 bg-red-50',
  'border-stone-800 bg-stone-200',
]
export const toneFor = (categoryIds, categoryId) => TONES[Math.max(0, categoryIds.indexOf(categoryId)) % TONES.length]

export const matchTitle = (match) => `${match.sides[0].name} × ${match.sides[1].name}`

/** {match id: 'error' | 'warning'} (the worst one) from the conflict list. */
export function conflictLevels(conflicts) {
  const levels = new Map()
  for (const conflict of conflicts) {
    for (const id of conflict.match_ids) {
      if (levels.get(id) !== 'error') levels.set(id, conflict.severity)
    }
  }
  return levels
}

export const courtName = (courts, id) => courts.find((c) => c.id === id)?.name ?? `Quadra #${id}`

export const publishedText = (value) => {
  if (!value) return null
  const [date, time] = value.split('T')
  const [, month, day] = date.split('-')
  return `${day}/${month} ${time.slice(0, 5)}`
}

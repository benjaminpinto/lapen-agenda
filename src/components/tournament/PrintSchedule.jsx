import {createPortal} from 'react-dom'
import {courtName, dayTitle, windowKey} from '@/components/admin/tournament/schedule/scheduleUtils'
import {formatDate} from './format'

const DAYS_PER_SHEET = 4

// Only mounted on the Cronograma tab, so these rules never touch printing anywhere else.
// On paper the app is hidden and only the sheets show: A4 landscape, black on white, no fills (saves ink).
const PRINT_CSS = `
@media screen { .schedule-print { display: none; } }
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  html, body { background: #fff !important; }
  body > *:not(.schedule-print) { display: none !important; }
  .schedule-print { display: block; background: #fff; color: #000; }
}`

function Day({ day, data, byWindow }) {
  return (
    <article className="break-inside-avoid" data-testid={`print-day-${day.date}`}>
      <h2 className="mb-1 text-[10pt] font-bold">{dayTitle(day.date)}</h2>
      <table className="w-full table-fixed border-collapse text-[7pt] leading-tight">
        <thead>
          <tr>
            <th scope="col" className="w-[10mm] border border-black px-1 py-px text-left">Hora</th>
            {day.courtIds.map((id) => (
              <th key={id} scope="col" className="border border-black px-1 py-px text-left">{courtName(data.courts, id)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {day.times.map((time) => (
            <tr key={time}>
              <th scope="row" className="border border-black px-1 py-px text-left align-top tabular-nums">{time}</th>
              {day.courtIds.map((courtId) => {
                const key = windowKey({ court_id: courtId, date: day.date, time })
                const match = byWindow.get(key)
                return (
                  <td key={courtId} className="border border-black px-1 py-px align-top">
                    {match ? (
                      <>
                        <span className="block font-bold">{match.category_name} · {match.round_name}</span>
                        <span className="block">{match.sides[0].name} × {match.sides[1].name}</span>
                      </>
                    ) : day.windows.get(key)?.blocked ? '—' : null}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  )
}

/** The schedule on paper: a text header with the tournament data and, on each A4 sheet, 4 days in a 2×2 grid. */
export default function PrintSchedule({ data, days, byWindow, updatedAt }) {
  const { tournament } = data
  const categories = [...new Set(data.matches.map((m) => m.category_name))]
  const sheets = []
  for (let i = 0; i < days.length; i += DAYS_PER_SHEET) sheets.push(days.slice(i, i + DAYS_PER_SHEET))
  const info = [
    `${formatDate(tournament.start_date)} a ${formatDate(tournament.end_date)}`,
    tournament.location,
    tournament.format_text,
  ].filter(Boolean).join(' · ')
  const updated = updatedAt?.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  return createPortal(
    <div className="schedule-print" data-testid="print-schedule">
      <style>{PRINT_CSS}</style>
      {sheets.map((sheet, index) => (
        <section key={index} className="break-after-page last:break-after-auto" data-testid={`print-sheet-${index + 1}`}>
          <header className="mb-2 border-b border-black pb-1 text-[9pt] leading-tight">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h1 className="text-[13pt] font-bold">{tournament.name} — Cronograma</h1>
              <span className="text-[8pt]">Folha {index + 1} de {sheets.length}</span>
            </div>
            <p>{info}</p>
            <div className="flex flex-wrap justify-between gap-x-4">
              {categories.length > 0 && <span>Categorias: {categories.join(', ')}</span>}
              {updated && <span className="text-[8pt]">Atualizado em {updated}</span>}
            </div>
          </header>
          <div className="grid grid-cols-2 items-start gap-x-4 gap-y-2">
            {sheet.map((day) => <Day key={day.date} day={day} data={data} byWindow={byWindow} />)}
          </div>
        </section>
      ))}
    </div>,
    document.body,
  )
}

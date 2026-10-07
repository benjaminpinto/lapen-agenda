import {useState} from 'react'
import MatchCell from './MatchCell'
import {toneFor} from './scheduleUtils'

/** Pending matches that have no window yet. Dropping a match here takes it out of the schedule. */
export default function UnscheduledList({ matches, categories, categoryIds, selectedId, levels, onSelect, setDragging, onDropUnplace }) {
  const [category, setCategory] = useState('all')
  const [stage, setStage] = useState('all')
  const shown = matches.filter((m) => (category === 'all' || m.category_id === category) && (stage === 'all' || m.stage === stage))
  return (
    <div
      data-testid="unscheduled-list" className="space-y-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); onDropUnplace(Number(event.dataTransfer.getData('text/plain'))) }}
    >
      <div className="grid gap-2">
        <select aria-label="Categoria" data-testid="unscheduled-category" className="h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          <option value="all">Todas as categorias</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Fase" data-testid="unscheduled-stage" className="h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-sm" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="all">Todas as fases</option>
          <option value="group">Grupos</option>
          <option value="knockout">Mata-mata</option>
        </select>
      </div>
      {shown.length === 0 && (
        <p className="rounded-md border border-dashed border-stone-300 p-4 text-center text-sm text-stone-600" data-testid="unscheduled-empty">
          {matches.length === 0 ? 'Todas as partidas pendentes têm horário.' : 'Nenhuma partida neste filtro.'}
        </p>
      )}
      <ul className="space-y-2">
        {shown.map((match) => (
          <li key={match.id}>
            <MatchCell
              match={match} tone={toneFor(categoryIds, match.category_id)} level={levels.get(match.id)} compact
              selected={selectedId === match.id} onSelect={onSelect} onDragStart={setDragging}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

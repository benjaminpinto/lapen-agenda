import {useState} from 'react'
import CategoryChips from '../CategoryChips'
import {CATEGORY_STATUS} from '../labels'

const groupBadge = (group) => {
  if (group.blocked) return { text: 'Empate a decidir', className: 'border-orange-500 bg-orange-100 text-orange-900' }
  if (group.complete) return { text: 'Encerrado', className: 'border-stone-400 bg-stone-100 text-stone-800' }
  return { text: 'Em andamento', className: 'border-amber-400 bg-amber-100 text-amber-900' }
}

function GroupMini({ group, games, qualifiers, roundRobin }) {
  const done = games.filter((match) => match.status === 'completed').length
  const badge = groupBadge(group)
  return (
    <div className="rounded-lg border bg-white p-3" data-testid={`live-group-${group.id}`} data-complete={group.complete ? 'true' : 'false'}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
        <p className="font-semibold text-stone-900">{roundRobin ? 'Classificação' : `Grupo ${group.name}`} <span className="text-xs font-normal text-stone-500">· {done}/{games.length} jogos</span></p>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`} data-testid={`live-group-status-${group.id}`}>{badge.text}</span>
      </div>
      <ol className="space-y-0.5 text-sm">
        {group.rows.map((row) => (
          <li
            key={row.registration_id} data-qualifying={!roundRobin && row.position <= qualifiers ? 'true' : undefined}
            className={`flex items-center justify-between gap-2 border-l-4 py-0.5 pl-2 ${!roundRobin && row.position <= qualifiers ? 'border-l-amber-600 bg-amber-50/70' : 'border-l-transparent'}`}
          >
            <span className="min-w-0 truncate">{row.position}º {row.display_name}</span>
            <span className="shrink-0 text-xs tabular-nums text-stone-600">{row.wins}V {row.losses}D</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Quick look at every category: games done, and for the ones with groups, each group's table. */
export default function LiveOverview({ categories, matches, progress, standings }) {
  const [filter, setFilter] = useState('')
  const shown = categories.filter((category) => !filter || String(category.id) === filter)
  return (
    <section className="space-y-3" data-testid="live-overview">
      <h3 className="text-lg font-semibold text-stone-900">Andamento e grupos</h3>
      <CategoryChips testId="live-category" categories={categories} value={filter} onChange={setFilter} allLabel="Todas" />
      {shown.map((category) => {
        const stats = progress.get(category.id) ?? { total: 0, done: 0, hasKnockout: false }
        const table = standings[category.id]
        const groups = table?.groups ?? []
        const waiting = category.draw_format === 'groups_knockout' && !stats.hasKnockout
        const settled = groups.filter((group) => group.confirmed).length
        const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0
        return (
          <div key={category.id} className="space-y-2" data-testid={`live-category-${category.id}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h4 className="font-semibold text-stone-900">{category.name}</h4>
              <span className="text-xs text-stone-600">{CATEGORY_STATUS[category.status] ?? category.status}</span>
              <span className="text-xs text-stone-600" data-testid={`live-progress-${category.id}`}>{stats.done}/{stats.total} jogos</span>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${category.name}`}>
                <div className="h-full bg-amber-700" style={{ width: `${percent}%` }} />
              </div>
            </div>
            {waiting && groups.length > 0 && (
              <p className="text-xs text-stone-600" data-testid={`live-knockout-wait-${category.id}`}>
                A chave do mata-mata será montada quando todos os grupos terminarem ({settled} de {groups.length} com classificados definidos).
              </p>
            )}
            {groups.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {groups.map((group) => (
                  <GroupMini
                    key={group.id} group={group} qualifiers={table.qualifiers_per_group} roundRobin={category.draw_format === 'round_robin'}
                    games={matches.filter((match) => match.category_id === category.id && match.stage === 'group' && match.group === group.name)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

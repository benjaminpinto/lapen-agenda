import {Check} from 'lucide-react'

const STATE_TEXT = { done: 'concluída', current: 'em andamento', upcoming: 'a seguir' }

/** The stages of a category (Inscrições → Grupos → Mata-mata → Final → Campeão) and how many games are done. */
export default function ProgressTrack({ stage, progress }) {
  const percent = progress.total ? Math.round((100 * progress.done) / progress.total) : 0
  const parts = [['Grupos', progress.group], ['Mata-mata', progress.knockout]].filter(([, part]) => part?.total > 0).map(([label, part]) => `${label}: ${part.done} de ${part.total}`)
  return (
    <div className="space-y-4" data-testid="progress-track">
      <ol className="flex items-start" aria-label="Etapas da categoria">
        {stage.steps.map((step, index) => (
          <li
            key={step.key}
            data-testid={`step-${step.key}`}
            data-state={step.state}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center px-0.5 text-center"
          >
            {index > 0 && (
              <span aria-hidden="true" className={`absolute right-1/2 top-[11px] h-0.5 w-full ${step.state === 'upcoming' ? 'bg-border' : 'bg-amber-600'}`} />
            )}
            <span
              className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
                step.state === 'done' ? 'border-amber-700 bg-amber-700 text-white'
                  : step.state === 'current' ? 'border-amber-600 bg-card text-amber-800 ring-2 ring-amber-300 dark:text-amber-400 dark:ring-amber-700'
                    : 'border-border bg-card text-muted-foreground'
              }`}
            >
              {step.state === 'done' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
            </span>
            <span className={`mt-1 text-xs leading-tight sm:text-sm ${step.state === 'current' ? 'font-semibold' : ''} ${step.state === 'upcoming' ? 'text-muted-foreground' : ''}`}>
              {step.label}
            </span>
            <span className="sr-only">{STATE_TEXT[step.state]}</span>
          </li>
        ))}
      </ol>
      {progress.total > 0 && (
        <div>
          <div
            role="progressbar" aria-label="Jogos disputados" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}
            className="h-2.5 overflow-hidden rounded-full bg-muted" data-testid="progress-bar"
          >
            <div className="h-full rounded-full bg-amber-600" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground" data-testid="progress-text">
            <strong className="text-foreground">{progress.done} de {progress.total}</strong> jogos disputados ({percent}%)
            {parts.length > 0 && <span> · {parts.join(' · ')}</span>}
          </p>
        </div>
      )}
    </div>
  )
}

import {tiebreakLines} from './tiebreakLines'

/** Why a finished group is in the order it is, whenever players ended level on wins. */
export default function TiebreakNote({ group }) {
  const lines = tiebreakLines(group)
  if (lines.length === 0) return null
  return (
    <div className="mx-3 mb-3 space-y-3 rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid={`group-tiebreak-${group.name}`}>
      {lines.map((line) => (
        <div key={line.wins}>
          <p className="font-medium">{line.intro} Desempate:</p>
          {line.steps.length === 0 ? (
            <p className="text-muted-foreground">Nenhum critério separou os jogadores.</p>
          ) : (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {line.steps.map((step) => (
                <li key={step.criterion + step.text} data-testid={`group-tiebreak-${group.name}-${step.criterion}`}>
                  <strong className="font-medium text-foreground">{step.title}:</strong> {step.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

import {ChevronDown} from 'lucide-react'

const CRITERIA = [
  'Mais vitórias.',
  'Mais partidas disputadas em quadra: duas vitórias em três jogos ficam à frente de duas vitórias em dois (W.O. não conta como disputada).',
  'Confronto direto, quando o empate é entre dois jogadores.',
  'Maior percentual de sets ganhos.',
  'Maior percentual de games ganhos.',
  'Se ainda houver empate numa vaga que importa, o organizador decide.',
]

/** How a group is ordered (ATP round-robin order), written for the public. */
export default function TiebreakExplainer({ open = false, roundRobin = false }) {
  const criteria = roundRobin ? [...CRITERIA.slice(0, -1), 'Se ainda houver empate, o organizador decide.'] : CRITERIA
  return (
    <details className="group rounded-lg border bg-card" open={open || undefined} data-testid="tiebreak-explainer">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 text-sm font-semibold" data-testid="tiebreak-explainer-toggle">
        Como é definida a classificação
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-3 border-t px-4 py-3 text-sm">
        <p>Dentro de cada grupo, a ordem segue o critério da ATP para fase de grupos, nesta sequência:</p>
        <ol className="list-decimal space-y-1 pl-5">
          {criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
        </ol>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Entre três ou mais jogadores empatados, os critérios 4 e 5 valem para todos; assim que um deles se separa, os que sobram voltam ao confronto direto.</li>
          <li>O super tie-break vale como um set e um game. W.O. conta como vitória (e derrota) sem sets nem games.</li>
          {roundRobin ? (
            <li>Todos contra todos não tem mata-mata: quando o último jogo termina, a ordem da tabela é a colocação final.</li>
          ) : (
            <>
              <li>Empate que não muda quem avança não precisa ser desfeito.</li>
              <li>
                <strong className="text-foreground">Avança (provisório)</strong>: está dentro das vagas e já venceu, mas o grupo ainda não terminou.{' '}
                <strong className="text-foreground">Classificado</strong>: grupo encerrado e vaga garantida.
              </li>
              <li>Na montagem da chave, grupos de tamanhos diferentes são comparados pelo aproveitamento (vitórias ÷ jogos), depois pelo percentual de sets e de games.</li>
            </>
          )}
        </ul>
      </div>
    </details>
  )
}

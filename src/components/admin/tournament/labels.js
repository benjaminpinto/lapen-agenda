// Clay-court palette: amber / orange / brown / stone. No green, blue or purple.
export const TOURNAMENT_STATUS = {
  draft: { label: 'Rascunho', className: 'bg-stone-100 text-stone-700 border-stone-300' },
  registration_open: { label: 'Inscrições abertas', className: 'bg-amber-100 text-amber-900 border-amber-400' },
  registration_closed: { label: 'Inscrições encerradas', className: 'bg-orange-100 text-orange-900 border-orange-400' },
  in_progress: { label: 'Em andamento', className: 'bg-amber-800 text-white border-amber-800' },
  finished: { label: 'Finalizado', className: 'bg-stone-800 text-white border-stone-800' },
  cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-300' },
}

export const CATEGORY_STATUS = {
  awaiting_draw: 'Aguardando sorteio',
  drawn: 'Pré-visualização do sorteio',
  published: 'Sorteio publicado',
  group_stage: 'Fase de grupos',
  knockout_stage: 'Mata-mata',
  finished: 'Finalizada',
}

export const REGISTRATION_STATUS = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-900 border-amber-400' },
  confirmed: { label: 'Confirmada', className: 'bg-stone-800 text-white border-stone-800' },
  rejected: { label: 'Recusada', className: 'bg-red-100 text-red-800 border-red-300' },
  cancelled: { label: 'Cancelada', className: 'bg-stone-100 text-stone-600 border-stone-300' },
  waitlist: { label: 'Lista de espera', className: 'bg-orange-100 text-orange-900 border-orange-400' },
  withdrawn: { label: 'Desistiu', className: 'bg-red-50 text-red-700 border-red-200' },
}

export const DRAW_FORMATS = {
  knockout: 'Eliminatória simples',
  round_robin: 'Todos contra todos',
  groups_knockout: 'Grupos + mata-mata',
}

export const MATCH_FORMATS = {
  best_of_3_super_tb: '2 sets + super tie-break (padrão)',
  pro_set_8: 'Set pro até 8 games',
  single_set_6: 'Set único até 6 games',
}

export const OUTCOMES = {
  normal: 'Placar normal',
  wo: 'W.O.',
  double_wo: 'Duplo W.O.',
  retired: 'Desistência durante o jogo',
}

export const formatDate = (value) => {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

export const formatDateTime = (value) => {
  if (!value) return '—'
  const [date, time] = String(value).split('T')
  return `${formatDate(date)} ${time ? time.slice(0, 5) : ''}`.trim()
}

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:MM"
export const toInputDateTime = (value) => (value ? String(value).slice(0, 16) : '')

/**
 * Note for admin screens built for a tablet or computer: below 768px they still work,
 * but dense tables and grids are cramped on a phone. Pass `children` for a screen-specific note.
 */
export default function DesktopNotice({ children }) {
  return (
    <p className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 md:hidden" role="note" data-testid="desktop-notice">
      <span aria-hidden="true">🖥️</span>
      <span>{children || 'Este painel foi pensado para tablet ou computador. No celular, o cronograma e as tabelas ficam apertados.'}</span>
    </p>
  )
}

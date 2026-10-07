/** The tournament panel is made for tablets and computers: below 768px it still works, but a phone makes it hard to handle. */
export default function DesktopNotice() {
  return (
    <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 md:hidden" role="note" data-testid="desktop-notice">
      Este painel foi pensado para tablet ou computador. No celular, o cronograma e as tabelas ficam apertados.
    </p>
  )
}

import {createPortal} from 'react-dom'

// Mounted only where printing is meant, so these rules never touch printing anywhere else.
// On paper the app is hidden and only the children show: A4 landscape, black on white.
const PRINT_CSS = `
@media screen { .print-root { display: none; } }
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  html, body { background: #fff !important; }
  body > *:not(.print-root) { display: none !important; }
  .print-root { display: block; background: #fff; color: #000; }
}`

/** What goes on paper: children are portalled into <body>, hidden on screen. Give each page its own <section>. */
export default function PrintRoot({ children, testId }) {
  return createPortal(
    <div className="print-root" data-testid={testId}>
      <style>{PRINT_CSS}</style>
      {children}
    </div>,
    document.body,
  )
}

export default function StatusBadge({ info, testId }) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${info.className}`}
    >
      {info.label}
    </span>
  )
}

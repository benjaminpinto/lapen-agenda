// Category filter as pill buttons, same look as the public tournament page. `allLabel` adds a leading "all" chip with value ''.
export default function CategoryChips({ categories, value, onChange, allLabel, testId }) {
  const options = [...(allLabel ? [{ id: '', name: allLabel }] : []), ...categories]
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria" data-testid={testId}>
      {options.map((option) => {
        const active = String(option.id) === String(value)
        return (
          <button
            key={option.id} type="button" aria-pressed={active} data-testid={`${testId}-${option.id === '' ? 'all' : option.id}`}
            onClick={() => onChange(String(option.id))}
            className={`min-h-[44px] rounded-full border px-4 text-sm font-medium ${active ? 'border-amber-800 bg-amber-800 text-white' : 'bg-card hover:bg-muted'}`}
          >
            {option.name}
          </button>
        )
      })}
    </div>
  )
}

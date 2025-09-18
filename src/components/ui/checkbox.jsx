import { forwardRef } from 'react'

const Checkbox = forwardRef(({ className = '', checked, onCheckedChange, ...props }, ref) => {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 rounded border border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 ${className}`}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      ref={ref}
      {...props}
    />
  )
})
Checkbox.displayName = 'Checkbox'

export { Checkbox }
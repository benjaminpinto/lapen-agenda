import { forwardRef } from 'react'

const Textarea = forwardRef(({ className = '', ...props }, ref) => {
  return (
    <textarea
      className={`form-textarea ${className}`}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
import { forwardRef } from 'react'

const Input = forwardRef(({ className = '', type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      className={`form-input ${className}`}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
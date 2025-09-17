import { forwardRef } from 'react'

const Label = forwardRef(({ className = '', ...props }, ref) => (
  <label
    ref={ref}
    className={`form-label ${className}`}
    {...props}
  />
))
Label.displayName = 'Label'

export { Label }
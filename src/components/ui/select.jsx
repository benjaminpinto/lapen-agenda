import * as React from "react"
const { useState, createContext, useContext } = React

const SelectContext = createContext()

const Select = ({ value, onValueChange, children, ...props }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(value || '')
  
  const handleValueChange = (newValue) => {
    setSelectedValue(newValue)
    onValueChange?.(newValue)
    setIsOpen(false)
  }
  
  return (
    <SelectContext.Provider value={{ isOpen, setIsOpen, selectedValue, handleValueChange }}>
      <div className="relative select-container" {...props}>{children}</div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef(({ className = "", children, ...props }, ref) => {
  const { isOpen, setIsOpen } = useContext(SelectContext)
  
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
      <span className="ml-2">▼</span>
    </button>
  )
})

const SelectValue = ({ placeholder, children, ...props }) => {
  const { selectedValue } = useContext(SelectContext)
  
  return (
    <span className={selectedValue ? "text-gray-900" : "text-gray-500"} {...props}>
      {children || selectedValue || placeholder}
    </span>
  )
}

const SelectContent = ({ className = "", children, ...props }) => {
  const { isOpen, setIsOpen } = useContext(SelectContext)
  
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && !event.target.closest('.select-container')) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen, setIsOpen])
  
  if (!isOpen) return null
  
  return (
    <div
      className={`absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-gray-200 bg-white shadow-md ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

const SelectItem = React.forwardRef(({ className = "", children, value, ...props }, ref) => {
  const { handleValueChange } = useContext(SelectContext)
  
  return (
    <div
      ref={ref}
      onClick={() => handleValueChange(value)}
      className={`relative flex w-full cursor-pointer select-none items-center py-2 px-3 text-sm outline-none hover:bg-gray-100 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
})

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
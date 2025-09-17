import { createContext, useContext, useState } from 'react'

const TabsContext = createContext()

const Tabs = ({ defaultValue, value, onValueChange, className = '', children, ...props }) => {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const currentValue = value !== undefined ? value : internalValue
  
  const handleValueChange = (newValue) => {
    if (value === undefined) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }
  
  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
      <div className={className} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const TabsList = ({ className = '', children, ...props }) => (
  <div
    className={`inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-600 ${className}`}
    {...props}
  >
    {children}
  </div>
)

const TabsTrigger = ({ value, className = '', children, ...props }) => {
  const { value: currentValue, onValueChange } = useContext(TabsContext)
  const isActive = currentValue === value
  
  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
      } ${className}`}
      onClick={() => onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  )
}

const TabsContent = ({ value, className = '', children, ...props }) => {
  const { value: currentValue } = useContext(TabsContext)
  
  if (currentValue !== value) return null
  
  return (
    <div
      className={`mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
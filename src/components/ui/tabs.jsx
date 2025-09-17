import * as React from "react"

const TabsContext = React.createContext()

const Tabs = ({ value, onValueChange, className = "", children, ...props }) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={`w-full ${className}`} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const TabsList = React.forwardRef(({ className = "", ...props }, ref) => (
  <div
    ref={ref}
    className={`inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 text-gray-500 ${className}`}
    {...props}
  />
))

const TabsTrigger = React.forwardRef(({ className = "", value: triggerValue, children, ...props }, ref) => {
  const { value, onValueChange } = React.useContext(TabsContext)
  const isActive = value === triggerValue
  
  return (
    <button
      ref={ref}
      onClick={() => onValueChange(triggerValue)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${isActive ? 'bg-white text-gray-950 shadow-sm' : 'hover:bg-gray-200'} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
})

const TabsContent = React.forwardRef(({ className = "", value: contentValue, children, ...props }, ref) => {
  const { value } = React.useContext(TabsContext)
  
  if (value !== contentValue) return null
  
  return (
    <div
      ref={ref}
      className={`mt-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
})

export { Tabs, TabsList, TabsTrigger, TabsContent }
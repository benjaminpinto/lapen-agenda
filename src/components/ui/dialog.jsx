import { createContext, useContext, useState } from 'react'

const DialogContext = createContext()

const Dialog = ({ open, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open !== undefined ? open : internalOpen
  
  const handleOpenChange = (newOpen) => {
    if (open === undefined) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }
  
  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
      {isOpen && (
        <div className="modal-overlay">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50" 
            onClick={() => handleOpenChange(false)}
          />
          <div className="modal-content">
            {children}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

const DialogTrigger = ({ children, ...props }) => {
  const { onOpenChange } = useContext(DialogContext)
  
  return (
    <div onClick={() => onOpenChange(true)} {...props}>
      {children}
    </div>
  )
}

const DialogContent = ({ className = '', children, ...props }) => {
  const { open } = useContext(DialogContext)
  
  if (!open) return null
  
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}

const DialogHeader = ({ className = '', ...props }) => (
  <div className={`flex flex-col space-y-1.5 text-center sm:text-left mb-4 ${className}`} {...props} />
)

const DialogTitle = ({ className = '', ...props }) => (
  <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props} />
)

const DialogDescription = ({ className = '', ...props }) => (
  <p className={`text-sm text-gray-600 ${className}`} {...props} />
)

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription }
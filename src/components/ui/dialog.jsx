import { createContext, useContext, useState } from 'react'
import { createPortal } from 'react-dom'

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
      {!isOpen && children}
      {/* Rendered on <body> so a transformed ancestor (e.g. an entrance animation) can't trap the overlay */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div 
            className="fixed inset-0 bg-black/45 animate-fade" 
            onClick={() => handleOpenChange(false)}
          />
          {children}
        </div>,
        document.body
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
    // Phones get a bottom sheet (full width, thumb-reachable); larger screens keep the centred dialog.
    <div className={`relative bg-card text-card-foreground rounded-2xl shadow-2xl max-h-[90dvh] overflow-y-auto p-6 ${className} max-sm:!w-full max-sm:!max-w-none max-sm:!mx-0 max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:animate-sheet`} {...props}>
      <div className="sm:hidden mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-muted" />
      {children}
    </div>
  )
}

const DialogHeader = ({ className = '', ...props }) => (
  <div className={`flex flex-col space-y-1.5 text-left mb-4 ${className}`} {...props} />
)

const DialogTitle = ({ className = '', ...props }) => (
  <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props} />
)

const DialogDescription = ({ className = '', ...props }) => (
  <p className={`text-sm text-muted-foreground ${className}`} {...props} />
)

const DialogFooter = ({ className = '', ...props }) => (
  <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4 ${className}`} {...props} />
)

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
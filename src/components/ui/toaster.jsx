import { useToast } from '@/contexts/ToastContext'
import { X } from 'lucide-react'

export const Toaster = () => {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 space-y-2 w-[calc(100%-2rem)] sm:w-auto">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-4 rounded-lg shadow-lg max-w-sm w-full relative ${
            toast.variant === 'destructive'
              ? 'bg-red-500 text-white'
              : 'bg-green-500 text-white'
          }`}
        >
          <button
            onClick={() => removeToast(toast.id)}
            className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="font-semibold pr-6">{toast.title}</div>
          {toast.description && (
            <div className="text-sm opacity-90 pr-6">{toast.description}</div>
          )}
        </div>
      ))}
    </div>
  )
}
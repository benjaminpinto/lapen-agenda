import { useToast } from '@/contexts/ToastContext'
import { X } from 'lucide-react'

export const Toaster = () => {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed top-3 inset-x-3 sm:inset-x-auto sm:top-4 sm:right-4 z-[70] space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-4 rounded-2xl shadow-xl sm:max-w-sm relative animate-fade ${
            toast.variant === 'destructive'
              ? 'bg-red-700 text-white'
              : 'bg-[#2a1810] text-white'
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
/**
 * Fetch utility with automatic token refresh
 */
export const fetchWithAuth = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    credentials: 'include'
  })
  
  if (response.status === 401) {
    try {
      const data = await response.json()
      if (data.refresh) {
        // Try to refresh the token
        const refreshed = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        })
        
        if (refreshed.ok) {
          // Retry the original request with new token
          return fetch(url, { ...options, credentials: 'include' })
        }
      }
      
      // Session expired and cannot refresh - redirect to login
      const { toast } = await import('sonner')
      toast.error('Sessão expirada. Faça login novamente.')
      
      // Wait a bit for user to see the message
      setTimeout(() => {
        window.location.href = '/login'
      }, 1500)
      
      return response
    } catch (e) {
      // If anything fails, redirect to login
      window.location.href = '/login'
      return response
    }
  }
  
  return response
}

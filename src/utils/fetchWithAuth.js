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
        const refreshed = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        })
        
        if (refreshed.ok) {
          return fetch(url, { ...options, credentials: 'include' })
        }
      }
    } catch (e) {
      // If refresh fails, redirect to login
      window.location.href = '/login'
    }
  }
  
  return response
}

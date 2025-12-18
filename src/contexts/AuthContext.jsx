import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else if (response.status === 401) {
        const data = await response.json()
        if (data.refresh) {
          const refreshed = await refreshToken()
          if (refreshed) {
            await fetchUser()
            return
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshToken = async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      })
      return response.ok
    } catch {
      return false
    }
  }

  const login = async (email, password, rememberMe = false) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, remember_me: rememberMe }),
        credentials: 'include'
      })

      const text = await response.text()
      
      if (response.ok) {
        const data = JSON.parse(text)
        setUser(data.user)
        return { success: true }
      } else {
        try {
          const data = JSON.parse(text)
          return { success: false, error: data.error }
        } catch {
          return { success: false, error: 'Email ou senha inválidos' }
        }
      }
    } catch (error) {
      return { success: false, error: 'Erro de conexão' }
    }
  }

  const register = async (userData) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData),
        credentials: 'include'
      })

      const text = await response.text()
      
      if (response.ok) {
        const data = JSON.parse(text)
        setUser(data.user)
        return { success: true }
      } else {
        try {
          const data = JSON.parse(text)
          return { success: false, error: data.error }
        } catch {
          if (response.status === 400) {
            return { success: false, error: 'Dados inválidos ou email já cadastrado' }
          }
          return { success: false, error: `Erro do servidor: ${response.status}` }
        }
      }
    } catch (error) {
      return { success: false, error: 'Network error' }
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      console.error('Logout error:', error)
    }
    setUser(null)
  }

  const updateUser = (updatedUser) => {
    setUser(updatedUser)
  }

  const canBookCourts = user && user.is_lapen_member && user.lapen_approved
  const canPlaceBets = !!user

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
    canBookCourts,
    canPlaceBets
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const Profile = () => {
  const { user, updateUser } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [profileData, setProfileData] = useState({
    name: '',
    short_name: '',
    email: '',
    phone: '',
    pix_key: ''
  })
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        short_name: user.short_name || '',
        email: user.email || '',
        phone: user.phone || '',
        pix_key: user.pix_key || ''
      })
    }
  }, [user])

  const formatPhoneDisplay = (value) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  }

  const handlePhoneChange = (e) => {
    const numbers = e.target.value.replace(/\D/g, '')
    setProfileData({ ...profileData, phone: numbers })
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      })

      const data = await response.json()

      if (response.ok) {
        updateUser(data.user)
        toast({ title: 'Perfil atualizado com sucesso' })
      } else {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao atualizar perfil', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' })
      return
    }

    if (passwordData.new_password.length < 6) {
      toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' })
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({ title: 'Senha alterada com sucesso' })
        setPasswordData({ current_password: '', new_password: '', confirm_password: '' })
      } else {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao alterar senha', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <div className="max-w-2xl mx-auto px-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Meu Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <Label>Nome Completo</Label>
              <Input
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Nome Curto</Label>
              <Input
                value={profileData.short_name}
                onChange={(e) => setProfileData({ ...profileData, short_name: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Como você quer ser chamado</p>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={formatPhoneDisplay(profileData.phone)}
                onChange={handlePhoneChange}
                placeholder="(11) 99999-9999"
                maxLength={15}
              />
            </div>
            <div>
              <Label>Chave PIX</Label>
              <Input
                value={profileData.pix_key}
                onChange={(e) => setProfileData({ ...profileData, pix_key: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">Para receber pagamentos de apostas</p>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <Label>Senha Atual</Label>
              <Input
                type="password"
                value={passwordData.current_password}
                onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Nova Senha</Label>
              <Input
                type="password"
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Confirmar Nova Senha</Label>
              <Input
                type="password"
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Profile

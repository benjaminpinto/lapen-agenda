import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'
import { BarChart3, ChevronDown, Laptop, LogOut, Moon, Sun, Swords, Target } from 'lucide-react'
import { fetchWithAuth } from '@/utils/fetchWithAuth'

const Profile = () => {
  const { user, updateUser, logout } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
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
      const response = await fetchWithAuth('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetchWithAuth('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleLogout = () => {
    logout()
    toast({ title: 'Logout realizado' })
    navigate('/')
  }

  if (!user) {
    navigate('/login')
    return null
  }

  const initials = (user.short_name || user.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const memberStatus = user.lapen_approved
    ? { label: 'Membro LAPEN', className: 'bg-primary text-primary-foreground' }
    : user.is_lapen_member
      ? { label: 'Aprovação pendente', className: 'bg-amber-100 text-amber-900' }
      : { label: 'Visitante', className: 'bg-muted text-muted-foreground' }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Identity */}
      <section className="flex items-center gap-4" data-testid="profile-header">
        <span className="h-16 w-16 shrink-0 rounded-full bg-[#2a1810] text-orange-200 grid place-items-center font-display text-2xl font-extrabold">
          {initials}
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{user.short_name || user.name}</h1>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${memberStatus.className}`}>
            {memberStatus.label}
          </span>
        </div>
      </section>

      {/* Shortcuts */}
      <nav className="grid grid-cols-3 gap-2 text-xs font-semibold">
        {[
          { to: '/ranking/my-matches', label: 'Meus jogos', icon: Swords },
          { to: '/statistics', label: 'Números', icon: BarChart3 },
          { to: '/challenges', label: 'Desafios', icon: Target },
        ].map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-1.5 rounded-2xl border bg-card py-3 active:scale-95 transition hover:border-primary/40">
            <span className="h-9 w-9 rounded-full bg-accent text-accent-foreground grid place-items-center"><Icon className="h-4 w-4" /></span>
            {label}
          </Link>
        ))}
      </nav>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Meus dados</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <Label htmlFor="profile-name">Nome completo</Label>
              <Input
                id="profile-name"
                autoComplete="name"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="profile-short-name">Nome curto</Label>
              <Input
                id="profile-short-name"
                autoComplete="nickname"
                value={profileData.short_name}
                onChange={(e) => setProfileData({ ...profileData, short_name: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Como você aparece na agenda e no ranking</p>
            </div>
            <div>
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                autoComplete="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="profile-phone">Telefone</Label>
              <Input
                id="profile-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={formatPhoneDisplay(profileData.phone)}
                onChange={handlePhoneChange}
                placeholder="(11) 99999-9999"
                maxLength={15}
              />
            </div>
            <div>
              <Label htmlFor="profile-pix">Chave PIX</Label>
              <Input
                id="profile-pix"
                value={profileData.pix_key}
                onChange={(e) => setProfileData({ ...profileData, pix_key: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Para receber pagamentos de apostas</p>
            </div>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto rounded-full" data-testid="profile-save">
              {loading ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
                aria-expanded={showPassword} data-testid="profile-password-toggle">
          <span className="font-display text-lg font-bold">Alterar senha</span>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition ${showPassword ? 'rotate-180' : ''}`} />
        </button>
        {showPassword && (
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <Label htmlFor="profile-current-password">Senha atual</Label>
                <Input
                  id="profile-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="profile-new-password">Nova senha</Label>
                <Input
                  id="profile-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="profile-confirm-password">Confirmar nova senha</Label>
                <Input
                  id="profile-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto rounded-full">
                {loading ? 'Alterando...' : 'Alterar senha'}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      <Button variant="outline" onClick={handleLogout}
              className="w-full rounded-full text-destructive hover:text-destructive"
              data-testid="profile-logout">
        <LogOut className="h-4 w-4 mr-2" />
        Sair
      </Button>
    </div>
  )
}

const ThemeOption = ({ value, icon, label }) => {
  const { theme, setTheme } = useTheme()
  const isSelected = theme === value

  return (
    <Button
      variant={isSelected ? "default" : "outline"}
      size="sm"
      onClick={() => setTheme(value)}
      className="flex items-center gap-2"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}

export default Profile

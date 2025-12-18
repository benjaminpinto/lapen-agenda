import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {useToast} from '@/contexts/ToastContext'
import {ArrowLeft, Edit, Key, Trash2} from 'lucide-react'
import {fetchWithAuth} from "../../utils/fetchWithAuth.js";

const AdminUsers = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editDialog, setEditDialog] = useState(false)
  const [passwordDialog, setPasswordDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [newPassword, setNewPassword] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetchWithAuth('/api/admin/users', {
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      toast({ title: 'Erro ao carregar usuários', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user) => {
    setSelectedUser(user)
    setEditForm({
      name: user.name,
      short_name: user.short_name,
      email: user.email,
      phone: user.phone || '',
      pix_key: user.pix_key || '',
      is_admin: user.is_admin,
      lapen_approved: user.lapen_approved
    })
    setEditDialog(true)
  }

  const handleSaveEdit = async () => {
    try {
      const response = await fetchWithAuth(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm)
      })
      
      if (response.ok) {
        toast({ title: 'Usuário atualizado com sucesso' })
        setEditDialog(false)
        fetchUsers()
      } else {
        const data = await response.json()
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao atualizar usuário', variant: 'destructive' })
    }
  }

  const handlePasswordChange = (user) => {
    setSelectedUser(user)
    setNewPassword('')
    setPasswordDialog(true)
  }

  const handleSavePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' })
      return
    }

    try {
      const response = await fetchWithAuth(`/api/admin/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword })
      })
      
      if (response.ok) {
        toast({ title: 'Senha alterada com sucesso' })
        setPasswordDialog(false)
      } else {
        const data = await response.json()
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao alterar senha', variant: 'destructive' })
    }
  }

  const handleDelete = (user) => {
    setSelectedUser(user)
    setDeleteDialog(true)
  }

  const confirmDelete = async () => {
    try {
      const response = await fetchWithAuth(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        toast({ title: 'Usuário excluído com sucesso' })
        setDeleteDialog(false)
        fetchUsers()
      } else {
        const data = await response.json()
        toast({ title: 'Erro', description: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro ao excluir usuário', variant: 'destructive' })
    }
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar ao Dashboard
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left p-2">Nome Curto</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Admin</th>
                  <th className="text-left p-2">LAPEN</th>
                  <th className="text-right p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b">
                    <td className="p-2">{user.name}</td>
                    <td className="p-2">{user.short_name}</td>
                    <td className="p-2">{user.email}</td>
                    <td className="p-2">{user.is_admin ? '✓' : ''}</td>
                    <td className="p-2">{user.lapen_approved ? '✓' : ''}</td>
                    <td className="p-2 text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handlePasswordChange(user)}>
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(user)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome Completo</Label>
              <Input value={editForm.name || ''} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
            </div>
            <div>
              <Label>Nome Curto</Label>
              <Input value={editForm.short_name || ''} onChange={(e) => setEditForm({...editForm, short_name: e.target.value})} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editForm.email || ''} onChange={(e) => setEditForm({...editForm, email: e.target.value})} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={editForm.phone || ''} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} />
            </div>
            <div>
              <Label>Chave PIX</Label>
              <Input value={editForm.pix_key || ''} onChange={(e) => setEditForm({...editForm, pix_key: e.target.value})} />
            </div>
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                checked={editForm.is_admin || false} 
                onChange={(e) => setEditForm({...editForm, is_admin: e.target.checked})}
              />
              <Label>Administrador</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                checked={editForm.lapen_approved || false} 
                onChange={(e) => setEditForm({...editForm, lapen_approved: e.target.checked})}
              />
              <Label>Membro LAPEN Aprovado</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nova Senha</Label>
              <Input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialog(false)}>Cancelar</Button>
            <Button onClick={handleSavePassword}>Alterar Senha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Usuário</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja excluir este usuário?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminUsers

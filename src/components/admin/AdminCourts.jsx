import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, MapPin } from 'lucide-react'
import { useToast } from '@/components/hooks/use-toast'
import PasswordConfirmDialog from './PasswordConfirmDialog'

const AdminCourts = () => {
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCourt, setEditingCourt] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    description: '',
    active: true,
    image: null
  })
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchCourts()
  }, [])

  const fetchCourts = async () => {
    try {
      const response = await fetch('/api/admin/courts', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setCourts(data)
      }
    } catch (error) {
      console.error('Error fetching courts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setPendingAction(() => submitForm)
    setShowPasswordDialog(true)
  }

  const submitForm = async () => {
    try {
      const url = editingCourt 
        ? `/api/admin/courts/${editingCourt.id}`
        : '/api/admin/courts'
      
      const method = editingCourt ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "Sucesso",
          description: data.message
        })
        fetchCourts()
        resetForm()
        setIsDialogOpen(false)
      } else {
        toast({
          title: "Erro",
          description: data.message || "Erro ao salvar quadra",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao conectar com o servidor",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async (court) => {
    setPendingAction(() => () => deleteCourt(court.id))
    setShowPasswordDialog(true)
  }

  const deleteCourt = async (courtId) => {
    try {
      const response = await fetch(`/api/admin/courts/${courtId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "Sucesso",
          description: data.message
        })
        fetchCourts()
      } else {
        toast({
          title: "Erro",
          description: data.message || "Erro ao excluir quadra",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao conectar com o servidor",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: '',
      description: '',
      active: true,
      image: null
    })
    setEditingCourt(null)
  }

  const handleEdit = (court) => {
    setEditingCourt(court)
    setFormData({
      name: court.name,
      type: court.type,
      description: court.description || '',
      active: court.active,
      image: null
    })
    setIsDialogOpen(true)
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setFormData(prev => ({ ...prev, image: e.target.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Carregando quadras...</div>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Gerenciar Quadras
          </h1>
          <p className="text-gray-600">
            Adicione, edite ou remova quadras do sistema
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Quadra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCourt ? 'Editar Quadra' : 'Nova Quadra'}
              </DialogTitle>
              <DialogDescription>
                {editingCourt ? 'Edite as informações da quadra' : 'Adicione uma nova quadra ao sistema'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Quadra</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Quadra Central"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="type">Tipo</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Saibro">Saibro</SelectItem>
                    <SelectItem value="Rápida">Rápida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detalhes adicionais sobre a quadra"
                />
              </div>
              
              <div>
                <Label htmlFor="image">Imagem da Quadra</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                />
                <Label htmlFor="active">Quadra ativa</Label>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingCourt ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courts.map((court) => (
          <Card key={court.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-5 w-5 mr-2 text-green-600" />
                    {court.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    <Badge variant={court.type === 'Saibro' ? 'default' : 'secondary'}>
                      {court.type}
                    </Badge>
                    <Badge variant={court.active ? 'default' : 'destructive'} className="ml-2">
                      {court.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </CardDescription>
                </div>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(court)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(court)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {court.description && (
              <CardContent>
                <p className="text-gray-600 text-sm">{court.description}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <PasswordConfirmDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onConfirm={pendingAction}
        title="Confirmar Ação"
        description="Digite a senha administrativa para confirmar esta ação."
      />
    </div>
  )
}

export default AdminCourts


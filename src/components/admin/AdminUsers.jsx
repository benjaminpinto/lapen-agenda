import {useEffect, useRef, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {useToast} from '@/contexts/ToastContext'
import {ArrowLeft, Download, Edit, FileText, Key, Printer, Trash2} from 'lucide-react'
import {fetchWithAuth} from "../../utils/fetchWithAuth.js";

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'yes', label: 'Sim' },
  { value: 'no', label: 'Não' },
]

const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return ''
  const at = email.indexOf('@')
  if (at < 0) return email
  const local = email.slice(0, at)
  const domain = email.slice(at)
  if (local.length <= 2) return `${local[0] || ''}*${domain}`
  return `${local[0]}${'*'.repeat(Math.max(local.length - 2, 3))}${local[local.length - 1]}${domain}`
}

const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const matchTri = (filter, value) => {
  if (filter === 'all') return true
  if (filter === 'yes') return !!value
  return !value
}

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
  const [reportDialog, setReportDialog] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportUsers, setReportUsers] = useState([])
  const [downloading, setDownloading] = useState(false)
  const [filters, setFilters] = useState({
    lapen_approved: 'all',
    is_admin: 'all',
    is_active: 'yes',
  })
  const reportRef = useRef(null)
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

  const openReport = async () => {
    setReportDialog(true)
    setReportLoading(true)
    try {
      const response = await fetchWithAuth('/api/admin/users?include_inactive=1')
      if (response.ok) {
        const data = await response.json()
        setReportUsers(data)
      } else {
        toast({ title: 'Erro ao carregar dados do relatório', variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Erro ao carregar dados do relatório', variant: 'destructive' })
    } finally {
      setReportLoading(false)
    }
  }

  const filteredReportUsers = reportUsers.filter(u =>
    matchTri(filters.lapen_approved, u.lapen_approved) &&
    matchTri(filters.is_admin, u.is_admin) &&
    matchTri(filters.is_active, u.is_active)
  )

  const handlePrint = () => {
    const filterLabel = (k) => FILTER_OPTIONS.find(o => o.value === filters[k])?.label
    const rowsHtml = filteredReportUsers.length === 0
      ? `<tr><td colspan="4" style="padding:24px;text-align:center;color:#888;">Nenhum usuário corresponde aos filtros selecionados.</td></tr>`
      : filteredReportUsers.map((u, i) => `
          <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f6f3ec'};border-bottom:1px solid #e5e0d2;">
            <td style="padding:8px 12px;color:#c5a059;font-weight:700;">${String(i + 1).padStart(2, '0')}</td>
            <td style="padding:8px 12px;">${escapeHtml(u.name || '')}</td>
            <td style="padding:8px 12px;">${escapeHtml(u.short_name || '—')}</td>
            <td style="padding:8px 12px;font-family:monospace;">${escapeHtml(maskEmail(u.email))}</td>
          </tr>
        `).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Usuários — LAPEN</title>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Merriweather',Georgia,serif;color:#2c3e50;background:#fff;padding:16mm;}
  header{border-bottom:2px solid #1a3c34;padding-bottom:16px;margin-bottom:20px;display:flex;align-items:center;gap:18px;}
  header img{width:72px;height:auto;}
  h1{font-family:'Lato',sans-serif;font-weight:900;text-transform:uppercase;color:#1a3c34;font-size:1.5rem;letter-spacing:1px;}
  h2{font-family:'Lato',sans-serif;font-size:.85rem;color:#666;font-weight:400;text-transform:uppercase;}
  .meta{text-align:right;font-family:'Lato',sans-serif;font-size:.75rem;color:#666;}
  .meta .label{text-transform:uppercase;letter-spacing:1px;}
  .meta .value{color:#1a3c34;font-weight:700;}
  .filters{background:#f8f9fa;border-left:4px solid #c5a059;padding:12px 16px;margin-bottom:22px;font-size:.9rem;font-style:italic;color:#444;}
  .filters strong{font-family:'Lato',sans-serif;color:#1a3c34;text-transform:uppercase;font-style:normal;display:block;margin-bottom:4px;font-size:.78rem;letter-spacing:1px;}
  table{width:100%;border-collapse:collapse;font-family:'Lato',sans-serif;font-size:.88rem;}
  thead tr{background:#1a3c34;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  th{text-align:left;padding:10px 12px;color:#fff;}
  .footer{margin-top:24px;padding-top:12px;border-top:1px solid #c5a059;font-family:'Lato',sans-serif;font-size:.72rem;color:#888;text-align:center;text-transform:uppercase;letter-spacing:1px;}
  .actions{position:fixed;top:12px;right:12px;display:flex;gap:8px;}
  .actions button{background:#1a3c34;color:#fff;border:0;padding:10px 16px;font-family:'Lato',sans-serif;font-weight:700;border-radius:4px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;font-size:.75rem;}
  .actions button.alt{background:#fff;color:#1a3c34;border:1px solid #1a3c34;}
  @page{size:A4;margin:12mm;}
  @media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;} .actions{display:none !important;}}
</style>
</head>
<body>
  <div class="actions">
    <button class="alt" onclick="window.close()">Fechar</button>
    <button onclick="window.print()">Imprimir / PDF</button>
  </div>
  <header>
    <img src="${window.location.origin}/lapen-logo.png" alt="Brasão LAPEN">
    <div style="flex:1;">
      <h1>Relatório de Usuários</h1>
      <h2>LAPEN — Liga Penedense de Tênis</h2>
    </div>
    <div class="meta">
      <div class="label">Emitido em</div>
      <div class="value">${escapeHtml(generatedAt)}</div>
    </div>
  </header>
  <div class="filters">
    <strong>Filtros Aplicados</strong>
    Membro LAPEN: <b>${escapeHtml(filterLabel('lapen_approved'))}</b> ·
    Administrador: <b>${escapeHtml(filterLabel('is_admin'))}</b> ·
    Ativo: <b>${escapeHtml(filterLabel('is_active'))}</b>
    — Total: <b>${filteredReportUsers.length}</b> usuário(s)
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:40px;">#</th>
        <th>Nome</th>
        <th>Nome Curto</th>
        <th>Email</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">Documento confidencial · Emails parcialmente mascarados para proteção dos dados</div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (!win) {
      URL.revokeObjectURL(url)
      toast({ title: 'Permita pop-ups para imprimir o relatório', variant: 'destructive' })
      return
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const handleDownloadPng = async () => {
    if (!reportRef.current) return
    setDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      })
      const link = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      link.download = `relatorio-usuarios-lapen-${stamp}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      toast({ title: 'Erro ao gerar imagem', variant: 'destructive' })
    } finally {
      setDownloading(false)
    }
  }

  const generatedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  if (loading) return <div>Carregando...</div>

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar ao Dashboard
      </Button>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle>Gerenciar Usuários</CardTitle>
          <Button onClick={openReport} className="bg-[#1a3c34] hover:bg-[#142f29] text-white">
            <FileText className="h-4 w-4 mr-2" />
            Gerar Relatório
          </Button>
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

      {/* Report Dialog */}
      <Dialog open={reportDialog} onOpenChange={setReportDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle>Relatório de Usuários</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
            <div>
              <Label className="text-xs uppercase tracking-wide text-gray-600">Membro LAPEN</Label>
              <Select value={filters.lapen_approved} onValueChange={(v) => setFilters({...filters, lapen_approved: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-gray-600">Administrador</Label>
              <Select value={filters.is_admin} onValueChange={(v) => setFilters({...filters, is_admin: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-gray-600">Ativo</Label>
              <Select value={filters.is_active} onValueChange={(v) => setFilters({...filters, is_active: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {reportLoading ? (
            <div className="py-12 text-center text-gray-500">Carregando dados...</div>
          ) : (
            <div
              id="lapen-report"
              ref={reportRef}
              className="bg-white border border-gray-200 shadow-sm"
              style={{ fontFamily: "'Merriweather', Georgia, serif", color: '#2c3e50' }}
            >
              <div style={{ padding: '32px 36px' }}>
                <header
                  style={{
                    borderBottom: '2px solid #1a3c34',
                    paddingBottom: 16,
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                  }}
                >
                  <img
                    src="/lapen-logo.png"
                    alt="Brasão LAPEN"
                    style={{ width: 72, height: 'auto' }}
                    crossOrigin="anonymous"
                  />
                  <div style={{ flex: 1 }}>
                    <h1
                      style={{
                        fontFamily: "'Lato', sans-serif",
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        color: '#1a3c34',
                        fontSize: '1.5rem',
                        letterSpacing: 1,
                        margin: 0,
                      }}
                    >
                      Relatório de Usuários
                    </h1>
                    <h2
                      style={{
                        fontFamily: "'Lato', sans-serif",
                        fontSize: '0.85rem',
                        color: '#666',
                        fontWeight: 400,
                        textTransform: 'uppercase',
                        margin: 0,
                      }}
                    >
                      LAPEN — Liga Penedense de Tênis
                    </h2>
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      fontFamily: "'Lato', sans-serif",
                      fontSize: '0.75rem',
                      color: '#666',
                    }}
                  >
                    <div style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Emitido em</div>
                    <div style={{ color: '#1a3c34', fontWeight: 700 }}>{generatedAt}</div>
                  </div>
                </header>

                <div
                  style={{
                    background: '#f8f9fa',
                    borderLeft: '4px solid #c5a059',
                    padding: '12px 16px',
                    marginBottom: 22,
                    fontSize: '0.9rem',
                    fontStyle: 'italic',
                    color: '#444',
                  }}
                >
                  <strong
                    style={{
                      fontFamily: "'Lato', sans-serif",
                      color: '#1a3c34',
                      textTransform: 'uppercase',
                      fontStyle: 'normal',
                      display: 'block',
                      marginBottom: 4,
                      fontSize: '0.78rem',
                      letterSpacing: 1,
                    }}
                  >
                    Filtros Aplicados
                  </strong>
                  Membro LAPEN: <b>{FILTER_OPTIONS.find(o => o.value === filters.lapen_approved)?.label}</b> ·
                  {' '}Administrador: <b>{FILTER_OPTIONS.find(o => o.value === filters.is_admin)?.label}</b> ·
                  {' '}Ativo: <b>{FILTER_OPTIONS.find(o => o.value === filters.is_active)?.label}</b>
                  {' '}— Total: <b>{filteredReportUsers.length}</b> usuário(s)
                </div>

                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontFamily: "'Lato', sans-serif",
                    fontSize: '0.88rem',
                  }}
                >
                  <thead>
                    <tr style={{ background: '#1a3c34', color: '#fff' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', width: 40 }}>#</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Nome</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Nome Curto</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReportUsers.map((u, i) => (
                      <tr
                        key={u.id}
                        style={{
                          background: i % 2 === 0 ? '#ffffff' : '#f6f3ec',
                          borderBottom: '1px solid #e5e0d2',
                        }}
                      >
                        <td style={{ padding: '8px 12px', color: '#c5a059', fontWeight: 700 }}>
                          {String(i + 1).padStart(2, '0')}
                        </td>
                        <td style={{ padding: '8px 12px' }}>{u.name}</td>
                        <td style={{ padding: '8px 12px' }}>{u.short_name || '—'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                          {maskEmail(u.email)}
                        </td>
                      </tr>
                    ))}
                    {filteredReportUsers.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#888' }}>
                          Nenhum usuário corresponde aos filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div
                  style={{
                    marginTop: 24,
                    paddingTop: 12,
                    borderTop: '1px solid #c5a059',
                    fontFamily: "'Lato', sans-serif",
                    fontSize: '0.72rem',
                    color: '#888',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Documento confidencial · Emails parcialmente mascarados para proteção dos dados
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="no-print">
            <Button variant="outline" onClick={() => setReportDialog(false)}>Fechar</Button>
            <Button variant="outline" onClick={handleDownloadPng} disabled={downloading || reportLoading}>
              <Download className="h-4 w-4 mr-2" />
              {downloading ? 'Gerando...' : 'Baixar PNG'}
            </Button>
            <Button onClick={handlePrint} disabled={reportLoading} className="bg-[#1a3c34] hover:bg-[#142f29] text-white">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminUsers

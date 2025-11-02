import {useEffect, useState} from 'react'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {useToast} from '@/contexts/ToastContext'
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {CheckCircle, Clock, Users, XCircle, ArrowLeft} from 'lucide-react'
import {Link} from 'react-router-dom'

const LapenApprovals = () => {
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('pending')
    const [rejectingUser, setRejectingUser] = useState(null)
    const {toast} = useToast()

    useEffect(() => {
        fetchRequests()
    }, [filter])

    const fetchRequests = async () => {
        setLoading(true)
        try {
            const response = await fetch(`/api/admin/lapen-requests?status=${filter}`)
            if (response.ok) {
                const data = await response.json()
                setRequests(data)
            }
        } catch (error) {
            console.error('Error fetching requests:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (userId) => {
        try {
            const response = await fetch(`/api/admin/lapen-approve/${userId}`, {
                method: 'POST'
            })

            if (response.ok) {
                toast({
                    title: "Aprovado!",
                    description: "Membro LAPEN aprovado com sucesso"
                })
                fetchRequests()
            } else {
                const data = await response.json()
                toast({
                    title: "Erro",
                    description: data.message || "Erro ao aprovar membro",
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

    const handleReject = async () => {
        if (!rejectingUser) return

        try {
            const response = await fetch(`/api/admin/lapen-reject/${rejectingUser.id}`, {
                method: 'POST'
            })

            if (response.ok) {
                toast({
                    title: "Rejeitado",
                    description: "Solicitação rejeitada"
                })
                setRejectingUser(null)
                fetchRequests()
            } else {
                const data = await response.json()
                toast({
                    title: "Erro",
                    description: data.message || "Erro ao rejeitar solicitação",
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

    const formatDate = (dateString) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="space-y-6">
            <Link to="/admin/dashboard">
                <Button variant="outline" size="sm" className="mb-4">
                    <ArrowLeft className="h-4 w-4 mr-2"/>
                    Voltar ao Dashboard
                </Button>
            </Link>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Users className="h-6 w-6 mr-2 text-green-600"/>
                        Aprovações de Membros LAPEN
                    </CardTitle>
                    <CardDescription>
                        Gerencie as solicitações de membros LAPEN
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Filter Tabs */}
                    <div className="flex gap-2 mb-6 flex-wrap">
                        <Button
                            variant={filter === 'pending' ? 'default' : 'outline'}
                            onClick={() => setFilter('pending')}
                            size="sm"
                        >
                            <Clock className="h-4 w-4 mr-2"/>
                            Pendentes
                        </Button>
                        <Button
                            variant={filter === 'approved' ? 'default' : 'outline'}
                            onClick={() => setFilter('approved')}
                            size="sm"
                        >
                            <CheckCircle className="h-4 w-4 mr-2"/>
                            Aprovados
                        </Button>
                        <Button
                            variant={filter === 'rejected' ? 'default' : 'outline'}
                            onClick={() => setFilter('rejected')}
                            size="sm"
                        >
                            <XCircle className="h-4 w-4 mr-2"/>
                            Rejeitados
                        </Button>
                    </div>

                    {/* Requests List */}
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Carregando...</div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            Nenhuma solicitação encontrada
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Desktop View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Nome</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Telefone</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Solicitado
                                            em
                                        </th>
                                        {filter === 'approved' && (
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Aprovado
                                                em</th>
                                        )}
                                        {filter === 'rejected' && (
                                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Rejeitado
                                                em</th>
                                        )}
                                        {filter === 'pending' && (
                                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Ações</th>
                                        )}
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                    {requests.map((request) => (
                                        <tr key={request.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm">{request.name}</td>
                                            <td className="px-4 py-3 text-sm">{request.email}</td>
                                            <td className="px-4 py-3 text-sm">{request.phone || '-'}</td>
                                            <td className="px-4 py-3 text-sm">{formatDate(request.lapen_requested_at)}</td>
                                            {filter === 'approved' && (
                                                <td className="px-4 py-3 text-sm">{formatDate(request.lapen_approved_at)}</td>
                                            )}
                                            {filter === 'rejected' && (
                                                <td className="px-4 py-3 text-sm">{formatDate(request.lapen_approved_at)}</td>
                                            )}
                                            {filter === 'pending' && (
                                                <td className="px-4 py-3 text-sm text-right space-x-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-green-600 hover:text-green-700"
                                                        onClick={() => handleApprove(request.id)}
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-1"/>
                                                        Aprovar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-red-600 hover:text-red-700"
                                                        onClick={() => setRejectingUser(request)}
                                                    >
                                                        <XCircle className="h-4 w-4 mr-1"/>
                                                        Rejeitar
                                                    </Button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View */}
                            <div className="md:hidden space-y-4">
                                {requests.map((request) => (
                                    <Card key={request.id}>
                                        <CardContent className="pt-6">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-medium">{request.name}</p>
                                                        <p className="text-sm text-gray-600">{request.email}</p>
                                                        {request.phone && (
                                                            <p className="text-sm text-gray-600">{request.phone}</p>
                                                        )}
                                                    </div>

                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    <p>Solicitado: {formatDate(request.lapen_requested_at)}</p>
                                                    {filter === 'approved' && request.lapen_approved_at && (
                                                        <p>Aprovado: {formatDate(request.lapen_approved_at)}</p>
                                                    )}
                                                    {filter === 'rejected' && request.lapen_approved_at && (
                                                        <p>Rejeitado: {formatDate(request.lapen_approved_at)}</p>
                                                    )}
                                                </div>
                                                {filter === 'pending' && (
                                                    <div className="flex gap-2 pt-2">
                                                        <Button
                                                            size="sm"
                                                            className="flex-1"
                                                            onClick={() => handleApprove(request.id)}
                                                        >
                                                            <CheckCircle className="h-4 w-4 mr-1"/>
                                                            Aprovar
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="flex-1 text-red-600"
                                                            onClick={() => setRejectingUser(request)}
                                                        >
                                                            <XCircle className="h-4 w-4 mr-1"/>
                                                            Rejeitar
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Reject Confirmation Dialog */}
            <AlertDialog open={!!rejectingUser} onOpenChange={(open) => !open && setRejectingUser(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rejeitar Solicitação</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja rejeitar a solicitação de {rejectingUser?.name}?
                            Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <Button onClick={handleReject} className="bg-red-600 hover:bg-red-700">
                            Rejeitar
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export default LapenApprovals

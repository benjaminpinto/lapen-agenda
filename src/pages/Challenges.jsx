import React, {useEffect, useState} from 'react';
import {History, Plus, Swords, Trophy} from 'lucide-react';
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import {fetchWithAuth} from '@/utils/fetchWithAuth';

import ChallengeCard from '@/components/challenges/ChallengeCard';
import {useAuth} from '@/contexts/AuthContext';
import {toast} from "sonner";

const Challenges = () => {
    const { user } = useAuth();
    const [challenges, setChallenges] = useState({ active: [], pending_received: [], pending_sent: [], history: [] });
    const [loading, setLoading] = useState(true);
    const [players, setPlayers] = useState([]);
    const [activeTab, setActiveTab] = useState('active');

    // Form State
    const [formData, setFormData] = useState({
        challenged_id: '',
        start_date: '',
        end_date: '',
        target_type: 'victories',
        target_amount: '',
        prize_comment: ''
    });

    const fetchChallenges = async () => {
        try {
            console.log('Token in localStorage:', localStorage.getItem('token') ? 'EXISTS' : 'MISSING');
            const response = await fetchWithAuth('/api/challenges/');
            if (response.ok) {
                const data = await response.json();
                setChallenges(data);
            }
        } catch (error) {
            console.error('Error fetching challenges', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlayers = async () => {
        if (!user) return;
        
        try {
            const response = await fetchWithAuth('/api/challenges/users');
            if (response.ok) {
                const data = await response.json();
                setPlayers(data || []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchChallenges();
    }, []);
    
    useEffect(() => {
        if (user) {
            fetchPlayers();
        }
    }, [user]);

    const handleCreate = async (e) => {
        e.preventDefault();

        if (!formData.challenged_id || !formData.start_date || !formData.end_date) {
            toast.error("Preencha os campos obrigatórios");
            return;
        }

        try {
            const response = await fetchWithAuth('/api/challenges/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                toast.success("Desafio enviado com sucesso!");
                setFormData({
                    challenged_id: '',
                    start_date: '',
                    end_date: '',
                    target_type: 'victories',
                    target_amount: '',
                    prize_comment: ''
                });
                await fetchChallenges();
                setActiveTab('pending');
            } else {
                const err = await response.json();
                toast.error(err.error || "Erro ao criar desafio");
            }
        } catch (error) {
            toast.error("Erro de conexão");
        }
    };

    return (
        <div className="container mx-auto max-w-4xl p-4 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-3">
                        <Swords className="w-8 h-8 text-orange-600" />
                        Desafios
                    </h1>
                    <p className="text-muted-foreground mt-1">Crie disputas, monitore o progresso e vença!</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="w-full grid grid-cols-4 gap-1 p-1">
                    <TabsTrigger value="active" className="text-[10px] sm:text-sm px-1 sm:px-3">Ativos</TabsTrigger>
                    <TabsTrigger value="pending" className="text-[10px] sm:text-sm px-1 sm:px-3">Pendentes ({challenges.pending_received.length + challenges.pending_sent.length})</TabsTrigger>
                    <TabsTrigger value="history" className="text-[10px] sm:text-sm px-1 sm:px-3">Histórico</TabsTrigger>
                    <TabsTrigger value="new" className="px-2 sm:px-3">
                        <Plus className="w-4 h-4" />
                    </TabsTrigger>
                </TabsList>

                {/* ACTIVE TAB */}
                <TabsContent value="active" className="space-y-4">
                    {challenges.active.length === 0 ? (
                        <div className="text-center py-12 rounded-xl border border-dashed">
                            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">Nenhum desafio ativo no momento.</p>
                        </div>
                    ) : (
                        challenges.active.map(c => (
                            <ChallengeCard key={c.id} challenge={c} onUpdate={fetchChallenges} />
                        ))
                    )}
                </TabsContent>

                {/* PENDING TAB */}
                <TabsContent value="pending" className="space-y-6">
                    {challenges.pending_received.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">Recebidos (Você foi desafiado!)</h3>
                            <div className="space-y-4">
                                {challenges.pending_received.map(c => (
                                    <ChallengeCard key={c.id} challenge={c} onUpdate={fetchChallenges} />
                                ))}
                            </div>
                        </div>
                    )}

                    {challenges.pending_sent.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">Enviados (Aguardando resposta)</h3>
                            <div className="space-y-4">
                                {challenges.pending_sent.map(c => (
                                    <ChallengeCard key={c.id} challenge={c} onUpdate={fetchChallenges} />
                                ))}
                            </div>
                        </div>
                    )}

                    {challenges.pending_received.length === 0 && challenges.pending_sent.length === 0 && (
                        <div className="text-center py-12 rounded-xl border border-dashed">
                            <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">Nenhum desafio pendente.</p>
                        </div>
                    )}
                </TabsContent>

                {/* HISTORY TAB */}
                <TabsContent value="history" className="space-y-4">
                    {challenges.history.map(c => (
                        <ChallengeCard key={c.id} challenge={c} onUpdate={fetchChallenges} />
                    ))}
                    {challenges.history.length === 0 && (
                        <p className="text-center text-muted-foreground py-10">Histórico vazio.</p>
                    )}
                </TabsContent>

                {/* NEW CHALLENGE TAB */}
                <TabsContent value="new">
                    {!user ? (
                        <Card>
                            <CardContent className="py-12">
                                <div className="text-center">
                                    <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">Faça login para criar desafios</h3>
                                    <p className="text-muted-foreground mb-6">Você precisa estar autenticado para desafiar outros jogadores.</p>
                                    <Button onClick={() => window.location.href = '/login'}>
                                        Fazer Login
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>Criar Novo Desafio</CardTitle>
                            <CardDescription>Escolha um oponente e defina as regras.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreate} className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Oponente</Label>
                                    <Select
                                        value={formData.challenged_id}
                                        onValueChange={(v) => setFormData({ ...formData, challenged_id: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um jogador...">
                                                {formData.challenged_id && players.find(p => String(p.id) === formData.challenged_id)
                                                    ? (players.find(p => String(p.id) === formData.challenged_id).short_name || 
                                                       players.find(p => String(p.id) === formData.challenged_id).name)
                                                    : 'Selecione um jogador...'}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {players
                                                .filter(p => p.id !== user?.id)
                                                .map(p => (
                                                    <SelectItem key={p.id} value={String(p.id)}>
                                                        {p.short_name || p.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Início</Label>
                                        <Input
                                            type="date"
                                            value={formData.start_date}
                                            onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fim</Label>
                                        <Input
                                            type="date"
                                            value={formData.end_date}
                                            onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Tipo de Disputa</Label>
                                        <Select
                                            value={formData.target_type}
                                            onValueChange={(v) => setFormData({ ...formData, target_type: v })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue>
                                                    {formData.target_type === 'victories' ? 'Quem vence mais (Vitórias)' :
                                                     formData.target_type === 'sets' ? 'Quem vence mais (Sets)' : 'Saldo de Games'}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="victories">Quem vence mais (Vitórias)</SelectItem>
                                                <SelectItem value="sets">Quem vence mais (Sets)</SelectItem>
                                                <SelectItem value="balance">Saldo de Games</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Alvo (Opcional)</Label>
                                        <Input
                                            type="number"
                                            placeholder="Ex: 10"
                                            value={formData.target_amount}
                                            onChange={e => setFormData({ ...formData, target_amount: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>O que está em jogo? (Prêmio / Aposta)</Label>
                                    <Textarea
                                        placeholder="Ex: Uma caixa de bolas, Jantar, R$ 50,00..."
                                        value={formData.prize_comment}
                                        onChange={e => setFormData({ ...formData, prize_comment: e.target.value })}
                                    />
                                </div>

                                <Button type="submit" className="w-full font-bold py-6">
                                    Lançar Desafio!
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default Challenges;

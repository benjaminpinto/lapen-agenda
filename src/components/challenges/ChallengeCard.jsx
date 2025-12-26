import React, { useState } from 'react';
import { Calendar, Gift, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ChallengeProgress from './ChallengeProgress';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from '@/contexts/AuthContext';

const ChallengeCard = ({ challenge, onUpdate }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    // Helper to check if current user is the challenged one
    const isChallenged = user?.id === challenge.challenged_id;

    const handleAction = async (action) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/challenges/${challenge.id}/${action}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                toast.success(`Desafio ${action === 'accept' ? 'aceito' : 'rejeitado'}!`);
                if (onUpdate) onUpdate();
            } else {
                const err = await response.json();
                toast.error(err.error || 'Erro ao processar ação');
            }
        } catch (error) {
            toast.error('Erro de conexão');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        try {
            return format(new Date(dateStr), "d 'de' MMM", { locale: ptBR });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="rounded-xl border overflow-hidden hover:border-orange-300 transition-colors">

            {/* Header */}
            <div className="p-4 flex items-center justify-between border-b bg-orange-50">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}</span>
                </div>
                <div className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide
            ${challenge.status === 'active' ? 'bg-green-100 text-green-700 border border-green-300' :
                        challenge.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                            'bg-gray-100 text-gray-600'}`}>
                    {challenge.status === 'active' ? 'Em Progresso' :
                        challenge.status === 'pending' ? 'Aguardando' :
                            challenge.status}
                </div>
            </div>

            <div className="p-5 bg-white">
                {/* Title / Players */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="font-bold text-lg">{challenge.challenger_short_name || challenge.challenger_name}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">Desafiante</p>
                        </div>
                        <div className="text-xl font-black text-orange-600 italic">VS</div>
                        <div className="text-left">
                            <p className="font-bold text-lg">{challenge.challenged_short_name || challenge.challenged_name}</p>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">Desafiado</p>
                        </div>
                    </div>

                    <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase font-medium">Modalidade</p>
                        <p className="text-orange-600 font-bold capitalize">
                            {challenge.target_type === 'victories' ? 'Vitórias' :
                                challenge.target_type === 'balance' ? 'Saldo Games' : 'Sets'}
                        </p>
                    </div>
                </div>

                {/* Prize */}
                {challenge.prize_comment && (
                    <div className="mb-6 flex items-start gap-3 bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <Gift className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs text-amber-700 font-bold uppercase mb-0.5">Aposta / Prêmio</p>
                            <p className="text-gray-700 text-sm italic">"{challenge.prize_comment}"</p>
                        </div>
                    </div>
                )}

                {/* Progress (if active) */}
                {challenge.status === 'active' && (
                    <div className="mt-4">
                        <ChallengeProgress challenge={challenge} />
                    </div>
                )}

                {/* Updated pending action UI */}
                {challenge.status === 'pending' && isChallenged && (
                    <div className="mt-4 flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => handleAction('reject')}
                            disabled={loading}
                        >
                            Recusar
                        </Button>
                        <Button
                            onClick={() => handleAction('accept')}
                            disabled={loading}
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Aceitar Desafio
                        </Button>
                    </div>
                )}

                {challenge.status === 'pending' && !isChallenged && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>Aguardando resposta do oponente...</span>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ChallengeCard;

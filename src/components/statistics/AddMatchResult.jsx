import {useEffect, useState} from 'react'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {useToast} from '@/contexts/ToastContext'
import {useAuth} from '@/contexts/AuthContext'
import BackButton from '@/components/ui/BackButton'
import MatchResultForm from '@/components/shared/MatchResultForm'
import WOForm from '@/components/admin/WOForm'
import {Calendar, Clock} from 'lucide-react'
import {fetchWithAuth} from '@/utils/fetchWithAuth'

export default function AddMatchResult() {
    const [pastMatches, setPastMatches] = useState([])
    const [userMatches, setUserMatches] = useState([])
    const [otherMatches, setOtherMatches] = useState([])
    const [selectedMatch, setSelectedMatch] = useState(null)
    const [showWOForm, setShowWOForm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [hideOlderMatches, setHideOlderMatches] = useState(true)
    const {toast} = useToast()
    const {user} = useAuth()

    useEffect(() => {
        fetchPastMatches()
    }, [])

    const fetchPastMatches = async () => {
        try {
            const response = await fetchWithAuth('/api/statistics/past-matches')
            const data = await response.json()
            const matches = data.matches || []

            if (user?.short_name || user?.name) {
                const userName = user.short_name || user.name
                const myMatches = matches.filter(m =>
                    m.player1_name === userName || m.player2_name === userName
                )
                const others = matches.filter(m =>
                    m.player1_name !== userName && m.player2_name !== userName
                )
                setUserMatches(myMatches)
                setOtherMatches(others)
            } else {
                setOtherMatches(matches)
            }

            setPastMatches(matches)
        } catch (error) {
            console.error('Error fetching past matches:', error)
        }
    }

    const selectMatch = (match) => {
        setSelectedMatch(match)
    }

    const handleWOSubmit = async ({winner_id, comment}) => {
        setLoading(true)
        try {
            const response = await fetchWithAuth(`/api/ranking/matches/${selectedMatch.ranking_match_id}/wo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    winner_id: winner_id,
                    comment: comment
                })
            })

            if (response.ok) {
                setSelectedMatch(null)
                setShowWOForm(false)
                fetchPastMatches()
                toast({
                    title: 'Sucesso!',
                    description: 'W.O. registrado com sucesso',
                })
            } else {
                const error = await response.json()
                toast({title: error.error || 'Erro ao registrar W.O.', variant: 'destructive'})
            }
        } catch (error) {
            toast({title: 'Erro ao registrar W.O.', variant: 'destructive'})
        } finally {
            setLoading(false)
        }
    }

    const handleFormSubmit = async ({score, winner_name}) => {
        const scoreParts = score.split(', ').map(s => s.split('-').map(Number))
        let player1Sets = 0, player2Sets = 0, player1Games = 0, player2Games = 0

        scoreParts.forEach(([g1, g2]) => {
            player1Games += g1
            player2Games += g2
            if (g1 > g2) player1Sets++
            else if (g2 > g1) player2Sets++
        })

        setLoading(true)
        try {
            const response = await fetchWithAuth('/api/statistics/match-result', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    schedule_id: selectedMatch.match_type === 'Ranking' ? null : selectedMatch.id,
                    ranking_match_id: selectedMatch.match_type === 'Ranking' ? selectedMatch.id : null,
                    winner_name: winner_name,
                    player1_sets: player1Sets,
                    player2_sets: player2Sets,
                    player1_games: player1Games,
                    player2_games: player2Games,
                    score: score
                })
            })

            if (response.ok) {
                setSelectedMatch(null)
                fetchPastMatches()
                toast({
                    title: 'Sucesso!',
                    description: 'Resultado adicionado com sucesso',
                })
            } else {
                const error = await response.json()
                toast({title: error.error || 'Erro ao adicionar resultado', variant: 'destructive'})
            }
        } catch (error) {
            toast({title: 'Erro ao adicionar resultado', variant: 'destructive'})
        } finally {
            setLoading(false)
        }
    }

    const filterMatchesByDate = (matches) => {
        if (!hideOlderMatches) return matches
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return matches.filter(match => new Date(match.date) >= thirtyDaysAgo)
    }

    const filteredUserMatches = filterMatchesByDate(userMatches)
    const filteredOtherMatches = filterMatchesByDate(otherMatches)

    return (
        <div className="space-y-6" data-testid="add-match-result-page">
            <BackButton to="/statistics" label="Voltar para Estatísticas"/>
            <h1 className="text-3xl font-bold">Adicionar Resultado</h1>

            {!selectedMatch ? (
                <>
                    {filteredUserMatches.length > 0 && (
                        <Card data-testid="user-matches-card">
                            <CardHeader>
                                <CardTitle>Minhas Partidas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {filteredUserMatches.map(match => (
                                        <div
                                            key={match.id}
                                            onClick={() => selectMatch(match)}
                                            className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
                                            data-testid={`match-${match.id}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium">
                                                        {match.player1_name} vs {match.player2_name}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground mt-1">
                                                        {match.match_type}
                                                    </div>
                                                </div>
                                                <div className="text-right text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3"/>
                                                        {new Date(match.date).toLocaleDateString('pt-BR')}
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Clock className="h-3 w-3"/>
                                                        {match.start_time}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {filteredOtherMatches.length > 0 && (
                        <Card data-testid="other-matches-card">
                            <CardHeader>
                                <CardTitle>Outras Partidas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {filteredOtherMatches.map(match => (
                                        <div
                                            key={match.id}
                                            onClick={() => selectMatch(match)}
                                            className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
                                            data-testid={`match-${match.id}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium">
                                                        {match.player1_name} vs {match.player2_name}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground mt-1">
                                                        {match.match_type}
                                                    </div>
                                                </div>
                                                <div className="text-right text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3"/>
                                                        {new Date(match.date).toLocaleDateString('pt-BR')}
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Clock className="h-3 w-3"/>
                                                        {match.start_time}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {filteredUserMatches.length === 0 && filteredOtherMatches.length === 0 && pastMatches.length > 0 && (
                        <Card>
                            <CardContent className="text-center py-8 text-muted-foreground">
                                Nenhuma partida encontrada no período selecionado
                            </CardContent>
                        </Card>
                    )}

                    {pastMatches.length === 0 && (
                        <Card>
                            <CardContent className="text-center py-8 text-muted-foreground">
                                Nenhuma partida passada sem resultado
                            </CardContent>
                        </Card>
                    )}

                    {pastMatches.length > 0 && (
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="hide-older-matches"
                                        checked={hideOlderMatches}
                                        onCheckedChange={setHideOlderMatches}
                                    />
                                    <label
                                        htmlFor="hide-older-matches"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        Ocultar partidas com mais de 30 dias
                                    </label>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            ) : showWOForm ? (
                <Card data-testid="wo-form">
                    <CardHeader>
                        <CardTitle>Registrar W.O.</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                            <div className="font-medium">
                                {selectedMatch.player1_name} vs {selectedMatch.player2_name}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                                {new Date(selectedMatch.date).toLocaleDateString('pt-BR')} • {selectedMatch.start_time} • {selectedMatch.match_type}
                            </div>
                        </div>

                        <WOForm
                            match={selectedMatch}
                            onSubmit={handleWOSubmit}
                            onCancel={() => {
                                setShowWOForm(false)
                                setSelectedMatch(null)
                            }}
                        />
                    </CardContent>
                </Card>
            ) : (
                <Card data-testid="add-result-form">
                    <CardHeader>
                        <CardTitle>Registrar Resultado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                            <div className="font-medium">
                                {selectedMatch.player1_name} vs {selectedMatch.player2_name}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                                {new Date(selectedMatch.date).toLocaleDateString('pt-BR')} • {selectedMatch.start_time} • {selectedMatch.match_type}
                            </div>
                        </div>

                        <MatchResultForm
                            match={selectedMatch}
                            onSubmit={handleFormSubmit}
                            onCancel={() => setSelectedMatch(null)}
                        />
                        
                        {["Liga", "Ranking"].includes(selectedMatch.match_type) && (
                            <div className="mt-4">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setShowWOForm(true)}
                                    className="w-full"
                                >
                                    Registrar W.O.
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
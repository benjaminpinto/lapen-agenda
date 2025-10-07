import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Clock, Trophy, DollarSign } from 'lucide-react'

const Home = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-0">
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
          Bem-vindo ao Agenda LAPEN
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8">
          Sistema de gestão de reservas de quadras de tênis
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/schedule">
            <Button size="lg" className="w-full sm:w-auto">
              <Calendar className="h-5 w-5 mr-2" />
              Fazer Agendamento
            </Button>
          </Link>
          <Link to="/view">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Ver Agenda
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
        <Card>
          <CardHeader className="text-center">
            <Calendar className="h-12 w-12 text-green-600 mx-auto mb-2" />
            <CardTitle>Agendamento Fácil</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Agende suas partidas de forma rápida e intuitiva
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Clock className="h-12 w-12 text-blue-600 mx-auto mb-2" />
            <CardTitle>Horários Flexíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Disponível das 07:30 às 22:30 com slots de 1h30
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Trophy className="h-12 w-12 text-yellow-600 mx-auto mb-2" />
            <CardTitle>Liga e Amistosos</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Organize partidas de liga e jogos amistosos
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <DollarSign className="h-12 w-12 text-green-600 mx-auto mb-2" />
            <CardTitle>Apostas Esportivas</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Aposte nas partidas e acompanhe os resultados
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Como funciona?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <span className="text-green-600 font-bold">1</span>
              </div>
              <h3 className="font-semibold mb-2">Escolha a Quadra</h3>
              <p className="text-gray-600">Selecione entre quadras de saibro ou rápida</p>
            </div>
            
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <h3 className="font-semibold mb-2">Defina Data e Horário</h3>
              <p className="text-gray-600">Veja os horários disponíveis em tempo real</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold mb-2">Confirme o Agendamento</h3>
              <p className="text-gray-600">Adicione os jogadores e confirme</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Home


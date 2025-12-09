import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import Header from './components/Header'
import Home from './components/Home'
import AdminLogin from './components/admin/AdminLogin'
import AdminDashboard from './components/admin/AdminDashboard'
import AdminCourts from './components/admin/AdminCourts'
import AdminHolidays from './components/admin/AdminHolidays'
import AdminRecurring from './components/admin/AdminRecurring'
import AdminMatches from './components/admin/AdminMatches'
import MatchReport from './components/admin/MatchReport'
import AdminReports from './components/admin/AdminReports'
import LapenApprovals from './components/admin/LapenApprovals'
import AdminUsers from './components/admin/AdminUsers'
import AdminRanking from './components/admin/AdminRanking'
import SeasonConfig from './components/admin/SeasonConfig'
import SeasonParticipants from './components/admin/SeasonParticipants'
import SeasonRounds from './components/admin/SeasonRounds'
import ScheduleForm from './components/ScheduleForm'
import ScheduleView from './components/ScheduleView'
import SignUp from './components/auth/SignUp'
import Login from './components/auth/Login'
import SignUpSuccess from './components/auth/SignUpSuccess'
import EmailVerification from './components/auth/EmailVerification'
import ForgotPassword from './components/auth/ForgotPassword'
import ResetPassword from './components/auth/ResetPassword'
import BettingDashboard from './components/betting/BettingDashboard'
import MyBets from './components/betting/MyBets'
import Profile from './components/Profile'
import RankingLeaderboard from './components/ranking/RankingLeaderboard'
import MyMatches from './components/ranking/MyMatches'
import Statistics from './components/statistics/Statistics'
import AddMatchResult from './components/statistics/AddMatchResult'
import './App.css'

function App() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)

  return (
    <ToastProvider>
      <AuthProvider>
        <AuthWrapper>
          <Router isAdminAuthenticated={isAdminAuthenticated} setIsAdminAuthenticated={setIsAdminAuthenticated} />
        </AuthWrapper>
      </AuthProvider>
    </ToastProvider>
  )
}

function AuthWrapper({ children }) {
  return children
}

function Router({ isAdminAuthenticated, setIsAdminAuthenticated }) {
  const { isAuthenticated, loading } = useAuth()
  
  return (
    <BrowserRouter>
        <div className="min-h-screen bg-slate-50">
          <Header isAdminAuthenticated={isAdminAuthenticated} setIsAdminAuthenticated={setIsAdminAuthenticated} />
          <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/schedule" element={<ScheduleForm />} />
              <Route path="/view" element={<ScheduleView />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/signup-success" element={<SignUpSuccess />} />
              <Route path="/verify" element={<EmailVerification />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/betting" element={<BettingDashboard />} />
              <Route path="/my-bets" element={<MyBets />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/ranking" element={<RankingLeaderboard />} />
              <Route path="/ranking/my-matches" element={<MyMatches />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="/statistics/add-result" element={loading ? <div>Carregando...</div> : (isAuthenticated ? <AddMatchResult /> : <Navigate to="/login" />)} />
              <Route 
                path="/admin" 
                element={
                  isAdminAuthenticated ? 
                  <Navigate to="/admin/dashboard" /> : 
                  <AdminLogin setIsAdminAuthenticated={setIsAdminAuthenticated} />
                } 
              />
              <Route 
                path="/admin/dashboard" 
                element={
                  isAdminAuthenticated ? 
                  <AdminDashboard /> : 
                  <Navigate to="/admin" />
                } 
              />
              <Route 
                path="/admin/courts" 
                element={
                  isAdminAuthenticated ? 
                  <AdminCourts /> : 
                  <Navigate to="/admin" />
                } 
              />

              <Route 
                path="/admin/holidays" 
                element={
                  isAdminAuthenticated ? 
                  <AdminHolidays /> : 
                  <Navigate to="/admin" />
                } 
              />
              <Route 
                path="/admin/recurring" 
                element={
                  isAdminAuthenticated ? 
                  <AdminRecurring /> : 
                  <Navigate to="/admin" />
                } 
              />
              <Route 
                path="/admin/matches" 
                element={
                  isAdminAuthenticated ? 
                  <AdminMatches /> : 
                  <Navigate to="/admin" />
                } 
              />
              <Route 
                path="/admin/matches/:matchId/report" 
                element={
                  isAdminAuthenticated ? 
                  <MatchReport /> : 
                  <Navigate to="/admin" />
                } 
              />
              <Route 
                path="/admin/reports" 
                element={
                  isAdminAuthenticated ? 
                  <AdminReports /> : 
                  <Navigate to="/admin" />
                } 
              />
              <Route 
                path="/admin/lapen-approvals" 
                element={
                  isAdminAuthenticated ? 
                  <LapenApprovals /> : 
                  <Navigate to="/admin" />
                } 
              />
              <Route 
                path="/admin/users" 
                element={
                  isAdminAuthenticated ? 
                  <AdminUsers /> : 
                  <Navigate to="/admin" />
                } 
              />
              <Route 
                path="/admin/ranking" 
                element={
                  isAdminAuthenticated ? 
                  <AdminRanking /> : 
                  <Navigate to="/admin" />
                } 
              />
              <Route 
                path="/admin/ranking/config/:id" 
                element={
                  isAdminAuthenticated ? 
                  <SeasonConfig /> : 
                  <Navigate to="/admin" />
                } 
              />
              <Route 
                path="/admin/ranking/participants/:id" 
                element={
                  isAdminAuthenticated ? 
                  <SeasonParticipants /> : 
                  <Navigate to="/admin" />
                } 
              />
              <Route 
                path="/admin/ranking/rounds/:id" 
                element={
                  isAdminAuthenticated ? 
                  <SeasonRounds /> : 
                  <Navigate to="/admin" />
                } 
              />
            </Routes>
          </main>
        </div>
        <Toaster />
    </BrowserRouter>
  )
}

export default App


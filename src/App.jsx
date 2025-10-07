import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import Header from './components/Header'
import Home from './components/Home'
import AdminLogin from './components/admin/AdminLogin'
import AdminDashboard from './components/admin/AdminDashboard'
import AdminCourts from './components/admin/AdminCourts'
import AdminPlayers from './components/admin/AdminPlayers'
import AdminHolidays from './components/admin/AdminHolidays'
import AdminRecurring from './components/admin/AdminRecurring'
import ScheduleForm from './components/ScheduleForm'
import ScheduleView from './components/ScheduleView'
import SignUp from './components/auth/SignUp'
import Login from './components/auth/Login'
import SignUpSuccess from './components/auth/SignUpSuccess'
import EmailVerification from './components/auth/EmailVerification'
import BettingDashboard from './components/betting/BettingDashboard'
import MyBets from './components/betting/MyBets'
import './App.css'

function App() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)

  useEffect(() => {
    // Check if admin is already authenticated (session storage)
    const adminAuth = sessionStorage.getItem('admin_authenticated')
    if (adminAuth === 'true') {
      setIsAdminAuthenticated(true)
    }
  }, [])

  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
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
              <Route path="/betting" element={<BettingDashboard />} />
              <Route path="/my-bets" element={<MyBets />} />
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
                path="/admin/players" 
                element={
                  isAdminAuthenticated ? 
                  <AdminPlayers /> : 
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
            </Routes>
          </main>
        </div>
        <Toaster />
      </Router>
    </AuthProvider>
  </ToastProvider>
  )
}

export default App


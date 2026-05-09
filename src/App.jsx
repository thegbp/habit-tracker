import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './screens/Login'
import Today from './screens/Today'
import Habits from './screens/Habits'
import Dashboard from './screens/Dashboard'
import BottomNav from './components/BottomNav'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950">
        <div aria-label="Loading" role="status" className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full motion-safe:animate-spin" />
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

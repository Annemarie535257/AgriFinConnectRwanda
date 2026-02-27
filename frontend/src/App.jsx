import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import GetStartedPage from './pages/GetStartedPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import TryModelsPage from './pages/TryModelsPage'
import DashboardLayout from './pages/DashboardLayout'
import FarmerDashboard from './pages/FarmerDashboard'
import MicrofinanceDashboard from './pages/MicrofinanceDashboard'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  const location = useLocation()

  // Scroll to hash target when URL has a hash (e.g. /#about) so header links work
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '')
      const el = id ? document.getElementById(id) : null
      if (el) {
        const timer = setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
        return () => clearTimeout(timer)
      }
    }
  }, [location.pathname, location.hash])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/get-started" element={<GetStartedPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/try-models" element={<TryModelsPage />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route path="farmer" element={<FarmerDashboard />} />
        <Route path="microfinance" element={<MicrofinanceDashboard />} />
        <Route path="admin" element={<AdminDashboard />} />
      </Route>
    </Routes>
  )
}

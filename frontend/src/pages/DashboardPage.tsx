import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { Logo } from '../components/Logo'

interface User {
  id: string
  email: string
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    apiFetch<User>('/auth/me')
      .then(setUser)
      .catch(() => navigate('/login', { replace: true }))
      .finally(() => setChecking(false))
  }, [navigate])

  async function handleLogout() {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {})
    navigate('/login', { replace: true })
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <span className="font-semibold text-gray-900">Dashboard</span>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
        >
          Log out
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-xl font-semibold text-gray-900">Welcome, {user.email}</h1>
        <p className="mt-1 text-sm text-gray-500">Widget dashboard coming in a later step.</p>
      </main>
    </div>
  )
}

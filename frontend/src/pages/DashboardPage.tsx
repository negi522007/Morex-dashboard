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

  function handleLinkGithub() {
    window.open('/auth/github', '_blank')
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

        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Connected accounts</h2>
          <p className="mt-1 text-sm text-gray-500">
            Link GitHub to raise the API rate limit for GitHub widgets (public repos only).
          </p>
          <button
            onClick={handleLinkGithub}
            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Link GitHub account
          </button>
          <p className="mt-2 text-xs text-gray-400">
            Opens in a new tab — GitHub will show "linked" there when it's done, you can close it and come back
            here.
          </p>
        </div>
      </main>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import { PasswordInput } from '../components/PasswordInput'
import { AuthLayout, glassInputClass, glassLabelClass } from '../components/AuthLayout'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      navigate('/dashboard')
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Please confirm your email before logging in — check your inbox')
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Incorrect email or password')
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome"
      subtitle="Log in to your universe"
      switchPrompt="New to Morex?"
      switchLabel="Create an account"
      switchTo="/register"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className={glassLabelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={glassInputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className={glassLabelClass}>
            Password
          </label>
          <PasswordInput
            id="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </div>

        {error && <p className="rounded-2xl border border-red-300/30 bg-red-500/15 px-5 py-3 text-sm text-red-100">{error}</p>}

        <div className="pt-2">
          <button type="submit" disabled={loading} className="w-full rounded-full bg-white py-4 text-base font-semibold text-indigo-950 shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-indigo-400/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}

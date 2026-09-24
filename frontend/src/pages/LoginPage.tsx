import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import { PasswordInput } from '../components/PasswordInput'
import { AuthLayout, glassInputClass, glassLabelClass } from '../components/AuthLayout'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(searchParams.get('error'))

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

        <div className="flex items-center gap-3 pt-1">
          <div className="h-px flex-1 bg-white/20" />
          <span className="text-xs text-white/50">or</span>
          <div className="h-px flex-1 bg-white/20" />
        </div>

        <a
          href="/auth/github/login"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          <GithubIcon />
          Continue with GitHub
        </a>
      </form>
    </AuthLayout>
  )
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 2C6.48 2 2 6.58 2 12.2c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.88-2.78.51-3.5-.7-3.72-1.34-.13-.34-.68-1.38-1.16-1.66-.4-.22-.97-.77-.01-.78.9-.01 1.55.85 1.76 1.2 1.03 1.75 2.68 1.26 3.33.96.1-.75.4-1.26.72-1.55-2.53-.29-5.18-1.29-5.18-5.72 0-1.26.44-2.3 1.16-3.11-.12-.29-.5-1.48.11-3.08 0 0 .95-.31 3.12 1.19a10.6 10.6 0 0 1 2.84-.39c.96 0 1.93.13 2.84.39 2.17-1.5 3.12-1.19 3.12-1.19.61 1.6.23 2.79.11 3.08.72.81 1.16 1.84 1.16 3.11 0 4.44-2.66 5.43-5.19 5.72.41.36.77 1.07.77 2.17 0 1.57-.01 2.83-.01 3.22 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.2C22 6.58 17.52 2 12 2Z" />
    </svg>
  )
}

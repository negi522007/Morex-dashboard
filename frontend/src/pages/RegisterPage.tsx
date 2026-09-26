import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import { PasswordInput } from '../components/PasswordInput'
import { AuthLayout, glassInputClass, glassLabelClass } from '../components/AuthLayout'

export function RegisterPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={submitted ? 'Check your inbox' : 'Sign up'}
      subtitle={submitted ? undefined : 'Create your account and start exploring'}
      switchPrompt="Already a member?"
      switchLabel="Sign in"
      switchTo="/login"
    >
      {submitted ? (
        <p className="text-base leading-relaxed text-white/80">
          We sent a confirmation link to <strong className="text-white">{email}</strong>. Click it to activate
          your account, then{' '}
          <Link to="/login" className="font-medium text-sky-300 hover:underline">
            log in
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className={glassLabelClass}>
                First name
              </label>
              <input
                id="firstName"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ada"
                className={glassInputClass}
              />
            </div>
            <div>
              <label htmlFor="lastName" className={glassLabelClass}>
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Lovelace"
                className={glassInputClass}
              />
            </div>
          </div>

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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className={glassLabelClass}>
              Confirm password
            </label>
            <PasswordInput
              id="confirmPassword"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Type it again"
            />
          </div>

          {error && <p className="rounded-2xl border border-red-300/30 bg-red-500/15 px-5 py-3 text-sm text-red-100">{error}</p>}

          <div className="pt-2">
            <button type="submit" disabled={loading} className="w-full rounded-full bg-white py-4 text-base font-semibold text-indigo-950 shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-indigo-400/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}

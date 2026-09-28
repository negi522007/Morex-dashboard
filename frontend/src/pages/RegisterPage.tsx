import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import { PasswordInput } from '../components/PasswordInput'
import { AuthLayout, glassInputClass, glassLabelClass } from '../components/AuthLayout'
import { AUTH, useAuthLang } from '../lib/authLang'
import { translateError } from '../lib/i18n'
import { SsoButtons } from '../components/SsoButtons'
import { AuthNotice } from '../components/AuthNotice'

export function RegisterPage() {
  const lang = useAuthLang(), a = AUTH[lang]
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // The backend refuses accounts for people under 13: the date picker stops there too
  const today = new Date()
  const latestBirthDate = new Date(Date.UTC(today.getFullYear() - 13, today.getMonth(), today.getDate())).toISOString().slice(0, 10)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(a.mismatch)
      return
    }

    setLoading(true)
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        // The confirmation email is written in this language
        headers: { 'Accept-Language': lang },
        body: JSON.stringify({
          email,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          birthDate,
        }),
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof ApiError ? translateError(err.message, lang) : a.wrong)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={submitted ? a.inbox : a.signUp}
      subtitle={submitted ? undefined : a.signUpSub}
      switchPrompt={a.member}
      switchLabel={a.signIn}
      switchTo="/login"
    >
      {submitted ? (
        <AuthNotice kind="sent">
          <p className="mt-3 text-sm text-white/70">{a.sent} <strong className="break-all text-white">{email}</strong></p>
          <Link to="/login" className="mt-4 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-indigo-950 transition hover:bg-indigo-50">
            {a.signIn}
          </Link>
        </AuthNotice>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className={glassLabelClass}>
                {a.firstName}
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
                {a.lastName}
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
            <label htmlFor="birthDate" className={glassLabelClass}>
              {a.birth}
            </label>
            <input
              id="birthDate"
              type="date"
              required
              value={birthDate}
              max={latestBirthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={`${glassInputClass} [color-scheme:dark]`}
            />
            <p className="mt-1.5 ml-4 text-xs text-white/50">{a.birthNote}</p>
          </div>
          <div>
            <label htmlFor="email" className={glassLabelClass}>
              {a.email}
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
              {a.password}
            </label>
            <PasswordInput
              id="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={a.atLeast8}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className={glassLabelClass}>
              {a.confirm}
            </label>
            <PasswordInput
              id="confirmPassword"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={a.again}
            />
          </div>

          {error && <AuthNotice kind="error" detail={error} />}

          <div className="pt-2">
            <button type="submit" disabled={loading} className="w-full rounded-full bg-white py-4 text-base font-semibold text-indigo-950 shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-indigo-400/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
              {loading ? a.creating : a.createBtn}
            </button>
          </div>
          <SsoButtons />
        </form>
      )}
    </AuthLayout>
  )
}

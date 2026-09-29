import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import { PasswordInput } from '../components/PasswordInput'
import { AuthLayout, glassInputClass, glassLabelClass } from '../components/AuthLayout'
import { AUTH, useAuthLang } from '../lib/authLang'
import { translateError } from '../lib/i18n'
import { SsoButtons } from '../components/SsoButtons'
import { AuthNotice } from '../components/AuthNotice'

// Envelope outline + flap, drawn as a constellation (the points are the stars, the lines are drawn in turn)
const STARS = [[40, 50], [200, 50], [200, 160], [40, 160], [120, 108]]
const LINKS = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 1]]
function SentConstellation() {
  return (
    <svg className="sent-sky" viewBox="0 0 240 190" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => <circle key={`d${i}`} className="dust" cx={(i * 53) % 240} cy={(i * 37) % 190} r={i % 4 ? 0.8 : 1.3} style={{ animationDelay: `${(i % 6) * 0.5}s` }} />)}
      {LINKS.map(([a, b], i) => <line key={i} x1={STARS[a][0]} y1={STARS[a][1]} x2={STARS[b][0]} y2={STARS[b][1]} style={{ animationDelay: `${i * 0.25}s` }} />)}
      {STARS.map(([x, y], i) => <circle key={i} className="star" cx={x} cy={y} r="3.2" style={{ animationDelay: `${i * 0.4}s` }} />)}
    </svg>
  )
}

export function RegisterPage() {
  const lang = useAuthLang(), a = AUTH[lang]
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
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
    if (!acceptTerms) {
      setError(a.acceptRequired)
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
          acceptTerms,
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
      title={submitted ? '' : a.signUp}
      subtitle={submitted ? undefined : a.signUpSub}
      switchPrompt={a.member}
      switchLabel={a.signIn}
      switchTo="/login"
    >
      {submitted ? (
        // "Look for this message": stars link up one by one and draw an envelope in the sky
        <div className="text-center">
          <SentConstellation />
          <p className="font-['Caveat'] text-2xl text-white">{a.lookFor}</p>
          <p className="mt-2 inline-flex max-w-full rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white">
            <span className="truncate">{email}</span>
          </p>
          <div className="mt-5">
            <Link to="/login" className="inline-block rounded-full border border-white/30 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
              {a.signIn}
            </Link>
          </div>
        </div>
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

          <label className="flex items-start gap-2.5 text-sm text-white/75">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 bg-white/10 accent-indigo-400"
            />
            <span>
              {a.acceptPre}{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline decoration-white/40 hover:text-white">{a.termsLabel}</a>
              {' '}{a.acceptAnd}{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline decoration-white/40 hover:text-white">{a.privacyLabel}</a>
            </span>
          </label>

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

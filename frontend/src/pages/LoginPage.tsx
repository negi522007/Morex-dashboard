import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import { PasswordInput } from '../components/PasswordInput'
import { AuthLayout, glassInputClass, glassLabelClass } from '../components/AuthLayout'
import { AUTH, useAuthLang } from '../lib/authLang'
import { translateError } from '../lib/i18n'
import { SsoButtons } from '../components/SsoButtons'
import { AuthNotice, type NoticeKind } from '../components/AuthNotice'

export function LoginPage() {
  const navigate = useNavigate()
  // The backend's GitHub sign-in redirects here with ?error=… when it fails
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const lang = useAuthLang(), a = AUTH[lang]
  const urlError = searchParams.get('error')
  // 401 = wrong email or password, 403 = email not confirmed yet, anything else = a generic hiccup
  // (with the backend's message, shown in the page's language when it is a known one)
  const [notice, setNotice] = useState<{ kind: NoticeKind; detail?: string } | null>(
    urlError ? { kind: 'error', detail: translateError(urlError, lang) } : null,
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setNotice(null)
    setLoading(true)
    try {
      await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      navigate('/dashboard')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setNotice({ kind: 'wrong' })
      else if (err instanceof ApiError && err.status === 403) setNotice({ kind: 'confirm' })
      else setNotice({ kind: 'error', detail: err instanceof ApiError ? translateError(err.message, lang) : undefined })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={a.welcome}
      subtitle={a.loginSub}
      switchPrompt={a.newHere}
      switchLabel={a.create}
      switchTo="/register"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={a.yourPassword}
          />
        </div>

        {notice && <AuthNotice kind={notice.kind} detail={notice.detail} />}

        <div className="pt-2">
          <button type="submit" disabled={loading} className="w-full rounded-full bg-white py-4 text-base font-semibold text-indigo-950 shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-indigo-400/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
            {loading ? a.loggingIn : a.login}
          </button>
        </div>

        <SsoButtons />
      </form>
    </AuthLayout>
  )
}


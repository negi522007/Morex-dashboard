import { Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { setAuthLang, useAuthLang } from '../lib/authLang'
import { LANGS, type Lang } from '../lib/i18n'
import { LEGAL, LEGAL_UI, LEGAL_UPDATED, type LegalDoc, type LegalIcon } from '../lib/legal'
import '../styles/legal.css'

const LOCALE: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' }

// "**word**" → <b>word</b>, the only markup the legal texts use
function rich(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))
}

// Section icons, drawn in the letter's violet (emojis can't take a colour)
const ICONS: Record<LegalIcon, React.ReactNode> = {
  galaxy: <><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" /><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-25 12 12)" /><path d="M19 4.5v2M18 5.5h2M5 18v1.6M4.2 18.8h1.6" /></>,
  handshake: <><path d="M3 11l4-4 3 1 2-1 3 3-4 4" /><path d="M21 11l-4-4" /><path d="M7 13l3 3a1.4 1.4 0 0 0 2-2M10 16l1.5 1.5a1.4 1.4 0 0 0 2-2l-1-1M13 17.5a1.4 1.4 0 0 0 2-2l-2-2" /></>,
  shield: <><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6Z" /><path d="m8.8 12 2.2 2.2 4.2-4.4" /></>,
  trash: <><path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></>,
  inbox: <><path d="M4 13l2-8h12l2 8v6H4Z" /><path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20" /><path d="M12 3v6M9.5 6.5 12 9l2.5-2.5" /></>,
  robot: <><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 4.5V8M3 13v2M21 13v2" /><circle cx="9.5" cy="13" r="1.2" fill="currentColor" stroke="none" /><circle cx="14.5" cy="13" r="1.2" fill="currentColor" stroke="none" /><path d="M10 16.5h4" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  box: <><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></>,
}

// Shared page for /terms and /privacy, written as a letter on lined paper (same family as the journal):
// handwritten title, the Morex seal, plain-language sections, signed by the team. Text in lib/legal.ts.
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const lang = useAuthLang()
  const navigate = useNavigate()
  // Back to where the reader came from (login or sign-up); a page opened in a new tab has no history
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/login'))
  const ui = LEGAL_UI[lang], text = LEGAL[doc][lang]
  const updated = new Date(LEGAL_UPDATED).toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="legal">
      <header className="legal-top">
        <Link to="/dashboard" className="legal-brand"><img src="/logo.svg" alt="" />Morex</Link>
        <div className="legal-langs" role="group" aria-label="Language">
          {LANGS.map((l) => <button key={l} className={l === lang ? 'on' : ''} onClick={() => setAuthLang(l)}>{l.toUpperCase()}</button>)}
        </div>
        <button type="button" onClick={back} className="legal-back">{ui.back}</button>
      </header>

      <nav className="legal-tabs">
        {(['terms', 'privacy'] as LegalDoc[]).map((d) => <Link key={d} to={`/${d}`} replace className={d === doc ? 'on' : ''}>{ui.tabs[d]}</Link>)}
      </nav>

      <main className="legal-letter">
        <span className="legal-seal" aria-hidden="true"><img src="/logo.svg" alt="" /></span>
        <h1>{text.title}</h1>
        <p className="legal-date">{ui.updated(updated)}</p>
        {text.intro && <p>{text.intro}</p>}
        {text.sections.map((s) => (
          <section key={s.title}>
            <h2><svg className="legal-ic" viewBox="0 0 24 24" aria-hidden="true">{ICONS[s.icon]}</svg>{s.title}</h2>
            <ul>{s.items.map((item) => <li key={item}>{rich(item)}</li>)}</ul>
          </section>
        ))}
        <p className="legal-sign">{ui.sign}</p>
      </main>
    </div>
  )
}

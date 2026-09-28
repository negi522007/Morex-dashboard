import { W, translateError, type Lang } from '../../lib/i18n'

// After connecting an account, the backend sends the browser back to /dashboard with ?github=linked
// (or ?github_error=…; same for epitech and microsoft). This card tells the user how it went:
// Morex ⇄ the account, what it unlocks, confetti when it worked, the reason and a retry when it didn't.

export type LinkResult = { provider: 'github' | 'epitech' | 'microsoft'; ok: boolean; error?: string }

const PROVIDERS = ['github', 'epitech', 'microsoft'] as const

// Reads the result from the current address (and returns null when there is none)
export function readLinkResult(search: string): LinkResult | null {
  const q = new URLSearchParams(search)
  for (const provider of PROVIDERS) {
    if (q.get(provider) === 'linked') return { provider, ok: true }
    const error = q.get(`${provider}_error`)
    if (error) return { provider, ok: false, error }
  }
  return null
}

const LOOK = {
  github: { name: 'GitHub', icon: '🐙' },
  epitech: { name: 'My Epitech', icon: '🎓' },
  microsoft: { name: 'Microsoft', icon: <span className="acc-ms"><i /><i /><i /><i /></span> },
}
const COLORS = ['#f472b6', '#fde047', '#38bdf8', '#a78bfa', '#34d399']

export function LinkedCard({ result, lang, onClose, onAddWidget }: { result: LinkResult; lang: Lang; onClose: () => void; onAddWidget: () => void }) {
  const w = W[lang], { name, icon } = LOOK[result.provider]
  const unlocks = w.linkUnlocks[result.provider]
  return (
    <div className="modal-bg open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {result.ok && (
        <div className="lk-confetti" aria-hidden="true">
          {Array.from({ length: 26 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: COLORS[i % 5], animationDelay: `-${(i * 0.17).toFixed(2)}s` }} />)}
        </div>
      )}
      <div className={`glass modal lk-card${result.ok ? '' : ' bad'}`} role="dialog" aria-modal="true">
        <div className="lk-pair"><span><img src="/logo.svg" alt="Morex" /></span><i aria-hidden="true">{result.ok ? '⇄' : '✕'}</i><span>{icon}</span></div>
        <h3>{result.ok ? w.linkOk(name) : w.linkBad}</h3>
        <p>{result.ok ? unlocks.text : w.linkBadText(name)}</p>
        {!result.ok && result.error && <p className="lk-why">{translateError(result.error, lang)}</p>}
        {result.ok && unlocks.items.length > 0 && <div className="lk-unlocked">{unlocks.items.map((it) => <span key={it}>✓ {it}</span>)}</div>}
        <div className="lk-actions">
          {result.ok
            ? (result.provider === 'github'
              ? <><button className="primary" onClick={onAddWidget}>{w.linkAddGithub}</button><button className="soft" onClick={onClose}>{w.linkLater}</button></>
              : <button className="primary" onClick={onClose}>{w.linkSuper}</button>)
            : <><a className="primary" href={`/auth/${result.provider}`}>{w.linkRetry}</a><button className="soft" onClick={onClose}>{w.close}</button></>}
        </div>
      </div>
    </div>
  )
}

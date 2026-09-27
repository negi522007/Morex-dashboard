import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../../lib/api'
import { W, translateError, type Lang } from '../../lib/i18n'
import { entryFor, type CatalogEntry } from '../../lib/catalog'
import type { User } from '../../lib/types'

// The AI assistant's own bubble: a small golden star with an orbiting satellite, bottom right of the page.
// It talks to three backend routes:
//   POST /assistant/widgets  a sentence → widget drafts (nothing is created until "Add" is pressed)
//   GET  /brief (+ POST /brief/refresh)  today's brief, written from the widgets that have AI on
//   POST /helpdesk/ask  questions about the app (works even without AI: best documentation entry)

interface Draft { serviceName: string; widgetName: string; title?: string; config: Record<string, string | number>; reason?: string }
interface Brief { headline: string; items: string[]; tip?: string }
type Msg = { from: 'me' | 'it'; body: ReactNode }

export function AiBubble({ user, lang, onCreate }: {
  user: User
  lang: Lang
  onCreate: (entry: CatalogEntry, config: Record<string, string | number>, refreshRateSeconds: number) => Promise<void>
}) {
  const w = W[lang]
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [mode, setMode] = useState<'help' | 'widgets'>('help')
  const [q, setQ] = useState(''), [busy, setBusy] = useState(false)
  const chat = useRef<HTMLDivElement>(null)
  useEffect(() => { chat.current?.scrollTo({ top: chat.current.scrollHeight, behavior: 'smooth' }) }, [msgs, busy])

  const say = (from: Msg['from'], body: ReactNode) => setMsgs((m) => [...m, { from, body }])
  const run = async (fn: () => Promise<ReactNode>) => {
    setBusy(true)
    try { say('it', await fn()) } catch (err) { say('it', `⚠ ${translateError((err as Error).message, lang)}`) } finally { setBusy(false) }
  }

  function AddButton({ d }: { d: Draft }) {
    const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
    const entry = entryFor(d.serviceName, d.widgetName)
    if (!entry) return null
    return (
      <button type="button" className={state === 'done' ? 'done' : ''} disabled={state === 'busy' || state === 'done'}
        onClick={async () => { setState('busy'); try { await onCreate(entry, d.config, 300); setState('done') } catch { setState('error') } }}>
        {state === 'done' ? `✓ ${w.aiAdded}` : state === 'error' ? w.aiRetry : w.aiAdd}
      </button>
    )
  }

  const askWidgets = (text: string) => run(async () => {
    const r = await api.post<{ available: boolean; suggestions: Draft[] }>('/assistant/widgets', { prompt: text })
    if (!r.available) return w.aiOff
    if (!r.suggestions.length) return w.aiNothing
    return (
      <>{w.aiHere}
        <div className="ai-sug">{r.suggestions.map((d, i) => (
          <div key={i}><span>{d.title || entryFor(d.serviceName, d.widgetName)?.name[lang] || d.widgetName}{d.reason && <small>{d.reason}</small>}</span><AddButton d={d} /></div>
        ))}</div>
      </>
    )
  })
  const showBrief = () => run(async () => {
    let r = await api.get<{ available: boolean; brief: Brief | null }>('/brief')
    if (!r.available) return w.aiOff
    if (!r.brief) r = await api.post<{ available: boolean; brief: Brief | null }>('/brief/refresh')
    if (!r.brief) return w.aiNoBrief
    return (
      <div className="ai-brief"><h5>{r.brief.headline}</h5><ul>{r.brief.items.map((it, i) => <li key={i}>{it}</li>)}</ul>{r.brief.tip && <div className="tip">💡 {r.brief.tip}</div>}</div>
    )
  })
  const askHelp = (text: string) => run(async () => {
    const r = await api.post<{ answer: string; sources: { id: string; title: string }[] }>(`/helpdesk/ask?lang=${lang}`, { question: text })
    return <>{r.answer}{r.sources.length > 0 && <div className="ai-src">{r.sources.slice(0, 3).map((s) => <span key={s.id}>📄 {s.title}</span>)}</div>}</>
  })

  function send() {
    const text = q.trim()
    if (text.length < 2 || busy) return
    setQ(''); say('me', text)
    if (mode === 'widgets') askWidgets(text)
    else askHelp(text)
  }
  function action(kind: 'widgets' | 'brief' | 'help') {
    if (kind === 'widgets') { say('me', w.aiActWidgets); setMode('widgets'); say('it', w.aiTellMe) }
    if (kind === 'brief') { say('me', w.aiActBrief); showBrief() }
    if (kind === 'help') { say('me', w.aiActHelp); setMode('help'); say('it', w.aiAskAway) }
  }

  return (
    <div className="ai-bubble">
      <div className={`ai-panel${open ? '' : ' closed'}`} role="dialog" aria-label={w.aiName} aria-hidden={!open}>
        <div className="ai-head">
          <span className="ai-av"><img src="/logo.svg" alt="" /></span>
          <div><b>{w.aiName}</b><small>{w.aiSub}</small></div>
          <button type="button" className="ai-x" aria-label="✕" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="ai-chat" ref={chat}>
          <div className="ai-m it">{w.aiHello(user.firstName || '')}
            <div className="ai-acts">
              <button type="button" onClick={() => action('widgets')}>✨ {w.aiActWidgets}</button>
              <button type="button" onClick={() => action('brief')}>☀️ {w.aiActBrief}</button>
              <button type="button" onClick={() => action('help')}>❔ {w.aiActHelp}</button>
            </div>
          </div>
          {msgs.map((m, i) => <div key={i} className={`ai-m ${m.from}`}>{m.body}</div>)}
          {busy && <div className="ai-m it ai-dots"><i /><i /><i /></div>}
        </div>
        <form className="ai-cmp" onSubmit={(e) => { e.preventDefault(); send() }}>
          <input value={q} maxLength={400} placeholder={mode === 'widgets' ? w.aiPhWidgets : w.helpAsk} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" disabled={busy || q.trim().length < 2} aria-label={w.helpAsk}>➤</button>
        </form>
      </div>
      <div className="ai-star">
        <span className="ai-orbit" />
        <button type="button" className="ai-core" aria-label={w.aiName} aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      </div>
    </div>
  )
}

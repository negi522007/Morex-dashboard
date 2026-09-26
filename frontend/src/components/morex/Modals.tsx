import { useEffect, useRef, useState } from 'react'
import { api, apiFetch } from '../../lib/api'
import { LOCALE, W, tr, type Lang } from '../../lib/i18n'
import { AV_OPTIONS, DEFAULT_AVATAR, HAIR, NICE, avatarUrl, type AvatarConfig, type Gender } from '../../lib/avatar'
import { entryFor, prepareConfig, rateLabel, REFRESH_RATES } from '../../lib/catalog'
import type { AboutResponse, JournalEntry, User, WidgetInstance } from '../../lib/types'
import { DECOS } from './Decoration'
import { THEMES, displayName } from './Chrome'

function Modal({ onClose, className = 'glass modal', style, children }: { onClose: () => void; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-bg open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={className} style={style} role="dialog" aria-modal="true">{children}</div>
    </div>
  )
}

// ---------- Edit a widget: title, refresh rate, decoration (+ its settings and AI switch) ----------
export function EditWidgetModal({ widget, about, lang, onClose, onSave }: {
  widget: WidgetInstance; about: AboutResponse | null; lang: Lang; onClose: () => void
  onSave: (patch: Partial<Pick<WidgetInstance, 'title' | 'refreshRateSeconds' | 'decoration' | 'aiEnabled' | 'config'>>) => Promise<void>
}) {
  const t = tr(lang), w = W[lang], entry = entryFor(widget.serviceName, widget.widgetName)
  const params = about?.server.services.find((s) => s.name === widget.serviceName)?.widgets.find((x) => x.name === widget.widgetName)?.params ?? []
  const [title, setTitle] = useState(widget.title ?? '')
  const [rate, setRate] = useState(widget.refreshRateSeconds)
  const [deco, setDeco] = useState(widget.decoration ?? 'none')
  const [ai, setAi] = useState(widget.aiEnabled)
  // Secrets come back masked: the field starts empty and an empty value keeps the stored one
  const [cfg, setCfg] = useState<Record<string, string>>(() =>
    Object.fromEntries(params.map((p) => [p.name, p.secret ? '' : String(widget.config[p.name] ?? '')])))
  const [error, setError] = useState('')
  const rates = REFRESH_RATES.some(([s]) => s === widget.refreshRateSeconds) ? REFRESH_RATES : [[widget.refreshRateSeconds, rateLabel(widget.refreshRateSeconds)] as [number, string], ...REFRESH_RATES]

  async function save() {
    const patch: Parameters<typeof onSave>[0] = {}
    if ((widget.title ?? '') !== title.trim()) patch.title = title.trim() || null
    if (rate !== widget.refreshRateSeconds) patch.refreshRateSeconds = rate
    if ((widget.decoration ?? 'none') !== deco) patch.decoration = deco === 'none' ? null : deco
    if (ai !== widget.aiEnabled) patch.aiEnabled = ai
    const next: Record<string, string | number> = {}
    let changed = false
    for (const p of params) {
      const v = cfg[p.name].trim()
      if (p.secret && !v) { next[p.name] = '********'; continue }
      if (v) next[p.name] = p.type === 'integer' ? Number(v) : v
      if (String(widget.config[p.name] ?? '') !== v) changed = true
    }
    if (!Object.keys(patch).length && !changed) return onClose()
    try {
      if (changed) patch.config = prepareConfig(widget.serviceName, widget.widgetName, next, lang)
      await onSave(patch)
      onClose()
    } catch (err) {
      setError(`${w.saveError} : ${(err as Error).message}`)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3>{t.editWidget}</h3>
      <label className="field"><span>{t.fTitle}</span><input value={title} placeholder={entry?.name[lang]} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="field"><span>{t.fRefresh}</span>
        <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>{rates.map(([s, l]) => <option key={s} value={s}>{l}</option>)}</select></label>
      {params.length > 0 && (
        <div className="field"><span>{w.settings}</span>
          {params.map((p) => (
            <label key={p.name} className="dw-field" style={{ margin: '4px 0 0' }}>{p.name}{p.required ? ' *' : ''}{p.secret ? ' 🔒' : ''}
              <input type={p.type === 'integer' ? 'number' : p.secret ? 'password' : 'text'} value={cfg[p.name]} placeholder={p.secret ? '••••••••' : entry?.hints[p.name]?.[1]}
                onChange={(e) => setCfg((c) => ({ ...c, [p.name]: e.target.value }))} />
              {p.secret && <small>{w.secretKept}</small>}
            </label>
          ))}
        </div>
      )}
      {entry?.ai && (
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} style={{ width: 18, height: 18, padding: 0 }} />
          <span>✨ {w.aiLabel}<small style={{ display: 'block' }}>{w.aiHint}</small></span>
        </label>
      )}
      <div className="field"><span>{t.decoLabel}</span>
        <div className="deco-pick">
          {Object.entries(DECOS).map(([k, [icon]]) => <button key={k} type="button" className={k === deco ? 'on' : ''} onClick={() => setDeco(k)}><span>{icon}</span>{(t.deco as Record<string, string>)[k]}</button>)}
        </div>
      </div>
      {error && <p style={{ color: '#fca5a5', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
      <div style={{ marginTop: 22 }}><button className="primary" onClick={save}>{t.save}</button></div>
    </Modal>
  )
}

// ---------- Help ----------
export function HelpModal({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const t = tr(lang)
  return (
    <Modal onClose={onClose} style={{ maxWidth: 560 }}>
      <h3>{t.helpTitle}</h3>
      <p className="muted" style={{ margin: 0 }}>{t.helpSub}</p>
      <div className="faq">{t.faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
      <p className="muted" style={{ margin: '18px 0 0', fontSize: 14 }}>{t.helpMore} <a href="mailto:support@morex.app" style={{ color: 'var(--a2)' }}>support@morex.app</a></p>
    </Modal>
  )
}

// ---------- Logout ----------
export function LogoutModal({ lang, onClose, onLogout }: { lang: Lang; onClose: () => void; onLogout: () => void }) {
  const t = tr(lang)
  return (
    <Modal onClose={onClose} style={{ maxWidth: 420, textAlign: 'center' }}>
      <div style={{ fontSize: 46 }}>🪐</div>
      <h3>{t.logoutTitle}</h3>
      <p className="muted">{t.logoutSub}</p>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="soft" style={{ flex: 1 }} onClick={onClose}>{t.stay}</button>
        <button className="primary" style={{ flex: 1, background: '#ef4444', color: '#fff' }} onClick={onLogout}>{t.logout}</button>
      </div>
    </Modal>
  )
}

// ---------- Profile page ----------
export function ProfileModal({ user, lang, theme, onClose, onSaved, onLang, onTheme, onAvatar }: {
  user: User; lang: Lang; theme: string; onClose: () => void; onSaved: (u: User) => void
  onLang: (l: Lang) => void; onTheme: (t: string) => void; onAvatar: () => void
}) {
  const t = tr(lang) as unknown as Record<string, string>
  const [firstName, setFirst] = useState(user.firstName ?? ''), [lastName, setLast] = useState(user.lastName ?? '')
  const [bio, setBio] = useState(user.bio ?? ''), [currentPw, setCur] = useState(''), [newPw, setNew] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const since = new Date(user.createdAt).toLocaleDateString(LOCALE[lang], { month: 'long', year: 'numeric' })

  async function save() {
    const body: Record<string, string> = {}
    if (firstName.trim() !== (user.firstName ?? '')) body.firstName = firstName.trim()
    if (lastName.trim() !== (user.lastName ?? '')) body.lastName = lastName.trim()
    if (bio.trim() !== (user.bio ?? '')) body.bio = bio.trim()
    if (newPw) { body.currentPassword = currentPw; body.newPassword = newPw }
    if (!Object.keys(body).length) return onClose()
    setBusy(true); setError('')
    try {
      const updated = await api.patch<User>('/auth/me', body)
      onSaved({ ...user, ...updated })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} className="glass modal profile-modal">
      <div className="pf-cover" />
      <div className="pf-top">
        <div className="avatar" onClick={onAvatar}><img src={user.avatarPhotoUrl || avatarUrl({ ...DEFAULT_AVATAR, ...(user.avatarConfig ?? {}) })} alt="" /><span className="cam">📷</span></div>
        <div style={{ marginTop: 66 }}><h3>{displayName(user)}</h3><span className="muted" style={{ fontSize: 14 }}>{`${t.memberSince.replace(/\s\S+( de)? \d{4}$/, '')} ${since}`}</span></div>
      </div>
      <div className="pf-body">
        <section className="pf-section">
          <h4>{t.pfInfo}</h4>
          <div className="pf-grid">
            <label className="field"><span>{t.firstName}</span><input value={firstName} onChange={(e) => setFirst(e.target.value)} /></label>
            <label className="field"><span>{t.lastName}</span><input value={lastName} onChange={(e) => setLast(e.target.value)} /></label>
          </div>
          <label className="field"><span>Email</span><input value={user.email} readOnly /><small>{t.emailNote}</small></label>
          <label className="field"><span>{t.bioLabel}</span><textarea maxLength={280} placeholder={t.bio} value={bio} onChange={(e) => setBio(e.target.value)} />
            <small>{bio.length}/280 · {t.bioNote}</small></label>
        </section>
        <section className="pf-section">
          <h4>{t.pfPrefs}</h4>
          <div className="pf-grid">
            <label className="field"><span>{t.language}</span>
              <select value={lang} onChange={(e) => onLang(e.target.value as Lang)}><option value="fr">🇫🇷 Français</option><option value="en">🇬🇧 English</option><option value="es">🇪🇸 Español</option></select></label>
            <label className="field"><span>{t.theme}</span>
              <select value={theme} onChange={(e) => onTheme(e.target.value)}>{THEMES.map(([k]) => <option key={k} value={k}>{t[`th_${k}`]}</option>)}</select></label>
          </div>
        </section>
        <section className="pf-section">
          <h4>{t.pfSecurity}</h4>
          <p>{t.pwNote}</p>
          <div className="pf-grid">
            <label className="field"><span>{t.currentPw}</span><input type="password" placeholder="••••••••" value={currentPw} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></label>
            <label className="field"><span>{t.newPw}</span><input type="password" placeholder={t.pwPh} value={newPw} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" /></label>
          </div>
        </section>
        <section className="pf-section danger-zone">
          <h4>{t.pfData}</h4>
          <p>{t.pfDataSub}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            <button className="soft" disabled>⬇ <span>{t.export}</span><span className="soon">{t.soon}</span></button>
            <button className="btn-danger" disabled>🗑 <span>{t.deleteAcc}</span><span className="soon">{t.soon}</span></button>
          </div>
        </section>
        {error && <p style={{ color: '#fca5a5', fontSize: 13, margin: 0 }}>{error}</p>}
        <div className="pf-actions">
          <button className="soft" onClick={onClose}>{t.cancel}</button>
          <button className="primary" onClick={save} disabled={busy}>{t.save}</button>
        </div>
      </div>
    </Modal>
  )
}

// ---------- Avatar editor (DiceBear avataaars, or your own photo) ----------
export function AvatarModal({ user, lang, onClose, onSaved }: { user: User; lang: Lang; onClose: () => void; onSaved: (u: User) => void }) {
  const t = tr(lang)
  const saved = { ...DEFAULT_AVATAR, ...(user.avatarConfig ?? {}) }
  const [draft, setDraft] = useState<AvatarConfig>(saved)
  const [gender, setGender] = useState<Gender>((saved.gender as Gender) ?? 'girl')
  const [tab, setTab] = useState('top')
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)
  const [usePhoto, setUsePhoto] = useState(!!user.avatarPhotoUrl)
  const [error, setError] = useState('')
  const values = (k: string) => (k === 'top' && gender !== 'all' ? HAIR[gender] : AV_OPTIONS[k].values)
  const tabs = Object.keys(AV_OPTIONS).filter((k) => !(k === 'facialHair' && gender === 'girl'))
  const preview = usePhoto ? photo?.url ?? user.avatarPhotoUrl ?? avatarUrl(draft) : avatarUrl(draft)
  const set = (k: string, v: string) => { setDraft((d) => ({ ...d, [k]: v })); setUsePhoto(false) }
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

  function random() {
    const d: AvatarConfig = { ...draft }
    for (const k of Object.keys(AV_OPTIONS)) d[k] = pick(NICE[k] || values(k))
    if (gender === 'girl') d.facialHair = 'none'
    setDraft(d); setUsePhoto(false)
  }
  function chooseGender(g: Gender) {
    setGender(g)
    const hair = g === 'all' ? AV_OPTIONS.top.values : HAIR[g]
    setDraft((d) => ({ ...d, top: hair.includes(d.top) ? d.top : hair[g === 'boy' ? 1 : 0], facialHair: g === 'girl' ? 'none' : d.facialHair }))
    if (g === 'girl' && tab === 'facialHair') setTab('top')
    setUsePhoto(false)
  }
  async function save() {
    setError('')
    try {
      let u: User
      if (usePhoto && photo) {
        const form = new FormData(); form.append('photo', photo.file)
        u = await apiFetch<User>('/auth/me/avatar', { method: 'POST', body: form })
      } else if (usePhoto) {
        return onClose()
      } else {
        u = await api.patch<User>('/auth/me', { avatarConfig: { ...draft, gender } })
        if (user.avatarPhotoUrl) u = await apiFetch<User>('/auth/me/avatar', { method: 'DELETE' })
      }
      onSaved({ ...user, ...u })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Modal onClose={onClose} className="glass modal av-modal">
      <h3>{t.avatarTitle}</h3>
      <p className="muted" style={{ margin: 0 }}>{t.avatarSub}</p>
      <div className="av-grid">
        <div className="av-preview">
          <div className="big"><img src={preview} alt="" /></div>
          <div className="row">
            <button className="soft" onClick={random}>🎲 <span>{t.random}</span></button>
            <label className="soft">📷 <span>{t.photo}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhoto({ file: f, url: URL.createObjectURL(f) }); setUsePhoto(true) } }} /></label>
          </div>
          <button className="primary" onClick={save}>{t.save}</button>
          {error && <p style={{ color: '#fca5a5', fontSize: 13, margin: 0 }}>{error}</p>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="gender">{(['girl', 'boy', 'all'] as Gender[]).map((g) => <button key={g} className={g === gender ? 'on' : ''} onClick={() => chooseGender(g)}>{t.genders[g]}</button>)}</div>
          <div className="tabs">{tabs.map((k) => <button key={k} className={k === tab ? 'on' : ''} onClick={() => setTab(k)}>{(t.cats as Record<string, string>)[k]}</button>)}</div>
          <div className="opts">
            {values(tab).map((v) => {
              const on = !usePhoto && draft[tab] === v ? 'on' : ''
              if (AV_OPTIONS[tab].color) return <button key={v} className={`color ${on}`} style={{ background: `#${v}` }} aria-label={v} onClick={() => set(tab, v)} />
              if (v === 'none') return <button key={v} className={`none ${on}`} onClick={() => set(tab, v)}>{t.none}</button>
              return <button key={v} className={on} onClick={() => set(tab, v)}><img src={avatarUrl({ ...draft, [tab]: v })} alt="" loading="lazy" /></button>
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ---------- Journal: an open book whose pages turn on their own (entries are stored encrypted by the backend) ----------
const MOODS = ['😊', '🥰', '😌', '😴', '😢', '😡']
type Draft = Pick<JournalEntry, 'date' | 'mood' | 'text'> & { id?: string }

export function JournalModal({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const t = tr(lang)
  const [entries, setEntries] = useState<Draft[]>([])
  const [current, setCurrent] = useState(0)
  const [saved, setSaved] = useState('')
  const [opening, setOpening] = useState(true)
  // Latest entries for the debounced save (a closure would see an old list), and pages being created
  const live = useRef<Draft[]>([]), creating = useRef<Map<string, Promise<string>>>(new Map())
  live.current = entries
  const book = useRef<HTMLDivElement>(null), saveTimer = useRef<number | undefined>(undefined), textRef = useRef<HTMLTextAreaElement>(null)
  const fmtDay = (d: string) => { const s = new Date(d).toLocaleDateString(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1) }

  // A leaf that turns around the spine, added and removed on its own
  function flip(dir: 1 | -1, { delay = 0, dur = 0.75, z0, z1 }: { delay?: number; dur?: number; z0?: number; z1?: number } = {}) {
    if (!book.current) return
    const f = document.createElement('div')
    f.className = `flip${dir < 0 ? ' rev' : ''}`
    f.style.animationDelay = `${delay}s`; f.style.animationDuration = `${dur}s`
    if (z0 != null) { f.style.setProperty('--z0', String(z0)); f.style.setProperty('--z1', String(z1)) }
    f.innerHTML = '<div class="face front"></div><div class="face back"></div>'
    book.current.append(f)
    setTimeout(() => f.remove(), (delay + dur) * 1000 + 60)
  }

  useEffect(() => {
    api.get<JournalEntry[]>('/journal').then((list) => setEntries(list.length ? list : [{ date: new Date().toISOString(), mood: '😊', text: '' }])).catch(() => {})
    // On opening, a few pages riffle past before settling on the latest one
    for (let i = 0; i < 6; i++) flip(1, { delay: 0.15 + i * 0.14, dur: 0.6, z0: 9 - i, z1: 2 + i })
    const id = setTimeout(() => setOpening(false), 1500)
    return () => { clearTimeout(id); clearTimeout(saveTimer.current) }
  }, [])

  // Create the entry on the server the first time it gets content, then PATCH it
  async function persist(i: number, patch: Partial<Draft>) {
    const e = live.current[i]
    if (!e) return
    if (e.id) return void (await api.patch(`/journal/${e.id}`, patch))
    const pending = creating.current.get(e.date)
    if (pending) return void (await api.patch(`/journal/${await pending}`, patch))
    const p = api.post<JournalEntry>('/journal', { date: e.date, mood: e.mood, text: e.text, ...patch }).then((c) => c.id)
    creating.current.set(e.date, p)
    const id = await p
    setEntries((list) => list.map((x) => (x.date === e.date && !x.id ? { ...x, id } : x)))
  }
  const update = (patch: Partial<Draft>) => setEntries((list) => list.map((x, j) => (j === current ? { ...x, ...patch } : x)))
  const e = entries[current]

  return (
    <Modal onClose={onClose} className="modal journal-modal">
      <button className="j-close" onClick={onClose} aria-label="×">×</button>
      <div ref={book} className={`book${opening ? ' opening' : ''}`}>
        <div className="page left">
          <p className="j-title">{t.journal}</p>
          <p className="j-private">{t.journalPrivate}</p>
          <button className="j-new" onClick={() => { setEntries((l) => [{ date: new Date().toISOString(), mood: '😊', text: '' }, ...l]); setCurrent(0); flip(-1); setTimeout(() => textRef.current?.focus(), 50) }}>＋ <span>{t.newPage}</span></button>
          <ul className="j-list">
            {entries.map((x, i) => (
              <li key={x.id ?? `new-${i}`}>
                <button className={i === current ? 'on' : ''} onClick={() => { if (i !== current) { flip(i > current ? 1 : -1); setCurrent(i); setSaved('') } }}>
                  <span className="mood">{x.mood}</span><span><b>{fmtDay(x.date)}</b><span className="prev">{x.text || t.untitled}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="page right">
          {e && (
            <>
              <p className="j-date">{fmtDay(e.date)}</p>
              <div className="j-moods"><span>{t.howFeel}</span>
                {MOODS.map((m) => <button key={m} className={m === e.mood ? 'on' : ''} onClick={() => { update({ mood: m }); persist(current, { mood: m }).catch(() => {}) }}>{m}</button>)}
              </div>
              <textarea ref={textRef} className="j-text" placeholder={t.writeHere} value={e.text}
                onChange={(ev) => {
                  const text = ev.target.value, i = current
                  update({ text }); setSaved('…')
                  clearTimeout(saveTimer.current)
                  saveTimer.current = window.setTimeout(() => persist(i, { text }).then(() => setSaved(t.saved)).catch(() => setSaved('⚠')), 600)
                }} />
              <span className="j-saved">{saved}</span>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

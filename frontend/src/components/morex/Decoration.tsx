// Stickers sitting on a card's edges (saved as the widget's `decoration`). Markup copied from the mockup;
// it is static and never contains user data, so rendering it as HTML is safe.

const balloon = (x: number, y: number, c: string) =>
  `<path d="M${x} ${y + 26}q-3 22 4 48" stroke="rgb(255 255 255 / .6)" fill="none"/><ellipse cx="${x}" cy="${y}" rx="14" ry="17" fill="${c}"/><path d="M${x - 3} ${y + 16}l3 5 3-5z" fill="${c}"/><ellipse cx="${x - 5}" cy="${y - 7}" rx="3" ry="5" fill="#fff" fill-opacity=".45"/>`

export const DECOS: Record<string, [string, string]> = {
  none: ['🚫', ''],
  flowers: ['🌸', '<i>🌸</i><i>🌼</i><i>🌷</i>'],
  balloons: ['🎈', `<svg viewBox="0 0 80 120">${balloon(22, 30, '#f472b6')}${balloon(50, 20, '#38bdf8')}${balloon(62, 44, '#fde047')}</svg>`],
  stars: ['✨', '<i>✨</i><i>⭐</i><i>✨</i><i>⭐</i>'],
  butterflies: ['🦋', '<i>🦋</i><i>🦋</i>'],
  hearts: ['💖', '<i>💖</i><i>💕</i><i>💗</i>'],
  lights: ['💡', '<b></b>'.repeat(12)],
  clouds: ['☁️', '<i>☁️</i><i>☁️</i>'],
  crown: ['👑', '<i>👑</i>'],
  bow: ['🎀', '<i>🎀</i>'],
  cat: ['🐱', '<i>🐱</i>'],
}

export function Decoration({ name }: { name: string | null }) {
  if (!name || name === 'none' || !DECOS[name]) return null
  return <div className={`deco dc-${name}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: DECOS[name][1] }} />
}

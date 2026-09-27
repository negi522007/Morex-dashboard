import { W, type Lang } from './i18n'
import { toTimeZone, toTimeZones } from './timezones'

// Link between the backend registry (/about.json: service + widget + typed params)
// and the cards of the mockup. `kind` is the card design, used as data-kind in the CSS.

type L3 = Record<Lang, string>

export interface CatalogEntry {
  kind: string
  service: string
  widget: string
  name: L3
  wide?: boolean
  // Account the backend requires before this widget can be added (it answers 400 otherwise)
  needs?: 'github' | 'epitech'
  // Widgets with an `enrich` step on the backend: they can show an AI insight when aiEnabled is on
  ai?: boolean
  // Help under each field of the add form: text per language + example value
  hints: Record<string, [L3, string]>
}

export const SERVICES: Record<string, { label: L3; icon: string; color: string }> = {
  rss: { label: { fr: 'Actus', en: 'News', es: 'Noticias' }, icon: '📰', color: '#f97316' },
  market_data: { label: { fr: 'Bourse', en: 'Markets', es: 'Bolsa' }, icon: '₿', color: '#f59e0b' },
  github: { label: { fr: 'GitHub', en: 'GitHub', es: 'GitHub' }, icon: '🐙', color: '#111827' },
  weather: { label: { fr: 'Météo', en: 'Weather', es: 'Tiempo' }, icon: '☀️', color: '#0ea5e9' },
  worldclock: { label: { fr: 'Horloge', en: 'Clock', es: 'Reloj' }, icon: '🌍', color: '#6366f1' },
  youtube: { label: { fr: 'YouTube', en: 'YouTube', es: 'YouTube' }, icon: '▶', color: '#ff0033' },
  calendar: { label: { fr: 'Agenda', en: 'Calendar', es: 'Agenda' }, icon: '📅', color: '#f43f5e' },
  epitech: { label: { fr: 'My Epitech', en: 'My Epitech', es: 'My Epitech' }, icon: '🎓', color: '#0b5fff' },
  custom_api: { label: { fr: 'API perso', en: 'Custom API', es: 'API propia' }, icon: '{ }', color: '#10b981' },
  wellbeing: { label: { fr: 'Bien-être', en: 'Well-being', es: 'Bienestar' }, icon: '✨', color: '#ec4899' },
  steam: { label: { fr: 'Steam', en: 'Steam', es: 'Steam' }, icon: '🎮', color: '#1b2838' },
}

// The 12 signs, in the backend's order (value = what the horoscope widget expects)
export const ZODIAC: Record<string, { glyph: string; name: L3 }> = {
  aries: { glyph: '♈', name: { fr: 'Bélier', en: 'Aries', es: 'Aries' } }, taurus: { glyph: '♉', name: { fr: 'Taureau', en: 'Taurus', es: 'Tauro' } },
  gemini: { glyph: '♊', name: { fr: 'Gémeaux', en: 'Gemini', es: 'Géminis' } }, cancer: { glyph: '♋', name: { fr: 'Cancer', en: 'Cancer', es: 'Cáncer' } },
  leo: { glyph: '♌', name: { fr: 'Lion', en: 'Leo', es: 'Leo' } }, virgo: { glyph: '♍', name: { fr: 'Vierge', en: 'Virgo', es: 'Virgo' } },
  libra: { glyph: '♎', name: { fr: 'Balance', en: 'Libra', es: 'Libra' } }, scorpio: { glyph: '♏', name: { fr: 'Scorpion', en: 'Scorpio', es: 'Escorpio' } },
  sagittarius: { glyph: '♐', name: { fr: 'Sagittaire', en: 'Sagittarius', es: 'Sagitario' } }, capricorn: { glyph: '♑', name: { fr: 'Capricorne', en: 'Capricorn', es: 'Capricornio' } },
  aquarius: { glyph: '♒', name: { fr: 'Verseau', en: 'Aquarius', es: 'Acuario' } }, pisces: { glyph: '♓', name: { fr: 'Poissons', en: 'Pisces', es: 'Piscis' } },
}

const repo: [L3, string] = [{ fr: 'propriétaire/nom', en: 'owner/name', es: 'propietario/nombre' }, 'facebook/react']
const channel: [L3, string] = [{ fr: 'Le @ ou le lien d’une chaîne', en: 'A channel @handle or link', es: 'El @ o el enlace de un canal' }, '@Squeezie']
const city = (ex: string): [L3, string] => [{ fr: 'Une ville', en: 'A city', es: 'Una ciudad' }, ex]
const unit: [L3, string] = [{ fr: 'celsius ou fahrenheit', en: 'celsius or fahrenheit', es: 'celsius o fahrenheit' }, 'celsius']
const count = (fr: string, en: string, es: string, ex: string): [L3, string] => [{ fr, en, es }, ex]
const steamHint: [L3, string] = [{ fr: 'Lien du profil, pseudo personnalisé ou numéro Steam (profil public)', en: 'Profile link, custom name or Steam number (public profile)', es: 'Enlace del perfil, nombre personalizado o número de Steam (perfil público)' }, 'https://steamcommunity.com/id/…']
const secretUrl = (fr: string, en: string, es: string, ex: string): [L3, string] => [{ fr, en, es }, ex]

export const CATALOG: CatalogEntry[] = [
  { kind: 'rss', service: 'rss', widget: 'article_list', ai: true, name: { fr: 'Actualités', en: 'News', es: 'Noticias' },
    hints: { link: [{ fr: 'Adresse d’un flux RSS', en: 'An RSS feed address', es: 'Dirección de un feed RSS' }, 'https://www.lemonde.fr/rss/une.xml'],
      number: count('Nombre d’articles', 'Number of articles', 'Número de artículos', '4') } },
  { kind: 'fx', service: 'market_data', widget: 'exchange_rate', name: { fr: 'Taux de change', en: 'Exchange rate', es: 'Tipo de cambio' },
    hints: { base: [{ fr: 'Une cryptomonnaie', en: 'A cryptocurrency', es: 'Una criptomoneda' }, 'bitcoin'],
      quote: [{ fr: 'Une devise', en: 'A currency', es: 'Una moneda' }, 'eur'], days: count('Période en jours (1, 7 ou 30)', 'Period in days (1, 7 or 30)', 'Periodo en días (1, 7 o 30)', '7') } },
  { kind: 'price', service: 'market_data', widget: 'price_history', wide: true, name: { fr: 'Historique de prix', en: 'Price history', es: 'Historial de precios' },
    hints: { asset: [{ fr: 'Une cryptomonnaie', en: 'A cryptocurrency', es: 'Una criptomoneda' }, 'bitcoin'],
      days: count('Nombre de jours', 'Number of days', 'Número de días', '30'), currency: [{ fr: 'Une devise', en: 'A currency', es: 'Una moneda' }, 'usd'] } },
  { kind: 'gh', service: 'github', widget: 'recent_commits', needs: 'github', name: { fr: 'Derniers commits', en: 'Latest commits', es: 'Últimos commits' },
    hints: { repo, number: count('Nombre de commits', 'Number of commits', 'Número de commits', '5') } },
  { kind: 'gh-issues', service: 'github', widget: 'open_issues', needs: 'github', name: { fr: 'Issues ouvertes', en: 'Open issues', es: 'Issues abiertas' },
    hints: { repo, number: count('Nombre d’issues', 'Number of issues', 'Número de issues', '5') } },
  { kind: 'gh-stats', service: 'github', widget: 'repo_stats', needs: 'github', name: { fr: 'Statistiques du dépôt', en: 'Repository stats', es: 'Estadísticas del repositorio' },
    hints: { repo } },
  { kind: 'gh-daily', service: 'github', widget: 'daily_changes', needs: 'github', ai: true, wide: true, name: { fr: 'Ce qui a changé', en: 'What changed', es: 'Qué ha cambiado' },
    hints: { repo, hours: count('Sur combien d’heures (168 max)', 'Over how many hours (168 max)', 'En cuántas horas (168 máx.)', '24') } },
  { kind: 'world', service: 'worldclock', widget: 'world_clock', wide: true, name: { fr: 'Heure du monde', en: 'World clock', es: 'Hora mundial' },
    hints: { homeTimezone: [{ fr: 'Ta ville (ou ton fuseau horaire)', en: 'Your city (or time zone)', es: 'Tu ciudad (o zona horaria)' }, 'Cotonou'],
      cities: [{ fr: 'Villes séparées par des virgules', en: 'Cities separated by commas', es: 'Ciudades separadas por comas' }, 'Paris, New York, Tokyo'] } },
  { kind: 'wx-now', service: 'weather', widget: 'current_weather', ai: true, name: { fr: 'Météo actuelle', en: 'Current weather', es: 'Tiempo actual' },
    hints: { city: city('Cotonou'), unit } },
  { kind: 'weather', service: 'weather', widget: 'daily_forecast', ai: true, wide: true, name: { fr: 'Météo de la semaine', en: 'Weekly weather', es: 'Tiempo de la semana' },
    hints: { city: city('Cotonou'), days: count('Nombre de jours (16 max)', 'Number of days (16 max)', 'Número de días (16 máx.)', '5'), unit } },
  { kind: 'wx-hours', service: 'weather', widget: 'hourly_forecast', wide: true, name: { fr: 'Météo heure par heure', en: 'Hourly weather', es: 'Tiempo por horas' },
    hints: { city: city('Paris'), hours: count('Nombre d’heures (48 max)', 'Number of hours (48 max)', 'Número de horas (48 máx.)', '8'), unit } },
  { kind: 'yt-channel', service: 'youtube', widget: 'channel_stats', name: { fr: 'Statistiques de la chaîne', en: 'Channel stats', es: 'Estadísticas del canal' },
    hints: { channel } },
  { kind: 'yt-latest', service: 'youtube', widget: 'latest_videos', wide: true, name: { fr: 'Dernières vidéos', en: 'Latest videos', es: 'Últimos vídeos' },
    hints: { channel, number: count('Nombre de vidéos', 'Number of videos', 'Número de vídeos', '5') } },
  { kind: 'yt-trend', service: 'youtube', widget: 'trending', wide: true, name: { fr: 'Tendances', en: 'Trending', es: 'Tendencias' },
    hints: { country: [{ fr: 'Code pays à deux lettres', en: 'Two-letter country code', es: 'Código de país de dos letras' }, 'FR'],
      number: count('Nombre de vidéos', 'Number of videos', 'Número de vídeos', '5') } },
  { kind: 'yt-video', service: 'youtube', widget: 'video_stats', name: { fr: 'Statistiques de la vidéo', en: 'Video stats', es: 'Estadísticas del vídeo' },
    hints: { video: [{ fr: 'Le lien ou l’id d’une vidéo', en: 'A video link or id', es: 'El enlace o el id de un vídeo' }, 'https://youtu.be/dQw4w9WgXcQ'] } },
  { kind: 'cal', service: 'calendar', widget: 'upcoming_events', name: { fr: 'Prochain événement', en: 'Next event', es: 'Próximo evento' },
    hints: { url: secretUrl('Adresse iCal (.ics), gardée secrète', 'iCal address (.ics), kept secret', 'Dirección iCal (.ics), guardada en secreto', 'https://calendar.google.com/…/basic.ics'),
      days: count('Sur combien de jours (60 max)', 'Over how many days (60 max)', 'En cuántos días (60 máx.)', '14'),
      number: count('Nombre d’événements (30 max)', 'Number of events (30 max)', 'Número de eventos (30 máx.)', '8') } },
  { kind: 'epi-plan', service: 'epitech', widget: 'planning', name: { fr: 'Planning du jour', en: 'Today’s planning', es: 'Planning del día' },
    hints: { calendarToken: [{ fr: 'Token de « My Epitech > Calendrier », gardé secret', en: 'Token from “My Epitech > Calendar”, kept secret', es: 'Token de «My Epitech > Calendario», guardado en secreto' }, ''],
      days: count('Sur combien de jours', 'Over how many days', 'En cuántos días', '14'), number: count('Nombre d’activités', 'Number of activities', 'Número de actividades', '8') } },
  { kind: 'epi-prof', service: 'epitech', widget: 'profile', needs: 'epitech', name: { fr: 'Mon profil', en: 'My profile', es: 'Mi perfil' }, hints: {} },
  { kind: 'steam-prof', service: 'steam', widget: 'profile', name: { fr: 'Profil Steam', en: 'Steam profile', es: 'Perfil de Steam' }, hints: { steamId: steamHint } },
  { kind: 'steam-recent', service: 'steam', widget: 'recent_games', name: { fr: 'Jeux récents', en: 'Recent games', es: 'Juegos recientes' },
    hints: { steamId: steamHint, number: count('Nombre de jeux (10 max)', 'Number of games (10 max)', 'Número de juegos (10 máx.)', '4') } },
  { kind: 'steam-lib', service: 'steam', widget: 'library_stats', name: { fr: 'Ma bibliothèque', en: 'My library', es: 'Mi biblioteca' }, hints: { steamId: steamHint } },
  { kind: 'quote', service: 'wellbeing', widget: 'daily_quote', name: { fr: 'Citation du jour', en: 'Quote of the day', es: 'Cita del día' }, hints: {} },
  { kind: 'fact', service: 'wellbeing', widget: 'did_you_know', name: { fr: 'Le savais-tu ?', en: 'Did you know?', es: '¿Sabías que…?' }, hints: {} },
  { kind: 'horo', service: 'wellbeing', widget: 'horoscope', ai: true, name: { fr: 'Horoscope', en: 'Horoscope', es: 'Horóscopo' },
    hints: { sign: [{ fr: 'Ton signe, rempli d’après ta date de naissance', en: 'Your sign, filled from your birth date', es: 'Tu signo, rellenado según tu fecha de nacimiento' }, 'capricorn'] } },
  { kind: 'api-value', service: 'custom_api', widget: 'json_value', name: { fr: 'Une valeur', en: 'One value', es: 'Un valor' },
    hints: { url: secretUrl('Adresse d’une API JSON publique, gardée secrète', 'A public JSON API address, kept secret', 'Dirección de una API JSON pública, guardada en secreto', 'http://api.open-notify.org/astros.json'),
      path: [{ fr: 'Chemin du champ, ex. data.items[0].price', en: 'Path to the field, e.g. data.items[0].price', es: 'Ruta del campo, p. ej. data.items[0].price' }, 'number'],
      label: [{ fr: 'Nom affiché', en: 'Displayed name', es: 'Nombre mostrado' }, 'Humains dans l’espace'], unit: [{ fr: 'Unité', en: 'Unit', es: 'Unidad' }, 'personnes'] } },
  { kind: 'api-list', service: 'custom_api', widget: 'json_list', name: { fr: 'Une liste', en: 'A list', es: 'Una lista' },
    hints: { url: secretUrl('Adresse d’une API JSON publique, gardée secrète', 'A public JSON API address, kept secret', 'Dirección de una API JSON pública, guardada en secreto', 'https://api.github.com/search/repositories?q=stars:>100000'),
      path: [{ fr: 'Chemin de la liste', en: 'Path to the list', es: 'Ruta de la lista' }, 'items'],
      titleField: [{ fr: 'Champ du titre', en: 'Title field', es: 'Campo del título' }, 'full_name'],
      subtitleField: [{ fr: 'Champ du sous-titre', en: 'Subtitle field', es: 'Campo del subtítulo' }, 'description'],
      number: count('Nombre d’éléments (30 max)', 'Number of items (30 max)', 'Número de elementos (30 máx.)', '8') } },
]

export const entryFor = (serviceName: string, widgetName: string) =>
  CATALOG.find((e) => e.service === serviceName && e.widget === widgetName)

// Last step before a config is sent: the world clock gets its cities turned into IANA time zones.
// Throws an Error with a message for the user when something typed can't be understood.
export function prepareConfig(serviceName: string, widgetName: string, config: Record<string, string | number>, lang: Lang) {
  if (serviceName !== 'worldclock' || widgetName !== 'world_clock') return config
  const out = { ...config }
  if (out.homeTimezone) {
    const tz = toTimeZone(String(out.homeTimezone))
    if (!tz) throw new Error(W[lang].unknownZone(String(out.homeTimezone)))
    out.homeTimezone = tz
  }
  if (out.cities) {
    const { zones, unknown } = toTimeZones(String(out.cities))
    if (unknown.length) throw new Error(W[lang].unknownZone(unknown.join(', ')))
    out.cities = zones.join(', ')
  }
  return out
}

export const REFRESH_RATES: [number, string][] = [[30, '30 s'], [60, '1 min'], [300, '5 min'], [900, '15 min'], [3600, '1 h']]
export const rateLabel = (sec: number) => REFRESH_RATES.find(([s]) => s === sec)?.[1] ?? (sec < 60 ? `${sec} s` : sec < 3600 ? `${Math.round(sec / 60)} min` : `${Math.round(sec / 3600)} h`)

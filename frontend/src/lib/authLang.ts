import { useSyncExternalStore } from 'react'
import { LANGS, type Lang } from './i18n'

// Language of the pages seen before logging in (login, sign-up). It starts from the language saved by the
// last dashboard visit, else the browser's language; the FR / EN / ES switch on those pages changes it.
// Once logged in, the account's own language (PATCH /auth/me) takes over and is remembered here too.
const KEY = 'morex.lang'
const listeners = new Set<() => void>()

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved && LANGS.includes(saved as Lang)) return saved as Lang
  } catch {
    // storage blocked: fall back to the browser language
  }
  const browser = (navigator.language || 'en').slice(0, 2)
  return LANGS.includes(browser as Lang) ? (browser as Lang) : 'en'
}

let current: Lang = initial()

export function setAuthLang(lang: Lang) {
  current = lang
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    // not saved, still applied for this visit
  }
  listeners.forEach((l) => l())
}

export function useAuthLang(): Lang {
  return useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), () => current)
}

export const AUTH = {
  fr: {
    slogan: 'Ton univers, en un coup d’œil', welcome: 'Bienvenue', loginSub: 'Connecte-toi à ton univers', newHere: 'Nouveau sur Morex ?', create: 'Créer un compte',
    email: 'E-mail', password: 'Mot de passe', yourPassword: 'Ton mot de passe', loggingIn: 'Connexion…', login: 'Se connecter', or: 'ou', github: 'Continuer avec GitHub',
    signUp: 'Inscription', signUpSub: 'Crée ton compte et pars explorer', member: 'Déjà membre ?', signIn: 'Se connecter', firstName: 'Prénom', lastName: 'Nom',
    birth: 'Date de naissance', birthNote: 'Sert à ton horoscope : seul ton signe est utilisé', atLeast8: 'Au moins 8 caractères', confirm: 'Confirme le mot de passe',
    again: 'Tape-le à nouveau', creating: 'Création du compte…', createBtn: 'Créer mon compte', inbox: 'Regarde ta boîte mail',
    sent: 'Nous avons envoyé un lien de confirmation à', sentEnd: 'Clique dessus pour activer ton compte, puis', goLogin: 'connecte-toi',
    microsoft: 'Continuer avec Microsoft (école)', epitech: 'Continuer avec My Epitech', notReady: 'Pas encore disponible : l’application doit être déclarée par l’école', mismatch: 'Les mots de passe ne correspondent pas', wrong: 'Une erreur est survenue', show: 'Afficher le mot de passe', hide: 'Masquer le mot de passe',
  },
  en: {
    slogan: 'Your universe, at a glance', welcome: 'Welcome', loginSub: 'Log in to your universe', newHere: 'New to Morex?', create: 'Create an account',
    email: 'Email', password: 'Password', yourPassword: 'Your password', loggingIn: 'Logging in…', login: 'Log in', or: 'or', github: 'Continue with GitHub',
    signUp: 'Sign up', signUpSub: 'Create your account and start exploring', member: 'Already a member?', signIn: 'Sign in', firstName: 'First name', lastName: 'Last name',
    birth: 'Date of birth', birthNote: 'Used for your horoscope: only your zodiac sign is used', atLeast8: 'At least 8 characters', confirm: 'Confirm password',
    again: 'Type it again', creating: 'Creating account…', createBtn: 'Create account', inbox: 'Check your inbox',
    sent: 'We sent a confirmation link to', sentEnd: 'Click it to activate your account, then', goLogin: 'log in',
    microsoft: 'Continue with Microsoft (school)', epitech: 'Continue with My Epitech', notReady: 'Not available yet: the app must be registered by the school', mismatch: 'Passwords do not match', wrong: 'Something went wrong', show: 'Show password', hide: 'Hide password',
  },
  es: {
    slogan: 'Tu universo, de un vistazo', welcome: 'Bienvenido', loginSub: 'Inicia sesión en tu universo', newHere: '¿Nuevo en Morex?', create: 'Crear una cuenta',
    email: 'Correo', password: 'Contraseña', yourPassword: 'Tu contraseña', loggingIn: 'Iniciando sesión…', login: 'Iniciar sesión', or: 'o', github: 'Continuar con GitHub',
    signUp: 'Registro', signUpSub: 'Crea tu cuenta y empieza a explorar', member: '¿Ya eres miembro?', signIn: 'Iniciar sesión', firstName: 'Nombre', lastName: 'Apellido',
    birth: 'Fecha de nacimiento', birthNote: 'Sirve para tu horóscopo: solo se usa tu signo', atLeast8: 'Al menos 8 caracteres', confirm: 'Confirma la contraseña',
    again: 'Escríbela otra vez', creating: 'Creando la cuenta…', createBtn: 'Crear mi cuenta', inbox: 'Revisa tu correo',
    sent: 'Hemos enviado un enlace de confirmación a', sentEnd: 'Haz clic en él para activar tu cuenta y luego', goLogin: 'inicia sesión',
    microsoft: 'Continuar con Microsoft (escuela)', epitech: 'Continuar con My Epitech', notReady: 'Aún no disponible: la escuela debe registrar la aplicación', mismatch: 'Las contraseñas no coinciden', wrong: 'Algo ha fallado', show: 'Mostrar la contraseña', hide: 'Ocultar la contraseña',
  },
}

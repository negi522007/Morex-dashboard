import type { Lang } from './i18n'

// Text of /terms and /privacy, in plain language (a student project, not a company). The full technical
// version is docs/PRIVACY.md — keep both saying the same thing. **bold** marks the words to stress.

export type LegalDoc = 'terms' | 'privacy'
export type LegalIcon = 'galaxy' | 'handshake' | 'shield' | 'trash' | 'inbox' | 'robot' | 'eye' | 'box'
export interface LegalText { title: string; intro?: string; sections: { icon: LegalIcon; title: string; items: string[] }[] }

export const LEGAL_UPDATED = '2026-10-09'

export const LEGAL_UI: Record<Lang, { back: string; updated: (d: string) => string; sign: string; tabs: Record<LegalDoc, string> }> = {
  fr: { back: '← Retour', updated: (d) => `Mis à jour le ${d}`, sign: '— L’équipe Morex ✦', tabs: { terms: 'Conditions d’utilisation', privacy: 'Politique de confidentialité' } },
  en: { back: '← Back', updated: (d) => `Updated on ${d}`, sign: '— The Morex team ✦', tabs: { terms: 'Terms of Service', privacy: 'Privacy Policy' } },
  es: { back: '← Volver', updated: (d) => `Actualizado el ${d}`, sign: '— El equipo de Morex ✦', tabs: { terms: 'Términos del servicio', privacy: 'Política de privacidad' } },
}

export const LEGAL: Record<LegalDoc, Record<Lang, LegalText>> = {
  terms: {
    fr: {
      title: 'Conditions d’utilisation',
      intro: 'Morex est un projet étudiant réalisé dans le cadre d’un cursus Epitech, pas un produit commercial.',
      sections: [
        { icon: 'galaxy', title: 'Ce que tu peux attendre', items: ['Un compte **gratuit**, sans publicité, sans revente de tes données à qui que ce soit.', 'Le code source est disponible sur le dépôt GitHub du projet.', 'Le service peut être interrompu, modifié ou arrêté à tout moment : c’est un projet pédagogique, sans engagement de disponibilité.'] },
        { icon: 'handshake', title: 'Ce qu’on attend de toi', items: ['Ne pas utiliser l’appli pour du **contenu illégal** ou pour nuire à d’autres utilisateurs.', 'Ne pas essayer de contourner les protections de sécurité (limites de requêtes, quotas, filtrage des adresses).', '**Un compte, une personne** : pas de comptes créés en masse.'] },
        { icon: 'shield', title: 'Modération', items: ['Un administrateur peut **suspendre** ou **supprimer** un compte qui ne respecte pas ces règles.', 'Tu reçois toujours un **e-mail avec le motif**, et tu peux y répondre pour t’expliquer : une vraie personne le lira.'] },
        { icon: 'trash', title: 'Supprimer ton compte', items: ['Depuis ton profil, à tout moment : suppression **immédiate et définitive** de ton compte et de toutes tes données.', 'Avant de partir, tu peux **télécharger tes données** en un fichier JSON.'] },
      ],
    },
    en: {
      title: 'Terms of Service',
      intro: 'Morex is a student project built as part of an Epitech program, not a commercial product.',
      sections: [
        { icon: 'galaxy', title: 'What you can expect', items: ['A **free** account, no ads, your data is never resold to anyone.', 'The source code is available on the project’s GitHub repository.', 'The service may be interrupted, changed or shut down at any time: it is a teaching project, with no uptime commitment.'] },
        { icon: 'handshake', title: 'What we expect from you', items: ['Don’t use the app for **illegal content** or to harm other users.', 'Don’t try to bypass its security protections (rate limits, quotas, address filtering).', '**One account, one person**: no accounts created in bulk.'] },
        { icon: 'shield', title: 'Moderation', items: ['An administrator can **suspend** or **delete** an account that breaks these rules.', 'You always get an **email with the reason**, and you can reply to explain yourself: a real person will read it.'] },
        { icon: 'trash', title: 'Deleting your account', items: ['From your profile, at any time: your account and all your data are deleted **immediately and for good**.', 'Before you go, you can **download your data** as one JSON file.'] },
      ],
    },
    es: {
      title: 'Términos del servicio',
      intro: 'Morex es un proyecto estudiantil realizado en un programa de Epitech, no un producto comercial.',
      sections: [
        { icon: 'galaxy', title: 'Qué puedes esperar', items: ['Una cuenta **gratuita**, sin publicidad, sin reventa de tus datos a nadie.', 'El código fuente está disponible en el repositorio de GitHub del proyecto.', 'El servicio puede interrumpirse, modificarse o detenerse en cualquier momento: es un proyecto pedagógico, sin garantía de disponibilidad.'] },
        { icon: 'handshake', title: 'Qué esperamos de ti', items: ['No usar la app para **contenido ilegal** ni para perjudicar a otros usuarios.', 'No intentar eludir las protecciones de seguridad (límites de peticiones, cuotas, filtrado de direcciones).', '**Una cuenta, una persona**: sin cuentas creadas en masa.'] },
        { icon: 'shield', title: 'Moderación', items: ['Un administrador puede **suspender** o **eliminar** una cuenta que no respete estas reglas.', 'Siempre recibes un **email con el motivo**, y puedes responder para explicarte: lo leerá una persona real.'] },
        { icon: 'trash', title: 'Eliminar tu cuenta', items: ['Desde tu perfil, en cualquier momento: tu cuenta y todos tus datos se eliminan **de inmediato y para siempre**.', 'Antes de irte, puedes **descargar tus datos** en un archivo JSON.'] },
      ],
    },
  },
  privacy: {
    fr: {
      title: 'Politique de confidentialité',
      sections: [
        { icon: 'inbox', title: 'Ce qu’on collecte', items: ['**E-mail et nom**, pour identifier ton compte et le personnaliser.', '**Mot de passe** : jamais stocké en clair (haché avec scrypt, personne ne peut le retrouver).', '**Comptes liés** (GitHub, Google, Microsoft, My Epitech) : leurs accès sont chiffrés (AES-256-GCM), et on garde leur nom public (ton pseudo GitHub, ton e-mail).', 'Ce que tes **widgets** récupèrent (actus, cours…), mis en cache pour ne pas tout re-télécharger.', 'Ton **journal**, si tu en écris un : chiffré.', '**Date de naissance** (optionnelle) : uniquement pour ton signe et vérifier que tu as 13 ans ou plus.', '**Tes connexions** : quand tu t’es connecté, ta dernière activité et le navigateur de chaque session (ex. « Chrome · Linux »). Pas d’adresse IP, pas de localisation.'] },
        { icon: 'robot', title: 'IA (optionnelle)', items: ['Seulement si tu actives l’IA sur un widget : certaines données partent vers le fournisseur d’IA pour générer un résumé.', '**Jamais** ton mot de passe, tes tokens, ton journal ou ton e-mail.'] },
        { icon: 'eye', title: 'Qui peut voir quoi', items: ['Toi seul vois tes données.', 'Un **administrateur** voit les informations de ton compte : nom, e-mail, avatar, date de naissance, dernière connexion, navigateurs connectés, comptes liés et la liste de tes widgets (leur type et s’ils fonctionnent).', 'Il ne voit **jamais** ton mot de passe, tes tokens, les réglages ou le contenu de tes widgets, ni ton journal.'] },
        { icon: 'box', title: 'Tes droits', items: ['**Télécharger** toutes tes données en un fichier JSON depuis ton profil.', '**Supprimer** ton compte et tout ce qu’il contient, à tout moment.', 'Modifier ton nom, ton mot de passe ou ta date de naissance quand tu veux.'] },
      ],
    },
    en: {
      title: 'Privacy Policy',
      sections: [
        { icon: 'inbox', title: 'What we collect', items: ['**Email and name**, to identify your account and make it yours.', '**Password**: never stored as is (hashed with scrypt, nobody can recover it).', '**Linked accounts** (GitHub, Google, Microsoft, My Epitech): their access keys are encrypted (AES-256-GCM), and we keep their public name (your GitHub username, your email).', 'What your **widgets** fetch (news, prices…), cached so it isn’t downloaded again on every view.', 'Your **journal**, if you write one: encrypted.', '**Date of birth** (optional): only for your sign and to check you are 13 or older.', '**Your sign-ins**: when you logged in, your last activity and the browser of each session (e.g. “Chrome · Linux”). No IP address, no location.'] },
        { icon: 'robot', title: 'AI (opt-in)', items: ['Only if you turn AI on for a widget: some data goes to the AI provider to write a summary.', '**Never** your password, your tokens, your journal or your email.'] },
        { icon: 'eye', title: 'Who can see what', items: ['Only you see your data.', 'An **administrator** sees your account’s information: name, email, avatar, date of birth, last login, signed-in browsers, linked accounts and the list of your widgets (their type and whether they work).', 'They **never** see your password, your tokens, your widgets’ settings or content, nor your journal.'] },
        { icon: 'box', title: 'Your rights', items: ['**Download** all your data as one JSON file from your profile.', '**Delete** your account and everything in it, at any time.', 'Change your name, password or date of birth whenever you want.'] },
      ],
    },
    es: {
      title: 'Política de privacidad',
      sections: [
        { icon: 'inbox', title: 'Qué recogemos', items: ['**Email y nombre**, para identificar tu cuenta y personalizarla.', '**Contraseña**: nunca se guarda tal cual (hash con scrypt, nadie puede recuperarla).', '**Cuentas vinculadas** (GitHub, Google, Microsoft, My Epitech): sus accesos están cifrados (AES-256-GCM), y guardamos su nombre público (tu usuario de GitHub, tu email).', 'Lo que tus **widgets** obtienen (noticias, cotizaciones…), en caché para no descargarlo en cada visita.', 'Tu **diario**, si escribes uno: cifrado.', '**Fecha de nacimiento** (opcional): solo para tu signo y comprobar que tienes 13 años o más.', '**Tus conexiones**: cuándo iniciaste sesión, tu última actividad y el navegador de cada sesión (p. ej. «Chrome · Linux»). Sin dirección IP, sin ubicación.'] },
        { icon: 'robot', title: 'IA (opcional)', items: ['Solo si activas la IA en un widget: algunos datos van al proveedor de IA para generar un resumen.', '**Nunca** tu contraseña, tus tokens, tu diario ni tu email.'] },
        { icon: 'eye', title: 'Quién puede ver qué', items: ['Solo tú ves tus datos.', 'Un **administrador** ve la información de tu cuenta: nombre, email, avatar, fecha de nacimiento, última conexión, navegadores conectados, cuentas vinculadas y la lista de tus widgets (su tipo y si funcionan).', '**Nunca** ve tu contraseña, tus tokens, los ajustes o el contenido de tus widgets, ni tu diario.'] },
        { icon: 'box', title: 'Tus derechos', items: ['**Descargar** todos tus datos en un archivo JSON desde tu perfil.', '**Eliminar** tu cuenta y todo lo que contiene, en cualquier momento.', 'Cambiar tu nombre, contraseña o fecha de nacimiento cuando quieras.'] },
      ],
    },
  },
}

import { LegalPage } from './LegalPage'

const TITLE = { fr: 'Politique de confidentialité', en: 'Privacy Policy', es: 'Política de privacidad' }
const BACK = { fr: '← Retour à l’inscription', en: '← Back to sign up', es: '← Volver al registro' }
const FULL_DOC = 'https://github.com/EpitechPGE3-2026/G-WEB-500-COT-5-1-dashboard-44/blob/main/PRIVACY.md'

export function PrivacyPage() {
  return (
    <LegalPage titleKey={TITLE} backKey={BACK}>
      {(lang) =>
        lang === 'fr' ? (
          <>
            <p>Note en langage simple sur ce que cette appli collecte et pourquoi — pas un document juridique. C'est un projet étudiant (Epitech), pas une entreprise.</p>
            <h2>Ce qu'on collecte</h2>
            <ul>
              <li>Email et nom, pour identifier ton compte et le personnaliser.</li>
              <li>Mot de passe — jamais stocké en clair (haché avec scrypt, personne ne peut le retrouver).</li>
              <li>Tokens de comptes liés (GitHub, Microsoft, My Epitech) — chiffrés (AES-256-GCM), jamais renvoyés en clair.</li>
              <li>Les données que tes widgets récupèrent (flux RSS, cours de crypto…), mises en cache pour éviter de re-télécharger à chaque affichage.</li>
              <li>Ton journal, si tu en écris un — chiffré, même un admin ne peut pas le lire.</li>
              <li>Date de naissance (optionnelle) — sert uniquement à ton signe astrologique et à vérifier que tu as 13 ans ou plus.</li>
            </ul>
            <h2>IA (optionnelle)</h2>
            <p>Si le serveur a une clé IA configurée et que tu actives l'IA sur un widget, certaines données (jamais ton mot de passe, tes tokens, ton journal ou ton email) partent vers le fournisseur d'IA pour générer un résumé ou une réponse.</p>
            <h2>Qui peut voir quoi</h2>
            <p>Un administrateur voit les métadonnées de compte (email, nom, statut) mais jamais le contenu de ton journal, jamais tes mots de passe ou tokens en clair.</p>
            <p>Détail technique complet (chiffrement, hachage, ce qu'on ne fait pas) : <a className="underline decoration-white/40 hover:text-white" href={FULL_DOC} target="_blank" rel="noopener noreferrer">PRIVACY.md sur le dépôt</a>.</p>
          </>
        ) : lang === 'es' ? (
          <>
            <p>Nota en lenguaje sencillo sobre lo que esta app recoge y por qué — no es un documento legal. Es un proyecto estudiantil (Epitech), no una empresa.</p>
            <h2>Qué recogemos</h2>
            <ul>
              <li>Correo y nombre, para identificar tu cuenta y personalizarla.</li>
              <li>Contraseña — nunca almacenada en texto plano (con scrypt, nadie puede recuperarla).</li>
              <li>Tokens de cuentas vinculadas (GitHub, Microsoft, My Epitech) — cifrados (AES-256-GCM), nunca devueltos en claro.</li>
              <li>Los datos que tus widgets obtienen (feeds RSS, precios de cripto…), guardados en caché para no volver a descargarlos cada vez.</li>
              <li>Tu diario, si escribes uno — cifrado, ni siquiera un administrador puede leerlo.</li>
              <li>Fecha de nacimiento (opcional) — solo para tu signo del zodiaco y para verificar que tienes 13 años o más.</li>
            </ul>
            <h2>IA (opcional)</h2>
            <p>Si el servidor tiene una clave de IA configurada y activas la IA en un widget, algunos datos (nunca tu contraseña, tokens, diario o correo) se envían al proveedor de IA para generar un resumen o una respuesta.</p>
            <h2>Quién puede ver qué</h2>
            <p>Un administrador ve los metadatos de la cuenta (correo, nombre, estado) pero nunca el contenido de tu diario, ni tus contraseñas o tokens en claro.</p>
            <p>Detalle técnico completo (cifrado, hash, lo que no hacemos): <a className="underline decoration-white/40 hover:text-white" href={FULL_DOC} target="_blank" rel="noopener noreferrer">PRIVACY.md en el repositorio</a>.</p>
          </>
        ) : (
          <>
            <p>Plain-language note on what this app collects and why — not a legal document. This is a student project (Epitech), not a company.</p>
            <h2>What we collect</h2>
            <ul>
              <li>Email and name, to identify your account and personalize it.</li>
              <li>Password — never stored as-is (hashed with scrypt, nobody can recover it).</li>
              <li>Tokens of linked accounts (GitHub, Microsoft, My Epitech) — encrypted (AES-256-GCM), never returned in clear.</li>
              <li>What your widgets fetch (RSS feeds, crypto prices…), cached so it isn't re-downloaded on every view.</li>
              <li>Your journal, if you write one — encrypted, not even an admin can read it.</li>
              <li>Date of birth (optional) — used only for your zodiac sign and to check you're 13+.</li>
            </ul>
            <h2>AI (opt-in)</h2>
            <p>If the server has an AI key configured and you turn AI on for a widget, some data (never your password, tokens, journal or email) is sent to the AI provider to generate a summary or reply.</p>
            <h2>Who can see what</h2>
            <p>An admin sees account metadata (email, name, status) but never your journal content, never your passwords or tokens in clear.</p>
            <p>Full technical detail (encryption, hashing, what we don't do): <a className="underline decoration-white/40 hover:text-white" href={FULL_DOC} target="_blank" rel="noopener noreferrer">PRIVACY.md on the repo</a>.</p>
          </>
        )
      }
    </LegalPage>
  )
}

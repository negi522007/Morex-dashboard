import { LegalPage } from './LegalPage'

const TITLE = { fr: 'Conditions d’utilisation', en: 'Terms of Service', es: 'Términos del servicio' }
const BACK = { fr: '← Retour à l’inscription', en: '← Back to sign up', es: '← Volver al registro' }

export function TermsPage() {
  return (
    <LegalPage titleKey={TITLE} backKey={BACK}>
      {(lang) =>
        lang === 'fr' ? (
          <>
            <p>Morex est un projet étudiant réalisé dans le cadre d'un cursus Epitech — pas un produit commercial. Ces conditions sont volontairement courtes et en langage clair, à l'image de ce projet.</p>
            <h2>Ce que tu peux attendre</h2>
            <ul>
              <li>Un compte gratuit, sans publicité, sans revente de tes données à qui que ce soit.</li>
              <li>Le code source est disponible sur le dépôt GitHub du projet.</li>
              <li>Le service peut être interrompu, modifié ou arrêté à tout moment (projet pédagogique, pas d'engagement de disponibilité).</li>
            </ul>
            <h2>Ce qu'on attend de toi</h2>
            <ul>
              <li>Ne pas utiliser l'appli pour du contenu illégal ou pour nuire à d'autres utilisateurs.</li>
              <li>Ne pas essayer de contourner les protections de sécurité (SSRF, limites de requêtes, quotas).</li>
              <li>Un compte, une personne — pas de comptes créés en masse.</li>
            </ul>
            <h2>Suppression de compte</h2>
            <p>Tu peux supprimer ton compte et toutes tes données à tout moment depuis ton profil — suppression immédiate et définitive.</p>
            <p>Pour le détail de ce qui est collecté et comment c'est protégé, voir la <a className="underline decoration-white/40 hover:text-white" href="/privacy">Politique de confidentialité</a>.</p>
          </>
        ) : lang === 'es' ? (
          <>
            <p>Morex es un proyecto estudiantil realizado en un programa de Epitech — no un producto comercial. Estos términos son deliberadamente cortos y en lenguaje claro, como el resto del proyecto.</p>
            <h2>Qué puedes esperar</h2>
            <ul>
              <li>Una cuenta gratuita, sin publicidad, sin reventa de tus datos a nadie.</li>
              <li>El código fuente está disponible en el repositorio de GitHub del proyecto.</li>
              <li>El servicio puede interrumpirse, modificarse o detenerse en cualquier momento (proyecto pedagógico, sin garantía de disponibilidad).</li>
            </ul>
            <h2>Qué esperamos de ti</h2>
            <ul>
              <li>No usar la app para contenido ilegal ni para perjudicar a otros usuarios.</li>
              <li>No intentar eludir las protecciones de seguridad (SSRF, límites de peticiones, cuotas).</li>
              <li>Una cuenta, una persona — sin cuentas creadas en masa.</li>
            </ul>
            <h2>Eliminación de cuenta</h2>
            <p>Puedes eliminar tu cuenta y todos tus datos en cualquier momento desde tu perfil — eliminación inmediata y definitiva.</p>
            <p>Para el detalle de lo que se recoge y cómo se protege, consulta la <a className="underline decoration-white/40 hover:text-white" href="/privacy">Política de privacidad</a>.</p>
          </>
        ) : (
          <>
            <p>Morex is a student project built as part of an Epitech program — not a commercial product. These terms are deliberately short and in plain language, like the rest of this project.</p>
            <h2>What you can expect</h2>
            <ul>
              <li>A free account, no ads, your data is never resold to anyone.</li>
              <li>The source code is available on the project's GitHub repository.</li>
              <li>The service may be interrupted, changed or shut down at any time (a teaching project, no uptime commitment).</li>
            </ul>
            <h2>What we expect from you</h2>
            <ul>
              <li>Don't use the app for illegal content or to harm other users.</li>
              <li>Don't try to bypass its security protections (SSRF guard, rate limits, quotas).</li>
              <li>One account per person — no mass-created accounts.</li>
            </ul>
            <h2>Deleting your account</h2>
            <p>You can delete your account and all your data at any time from your profile — immediate and permanent.</p>
            <p>For the detail of what's collected and how it's protected, see the <a className="underline decoration-white/40 hover:text-white" href="/privacy">Privacy Policy</a>.</p>
          </>
        )
      }
    </LegalPage>
  )
}

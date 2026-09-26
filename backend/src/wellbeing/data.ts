import type { Zodiac } from '../common/birth-date.util';

// [English, French, Spanish]
export type L3 = [string, string, string];

// Real, attributed sayings (a few are proverbs, marked as such). One is picked per day.
export interface Quote {
  author: string;
  text: L3;
}
export const QUOTES: Quote[] = [
  { author: 'Lao Tzu', text: ['A journey of a thousand miles begins with a single step.', 'Un voyage de mille lieues commence toujours par un premier pas.', 'Un viaje de mil millas comienza con un solo paso.'] },
  { author: 'Nelson Mandela', text: ['It always seems impossible until it is done.', 'Cela semble toujours impossible jusqu’à ce que ce soit fait.', 'Siempre parece imposible hasta que se hace.'] },
  { author: 'Nelson Mandela', text: ['Courage is not the absence of fear, but the triumph over it.', 'Le courage n’est pas l’absence de peur, mais la capacité de la vaincre.', 'El valor no es la ausencia de miedo, sino el triunfo sobre él.'] },
  { author: 'Robert Collier', text: ['Success is the sum of small efforts, repeated day in and day out.', 'Le succès est la somme de petits efforts répétés jour après jour.', 'El éxito es la suma de pequeños esfuerzos repetidos día tras día.'] },
  { author: 'Will Durant', text: ['We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Nous sommes ce que nous faisons de manière répétée. L’excellence n’est donc pas un acte, mais une habitude.', 'Somos lo que hacemos repetidamente. La excelencia, entonces, no es un acto, sino un hábito.'] },
  { author: 'Marcus Aurelius', text: ['What stands in the way becomes the way.', 'Ce qui fait obstacle devient le chemin.', 'Lo que se interpone en el camino se convierte en el camino.'] },
  { author: 'Marie Curie', text: ['Nothing in life is to be feared, it is only to be understood.', 'Dans la vie, rien n’est à craindre, tout est à comprendre.', 'Nada en la vida debe ser temido, solo comprendido.'] },
  { author: 'Friedrich Nietzsche', text: ['He who has a why to live can bear almost any how.', 'Celui qui a un pourquoi qui lui tient lieu de but peut vivre avec presque n’importe quel comment.', 'Quien tiene un porqué para vivir puede soportar casi cualquier cómo.'] },
  { author: 'Friedrich Nietzsche', text: ['What does not kill me makes me stronger.', 'Ce qui ne me tue pas me rend plus fort.', 'Lo que no me mata me hace más fuerte.'] },
  { author: 'Seneca', text: ['If one does not know to which port one is sailing, no wind is favourable.', 'Quand on ne sait pas dans quel port on va, aucun vent n’est favorable.', 'Si uno no sabe a qué puerto navega, ningún viento es favorable.'] },
  { author: 'Alan Kay', text: ['The best way to predict the future is to invent it.', 'La meilleure façon de prédire l’avenir est de l’inventer.', 'La mejor manera de predecir el futuro es inventarlo.'] },
  { author: 'Antonio Machado', text: ['Traveller, there is no path; the path is made by walking.', 'Voyageur, il n’y a pas de chemin ; le chemin se fait en marchant.', 'Caminante, no hay camino, se hace camino al andar.'] },
  { author: 'Jean de La Fontaine', text: ['There is no use in running; what matters is to set out on time.', 'Rien ne sert de courir ; il faut partir à point.', 'De nada sirve correr; hay que salir a tiempo.'] },
  { author: 'Emily Dickinson', text: ['Hope is the thing with feathers that perches in the soul.', 'L’espoir est cette chose à plumes qui se perche dans l’âme.', 'La esperanza es esa cosa con plumas que se posa en el alma.'] },
  { author: 'Proverb', text: ['Fall seven times, stand up eight.', 'Tombe sept fois, relève-toi huit.', 'Cae siete veces, levántate ocho.'] },
  { author: 'Proverb', text: ['A smooth sea never made a skilled sailor.', 'Une mer calme n’a jamais fait un bon marin.', 'Un mar en calma nunca hizo a un buen marinero.'] },
  { author: 'Proverb', text: ['Little by little, the bird builds its nest.', 'Petit à petit, l’oiseau fait son nid.', 'Poco a poco, el pájaro hace su nido.'] },
  { author: 'Proverb', text: ['Better late than never.', 'Mieux vaut tard que jamais.', 'Más vale tarde que nunca.'] },
  { author: 'Aristotle', text: ['Well begun is half done.', 'Bien commencé, c’est à moitié fait.', 'Bien empezado está medio hecho.'] },
  { author: 'Maya Angelou', text: ['You may encounter many defeats, but you must not be defeated.', 'Vous pouvez rencontrer bien des défaites, mais vous ne devez pas être vaincu.', 'Puedes encontrarte con muchas derrotas, pero no debes ser derrotado.'] },
];

export type StepType = 'inhale' | 'hold' | 'exhale';
export interface Breathing {
  id: string;
  name: L3;
  steps: { type: StepType; seconds: number }[];
  rounds: number;
  why: L3;
}
// Widely taught techniques. Not medical advice; stop if dizzy.
export const BREATHING: Breathing[] = [
  { id: 'box', name: ['Box breathing', 'Respiration carrée', 'Respiración cuadrada'], rounds: 4,
    steps: [{ type: 'inhale', seconds: 4 }, { type: 'hold', seconds: 4 }, { type: 'exhale', seconds: 4 }, { type: 'hold', seconds: 4 }],
    why: ['Four equal counts; steadies the mind before a task or a stressful moment.', 'Quatre temps égaux ; pose l’esprit avant une tâche ou un moment stressant.', 'Cuatro tiempos iguales; calma la mente antes de una tarea o un momento de estrés.'] },
  { id: '478', name: ['4-7-8 breathing', 'Respiration 4-7-8', 'Respiración 4-7-8'], rounds: 4,
    steps: [{ type: 'inhale', seconds: 4 }, { type: 'hold', seconds: 7 }, { type: 'exhale', seconds: 8 }],
    why: ['A long exhale slows the body down; often used to wind down before sleep.', 'Une longue expiration ralentit le corps ; souvent utilisée pour se détendre avant de dormir.', 'Una espiración larga ralentiza el cuerpo; se usa para relajarse antes de dormir.'] },
  { id: 'coherent', name: ['Coherent breathing', 'Cohérence cardiaque', 'Respiración coherente'], rounds: 6,
    steps: [{ type: 'inhale', seconds: 5 }, { type: 'exhale', seconds: 5 }],
    why: ['About six breaths a minute, evenly; a gentle daily reset (5 minutes is the usual routine).', 'Environ six respirations par minute, régulières ; une remise à zéro douce au quotidien (5 minutes en général).', 'Unas seis respiraciones por minuto, regulares; un reinicio suave diario (5 minutos es lo habitual).'] },
];

export type TipCategory = 'hydration' | 'movement' | 'eyes' | 'sleep' | 'focus' | 'mind' | 'social';
export interface Tip { category: TipCategory; text: L3 }
export const TIPS: Tip[] = [
  { category: 'hydration', text: ['Drink a glass of water now — before you check anything else.', 'Bois un verre d’eau maintenant — avant de regarder autre chose.', 'Bebe un vaso de agua ahora — antes de mirar cualquier otra cosa.'] },
  { category: 'eyes', text: ['20-20-20: every 20 minutes, look at something 20 feet (6 m) away for 20 seconds.', '20-20-20 : toutes les 20 minutes, regarde quelque chose à 6 m pendant 20 secondes.', '20-20-20: cada 20 minutos, mira algo a 6 m durante 20 segundos.'] },
  { category: 'movement', text: ['Stand up and stretch your shoulders and neck for one minute.', 'Lève-toi et étire épaules et nuque pendant une minute.', 'Levántate y estira hombros y cuello durante un minuto.'] },
  { category: 'movement', text: ['A ten-minute walk after a meal helps energy and digestion.', 'Dix minutes de marche après un repas aident l’énergie et la digestion.', 'Diez minutos de paseo tras comer ayudan a la energía y la digestión.'] },
  { category: 'sleep', text: ['Aim for the same bedtime tonight; regular hours matter more than a perfect night.', 'Vise la même heure de coucher ce soir ; des horaires réguliers comptent plus qu’une nuit parfaite.', 'Intenta acostarte a la misma hora esta noche; la regularidad importa más que una noche perfecta.'] },
  { category: 'sleep', text: ['Put screens away 30 minutes before bed; the light and the scrolling keep the brain awake.', 'Range les écrans 30 minutes avant de dormir ; la lumière et le défilement gardent le cerveau éveillé.', 'Aparta las pantallas 30 minutos antes de dormir; la luz y el desplazamiento mantienen el cerebro despierto.'] },
  { category: 'focus', text: ['Pick the one thing that matters today and do it first, before messages.', 'Choisis la seule chose qui compte aujourd’hui et fais-la en premier, avant les messages.', 'Elige lo único que importa hoy y hazlo primero, antes que los mensajes.'] },
  { category: 'focus', text: ['Work in 25-minute blocks with 5-minute breaks (the Pomodoro method).', 'Travaille par blocs de 25 minutes avec 5 minutes de pause (méthode Pomodoro).', 'Trabaja en bloques de 25 minutos con 5 de descanso (método Pomodoro).'] },
  { category: 'mind', text: ['Write down three things that went well today, however small.', 'Note trois choses qui se sont bien passées aujourd’hui, même petites.', 'Anota tres cosas que salieron bien hoy, por pequeñas que sean.'] },
  { category: 'mind', text: ['Step outside for a few minutes of daylight; it helps mood and sleep.', 'Sors quelques minutes à la lumière du jour ; ça aide l’humeur et le sommeil.', 'Sal unos minutos a la luz del día; ayuda al ánimo y al sueño.'] },
  { category: 'social', text: ['Send a kind message to someone you have not spoken to in a while.', 'Envoie un message sympa à quelqu’un à qui tu n’as pas parlé depuis longtemps.', 'Envía un mensaje amable a alguien con quien llevas tiempo sin hablar.'] },
  { category: 'mind', text: ['If today feels heavy, shrink the goal: one small step counts. Talking to someone you trust helps too.', 'Si la journée est lourde, réduis l’objectif : un petit pas compte. En parler à quelqu’un de confiance aide aussi.', 'Si el día pesa, reduce la meta: un pequeño paso cuenta. Hablar con alguien de confianza también ayuda.'] },
];

// Horoscope fallback (no AI available): a trait of the sign + a theme of the day, picked by a hash of
// sign+date so it is stable for the day. Shown with the label "library", never presented as AI.
export const SIGN_TRAIT: Record<Zodiac, L3> = {
  aries: ['Your energy leads the way today.', 'Ton énergie ouvre la voie aujourd’hui.', 'Tu energía marca el camino hoy.'],
  taurus: ['Steady, patient steps suit you today.', 'Des pas réguliers et patients te vont bien aujourd’hui.', 'Los pasos firmes y pacientes te sientan bien hoy.'],
  gemini: ['Your curiosity opens a useful conversation.', 'Ta curiosité ouvre une conversation utile.', 'Tu curiosidad abre una conversación útil.'],
  cancer: ['Trust your instincts about the people around you.', 'Fais confiance à ton instinct envers ton entourage.', 'Confía en tu instinto con quienes te rodean.'],
  leo: ['Your warmth is noticed; share it generously.', 'Ta chaleur se remarque ; partage-la généreusement.', 'Tu calidez se nota; compártela con generosidad.'],
  virgo: ['Your attention to detail pays off today.', 'Ton sens du détail paie aujourd’hui.', 'Tu atención al detalle da frutos hoy.'],
  libra: ['Balance comes from choosing, not from waiting.', 'L’équilibre vient du choix, pas de l’attente.', 'El equilibrio viene de elegir, no de esperar.'],
  scorpio: ['Your focus is sharp; use it on what truly matters.', 'Ta concentration est vive ; utilise-la pour l’essentiel.', 'Tu concentración es aguda; úsala en lo que de verdad importa.'],
  sagittarius: ['A new idea or a plan for a trip wants attention.', 'Une idée nouvelle ou un projet de voyage demande ton attention.', 'Una idea nueva o un plan de viaje pide tu atención.'],
  capricorn: ['Discipline gets you further than speed today.', 'La discipline te mène plus loin que la vitesse aujourd’hui.', 'La disciplina te lleva más lejos que la velocidad hoy.'],
  aquarius: ['An original approach solves an old problem.', 'Une approche originale résout un vieux problème.', 'Un enfoque original resuelve un viejo problema.'],
  pisces: ['Creativity flows when you give yourself quiet time.', 'La créativité coule quand tu t’accordes du calme.', 'La creatividad fluye cuando te das tiempo tranquilo.'],
};
export const DAY_THEME: L3[] = [
  ['Good day to finish something you have postponed.', 'Bon jour pour terminer ce que tu repousses.', 'Buen día para terminar algo que aplazas.'],
  ['Listen more than you talk and you will learn something useful.', 'Écoute plus que tu ne parles, tu apprendras quelque chose d’utile.', 'Escucha más de lo que hablas y aprenderás algo útil.'],
  ['A small treat for yourself is well deserved.', 'Une petite gâterie pour toi est bien méritée.', 'Un pequeño capricho para ti está bien merecido.'],
  ['Keep your plans flexible; a pleasant surprise is possible.', 'Garde tes plans souples ; une bonne surprise est possible.', 'Mantén tus planes flexibles; es posible una sorpresa agradable.'],
  ['Reach out to a friend; it will lift both of you.', 'Contacte un(e) ami(e) ; ça vous fera du bien à tous les deux.', 'Escribe a un amigo; os animará a ambos.'],
  ['Tidy one corner of your space; your mind will follow.', 'Range un coin de ton espace ; ton esprit suivra.', 'Ordena un rincón de tu espacio; tu mente lo agradecerá.'],
  ['Take the first step on the thing you are unsure about.', 'Fais le premier pas sur ce dont tu doutes.', 'Da el primer paso en aquello de lo que dudas.'],
  ['Rest is productive too; protect some time for it.', 'Le repos est aussi productif ; protège-en un peu.', 'Descansar también es productivo; protege algo de tiempo para ello.'],
  ['Money matters go better after a calm look at the numbers.', 'Les questions d’argent vont mieux après un regard calme sur les chiffres.', 'Los temas de dinero van mejor tras mirar los números con calma.'],
  ['Someone appreciates you more than they say.', 'Quelqu’un t’apprécie plus qu’il ne le dit.', 'Alguien te aprecia más de lo que dice.'],
];

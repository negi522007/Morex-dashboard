import type { Zodiac } from '../../common/birth-date.util';

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

// "Did you know?" — short facts that are well established. One per day, in three languages.
export type FactTopic = 'nature' | 'space' | 'science' | 'history' | 'tech' | 'body';
export interface Fact { topic: FactTopic; text: L3 }
export const FACTS: Fact[] = [
  { topic: 'nature', text: ['Octopuses have three hearts: two pump blood through the gills and one through the rest of the body.', 'Les pieuvres ont trois cœurs : deux envoient le sang aux branchies et un au reste du corps.', 'Los pulpos tienen tres corazones: dos bombean la sangre a las branquias y uno al resto del cuerpo.'] },
  { topic: 'space', text: ['A day on Venus (one full rotation) lasts longer than its year: about 243 Earth days against 225 for its orbit.', 'Un jour sur Vénus (une rotation complète) dure plus longtemps que son année : environ 243 jours terrestres contre 225 pour son orbite.', 'Un día en Venus (una rotación completa) dura más que su año: unos 243 días terrestres frente a 225 de su órbita.'] },
  { topic: 'nature', text: ['Botanically, a banana is a berry, but a strawberry is not.', 'Botaniquement, la banane est une baie, mais pas la fraise.', 'Botánicamente, el plátano es una baya, pero la fresa no.'] },
  { topic: 'science', text: ['The Eiffel Tower can grow by up to about 15 cm in hot weather, because the iron expands with the heat.', 'La tour Eiffel peut grandir d’une quinzaine de centimètres par forte chaleur, car le fer se dilate.', 'La torre Eiffel puede crecer hasta unos 15 cm con calor, porque el hierro se dilata.'] },
  { topic: 'nature', text: ['Sharks are older than trees: they appeared some 450 million years ago, trees about 100 million years later.', 'Les requins sont plus anciens que les arbres : ils sont apparus il y a environ 450 millions d’années, les arbres environ 100 millions d’années plus tard.', 'Los tiburones son más antiguos que los árboles: aparecieron hace unos 450 millones de años, los árboles unos 100 millones después.'] },
  { topic: 'science', text: ['At one precise temperature and pressure (the triple point of water, 0.01 °C), water can be ice, liquid and vapour at the same time.', 'À une température et une pression précises (le point triple de l’eau, 0,01 °C), l’eau peut être à la fois glace, liquide et vapeur.', 'A una temperatura y presión precisas (el punto triple del agua, 0,01 °C), el agua puede ser hielo, líquido y vapor a la vez.'] },
  { topic: 'tech', text: ['The first computer “bug” was a real moth found in a relay of the Harvard Mark II in 1947 and taped into the logbook.', 'Le premier « bug » informatique était un vrai papillon de nuit retrouvé dans un relais du Harvard Mark II en 1947 et collé dans le journal de bord.', 'El primer «bug» informático fue una polilla real hallada en un relé del Harvard Mark II en 1947 y pegada en el cuaderno de registro.'] },
  { topic: 'tech', text: ['The first website was published at CERN in 1991 by Tim Berners-Lee; it explained what the World Wide Web was.', 'Le premier site web a été publié au CERN en 1991 par Tim Berners-Lee ; il expliquait ce qu’était le World Wide Web.', 'El primer sitio web se publicó en el CERN en 1991 por Tim Berners-Lee; explicaba qué era la World Wide Web.'] },
  { topic: 'nature', text: ['The Sahara was green a few thousand years ago, with lakes, grasslands and animals such as hippos.', 'Le Sahara était vert il y a quelques milliers d’années, avec des lacs, des prairies et des animaux comme les hippopotames.', 'El Sáhara era verde hace unos miles de años, con lagos, praderas y animales como los hipopótamos.'] },
  { topic: 'history', text: ['Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid of Giza.', 'Cléopâtre a vécu plus près de nous, dans le temps, de l’alunissage que de la construction de la grande pyramide de Gizeh.', 'Cleopatra vivió más cerca en el tiempo de la llegada a la Luna que de la construcción de la Gran Pirámide de Guiza.'] },
  { topic: 'history', text: ['The University of Oxford is older than the Aztec Empire: teaching there began around 1096, Tenochtitlan was founded in 1325.', 'L’université d’Oxford est plus ancienne que l’Empire aztèque : on y enseigne depuis 1096 environ, Tenochtitlan a été fondée en 1325.', 'La Universidad de Oxford es más antigua que el Imperio azteca: allí se enseña desde hacia el año 1096, Tenochtitlan se fundó en 1325.'] },
  { topic: 'nature', text: ['Wombats produce cube-shaped droppings, which stay put on rocks and logs to mark territory.', 'Les wombats produisent des crottes en forme de cubes, qui restent en place sur les rochers et les troncs pour marquer le territoire.', 'Los wombats producen excrementos en forma de cubo, que se quedan en rocas y troncos para marcar territorio.'] },
  { topic: 'science', text: ['Sound travels about four times faster in water (roughly 1,500 m/s) than in air (about 343 m/s).', 'Le son se propage environ quatre fois plus vite dans l’eau (environ 1 500 m/s) que dans l’air (environ 343 m/s).', 'El sonido viaja unas cuatro veces más rápido en el agua (unos 1.500 m/s) que en el aire (unos 343 m/s).'] },
  { topic: 'space', text: ['Sunlight takes about 8 minutes and 20 seconds to reach the Earth.', 'La lumière du Soleil met environ 8 minutes et 20 secondes pour atteindre la Terre.', 'La luz del Sol tarda unos 8 minutos y 20 segundos en llegar a la Tierra.'] },
  { topic: 'nature', text: ['Antarctica is the largest desert on Earth, because a desert is defined by how little rain or snow falls, not by heat.', 'L’Antarctique est le plus grand désert de la Terre : un désert se définit par le peu de précipitations, pas par la chaleur.', 'La Antártida es el mayor desierto de la Tierra: un desierto se define por lo poco que llueve o nieva, no por el calor.'] },
  { topic: 'nature', text: ['A group of flamingos is called a “flamboyance”.', 'Un groupe de flamants roses s’appelle en anglais une « flamboyance ».', 'A un grupo de flamencos se le llama en inglés «flamboyance».'] },
  { topic: 'tech', text: ['Linus Torvalds announced the Linux kernel in 1991, describing it as a hobby project “just a hobby, won’t be big and professional”.', 'Linus Torvalds a annoncé le noyau Linux en 1991, en le décrivant comme un simple passe-temps, « qui ne sera pas gros et professionnel ».', 'Linus Torvalds anunció el núcleo Linux en 1991, describiéndolo como un simple pasatiempo, «que no será grande ni profesional».'] },
  { topic: 'tech', text: ['Ray Tomlinson chose the “@” sign to separate the user from the machine name in the first network email, in 1971.', 'Ray Tomlinson a choisi le signe « @ » pour séparer l’utilisateur du nom de la machine dans le premier email en réseau, en 1971.', 'Ray Tomlinson eligió el signo «@» para separar al usuario del nombre de la máquina en el primer correo en red, en 1971.'] },
  { topic: 'tech', text: ['The Python language is named after the British comedy group Monty Python, not after the snake.', 'Le langage Python porte le nom du groupe comique britannique Monty Python, pas celui du serpent.', 'El lenguaje Python se llama así por el grupo cómico británico Monty Python, no por la serpiente.'] },
  { topic: 'tech', text: ['Epitech was founded in 1999 as a school for computer science based on learning by projects.', 'Epitech a été fondée en 1999 comme une école d’informatique fondée sur l’apprentissage par projets.', 'Epitech se fundó en 1999 como una escuela de informática basada en el aprendizaje por proyectos.'] },
  { topic: 'history', text: ['The Great Wall of China is not visible to the naked eye from the Moon, a popular myth: it is long but very narrow.', 'La Grande Muraille de Chine n’est pas visible à l’œil nu depuis la Lune, un mythe populaire : elle est longue mais très étroite.', 'La Gran Muralla China no se ve a simple vista desde la Luna, un mito popular: es larga pero muy estrecha.'] },
  { topic: 'body', text: ['Your bones are alive: they are constantly rebuilt, and the whole adult skeleton is renewed about every ten years.', 'Tes os sont vivants : ils sont sans cesse reconstruits, et tout le squelette adulte est renouvelé environ tous les dix ans.', 'Tus huesos están vivos: se reconstruyen constantemente y todo el esqueleto adulto se renueva más o menos cada diez años.'] },
  { topic: 'body', text: ['The human brain uses roughly 20% of the body’s energy while being only about 2% of its weight.', 'Le cerveau humain consomme environ 20 % de l’énergie du corps alors qu’il ne représente qu’environ 2 % de son poids.', 'El cerebro humano usa aproximadamente el 20 % de la energía del cuerpo aunque solo supone un 2 % de su peso.'] },
  { topic: 'space', text: ['On the Moon there is no wind or rain, so the astronauts’ footprints from 1969 will stay for millions of years.', 'Sur la Lune il n’y a ni vent ni pluie : les traces de pas des astronautes de 1969 resteront des millions d’années.', 'En la Luna no hay viento ni lluvia: las huellas de los astronautas de 1969 durarán millones de años.'] },
  { topic: 'science', text: ['Honey barely spoils: with so little water and so much sugar, bacteria cannot grow in it.', 'Le miel ne se gâte quasiment pas : avec si peu d’eau et tant de sucre, les bactéries ne peuvent pas s’y développer.', 'La miel casi no se estropea: con tan poca agua y tanto azúcar, las bacterias no pueden crecer en ella.'] },
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

// Display names, in [en, fr, es], and the usual date range of each sign.
export const SIGN_INFO: Record<Zodiac, { glyph: string; name: L3; range: string }> = {
  aries: { glyph: '♈', name: ['Aries', 'Bélier', 'Aries'], range: '03-21 → 04-19' },
  taurus: { glyph: '♉', name: ['Taurus', 'Taureau', 'Tauro'], range: '04-20 → 05-20' },
  gemini: { glyph: '♊', name: ['Gemini', 'Gémeaux', 'Géminis'], range: '05-21 → 06-20' },
  cancer: { glyph: '♋', name: ['Cancer', 'Cancer', 'Cáncer'], range: '06-21 → 07-22' },
  leo: { glyph: '♌', name: ['Leo', 'Lion', 'Leo'], range: '07-23 → 08-22' },
  virgo: { glyph: '♍', name: ['Virgo', 'Vierge', 'Virgo'], range: '08-23 → 09-22' },
  libra: { glyph: '♎', name: ['Libra', 'Balance', 'Libra'], range: '09-23 → 10-22' },
  scorpio: { glyph: '♏', name: ['Scorpio', 'Scorpion', 'Escorpio'], range: '10-23 → 11-21' },
  sagittarius: { glyph: '♐', name: ['Sagittarius', 'Sagittaire', 'Sagitario'], range: '11-22 → 12-21' },
  capricorn: { glyph: '♑', name: ['Capricorn', 'Capricorne', 'Capricornio'], range: '12-22 → 01-19' },
  aquarius: { glyph: '♒', name: ['Aquarius', 'Verseau', 'Acuario'], range: '01-20 → 02-18' },
  pisces: { glyph: '♓', name: ['Pisces', 'Poissons', 'Piscis'], range: '02-19 → 03-20' },
};

export const DISCLAIMER: L3 = [
  'For entertainment only — not advice.',
  'Pour le plaisir uniquement — pas un conseil.',
  'Solo por entretenimiento — no es un consejo.',
];

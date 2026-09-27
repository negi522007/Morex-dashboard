// Snapshot of real backend data (taken while designing the mockup), used ONLY for the previews
// in the add-widget drawer. Cards on the dashboard always show their own widget's cachedData.
// The My Epitech samples are examples: they need a personal token / a linked account.

export interface Sample { data: unknown; insight?: unknown; config: Record<string, string | number> }

const at = (h: number, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString() }

export const SAMPLES: Record<string, Sample> = {
"rss": {
"data": [
{
"link": "https://www.lemonde.fr/societe/live/2026/09/25/en-direct-visite-du-pape-a-paris-leon-xiv-encense-l-unesco-un-interlocuteur-privilegie-de-l-eglise-catholique-au-service-du-bien-commun_6782008_3224.html",
"image": "https://img.lemde.fr/2026/09/25/35/0/5726/2863/644/322/60/0/cc6cd9b_ftp-1-sgf8q7hl4kx7-5180773-01-06.jpg",
"title": "EN DIRECT, visite du pape à Paris | Léon XIV a terminé son discours à l’Unesco et commence sa déambulation parisienne",
"summary": "Le pape effectue un voyage de quatre jours en France, à Paris, à Lourdes et à Metz. Dans la capitale, un programme chargé l’attend ce vendredi : il a rencontré Emmanuel Macron à l’Elysée, s’est rendu à l’Unesco. Il ira ensuite à la cathédrale Notre-Dame de Paris et participera à…",
"feedTitle": "Le Monde.fr - Actualités et Infos en France et dans le monde",
"publishedAt": "Fri, 25 Sep 2026 15:55:18 +0200"
},
{
"link": "https://www.lemonde.fr/pixels/article/2026/09/25/affaire-thelyson-orelien-le-concepteur-de-pangram-max-spero-n-a-aucun-doute-sur-la-presence-d-ia-dans-le-roman-c-etait-ca-ou-mourir_6782482_4408996.html",
"image": "https://img.lemde.fr/2026/09/24/286/0/3000/1500/644/322/60/0/5dbcf92_upload-1-2nxfvhd192kd-ia-edition-pangram.jpg",
"title": "Affaire Thélyson Orélien : le concepteur de Pangram, Max Spero, n’a « aucun doute » sur la présence d’IA dans le roman « C’était ça ou mourir »",
"summary": "En trois ans, le logiciel de détection d’IA est devenu l’un des plus efficaces de son secteur, déclenchant de multiples controverses aux Etats-Unis. Pour son concepteur, « Pangram pourrait finir par ressembler à une étiquette nutritionnelle ou de certification 100 % bio » de la …",
"feedTitle": "Le Monde.fr - Actualités et Infos en France et dans le monde",
"publishedAt": "Fri, 25 Sep 2026 15:03:29 +0200"
},
{
"link": "https://www.lemonde.fr/international/article/2026/09/25/comment-la-georgie-s-est-detournee-de-ses-partenaires-occidentaux-au-profit-de-la-russie_6782471_3210.html",
"image": "https://img.lemde.fr/2026/09/22/1601/0/4000/2000/644/322/60/0/c267e91_upload-1-1mhssfwdkfgh-pebrel-georgie-geopolitique-121.jpg",
"title": "Comment la Géorgie s’est détournée de ses partenaires occidentaux au profit de la Russie",
"summary": "La réorientation géopolitique de cette ex-république soviétique du Caucase est singulière dans la région, où les pays prennent au contraire leurs distances avec Moscou. L’Iran en profite pour accroître son influence.",
"feedTitle": "Le Monde.fr - Actualités et Infos en France et dans le monde",
"publishedAt": "Fri, 25 Sep 2026 14:00:21 +0200"
},
{
"link": "https://www.lemonde.fr/economie/article/2026/09/25/pourquoi-le-diesel-francais-flambe-plus-que-la-moyenne-europeenne_6782465_3234.html",
"image": "https://img.lemde.fr/2026/09/22/395/0/3333/1666/644/322/60/0/016a2e9_upload-1-7naevhmim15h-lewisjoly-lemonde-22-09-26-022.JPG",
"title": "Pourquoi le diesel français flambe plus que la moyenne européenne",
"summary": "Sous la menace de Trump, le litre de gazole à l’échelle de l’Union européenne a déjà battu son record, à 2,23 euros en moyenne lundi 21 septembre contre 2,16 euros une semaine plus tôt, et contre 2,38 euros en moyenne dans l’Hexagone.",
"feedTitle": "Le Monde.fr - Actualités et Infos en France et dans le monde",
"publishedAt": "Fri, 25 Sep 2026 13:30:07 +0200"
}
],
"insight": {
"kind": "rss_digest",
"items": [
{
"link": "https://www.lemonde.fr/societe/live/2026/09/25/en-direct-visite-du-pape-a-paris-leon-xiv-encense-l-unesco-un-interlocuteur-privilegie-de-l-eglise-catholique-au-service-du-bien-commun_6782008_3224.html",
"image": "https://img.lemde.fr/2026/09/25/35/0/5726/2863/644/322/60/0/cc6cd9b_ftp-1-sgf8q7hl4kx7-5180773-01-06.jpg",
"summary": "Le pape Léon XIV entame quatre jours en France : discours à l’Unesco sur le « bien commun », rencontre avec Emmanuel Macron, puis Lourdes et Metz.",
"whyItMatters": "Première visite d’un pape à Paris depuis 2008 : circulation et sécurité renforcées dans la capitale",
"topics": [
"Religion",
"Paris"
],
"readingMinutes": 3
}
]
},
"config": {
"link": "https://www.lemonde.fr/rss/une.xml"
}
},
"fx": {
"data": {
"days": 7,
"history": [
{
"price": 70583.60773502233,
"timestamp": "2026-09-18T15:00:00.000Z"
},
{
"price": 70465.45311675326,
"timestamp": "2026-09-18T19:00:00.000Z"
},
{
"price": 70613.35162788923,
"timestamp": "2026-09-18T23:00:00.000Z"
},
{
"price": 70745.16692052121,
"timestamp": "2026-09-19T03:00:00.000Z"
},
{
"price": 70528.18231606734,
"timestamp": "2026-09-19T07:00:00.000Z"
},
{
"price": 70740.55654258735,
"timestamp": "2026-09-19T11:00:00.000Z"
},
{
"price": 71037.17154654118,
"timestamp": "2026-09-19T15:00:00.000Z"
},
{
"price": 70918.3309798157,
"timestamp": "2026-09-19T19:00:00.000Z"
},
{
"price": 70761.02265161488,
"timestamp": "2026-09-19T23:00:00.000Z"
},
{
"price": 69932.79493184453,
"timestamp": "2026-09-20T03:00:00.000Z"
},
{
"price": 69935.631719041,
"timestamp": "2026-09-20T07:00:00.000Z"
},
{
"price": 69946.49492046898,
"timestamp": "2026-09-20T11:00:00.000Z"
},
{
"price": 70260.8912865166,
"timestamp": "2026-09-20T15:00:00.000Z"
},
{
"price": 70601.20266050723,
"timestamp": "2026-09-20T19:00:00.000Z"
},
{
"price": 70726.60630424402,
"timestamp": "2026-09-20T23:00:00.000Z"
},
{
"price": 70831.04448150635,
"timestamp": "2026-09-21T03:00:00.000Z"
},
{
"price": 71128.92981558645,
"timestamp": "2026-09-21T07:00:00.000Z"
},
{
"price": 73516.86455973964,
"timestamp": "2026-09-21T11:00:00.000Z"
},
{
"price": 74806.15788634842,
"timestamp": "2026-09-21T15:00:00.000Z"
},
{
"price": 75058.16409826472,
"timestamp": "2026-09-21T19:00:00.000Z"
},
{
"price": 75381.03132169892,
"timestamp": "2026-09-21T23:00:00.000Z"
},
{
"price": 74718.01161101476,
"timestamp": "2026-09-22T03:00:00.000Z"
},
{
"price": 74453.54852055866,
"timestamp": "2026-09-22T07:00:00.000Z"
},
{
"price": 74912.99537891193,
"timestamp": "2026-09-22T11:00:00.000Z"
},
{
"price": 75336.50399858892,
"timestamp": "2026-09-22T15:00:00.000Z"
},
{
"price": 75577.55114131465,
"timestamp": "2026-09-22T19:00:00.000Z"
},
{
"price": 75234.51582497521,
"timestamp": "2026-09-22T23:00:00.000Z"
},
{
"price": 75677.82714857227,
"timestamp": "2026-09-23T03:00:00.000Z"
},
{
"price": 75683.01287234243,
"timestamp": "2026-09-23T07:00:00.000Z"
},
{
"price": 75248.95714675555,
"timestamp": "2026-09-23T11:00:00.000Z"
},
{
"price": 74082.6790306288,
"timestamp": "2026-09-23T15:00:00.000Z"
},
{
"price": 74064.4303300458,
"timestamp": "2026-09-23T19:00:00.000Z"
},
{
"price": 74265.12443711188,
"timestamp": "2026-09-23T23:00:00.000Z"
},
{
"price": 74094.72264464275,
"timestamp": "2026-09-24T03:00:00.000Z"
},
{
"price": 73855.29144478215,
"timestamp": "2026-09-24T07:00:00.000Z"
},
{
"price": 73427.45998690728,
"timestamp": "2026-09-24T11:00:00.000Z"
},
{
"price": 73473.55083971455,
"timestamp": "2026-09-24T15:00:00.000Z"
},
{
"price": 74255.45120570235,
"timestamp": "2026-09-24T19:00:00.000Z"
},
{
"price": 74046.8719972067,
"timestamp": "2026-09-24T23:00:00.000Z"
},
{
"price": 74036.2169964288,
"timestamp": "2026-09-25T03:00:00.000Z"
},
{
"price": 73795.98213331932,
"timestamp": "2026-09-25T07:00:00.000Z"
},
{
"price": 74319.22227087863,
"timestamp": "2026-09-25T11:00:00.000Z"
},
{
"price": 73565.92092781846,
"timestamp": "2026-09-25T14:38:40.000Z"
}
],
"min": 69893.73822580682,
"max": 76276.8765579455,
"rate": 73466.89607880606,
"changePct": 4.225220682955189,
"base": "bitcoin",
"quote": "eur"
},
"config": {
"base": "bitcoin",
"quote": "eur",
"days": 7
}
},
"price": {
"data": [
{
"price": 77778.81759411356,
"timestamp": "2026-08-26T15:00:00.000Z"
},
{
"price": 78717.16727941387,
"timestamp": "2026-08-27T03:00:00.000Z"
},
{
"price": 80190.32101475948,
"timestamp": "2026-08-27T15:00:00.000Z"
},
{
"price": 79935.57059402476,
"timestamp": "2026-08-28T03:00:00.000Z"
},
{
"price": 79607.76745531596,
"timestamp": "2026-08-28T15:00:00.000Z"
},
{
"price": 77669.86720102842,
"timestamp": "2026-08-29T03:00:00.000Z"
},
{
"price": 78010.76127895089,
"timestamp": "2026-08-29T15:00:00.000Z"
},
{
"price": 78102.99055280742,
"timestamp": "2026-08-30T03:00:00.000Z"
},
{
"price": 78776.41086229906,
"timestamp": "2026-08-30T15:00:00.000Z"
},
{
"price": 77453.7976096339,
"timestamp": "2026-08-31T03:00:00.000Z"
},
{
"price": 78590.3128650354,
"timestamp": "2026-08-31T15:00:00.000Z"
},
{
"price": 78421.83031494952,
"timestamp": "2026-09-01T03:00:00.000Z"
},
{
"price": 78137.78899466433,
"timestamp": "2026-09-01T15:00:00.000Z"
},
{
"price": 77275.44455077226,
"timestamp": "2026-09-02T03:00:00.000Z"
},
{
"price": 77019.25544923359,
"timestamp": "2026-09-02T15:00:00.000Z"
},
{
"price": 77776.26490321505,
"timestamp": "2026-09-03T03:00:00.000Z"
},
{
"price": 80503.98990012161,
"timestamp": "2026-09-03T15:00:00.000Z"
},
{
"price": 80812.35052737984,
"timestamp": "2026-09-04T03:00:00.000Z"
},
{
"price": 78918.77058040584,
"timestamp": "2026-09-04T15:00:00.000Z"
},
{
"price": 79577.31078765137,
"timestamp": "2026-09-05T03:00:00.000Z"
},
{
"price": 79730.88136501185,
"timestamp": "2026-09-05T15:00:00.000Z"
},
{
"price": 79906.5630995094,
"timestamp": "2026-09-06T03:00:00.000Z"
},
{
"price": 79526.7967398626,
"timestamp": "2026-09-06T15:00:00.000Z"
},
{
"price": 79848.98832803365,
"timestamp": "2026-09-07T03:00:00.000Z"
},
{
"price": 79180.43723886288,
"timestamp": "2026-09-07T15:00:00.000Z"
},
{
"price": 78927.12553007393,
"timestamp": "2026-09-08T03:00:00.000Z"
},
{
"price": 78535.15771615456,
"timestamp": "2026-09-08T15:00:00.000Z"
},
{
"price": 78722.42026766515,
"timestamp": "2026-09-09T03:00:00.000Z"
},
{
"price": 78949.21330811581,
"timestamp": "2026-09-09T15:00:00.000Z"
},
{
"price": 78329.34789117156,
"timestamp": "2026-09-10T03:00:00.000Z"
},
{
"price": 77359.53454949934,
"timestamp": "2026-09-10T15:00:00.000Z"
},
{
"price": 76824.79305692423,
"timestamp": "2026-09-11T03:00:00.000Z"
},
{
"price": 78783.77426720792,
"timestamp": "2026-09-11T15:00:00.000Z"
},
{
"price": 77256.74504889011,
"timestamp": "2026-09-12T03:00:00.000Z"
},
{
"price": 77445.64426190322,
"timestamp": "2026-09-12T15:00:00.000Z"
},
{
"price": 77273.86828489418,
"timestamp": "2026-09-13T03:00:00.000Z"
},
{
"price": 77186.99824765752,
"timestamp": "2026-09-13T15:00:00.000Z"
},
{
"price": 77570.55529884281,
"timestamp": "2026-09-14T03:00:00.000Z"
},
{
"price": 78476.07323013752,
"timestamp": "2026-09-14T15:00:00.000Z"
},
{
"price": 77885.53242277539,
"timestamp": "2026-09-15T03:00:00.000Z"
},
{
"price": 75903.01064422875,
"timestamp": "2026-09-15T15:00:00.000Z"
},
{
"price": 75831.86578487034,
"timestamp": "2026-09-16T03:00:00.000Z"
},
{
"price": 75628.25325189572,
"timestamp": "2026-09-16T15:00:00.000Z"
},
{
"price": 76308.60784780057,
"timestamp": "2026-09-17T03:00:00.000Z"
},
{
"price": 76443.5456147915,
"timestamp": "2026-09-17T15:00:00.000Z"
},
{
"price": 76924.54758447783,
"timestamp": "2026-09-18T03:00:00.000Z"
},
{
"price": 80901.08489368358,
"timestamp": "2026-09-18T15:00:00.000Z"
},
{
"price": 81275.55262020552,
"timestamp": "2026-09-19T03:00:00.000Z"
},
{
"price": 81543.5714688772,
"timestamp": "2026-09-19T15:00:00.000Z"
},
{
"price": 80275.857517878,
"timestamp": "2026-09-20T03:00:00.000Z"
},
{
"price": 80652.47933380083,
"timestamp": "2026-09-20T15:00:00.000Z"
},
{
"price": 81293.14737623878,
"timestamp": "2026-09-21T03:00:00.000Z"
},
{
"price": 85822.11261773574,
"timestamp": "2026-09-21T15:00:00.000Z"
},
{
"price": 85700.6334938903,
"timestamp": "2026-09-22T03:00:00.000Z"
},
{
"price": 86207.13787784762,
"timestamp": "2026-09-22T15:00:00.000Z"
},
{
"price": 86527.61079359149,
"timestamp": "2026-09-23T03:00:00.000Z"
},
{
"price": 84470.52649714124,
"timestamp": "2026-09-23T15:00:00.000Z"
},
{
"price": 84348.7467395268,
"timestamp": "2026-09-24T03:00:00.000Z"
},
{
"price": 83565.98156532156,
"timestamp": "2026-09-24T15:00:00.000Z"
},
{
"price": 84194.82818604415,
"timestamp": "2026-09-25T03:00:00.000Z"
},
{
"price": 83793.8865511238,
"timestamp": "2026-09-25T14:41:00.000Z"
}
],
"config": {
"asset": "bitcoin",
"days": 30
}
},
"gh": {
"data": [
{
"sha": "d083ec1",
"message": "[compiler] Allow setState after await in effect functions (#36734)",
"author": "",
"date": ""
},
{
"sha": "8b0da1c",
"message": "[rust-compiler] Fix detection of shorthand and computed properties (#37674)",
"author": "",
"date": ""
},
{
"sha": "f8e63c6",
"message": "[Flight] Preserve leading `U+FEFF` in text rows (#37625)",
"author": "",
"date": ""
},
{
"sha": "59aff3e",
"message": "[compiler] Bail on use of arguments object (#37645)",
"author": "",
"date": ""
},
{
"sha": "71f7255",
"message": "[Flight] Server References for arbitrary object types (#37636)",
"author": "",
"date": ""
},
{
"sha": "2b19aec",
"message": "[rust-compiler] Fix exponentiation to match js semantics (#37587)",
"author": "",
"date": ""
}
],
"config": {
"repo": "facebook/react"
}
},
"gh-issues": {
"data": [
{
"number": 37682,
"title": "Bug: hydration restart storm — a root that suspends during hydration re-renders thousands of times when `useDeferredValue(value, initialValue)` is mounted",
"author": "GorkemMergenay",
"createdAt": "2026-09-24T07:38:15Z"
},
{
"number": 37681,
"title": "[DevTools Bug]: Extension reloads on client-side navigation",
"author": "yepitschunked",
"createdAt": "2026-09-23T23:57:05Z"
}
],
"config": {
"repo": "facebook/react"
}
},
"gh-stats": {
"data": {
"stars": 250719,
"forks": 51411,
"openIssues": 1378,
"description": "The library for web and native user interfaces."
},
"config": {
"repo": "facebook/react"
}
},
"gh-daily": {
"data": {
"repo": "facebook/react",
"hours": 72,
"since": "2026-09-22T14:56:38Z",
"commitCount": 3,
"authors": [
{
"name": "lauren",
"count": 1
},
{
"name": "Jimmy Miller",
"count": 1
},
{
"name": "Hendrik Liebau",
"count": 1
}
],
"commits": [
{
"sha": "d083ec1",
"message": "[compiler] Allow setState after await in effect functions (#36734)",
"author": "lauren",
"date": "2026-09-22T17:26:59Z"
},
{
"sha": "8b0da1c",
"message": "[rust-compiler] Fix detection of shorthand and computed properties (#37674)",
"author": "Jimmy Miller",
"date": "2026-09-22T16:13:10Z"
},
{
"sha": "f8e63c6",
"message": "[Flight] Preserve leading `U+FEFF` in text rows (#37625)",
"author": "Hendrik Liebau",
"date": "2026-09-22T15:07:13Z"
}
]
},
"insight": {
"kind": "standup",
"summary": "Le compilateur avance : les effets asynchrones peuvent maintenant mettre à jour l’état après un await, et les outils de dev gagnent en stabilité",
"highlights": []
},
"config": {
"repo": "facebook/react",
"hours": 72
}
},
"world": {
"data": {
"home": {
"timezone": "Africa/Porto-Novo"
},
"cities": [
{
"timezone": "Europe/Paris",
"label": "Paris"
},
{
"timezone": "America/New_York",
"label": "New York"
},
{
"timezone": "Asia/Tokyo",
"label": "Tokyo"
},
{
"timezone": "America/Toronto",
"label": "Toronto"
},
{
"timezone": "Asia/Dubai",
"label": "Dubai"
}
]
},
"config": {}
},
"weather": {
"data": {
"now": {
"condition": "partly_cloudy",
"temperature": 28
},
"city": "Cotonou",
"days": [
{
"max": 28,
"min": 25,
"date": "2026-09-26",
"condition": "drizzle",
"rainChance": 86
},
{
"max": 28,
"min": 25,
"date": "2026-09-27",
"condition": "rain",
"rainChance": 75
},
{
"max": 27,
"min": 24,
"date": "2026-09-28",
"condition": "rain",
"rainChance": 78
},
{
"max": 27,
"min": 25,
"date": "2026-09-29",
"condition": "drizzle",
"rainChance": 78
},
{
"max": 28,
"min": 25,
"date": "2026-09-30",
"condition": "drizzle",
"rainChance": 63
}
],
"unit": "celsius",
"country": "Benin"
},
"config": {
"city": "Cotonou"
}
},
"wx-now": {
"data": {
"low": 70,
"city": "Tokyo",
"high": 80,
"unit": "fahrenheit",
"isDay": false,
"country": "Japan",
"windKmh": 4,
"humidity": 77,
"condition": "partly_cloudy",
"feelsLike": 78,
"temperature": 73
},
"insight": {
"kind": "weather_advice",
"advice": "Nuit douce et humide : pas besoin de pull, mais garde une veste légère si tu sors tard",
"outfit": "Veste légère, baskets"
},
"config": {
"city": "Tokyo"
}
},
"wx-hours": {
"data": {
"city": "Paris",
"unit": "celsius",
"hours": [
{
"time": "2026-09-25T12:00",
"condition": "clear",
"rainChance": 0,
"temperature": 21
},
{
"time": "2026-09-25T13:00",
"condition": "clear",
"rainChance": 0,
"temperature": 23
},
{
"time": "2026-09-25T14:00",
"condition": "clear",
"rainChance": 0,
"temperature": 25
},
{
"time": "2026-09-25T15:00",
"condition": "clear",
"rainChance": 0,
"temperature": 26
},
{
"time": "2026-09-25T16:00",
"condition": "clear",
"rainChance": 0,
"temperature": 27
},
{
"time": "2026-09-25T17:00",
"condition": "clear",
"rainChance": 0,
"temperature": 28
},
{
"time": "2026-09-25T18:00",
"condition": "clear",
"rainChance": 0,
"temperature": 28
},
{
"time": "2026-09-25T19:00",
"condition": "clear",
"rainChance": 0,
"temperature": 27
}
],
"country": "France"
},
"config": {
"city": "Paris"
}
},
"yt-channel": {
"data": {
"url": "https://www.youtube.com/channel/UCWeg2Pkate69NFdBeuRFTAw",
"title": "SQUEEZIE",
"views": 12038256497,
"avatar": "https://yt3.ggpht.com/ytc/AIdro_mPZvx-xk6pbAYdC7G8jUZzgCNDDTg1ZfF0_Lwd8UpJT4M=s800-c-k-c0x00ffffff-no-rj",
"handle": "@squeezie",
"videos": 1876,
"subscribers": 20200000
},
"config": {
"channel": "@Squeezie"
}
},
"yt-latest": {
"data": [
{
"id": "2QcaDwpvl7s",
"url": "https://www.youtube.com/watch?v=2QcaDwpvl7s",
"likes": 36195,
"title": "Essayez de ne pas rire | Séquence inédite (Partie 3/3)",
"views": 798278,
"channel": "SQUEEZIE",
"comments": 85,
"thumbnail": "https://i.ytimg.com/vi/2QcaDwpvl7s/hqdefault.jpg",
"publishedAt": "2026-09-04T20:27:43Z"
},
{
"id": "EdNjkLG9UbE",
"url": "https://www.youtube.com/watch?v=EdNjkLG9UbE",
"likes": 18788,
"title": "Essayez de ne pas rire | Séquence inédite (Partie 2/3)",
"views": 393526,
"channel": "SQUEEZIE",
"comments": 57,
"thumbnail": "https://i.ytimg.com/vi/EdNjkLG9UbE/hqdefault.jpg",
"publishedAt": "2026-09-04T20:24:28Z"
},
{
"id": "f7w2FjD151s",
"url": "https://www.youtube.com/watch?v=f7w2FjD151s",
"likes": 27893,
"title": "Essayez de ne pas rire | Séquence inédite (Partie 1/3)",
"views": 482992,
"channel": "SQUEEZIE",
"comments": 124,
"thumbnail": "https://i.ytimg.com/vi/f7w2FjD151s/hqdefault.jpg",
"publishedAt": "2026-09-04T20:21:47Z"
}
],
"config": {
"channel": "@Squeezie"
}
},
"yt-trend": {
"data": [
{
"id": "7y2ibQtuxmw",
"url": "https://www.youtube.com/watch?v=7y2ibQtuxmw",
"likes": 7004,
"title": "Tiakola, Kuluna, TVLM & Nooche - Bottega (Track5)",
"views": 85228,
"channel": "TIAKOLA",
"comments": 307,
"thumbnail": "https://i.ytimg.com/vi/7y2ibQtuxmw/hqdefault.jpg",
"publishedAt": "2026-09-24T22:00:34Z"
},
{
"id": "U3X5JiEPATk",
"url": "https://www.youtube.com/watch?v=U3X5JiEPATk",
"likes": 144,
"title": "CAMEMBERT Bande Annonce (2026) Alex Lutz",
"views": 60013,
"channel": "Allociné | Bandes Annonces",
"comments": 25,
"thumbnail": "https://i.ytimg.com/vi/U3X5JiEPATk/hqdefault.jpg",
"publishedAt": "2026-09-24T13:01:30Z"
},
{
"id": "mMi0WRH10FY",
"url": "https://www.youtube.com/watch?v=mMi0WRH10FY",
"likes": 8566,
"title": "Un jeu où je dois trouver une Aiguille dans un Tas de Foin (ça m'a prit 4 jours...)",
"views": 265899,
"channel": "Fiouze",
"comments": 330,
"thumbnail": "https://i.ytimg.com/vi/mMi0WRH10FY/hqdefault.jpg",
"publishedAt": "2026-09-24T16:48:15Z"
},
{
"id": "V-uIp-WuD60",
"url": "https://www.youtube.com/watch?v=V-uIp-WuD60",
"likes": 39333,
"title": "Patient Zero",
"views": 589431,
"channel": "Taylor Swift - Topic",
"comments": 2783,
"thumbnail": "https://i.ytimg.com/vi/V-uIp-WuD60/hqdefault.jpg",
"publishedAt": "2026-09-25T04:02:10Z"
}
],
"config": {
"country": "FR"
}
},
"yt-video": {
"data": {
"id": "dQw4w9WgXcQ",
"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
"likes": 19413304,
"title": "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
"views": 1819731902,
"channel": "Rick Astley",
"comments": 2457632,
"thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
"publishedAt": "2009-10-25T06:57:33Z"
},
"config": {}
},
"cal": {
"data": {
"events": [
{
"end": "2026-10-26T00:00:00.000Z",
"start": "2026-10-25T00:00:00.000Z",
"title": "Heure d'hiver",
"allDay": true,
"location": null
},
{
"end": "2026-11-02T00:00:00.000Z",
"start": "2026-11-01T00:00:00.000Z",
"title": "La Toussaint",
"allDay": true,
"location": null
},
{
"end": "2026-11-12T00:00:00.000Z",
"start": "2026-11-11T00:00:00.000Z",
"title": "L'Armistice",
"allDay": true,
"location": null
}
],
"generatedAt": "2026-09-25T16:25:06.576Z"
},
"config": {
"days": 60
}
},
"api-value": {
"data": {
"unit": "personnes",
"label": "Humains dans l’espace",
"value": 12,
"fetchedAt": "2026-09-25T16:41:50.695Z"
},
"config": {}
},
"api-list": {
"data": {
"items": [
{
"title": "codecrafters-io/build-your-own-x",
"subtitle": "Master programming by recreating your favorite technologies from scratch."
},
{
"title": "sindresorhus/awesome",
"subtitle": "😎 Awesome lists about all kinds of interesting topics [NOTE: Pull requests are temporarily disabled until I have a chance to catch up with the existing ones]"
},
{
"title": "public-apis/public-apis",
"subtitle": "A collective list of free APIs"
},
{
"title": "freeCodeCamp/freeCodeCamp",
"subtitle": "freeCodeCamp.org's open-source codebase and curriculum. Learn math, programming, and computer science for free."
},
{
"title": "EbookFoundation/free-programming-books",
"subtitle": ":books: Freely available programming books"
},
{
"title": "openclaw/openclaw",
"subtitle": "The AI that really does things. Any OS. Any Platform. The lobster way. 🦞"
}
],
"fetchedAt": "2026-09-25T16:41:52.181Z"
},
"config": {}
}
}

SAMPLES['epi-plan'] = { config: {}, data: { events: [
  { title: 'Kick-off G-WEB-500 Dashboard', start: at(9), end: at(10, 30), allDay: false, location: 'Cotonou · Salle Turing' },
  { title: 'Follow-up Dashboard', start: at(14), end: at(15), allDay: false, location: 'Cotonou · Salle Lovelace' },
  { title: 'Hub : atelier Git', start: at(16, 30), end: at(18), allDay: false, location: 'Hub' },
] } }
// Steam: EXAMPLE profile (no Steam key on this server yet), real game pictures
SAMPLES['steam-prof'] = { config: {}, data: {"steamId": "76561198000000000", "name": "Morayo_Gaming", "avatar": "https://api.dicebear.com/9.x/avataaars/svg?seed=morex&top=curly&skinColor=ae5d29&backgroundColor=c0aede", "url": "https://steamcommunity.com", "status": "online", "currentGame": "Stardew Valley", "level": 27, "memberSince": "2019-03-14T00:00:00Z", "country": "BJ", "isPublic": true} }
SAMPLES['steam-recent'] = { config: {}, data: [{"appId": 413150, "name": "Stardew Valley", "minutesLast2Weeks": 540, "minutesTotal": 8200, "header": "https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg", "url": "https://store.steampowered.com/app/413150"}, {"appId": 1145360, "name": "Hades", "minutesLast2Weeks": 310, "minutesTotal": 2900, "header": "https://cdn.akamai.steamstatic.com/steam/apps/1145360/header.jpg", "url": "https://store.steampowered.com/app/1145360"}, {"appId": 1245620, "name": "ELDEN RING", "minutesLast2Weeks": 190, "minutesTotal": 6100, "header": "https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg", "url": "https://store.steampowered.com/app/1245620"}, {"appId": 367520, "name": "Hollow Knight", "minutesLast2Weeks": 75, "minutesTotal": 1800, "header": "https://cdn.akamai.steamstatic.com/steam/apps/367520/header.jpg", "url": "https://store.steampowered.com/app/367520"}] }
SAMPLES['steam-lib'] = { config: {}, data: {"steamId": "76561198000000000", "gameCount": 64, "playedCount": 46, "neverPlayedCount": 18, "totalMinutes": 74400, "totalHours": 1240, "topGames": [{"appId": 413150, "name": "Stardew Valley", "minutesLast2Weeks": 540, "minutesTotal": 8200, "header": "https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg", "url": "https://store.steampowered.com/app/413150"}, {"appId": 1245620, "name": "ELDEN RING", "minutesLast2Weeks": 190, "minutesTotal": 6100, "header": "https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg", "url": "https://store.steampowered.com/app/1245620"}, {"appId": 292030, "name": "The Witcher 3", "minutesLast2Weeks": 0, "minutesTotal": 4700, "header": "https://cdn.akamai.steamstatic.com/steam/apps/292030/header.jpg", "url": "https://store.steampowered.com/app/292030"}, {"appId": 1145360, "name": "Hades", "minutesLast2Weeks": 310, "minutesTotal": 2900, "header": "https://cdn.akamai.steamstatic.com/steam/apps/1145360/header.jpg", "url": "https://store.steampowered.com/app/1145360"}, {"appId": 367520, "name": "Hollow Knight", "minutesLast2Weeks": 75, "minutesTotal": 1800, "header": "https://cdn.akamai.steamstatic.com/steam/apps/367520/header.jpg", "url": "https://store.steampowered.com/app/367520"}]} }
SAMPLES['quote'] = { config: {}, data: {"date": "2026-09-27", "text": {"en": "Success is the sum of small efforts, repeated day in and day out.", "es": "El éxito es la suma de pequeños esfuerzos repetidos día tras día.", "fr": "Le succès est la somme de petits efforts répétés jour après jour."}, "author": "Robert Collier"} }
SAMPLES['fact'] = { config: {}, data: {"date": "2026-09-27", "text": {"en": "Wombats produce cube-shaped droppings, which stay put on rocks and logs to mark territory.", "es": "Los wombats producen excrementos en forma de cubo, que se quedan en rocas y troncos para marcar territorio.", "fr": "Les wombats produisent des crottes en forme de cubes, qui restent en place sur les rochers et les troncs pour marquer le territoire."}, "topic": "nature"} }
SAMPLES['horo'] = { config: { sign: 'capricorn' }, data: {"sign": "capricorn", "text": {"en": "Discipline gets you further than speed today. Keep your plans flexible; a pleasant surprise is possible.", "es": "La disciplina te lleva más lejos que la velocidad hoy. Mantén tus planes flexibles; es posible una sorpresa agradable.", "fr": "La discipline te mène plus loin que la vitesse aujourd’hui. Garde tes plans souples ; une bonne surprise est possible."}, "areas": {"love": {"text": {"en": "Great day to plan something fun with someone you love.", "es": "Gran día para planear algo divertido con alguien que quieres.", "fr": "Super journée pour prévoir un moment sympa avec quelqu’un que tu aimes."}, "stars": 5}, "work": {"text": {"en": "You are in the zone: tackle the big project.", "es": "Estás en tu mejor momento: ataca el gran proyecto.", "fr": "Tu es dans ta zone : attaque le gros projet."}, "stars": 4}, "energy": {"text": {"en": "Great day for sport or a new challenge.", "es": "Gran día para el deporte o un nuevo reto.", "fr": "Super journée pour le sport ou un nouveau défi."}, "stars": 4}}, "lucky": {"color": {"hex": "#facc15", "name": {"en": "Yellow", "es": "Amarillo", "fr": "Jaune"}}, "number": 74}, "source": "library", "forDate": "2026-09-27", "disclaimer": {"en": "For entertainment only — not advice.", "es": "Solo por entretenimiento — no es un consejo.", "fr": "Pour le plaisir uniquement — pas un conseil."}} }
SAMPLES['epi-prof'] = { config: {}, data: { login: 'prenom.nom@epitech.eu', name: 'Prénom Nom', email: 'prenom.nom@epitech.eu', campus: 'Cotonou', promotion: '2029', cursus: 'PGE · Bachelor', groups: ['PGE3'] } }

// Avatar builder (DiceBear "avataaars"), ported from the mockup.
// The chosen options are saved on the user as avatarConfig (PATCH /auth/me); an uploaded photo wins over them.

export type AvatarConfig = Record<string, string>
export type Gender = 'girl' | 'boy' | 'all'

export const AV_URL = 'https://api.dicebear.com/9.x/avataaars/svg'
export const AV_OPTIONS: Record<string, { color?: boolean; values: string[] }> = {
  skinColor: { color: true, values: ['614335', 'ae5d29', 'd08b5b', 'edb98a', 'ffdbb4', 'f8d25c', 'fd9841'] },
  top: { values: ['none', 'bigHair', 'bob', 'bun', 'curly', 'curvy', 'dreads', 'dreads01', 'dreads02', 'frida', 'frizzle', 'fro', 'froBand',
    'longButNotTooLong', 'miaWallace', 'shaggy', 'shaggyMullet', 'shavedSides', 'shortCurly', 'shortFlat', 'shortRound', 'shortWaved', 'sides',
    'straight01', 'straight02', 'straightAndStrand', 'theCaesar', 'theCaesarAndSidePart', 'hat', 'hijab', 'turban', 'winterHat1', 'winterHat02', 'winterHat03', 'winterHat04'] },
  hairColor: { color: true, values: ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'ecdcbf', 'e8e1e1', 'c93305', 'f59797', '8b5cf6', '38bdf8'] },
  eyes: { values: ['default', 'happy', 'wink', 'winkWacky', 'hearts', 'side', 'squint', 'surprised', 'eyeRoll', 'closed', 'cry', 'xDizzy'] },
  eyebrows: { values: ['defaultNatural', 'default', 'raisedExcitedNatural', 'raisedExcited', 'flatNatural', 'frownNatural', 'angryNatural', 'sadConcernedNatural', 'upDownNatural', 'unibrowNatural'] },
  mouth: { values: ['smile', 'default', 'twinkle', 'tongue', 'eating', 'serious', 'disbelief', 'concerned', 'grimace', 'sad', 'screamOpen'] },
  accessories: { values: ['none', 'prescription01', 'prescription02', 'round', 'sunglasses', 'wayfarers', 'kurt', 'eyepatch'] },
  facialHair: { values: ['none', 'beardLight', 'beardMedium', 'beardMajestic', 'moustacheFancy', 'moustacheMagnum'] },
  clothing: { values: ['hoodie', 'graphicShirt', 'shirtCrewNeck', 'shirtScoopNeck', 'shirtVNeck', 'collarAndSweater', 'blazerAndShirt', 'blazerAndSweater', 'overall'] },
  clothesColor: { color: true, values: ['262e33', '3c4f5c', '5199e4', '65c9ff', 'a7ffc4', 'b1e2ff', 'e6e6e6', 'ff488e', 'ff5c5c', 'ffafb9', 'ffdeb5', 'ffffb1', 'ffffff'] },
  backgroundColor: { color: true, values: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'a7f3d0', '1e1b4b'] },
}
export const DEFAULT_AVATAR: AvatarConfig = { skinColor: 'ae5d29', top: 'curly', hairColor: '2c1b18', eyes: 'happy', eyebrows: 'defaultNatural', mouth: 'smile',
  accessories: 'none', facialHair: 'none', clothing: 'hoodie', clothesColor: '5199e4', backgroundColor: 'c0aede' }

// Which hairstyles each choice shows; "all" shows everything. Girls get no beard tab.
export const HAIR: Record<'girl' | 'boy', string[]> = {
  girl: ['bigHair', 'bob', 'bun', 'curly', 'curvy', 'dreads01', 'frida', 'fro', 'froBand', 'longButNotTooLong', 'miaWallace',
    'straight01', 'straight02', 'straightAndStrand', 'shavedSides', 'hijab', 'hat', 'winterHat1', 'winterHat02', 'winterHat03', 'winterHat04'],
  boy: ['none', 'shortFlat', 'shortRound', 'shortWaved', 'shortCurly', 'theCaesar', 'theCaesarAndSidePart', 'sides', 'frizzle', 'fro',
    'dreads', 'dreads01', 'dreads02', 'shaggy', 'shaggyMullet', 'turban', 'hat', 'winterHat1', 'winterHat02', 'winterHat03', 'winterHat04'],
}
// Random picks stay pleasant: no crying/dizzy eyes or grimaces, glasses and beards only sometimes
export const NICE: Record<string, string[]> = {
  eyes: ['default', 'happy', 'wink', 'hearts', 'side', 'squint', 'surprised'],
  eyebrows: ['defaultNatural', 'default', 'raisedExcitedNatural', 'flatNatural'],
  mouth: ['smile', 'default', 'twinkle', 'tongue'],
  accessories: ['none', 'none', 'none', 'prescription01', 'prescription02', 'round', 'sunglasses', 'wayfarers'],
  facialHair: ['none', 'none', 'beardLight', 'beardMedium', 'moustacheFancy'],
}

export function avatarUrl(o: AvatarConfig): string {
  const q = new URLSearchParams({ seed: 'morex' })
  for (const k of ['skinColor', 'hairColor', 'eyes', 'eyebrows', 'mouth', 'clothing', 'clothesColor', 'backgroundColor']) if (o[k]) q.set(k, o[k])
  if (!o.top || o.top === 'none') q.set('topProbability', '0'); else { q.set('top', o.top); q.set('topProbability', '100') }
  if (!o.accessories || o.accessories === 'none') q.set('accessoriesProbability', '0'); else { q.set('accessories', o.accessories); q.set('accessoriesProbability', '100') }
  if (!o.facialHair || o.facialHair === 'none') q.set('facialHairProbability', '0'); else { q.set('facialHair', o.facialHair); q.set('facialHairProbability', '100') }
  return `${AV_URL}?${q}`
}

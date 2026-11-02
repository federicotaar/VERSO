// Original word -> icon mapping (our own, not Verci's ~770-word asset).
// Common English + Italian words. Extend freely.
const ICONS = {
  love:'❤️',heart:'❤️',cuore:'❤️',amore:'❤️',baby:'👶',babe:'👶',
  night:'🌙',notte:'🌙',moon:'🌙',luna:'🌙',sun:'☀️',sole:'☀️',day:'☀️',giorno:'☀️',
  star:'⭐',stars:'⭐',stella:'⭐',stelle:'⭐',sky:'🌌',cielo:'🌌',
  rain:'🌧️',pioggia:'🌧️',storm:'⛈️',snow:'❄️',neve:'❄️',fire:'🔥',fuoco:'🔥',
  water:'💧',acqua:'💧',sea:'🌊',mare:'🌊',ocean:'🌊',oceano:'🌊',river:'🏞️',fiume:'🏞️',
  home:'🏠',casa:'🏠',house:'🏠',city:'🏙️',citta:'🏙️',world:'🌍',mondo:'🌍',
  time:'⏰',tempo:'⏰',forever:'♾️',sempre:'♾️',never:'🚫',mai:'🚫',
  money:'💰',soldi:'💰',cash:'💵',gold:'🥇',oro:'🥇',diamond:'💎',diamante:'💎',
  car:'🚗',macchina:'🚗',drive:'🚗',road:'🛣️',strada:'🛣️',way:'🛣️',via:'🛣️',
  fly:'🕊️',vola:'🕊️',wings:'🪽',ali:'🪽',bird:'🐦',angelo:'😇',angel:'😇',
  devil:'😈',diavolo:'😈',hell:'🔥',inferno:'🔥',heaven:'😇',paradiso:'😇',paradise:'🌴',
  girl:'👧',ragazza:'👧',boy:'👦',ragazzo:'👦',man:'👨',uomo:'👨',woman:'👩',donna:'👩',
  eyes:'👀',occhi:'👀',look:'👀',guarda:'👀',see:'👀',vedi:'👀',
  dance:'💃',balla:'💃',party:'🎉',festa:'🎉',music:'🎵',musica:'🎵',song:'🎶',canzone:'🎶',
  sing:'🎤',canta:'🎤',voice:'🎤',voce:'🎤',scream:'😱',cry:'😢',piangi:'😢',tears:'😢',lacrime:'😢',
  smile:'😊',sorridi:'😊',happy:'😊',felice:'😊',sad:'😔',triste:'😔',alone:'🚶',sola:'🚶',solo:'🚶',
  friend:'🫂',amico:'🫂',amici:'🫂',friends:'🫂',family:'👪',famiglia:'👪',
  kiss:'💋',bacio:'💋',hug:'🤗',abbraccio:'🤗',touch:'🤝',mano:'✋',hand:'✋',mani:'✋',
  phone:'📱',telefono:'📱',call:'📞',chiama:'📞',message:'💬',messaggio:'💬',
  wine:'🍷',vino:'🍷',drink:'🍹',bevi:'🍹',smoke:'🚬',fumo:'🚬',high:'🚀',
  dream:'💭',sogno:'💭',sogni:'💭',sleep:'😴',dormi:'😴',wake:'⏰',svegliati:'⏰',
  die:'💀',morte:'💀',death:'💀',muori:'💀',kill:'🔪',blood:'🩸',sangue:'🩸',
  gun:'🔫',pistola:'🔫',war:'⚔️',guerra:'⚔️',fight:'🥊',lotta:'🥊',king:'👑',re:'👑',queen:'👑',regina:'👑',
  god:'🙏',dio:'🙏',pray:'🙏',prega:'🙏',church:'⛪',chiesa:'⛪',
  run:'🏃',corri:'🏃',fast:'⚡',veloce:'⚡',slow:'🐌',piano:'🐌',
  up:'⬆️',su:'⬆️',down:'⬇️',giu:'⬇️',high2:'⬆️',low:'⬇️',basso:'⬇️',
  light:'💡',luce:'💡',dark:'🌑',buio:'🌑',shadow:'👤',ombra:'👤',
  free:'🕊️',libero:'🕊️',libera:'🕊️',chains:'⛓️',catene:'⛓️',prison:'⛓️',prigione:'⛓️',
  summer:'🏖️',estate:'🏖️',winter:'🥶',inverno:'🥶',spring:'🌸',primavera:'🌸',autumn:'🍂',autunno:'🍂',
  flower:'🌸',fiore:'🌸',fiori:'🌸',rose:'🌹',rosa:'🌹',tree:'🌳',albero:'🌳',
  good:'👍',bene:'👍',bad:'👎',male:'👎',crazy:'🤪',pazzo:'🤪',pazza:'🤪',mad:'😡',
  young:'🧒',giovane:'🧒',old:'👴',vecchio:'👴',life:'🌱',vita:'🌱',live:'🌱',vivi:'🌱'
};
function iconFor(word) {
  if (!word) return null;
  const w = word.toLowerCase().replace(/[^a-zàèéìòù']/gi, '');
  return ICONS[w] || null;
}
if (typeof module !== 'undefined') module.exports = { ICONS, iconFor };

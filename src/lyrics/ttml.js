// TTML word-timing parser (pure function, no network, no credentials).
// Kept for a future AUTHORIZED Apple Music sign-in flow (MusicKit user auth
// with OS-level secure storage). Not wired to any provider yet.
// TTML -> unified model with word timings
function parseTtml(ttml) {
  const lines = [];
  if(typeof ttml!=="string")return {lines};
  const pRe=/<p\b([^>]*)>([\s\S]*?)<\/p>/g;
  const attribute=(attrs,name)=>{
    const match=attrs.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(["\'])(.*?)\\1'));
    return match?match[2]:null;
  };
  const spanRe=/<span\b([^>]*)>([\s\S]*?)<\/span>/g;
  const toMs = s => {
    if(typeof s!=="string")return null;
    const m = s.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
    if (m) {
      if (+m[3]>=60 || (m[1]!==undefined && +m[2]>=60)) return null;
      return Math.round(((+m[1] || 0) * 3600 + (+m[2]) * 60 + parseFloat(m[3])) * 1000);
    }
    // TTML offset times carry a unit: 75.5s, 500ms, 2m, 1h.
    const o = s.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/);
    if (o) return Math.round(parseFloat(o[1]) * { ms: 1, s: 1000, m: 60000, h: 3600000 }[o[2]]);
    return /^\d+(?:\.\d+)?$/.test(s)?Math.round(Number(s)*1000):null;
  };
  const strip=h=>h.replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,entity)=>{
    const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
    if(entity[0]!=='#')return named[entity.toLowerCase()];
    const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));
    return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'\uFFFD';
  });
  let m;
  while ((m = pRe.exec(ttml)) !== null) {
    const line={startMs:toMs(attribute(m[1],'begin')),endMs:toMs(attribute(m[1],'end')),text:'',words:[]};
    if(!Number.isSafeInteger(line.startMs)||!Number.isSafeInteger(line.endMs)||line.startMs<0||line.endMs<=line.startMs)continue;
    let sm;
    while ((sm = spanRe.exec(m[2])) !== null) {
      const w={text:strip(sm[2]),startMs:toMs(attribute(sm[1],'begin')),endMs:toMs(attribute(sm[1],'end'))};
      if(!Number.isSafeInteger(w.startMs)||!Number.isSafeInteger(w.endMs)||w.startMs<line.startMs||w.endMs>line.endMs||w.endMs<=w.startMs)continue;
      line.words.push(w);
    }
    // Line text comes from the whole paragraph content: text between or
    // after word spans (spaces, punctuation) is part of the line too.
    line.text = strip(m[2]).replace(/\s+/g, ' ').trim();
    // Lines with line-level timing only (no word spans) stay in the model
    // with words:null, like parseLrc output: callers estimate the words.
    if (!line.words.length) line.words = null;
    if (line.text) lines.push(line);
  }
  return { lines };
}


module.exports = { parseTtml };

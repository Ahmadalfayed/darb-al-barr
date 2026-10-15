/* درب البر — مكتبة الإحداثيات (WGS84 / UTM / MGRS / DMS) — كود أصلي */
(function (G) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const D = Math.PI / 180;
  const BANDS = 'CDEFGHJKLMNPQRSTUVWX';

  function zoneOf(lat, lon) {
    let z = Math.floor((lon + 180) / 6) + 1;
    if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) z = 32;
    if (lat >= 72 && lat < 84) {
      if (lon >= 0 && lon < 9) z = 31; else if (lon >= 9 && lon < 21) z = 33;
      else if (lon >= 21 && lon < 33) z = 35; else if (lon >= 33 && lon < 42) z = 37;
    }
    return z;
  }
  function bandOf(lat) { return BANDS[Math.min(19, Math.max(0, Math.floor((lat + 80) / 8)))]; }

  function toUTM(lat, lon, forceZone) {
    const zone = forceZone || zoneOf(lat, lon);
    const lon0 = ((zone - 1) * 6 - 180 + 3) * D;
    const p = lat * D, l = lon * D;
    const N = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2);
    const T = Math.tan(p) ** 2, C = ep2 * Math.cos(p) ** 2, A = Math.cos(p) * (l - lon0);
    const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p
      - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * p)
      + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * p)
      - (35 * e2 ** 3 / 3072) * Math.sin(6 * p));
    const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
    let y = k0 * (M + N * Math.tan(p) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
    if (lat < 0) y += 10000000;
    return { zone, band: bandOf(lat), hemi: lat >= 0 ? 'N' : 'S', easting: x, northing: y };
  }

  function fromUTM(zone, hemi, x, y) {
    x -= 500000; if (hemi === 'S') y -= 10000000;
    const lon0 = ((zone - 1) * 6 - 180 + 3) * D;
    const M = y / k0, mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
      + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2), T1 = Math.tan(p1) ** 2, C1 = ep2 * Math.cos(p1) ** 2;
    const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(p1) ** 2, 1.5), Dd = x / (N1 * k0);
    const lat = p1 - (N1 * Math.tan(p1) / R1) * (Dd * Dd / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Dd ** 4 / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Dd ** 6 / 720);
    const lon = lon0 + (Dd - (1 + 2 * T1 + C1) * Dd ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Dd ** 5 / 120) / Math.cos(p1);
    return { lat: lat / D, lon: lon / D };
  }

  const COLS = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'], ROWS = 'ABCDEFGHJKLMNPQRSTUV';
  function toMGRS(lat, lon, digits = 5) {
    const u = toUTM(lat, lon);
    const set = (u.zone - 1) % 3;
    const col = COLS[set][Math.floor(u.easting / 100000) - 1];
    const rowOff = (u.zone % 2 === 0) ? 5 : 0;
    const row = ROWS[(Math.floor(u.northing / 100000) + rowOff) % 20];
    const div = Math.pow(10, 5 - digits);
    const e = String(Math.floor((u.easting % 100000) / div)).padStart(digits, '0');
    const n = String(Math.floor((u.northing % 100000) / div)).padStart(digits, '0');
    return `${u.zone}${u.band} ${col}${row} ${e} ${n}`;
  }

  function fromMGRS(str) {
    const m = str.toUpperCase().replace(/\s+/g, '').match(/^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z])([A-HJ-NP-V])(\d*)$/);
    if (!m || m[5].length % 2) return null;
    const zone = +m[1], band = m[2], digits = m[5].length / 2;
    const set = (zone - 1) % 3;
    const ci = COLS[set].indexOf(m[3]); if (ci < 0) return null;
    const rowOff = (zone % 2 === 0) ? 5 : 0;
    let ri = ROWS.indexOf(m[4]) - rowOff; if (ri < 0) ri += 20;
    const mul = Math.pow(10, 5 - digits);
    const e = (ci + 1) * 100000 + (digits ? +m[5].slice(0, digits) * mul : 0);
    let n = ri * 100000 + (digits ? +m[5].slice(digits) * mul : 0);
    const hemi = BANDS.indexOf(band) >= 10 ? 'N' : 'S';
    // اختيار دورة الـ 2000كم الصحيحة حسب نطاق العرض
    const bandLat = (BANDS.indexOf(band) * 8 - 80) + 4;
    let best = null;
    for (let k = 0; k < 6; k++) {
      const nn = n + k * 2000000; const p = fromUTM(zone, hemi, e, nn);
      const d = Math.abs(p.lat - bandLat);
      if (!best || d < best.d) best = { d, p };
    }
    return best && best.d < 6 ? best.p : null;
  }

  function toDMS(v, isLat) {
    const h = isLat ? (v >= 0 ? 'ش' : 'ج') : (v >= 0 ? 'ق' : 'غ');
    v = Math.abs(v); const d = Math.floor(v), mf = (v - d) * 60, m = Math.floor(mf), s = (mf - m) * 60;
    return `${d}° ${String(m).padStart(2, '0')}′ ${s.toFixed(1).padStart(4, '0')}″ ${h}`;
  }
  function toDM(v, isLat) {
    const h = isLat ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W');
    v = Math.abs(v); const d = Math.floor(v); return `${h}${d}° ${((v - d) * 60).toFixed(3)}′`;
  }

  /* --------- الاستخراج من نص مختلط --------- */
  function normDigits(s) {
    return s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/٫/g, '.').replace(/،/g, ',');
  }
  const inGCC = (lat, lon) => lat > 10 && lat < 34 && lon > 33 && lon < 62;
  function validLL(lat, lon) { return isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180; }

  function fixFlip(lat, lon, notes) {
    if (!inGCC(lat, lon) && inGCC(lon, lat)) { notes.push('تم عكس خط العرض والطول (كانت مقلوبة)'); return [lon, lat]; }
    if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) { notes.push('تم عكس خط العرض والطول'); return [lon, lat]; }
    return [lat, lon];
  }

  function parse(text) {
    const out = []; const seen = new Set();
    let s = normDigits(text || '');
    const push = (lat, lon, src, notes = []) => {
      [lat, lon] = fixFlip(lat, lon, notes);
      if (!validLL(lat, lon)) return;
      const key = lat.toFixed(5) + ',' + lon.toFixed(5); if (seen.has(key)) return; seen.add(key);
      out.push({ lat, lon, src, notes });
    };
    let m;
    // روابط خرائط جوجل
    const gre = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g, /@(-?\d+\.\d+),(-?\d+\.\d+)/g, /[?&](?:q|query|ll|destination|center)=(?:loc:)?(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/gi];
    for (const re of gre) while ((m = re.exec(s))) { push(+m[1], +m[2], 'رابط خرائط'); }
    s = s.replace(/https?:\/\/\S+/g, ' ');
    // MGRS
    const mg = /\b(\d{1,2}[C-HJ-NP-X])\s?([A-HJ-NP-Z][A-HJ-NP-V])\s?(\d{1,5})\s?(\d{1,5})\b/gi;
    while ((m = mg.exec(s))) {
      if (m[3].length !== m[4].length) continue;
      const p = fromMGRS(m[1] + m[2] + m[3] + m[4]); if (p) push(p.lat, p.lon, 'MGRS');
    }
    s = s.replace(mg, ' ');
    // UTM: 38R 512345 2734567  أو  38N 512345 2734567
    const ut = /\b(\d{1,2})\s?([C-HJ-NP-X])\s+(\d{6}(?:\.\d+)?)\s*(?:m|م)?\s*[E]?\s*[,;\s]\s*(\d{6,7}(?:\.\d+)?)\s*(?:m|م)?\s*N?\b/gi;
    while ((m = ut.exec(s))) {
      const band = m[2].toUpperCase(); const hemi = BANDS.indexOf(band) >= 10 ? 'N' : 'S';
      const p = fromUTM(+m[1], hemi, +m[3], +m[4]); push(p.lat, p.lon, 'UTM');
    }
    s = s.replace(ut, ' ');
    // DMS / DM مع اتجاهات عربية أو إنجليزية
    const H = '(N|S|E|W|ش|ج|ق|غ|شمال|جنوب|شرق|غرب)';
    const dms = new RegExp(`${H}?\\s*(\\d{1,3}(?:\\.\\d+)?)\\s*[°º˚d:\\s]\\s*(\\d{1,2}(?:\\.\\d+)?)?\\s*['′’m:\\s]?\\s*(\\d{1,2}(?:\\.\\d+)?)?\\s*(?:"|″|”|''|s)?\\s*${H}?`, 'gi');
    const parts = [];
    while ((m = dms.exec(s))) {
      if (!m[0].trim()) { dms.lastIndex++; continue; }
      if (m[1] && m[5]) { dms.lastIndex -= m[0].length - m[0].lastIndexOf(m[5]); m[5] = undefined; }
      const hasSym = /[°º˚'′’"″:]/.test(m[0]) || m[1] || m[5];
      if (!hasSym || (!m[3] && !m[1] && !m[5] && !/[°º˚]/.test(m[0]))) continue;
      let v = +m[2] + (m[3] ? +m[3] / 60 : 0) + (m[4] ? +m[4] / 3600 : 0);
      const h = (m[1] || m[5] || '').toUpperCase();
      if (/^(S|W|ج|غ|جنوب|غرب)$/.test(h)) v = -v;
      const axis = /^(N|S|ش|ج|شمال|جنوب)$/.test(h) ? 'lat' : /^(E|W|ق|غ|شرق|غرب)$/.test(h) ? 'lon' : null;
      parts.push({ v, axis, raw: m[0] });
    }
    for (let i = 0; i + 1 < parts.length; i += 2) {
      let A = parts[i], B = parts[i + 1];
      if (A.axis === 'lon' || B.axis === 'lat') [A, B] = [B, A];
      push(A.v, B.v, 'درجات ودقائق');
    }
    if (parts.length >= 2) s = s.replace(dms, m0 => /[°º˚′″'"]/.test(m0) ? ' ' : m0);
    // أرقام عشرية
    const dec = /(-?\d{1,3}\.\d{3,})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})/g;
    while ((m = dec.exec(s))) push(+m[1], +m[2], 'عشري');
    return out;
  }

  function haversine(a1, o1, a2, o2) {
    const R = 6371008.8, p1 = a1 * D, p2 = a2 * D, dp = (a2 - a1) * D, dl = (o2 - o1) * D;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function bearing(a1, o1, a2, o2) {
    const p1 = a1 * D, p2 = a2 * D, dl = (o2 - o1) * D;
    const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) / D + 360) % 360;
  }
  function fmtDist(m) { return m < 1000 ? `${Math.round(m)} م` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} كم`; }
  function dirName(b) { return ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'][Math.round(b / 45) % 8]; }

  function all(lat, lon) {
    const u = toUTM(lat, lon);
    return {
      dec: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      dms: `${toDMS(lat, true)}  ${toDMS(lon, false)}`,
      dm: `${toDM(lat, true)}  ${toDM(lon, false)}`,
      utm: `${u.zone}${u.band} ${Math.round(u.easting)}E ${Math.round(u.northing)}N`,
      mgrs: toMGRS(lat, lon),
      gmaps: `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`
    };
  }
  G.Geo = { toUTM, fromUTM, toMGRS, fromMGRS, toDMS, parse, haversine, bearing, fmtDist, dirName, all, normDigits };
})(typeof window !== 'undefined' ? window : globalThis);

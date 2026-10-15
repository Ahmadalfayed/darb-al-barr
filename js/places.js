/* درب البر — دليل البر */
(function (G) {
  const TYPE_EMOJI = {
    well: '💧', spring: '⛲', water: '🚰', wadi: '🏜️', peak: '⛰️', hill: '⛰',
    dune: '🏜', desert: '🌵', camp: '⛺️', view: '👁', place: '📍', rawdah: '🌿'
  };

  function normAr(s) {
    return String(s || '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  let data = null, loadPromise = null;

  function hydrate(raw) {
    const items = (raw.items || []).map((it, i) => ({
      i, n: it[0], t: it[1], la: it[2], lo: it[3], c: it[4], alt: it[5] || '',
      norm: normAr(it[0] + ' ' + (it[5] || ''))
    }));
    data = { types: raw.types || {}, countries: raw.countries || {}, attr: raw.attr || '', items, n: items.length };
    return data;
  }

  function load() {
    if (data) return Promise.resolve(data);
    if (loadPromise) return loadPromise;
    loadPromise = fetch('data/places.json')
      .then(r => { if (!r.ok) throw new Error('places HTTP ' + r.status); return r.json(); })
      .then(hydrate)
      .catch(e => { loadPromise = null; throw e; });
    return loadPromise;
  }

  function search({ q = '', type = '', country = '', lat = null, lon = null, limit = 100 } = {}) {
    if (!data) return [];
    const nq = normAr(q);
    let list = data.items;
    if (type) list = list.filter(x => x.t === type);
    if (country) list = list.filter(x => x.c === country);
    if (nq) {
      const parts = nq.split(' ').filter(Boolean);
      list = list.filter(x => parts.every(p => x.norm.includes(p)));
    }
    if (lat != null && lon != null && isFinite(lat)) {
      list = list.map(x => Object.assign({}, x, { _d: G.Geo.haversine(lat, lon, x.la, x.lo) }))
        .sort((a, b) => a._d - b._d);
    } else {
      list = list.slice().sort((a, b) => a.n.localeCompare(b.n, 'ar'));
    }
    return list.slice(0, limit);
  }

  G.Places = { load, search, normAr, TYPE_EMOJI, get data() { return data; } };
})(typeof window !== 'undefined' ? window : globalThis);

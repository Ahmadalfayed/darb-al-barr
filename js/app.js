/* درب البر — التطبيق الرئيسي (كود أصلي) */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('darb_' + k)) ?? d; } catch { return d; } },
    set(k, v) { localStorage.setItem('darb_' + k, JSON.stringify(v)); }
  };
  const toast = (m, ms = 2400) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); };
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('تم النسخ'); } catch { toast('انسخ يدوياً'); } };
  const sheet = (html) => { $('#sheetBody').innerHTML = html; $('#sheet').classList.add('open'); };
  $('#sheetClose').onclick = () => $('#sheet').classList.remove('open');
  $('#sheet').onclick = (e) => { if (e.target === $('#sheet')) $('#sheet').classList.remove('open'); };

  // ثيم
  const applyTheme = (t) => { document.documentElement.setAttribute('data-theme', t); $('#themeBtn').textContent = t === 'dark' ? '☀️' : '🌙'; store.set('theme', t); };
  applyTheme(store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('#themeBtn').onclick = () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');

  // تبويبات
  $$('.tabs button').forEach(b => b.onclick = () => {
    document.body.dataset.page = b.dataset.p;
    $$('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    $$('.page').forEach(p => p.classList.toggle('active', p.id === 'p-' + b.dataset.p));
    if (b.dataset.p === 'rain') ensureRain();
    if (b.dataset.p === 'cal') renderCal();
    if (b.dataset.p === 'sky') renderSky();
    if (b.dataset.p === 'compass') updateCompassInfo();
    setTimeout(() => { map?.invalidateSize(); rainMap?.invalidateSize(); }, 80);
  });

  // ---- موقع المستخدم ----
  let me = store.get('lastPos', { lat: 29.3759, lon: 47.9774 }); // الكويت افتراضياً
  let meAcc = null, watchId = null, heading = null;
  const meIcon = L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  const emoji = (e) => L.divIcon({ className: '', html: `<div class="emoji-pin">${e}</div>`, iconSize: [28, 28], iconAnchor: [14, 28] });

  function startWatch() {
    if (!navigator.geolocation) return toast('الجهاز لا يدعم تحديد الموقع');
    watchId = navigator.geolocation.watchPosition(p => {
      me = { lat: p.coords.latitude, lon: p.coords.longitude };
      meAcc = p.coords.accuracy;
      if (p.coords.heading != null && !isNaN(p.coords.heading)) heading = p.coords.heading;
      store.set('lastPos', me);
      onPos();
    }, e => toast('تعذّر تحديد الموقع: ' + (e.message || '')), { enableHighAccuracy: true, maximumAge: 3000 });
  }

  // ---- الخريطة الرئيسية ----
  const layers = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap' }),
    sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' })
  };
  L.Icon.Default.mergeOptions({iconUrl:'vendor/leaflet/images/marker-icon.png',iconRetinaUrl:'vendor/leaflet/images/marker-icon-2x.png',shadowUrl:'vendor/leaflet/images/marker-shadow.png'});
  const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([me.lat, me.lon], 11);
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  let curLayer = layers.osm; curLayer.addTo(map);
  $('#layerSel').onchange = () => { map.removeLayer(curLayer); curLayer = layers[$('#layerSel').value]; curLayer.addTo(map); };

  const meMark = L.marker([me.lat, me.lon], { icon: meIcon, zIndexOffset: 1000 }).addTo(map);
  let carMark = null, destMark = null, trackLine = null, liveLine = null, poiLayer = L.layerGroup().addTo(map);
  let dest = store.get('dest', null);
  let car = store.get('car', null);

  function placeCar() {
    if (carMark) map.removeLayer(carMark);
    if (!car) return;
    carMark = L.marker([car.lat, car.lon], { icon: emoji('🚙'), draggable: true })
      .bindPopup(`<b>سيارتي</b><br><span dir="ltr">${car.lat.toFixed(5)}, ${car.lon.toFixed(5)}</span><br><button id="goCar">توجه إليها</button> <button id="clrCar">امسح</button>`)
      .addTo(map).on('dragend', e => { car = { lat: e.target.getLatLng().lat, lon: e.target.getLatLng().lng, t: Date.now() }; store.set('car', car); onPos(); })
      .on('popupopen', () => {
        $('#goCar')?.addEventListener('click', () => { dest = { ...car, name: 'السيارة' }; store.set('dest', dest); placeDest(); onPos(); toast('تم تعيين السيارة كوجهة'); });
        $('#clrCar')?.addEventListener('click', () => { car = null; store.set('car', null); placeCar(); onPos(); toast('تم مسح موقع السيارة'); });
      });
  }
  function placeDest() {
    if (destMark) map.removeLayer(destMark);
    if (!dest) return;
    destMark = L.marker([dest.lat, dest.lon], { icon: emoji('🚩') })
      .bindPopup(`<b>${dest.name || 'الوجهة'}</b><br><span dir="ltr">${dest.lat.toFixed(5)}, ${dest.lon.toFixed(5)}</span>`)
      .addTo(map);
  }
  placeCar(); placeDest();

  function onPos() {
    meMark.setLatLng([me.lat, me.lon]);
    const f = Geo.all(me.lat, me.lon);
    $('#hudCoord').textContent = f.dec;
    let h = '';
    if (dest) {
      const d = Geo.haversine(me.lat, me.lon, dest.lat, dest.lon);
      const b = Geo.bearing(me.lat, me.lon, dest.lat, dest.lon);
      h = `إلى ${dest.name || 'الوجهة'}: ${Geo.fmtDist(d)} · ${Geo.dirName(b)} (${Math.round(b)}°)`;
    } else if (car) {
      const d = Geo.haversine(me.lat, me.lon, car.lat, car.lon);
      h = `السيارة: ${Geo.fmtDist(d)} · ${Geo.dirName(Geo.bearing(me.lat, me.lon, car.lat, car.lon))}`;
    }
    $('#hudDest').textContent = h + (meAcc ? ` · دقة ±${Math.round(meAcc)}م` : '');
    if (recording) pushTrack(me.lat, me.lon);
    updateCompassInfo();
  }

  $('#btnLocate').onclick = () => { map.setView([me.lat, me.lon], Math.max(map.getZoom(), 14)); if (!watchId) startWatch(); toast('تم التمركز على موقعك'); };
  map.on('click', e => {
    dest = { lat: e.latlng.lat, lon: e.latlng.lng, name: 'نقطة على الخريطة' }; store.set('dest', dest); placeDest(); onPos();
  });
  map.on('contextmenu', e => {
    L.DomEvent.preventDefault(e);
    const f = Geo.all(e.latlng.lat, e.latlng.lng);
    L.popup().setLatLng(e.latlng).setContent(`
      <b>نقطة</b><br><span dir="ltr">${f.dec}</span><br>
      <small dir="ltr">${f.utm}<br>${f.mgrs}</small><br>
      <button onclick="window._setDest(${e.latlng.lat},${e.latlng.lng})">تعيين وجهة</button>
      <button onclick="window._setCar(${e.latlng.lat},${e.latlng.lng})">هنا سيارتي</button>
      <button onclick="navigator.clipboard.writeText('${f.dec}')">نسخ</button>`).openOn(map);
  });
  window._setDest = (lat, lon) => { dest = { lat, lon, name: 'وجهة' }; store.set('dest', dest); placeDest(); onPos(); map.closePopup(); };
  window._setCar = (lat, lon) => { car = { lat, lon, t: Date.now() }; store.set('car', car); placeCar(); onPos(); map.closePopup(); toast('تم حفظ موقع السيارة'); };

  // أين سيارتي
  $('#btnCar').onclick = () => {
    if (car) {
      const d = Geo.haversine(me.lat, me.lon, car.lat, car.lon);
      sheet(`<h2>🚙 سيارتي</h2>
        <p dir="ltr" style="font-weight:700">${car.lat.toFixed(6)}, ${car.lon.toFixed(6)}</p>
        <p>المسافة: <b>${Geo.fmtDist(d)}</b> · الاتجاه: <b>${Geo.dirName(Geo.bearing(me.lat, me.lon, car.lat, car.lon))}</b></p>
        <p class="muted tiny">حُفظت ${new Date(car.t).toLocaleString('ar')}</p>
        <div class="row">
          <button class="pill big" id="sGo">توجه إليها</button>
          <button class="pill" id="sUpd">حدّث بالموقع الحالي</button>
          <button class="pill" id="sClr">امسح</button>
        </div>`);
      $('#sGo').onclick = () => { dest = { ...car, name: 'السيارة' }; store.set('dest', dest); placeDest(); map.setView([car.lat, car.lon], 15); $('#sheet').classList.remove('open'); onPos(); };
      $('#sUpd').onclick = () => { car = { lat: me.lat, lon: me.lon, t: Date.now() }; store.set('car', car); placeCar(); $('#sheet').classList.remove('open'); toast('تم تحديث موقع السيارة'); };
      $('#sClr').onclick = () => { car = null; store.set('car', null); placeCar(); $('#sheet').classList.remove('open'); toast('تم المسح'); };
    } else {
      car = { lat: me.lat, lon: me.lon, t: Date.now() }; store.set('car', car); placeCar();
      toast('تم حفظ موقع السيارة هنا 🚙');
      map.setView([car.lat, car.lon], 15);
    }
  };

  // ---- تسجيل المسار ----
  let recording = false, livePts = [], tracks = store.get('tracks', []);
  function pushTrack(lat, lon) {
    const last = livePts[livePts.length - 1];
    if (last && Geo.haversine(last[0], last[1], lat, lon) < 4) return;
    livePts.push([lat, lon, Date.now()]);
    if (liveLine) map.removeLayer(liveLine);
    liveLine = L.polyline(livePts.map(p => [p[0], p[1]]), { color: '#e8463a', weight: 4 }).addTo(map);
  }
  $('#btnRec').onclick = () => {
    if (!recording) {
      recording = true; livePts = [[me.lat, me.lon, Date.now()]];
      $('#btnRec').classList.add('on'); $('#btnRec').textContent = '⏹ أوقف';
      toast('بدأ تسجيل المسار'); if (!watchId) startWatch();
    } else {
      recording = false; $('#btnRec').classList.remove('on'); $('#btnRec').textContent = '⏺ سجل المسار';
      if (livePts.length < 2) { toast('المسار قصير جداً'); return; }
      let dist = 0; for (let i = 1; i < livePts.length; i++) dist += Geo.haversine(livePts[i - 1][0], livePts[i - 1][1], livePts[i][0], livePts[i][1]);
      const name = prompt('اسم المسار:', `مسار ${new Date().toLocaleDateString('ar')}`) || `مسار ${tracks.length + 1}`;
      tracks.unshift({ id: Date.now(), name, pts: livePts, dist, t: Date.now() }); store.set('tracks', tracks);
      if (liveLine) map.removeLayer(liveLine); liveLine = null; livePts = [];
      toast(`حُفظ المسار · ${Geo.fmtDist(dist)}`);
    }
  };
  function showTrack(tr) {
    if (trackLine) map.removeLayer(trackLine);
    trackLine = L.polyline(tr.pts.map(p => [p[0], p[1]]), { color: '#2a9d8f', weight: 5 }).addTo(map);
    map.fitBounds(trackLine.getBounds(), { padding: [40, 40] });
  }
  $('#btnTracks').onclick = () => {
    if (!tracks.length) return sheet('<h2>مساراتي</h2><p class="muted">ما عندك مسارات محفوظة بعد. اضغط «سجل المسار» وتحرك.</p>');
    sheet(`<h2>🗂 مساراتي</h2>` + tracks.map((t, i) => `
      <div class="track"><div><b>${t.name}</b><br><small class="muted">${Geo.fmtDist(t.dist)} · ${new Date(t.t).toLocaleString('ar')} · ${t.pts.length} نقطة</small></div>
      <div class="acts">
        <button data-a="show" data-i="${i}">عرض</button>
        <button data-a="gpx" data-i="${i}">GPX</button>
        <button data-a="del" data-i="${i}">حذف</button>
      </div></div>`).join(''));
    $('#sheetBody').onclick = (e) => {
      const b = e.target.closest('button[data-a]'); if (!b) return;
      const t = tracks[+b.dataset.i];
      if (b.dataset.a === 'show') { showTrack(t); $('#sheet').classList.remove('open'); }
      if (b.dataset.a === 'del') { tracks.splice(+b.dataset.i, 1); store.set('tracks', tracks); $('#btnTracks').click(); toast('حُذف'); }
      if (b.dataset.a === 'gpx') downloadGPX(t);
    };
  };
  function downloadGPX(t) {
    const pts = t.pts.map(p => `<trkpt lat="${p[0]}" lon="${p[1]}"><time>${new Date(p[2]).toISOString()}</time></trkpt>`).join('\n');
    const gpx = `<?xml version="1.0"?><gpx version="1.1" creator="DarbAlBarr"><trk><name>${t.name}</name><trkseg>\n${pts}\n</trkseg></trk></gpx>`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' })); a.download = t.name + '.gpx'; a.click();
  }

  // POIs من Overpass (آبار / مياه / ينابيع)
  let poisLoaded = false;
  $('#btnPOI').onclick = async () => {
    toast('نجلب الآبار والمياه من OpenStreetMap…');
    const b = map.getBounds();
    const q = `[out:json][timeout:25];(node["natural"="spring"](${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()});node["amenity"="drinking_water"](${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()});node["man_made"="water_well"](${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()});node["waterway"="water_point"](${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}););out body;`;
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q });
      const j = await r.json();
      poiLayer.clearLayers();
      (j.elements || []).forEach(n => {
        const kind = n.tags.man_made === 'water_well' ? 'بئر' : n.tags.natural === 'spring' ? 'عين' : 'مياه';
        L.marker([n.lat, n.lon], { icon: emoji('💧') }).bindPopup(`<b>${n.tags.name || kind}</b><br>${kind}`).addTo(poiLayer);
      });
      poisLoaded = true;
      toast(`وُجد ${(j.elements || []).length} مصدر ماء في هذه المنطقة`);
    } catch (e) { toast('تعذّر الجلب — تحقق من الإنترنت'); }
  };

  // تخزين البلاطات المعروضة (كاش بسيط عبر Cache API)
  $('#btnOffline').onclick = async () => {
    if (!('caches' in window)) return toast('المتصفح لا يدعم التخزين بدون نت');
    toast('نحفظ بلاطات المنطقة الحالية…');
    const z = Math.min(map.getZoom(), 14), b = map.getBounds();
    const urls = [];
    for (let zz = Math.max(z - 1, 8); zz <= z; zz++) {
      const tl = latLon2tile(b.getNorth(), b.getWest(), zz), br = latLon2tile(b.getSouth(), b.getEast(), zz);
      for (let x = tl.x; x <= br.x; x++) for (let y = tl.y; y <= br.y; y++) {
        urls.push(`https://a.tile.openstreetmap.org/${zz}/${x}/${y}.png`);
        urls.push(`https://b.tile.openstreetmap.org/${zz}/${x}/${y}.png`);
      }
    }
    const uniq = [...new Set(urls)].slice(0, 400);
    const cache = await caches.open('darb-tiles-v1');
    let ok = 0;
    for (const u of uniq) { try { const r = await fetch(u, { mode: 'cors' }); if (r.ok) { await cache.put(u, r); ok++; } } catch {} }
    toast(`حُفظ ${ok} بلاطة — ستظهر بدون نت في هذه المنطقة`);
  };
  function latLon2tile(lat, lon, z) {
    const x = Math.floor((lon + 180) / 360 * 2 ** z);
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z);
    return { x, y };
  }

  // ---- الأمطار ----
  let rainMap, rainLayer, rainDone = false;
  // شبكة نقاط على الخليج والجزيرة
  const RAIN_PTS = [];
  for (let lat = 16; lat <= 32.5; lat += 1.4) for (let lon = 34; lon <= 59; lon += 1.4) RAIN_PTS.push([+lat.toFixed(2), +lon.toFixed(2)]);

  function ensureRain() {
    if (!rainMap) {
      rainMap = L.map('rainMap', { zoomControl: true, attributionControl: true }).setView([24.5, 46.5], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '© OSM' }).addTo(rainMap);
      rainLayer = L.layerGroup().addTo(rainMap);
      const leg = L.control({ position: 'bottomright' });
      leg.onAdd = function () { const d = L.DomUtil.create('div', 'legend'); d.innerHTML = '<b>مجموع المطر</b><br><i style="background:#74c0fc"></i>1–5 مم<br><i style="background:#1c7ed6"></i>5–15 مم<br><i style="background:#1864ab"></i>15–40 مم<br><i style="background:#3b5bdb"></i>+40 مم'; return d; };
      leg.addTo(rainMap);
    }
    setTimeout(() => rainMap.invalidateSize(), 100);
    if (!rainDone) loadRain();
  }
  $('#rainLoad').onclick = () => loadRain();
  $('#rainDays').onchange = () => loadRain();

  function rainColor(mm) {
    if (mm < 1) return null;
    if (mm < 5) return '#74c0fc'; if (mm < 15) return '#1c7ed6'; if (mm < 40) return '#1864ab'; return '#3b5bdb';
  }
  async function loadRain() {
    rainDone = true;
    $('#rainList').innerHTML = '<li class="muted">نجلب بيانات الأمطار…</li>';
    rainLayer.clearLayers();
    const days = +$('#rainDays').value;
    const end = new Date(); end.setDate(end.getDate() - 1); // أرشيف حتى أمس
    const start = new Date(end); start.setDate(start.getDate() - (days - 1));
    const fmt = d => d.toISOString().slice(0, 10);
    const lats = RAIN_PTS.map(p => p[0]).join(',');
    const lons = RAIN_PTS.map(p => p[1]).join(',');
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lats}&longitude=${lons}&start_date=${fmt(start)}&end_date=${fmt(end)}&daily=precipitation_sum&timezone=auto`;
    try {
      const r = await fetch(url); const j = await r.json();
      const arr = Array.isArray(j) ? j : [j];
      const hits = [];
      arr.forEach((loc, i) => {
        const sum = (loc.daily?.precipitation_sum || []).reduce((a, b) => a + (b || 0), 0);
        const lat = loc.latitude ?? RAIN_PTS[i][0], lon = loc.longitude ?? RAIN_PTS[i][1];
        const col = rainColor(sum); if (!col) return;
        const rad = Math.min(18, 6 + sum / 3);
        L.circleMarker([lat, lon], { radius: rad, color: col, fillColor: col, fillOpacity: 0.7, weight: 1 })
          .bindPopup(`<b>${sum.toFixed(1)} مم</b> خلال ${days} يوم<br><span dir="ltr">${lat.toFixed(2)}, ${lon.toFixed(2)}</span>`)
          .addTo(rainLayer);
        hits.push({ lat, lon, sum, dist: Geo.haversine(me.lat, me.lon, lat, lon) });
      });
      hits.sort((a, b) => a.dist - b.dist);
      if (!hits.length) { $('#rainList').innerHTML = '<li class="muted">ما في مطر يُذكر على الشبكة في هذه الفترة.</li>'; toast('ما في مطر مذكور'); return; }
      $('#rainList').innerHTML = hits.slice(0, 12).map(h =>
        `<li><b>${h.sum.toFixed(1)} مم</b> · ${Geo.fmtDist(h.dist)} · ${Geo.dirName(Geo.bearing(me.lat, me.lon, h.lat, h.lon))}
         <button class="pill" style="padding:4px 10px;margin-inline-start:6px" data-lat="${h.lat}" data-lon="${h.lon}">على الخريطة</button></li>`).join('');
      $('#rainList').onclick = (e) => {
        const b = e.target.closest('button[data-lat]'); if (!b) return;
        $$('.tabs button').find(x => x.dataset.p === 'map').click();
        dest = { lat: +b.dataset.lat, lon: +b.dataset.lon, name: 'مكان مطر' }; store.set('dest', dest); placeDest();
        map.setView([dest.lat, dest.lon], 9); onPos();
      };
      toast(`عُثر على ${hits.length} منطقة ممطرة`);
    } catch (e) { $('#rainList').innerHTML = '<li class="muted">تعذّر جلب البيانات. تحقق من الإنترنت.</li>'; }
  }

  // ---- الإحداثيات ----
  function showCoord(lat, lon, notes = [], src = '') {
    const f = Geo.all(lat, lon);
    const d = Geo.haversine(me.lat, me.lon, lat, lon);
    const b = Geo.bearing(me.lat, me.lon, lat, lon);
    const rows = [
      ['عشري', f.dec], ['درجات', f.dms], ['درجة/دقيقة', f.dm], ['UTM', f.utm], ['MGRS', f.mgrs], ['خرائط جوجل', f.gmaps]
    ].map(([k, v]) => `<div class="out-row"><b>${k}</b><code>${v}</code><button data-c="${encodeURIComponent(v)}">نسخ</button></div>`).join('');
    $('#coordOut').innerHTML = `<div class="card">
      ${notes.map(n => `<div class="note">⚠️ ${n}</div>`).join('')}
      ${src ? `<div class="muted tiny">المصدر: ${src}</div>` : ''}
      ${rows}
      <p>المسافة منك: <b>${Geo.fmtDist(d)}</b> · ${Geo.dirName(b)}</p>
      <div class="row">
        <button class="pill big" id="cShow">أظهر على الخريطة</button>
        <button class="pill" id="cDest">اجعلها وجهة</button>
        <button class="pill" id="cCar">هنا سيارتي</button>
      </div></div>`;
    $('#coordOut').onclick = (e) => {
      const b = e.target.closest('button[data-c]'); if (b) copy(decodeURIComponent(b.dataset.c));
    };
    $('#cShow').onclick = () => { $$('.tabs button').find(x => x.dataset.p === 'map').click(); map.setView([lat, lon], 14); L.marker([lat, lon], { icon: emoji('📌') }).addTo(map).bindPopup(f.dec).openPopup(); };
    $('#cDest').onclick = () => { dest = { lat, lon, name: 'إحداثيات' }; store.set('dest', dest); placeDest(); toast('تم تعيين الوجهة'); };
    $('#cCar').onclick = () => { car = { lat, lon, t: Date.now() }; store.set('car', car); placeCar(); toast('تم حفظ السيارة'); };
  }
  $('#coordGo').onclick = () => {
    const found = Geo.parse($('#coordIn').value);
    if (!found.length) return toast('ما لقينا إحداثيات في النص');
    if (found.length === 1) return showCoord(found[0].lat, found[0].lon, found[0].notes, found[0].src);
    $('#coordOut').innerHTML = `<div class="card"><h3>وجدنا ${found.length} موقع</h3>` +
      found.map((f, i) => `<div class="out-row"><b>${i + 1}. ${f.src}</b><code>${f.lat.toFixed(5)}, ${f.lon.toFixed(5)}</code>
        <button data-i="${i}">اختر</button></div>${(f.notes || []).map(n => `<div class="note">${n}</div>`).join('')}`).join('') + '</div>';
    $('#coordOut').onclick = (e) => { const b = e.target.closest('button[data-i]'); if (b) { const f = found[+b.dataset.i]; showCoord(f.lat, f.lon, f.notes, f.src); } };
  };
  $('#coordHere').onclick = () => { $('#coordIn').value = `${me.lat.toFixed(6)}, ${me.lon.toFixed(6)}`; showCoord(me.lat, me.lon, [], 'موقعي'); };
  $('#coordPaste').onclick = async () => { try { $('#coordIn').value = await navigator.clipboard.readText(); $('#coordGo').click(); } catch { toast('اسمح باللصق أو الصق يدوياً'); } };

  // ---- التقويم ----
  function renderCal() {
    const d = new Date(), s = Astro.seasonOf(d), t = Astro.taliOf(d), m = Astro.moon(d);
    const suh = Astro.countdown(8, 24, d), was = Astro.countdown(10, 16, d);
    $('#calHero').innerHTML = `
      <div class="big">${d.toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div class="muted">${Astro.hijri(d)}</div>
      <span class="season-badge" style="background:${s.c}">${s.n} · اليوم ${s.day} من ${s.total}</span>
      <div class="bar"><i style="width:${(s.day / s.total) * 100}%"></i></div>
      <p style="margin:10px 0 0">${s.t}</p>
      <div class="row" style="margin-top:12px">
        <span class="pill" style="background:rgba(255,255,255,.15);color:#fff;border:0">سهيل بعد ${suh} يوم</span>
        <span class="pill" style="background:rgba(255,255,255,.15);color:#fff;border:0">الوسم بعد ${was} يوم</span>
      </div>`;
    // قمر
    const phase = m.phase, r = 36;
    // ظل القمر على قرص
    const ox = Math.cos(phase * 2 * Math.PI) * r;
    $('#calMoon').innerHTML = `
      <h3>القمر</h3>
      <svg class="moon-svg" viewBox="-40 -40 80 80">
        <circle r="36" fill="#f6e7b0"/><circle r="36" fill="#1b2a4a" cx="${phase < 0.5 ? ox : -ox}" style="mix-blend-mode:darken"/>
      </svg>
      <b>${m.name}</b><br><small class="muted">عمر الهلال ${m.age.toFixed(1)} يوم · إضاءة ${(m.illum * 100).toFixed(0)}%</small>
      <p class="tiny muted">البدر القادم: ${m.nextFull.toLocaleDateString('ar')}<br>المحاق: ${m.nextNew.toLocaleDateString('ar')}</p>`;
    $('#calTali').innerHTML = `
      <h3>الطالع</h3>
      <div style="font-size:28px;font-weight:900">${t.name}</div>
      <p>اليوم <b>${t.day}</b> من الطالع</p>
      <p class="muted">التالي: ${t.next} · ${t.nextDate.toLocaleDateString('ar')}</p>`;
    // صلاة
    const tz = -new Date().getTimezoneOffset() / 60;
    const p = Astro.prayers(d, me.lat, me.lon, tz);
    const names = { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
    const nowH = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    let next = 'fajr'; for (const k of Object.keys(names)) if (p[k] > nowH) { next = k; break; }
    $('#prayLoc').textContent = `عند ${me.lat.toFixed(2)}°, ${me.lon.toFixed(2)}°`;
    $('#prayGrid').innerHTML = Object.keys(names).map(k =>
      `<div class="${k === next ? 'next' : ''}"><b>${names[k]}</b><span>${Astro.fmtH(p[k])}</span></div>`).join('');
    // مواسم
    $('#seasonList').innerHTML = Astro.SEASONS.map(x => {
      const cur = x.n === s.n;
      const a = `${x.s[0]}/${x.s[1]}`, b = `${x.e[0]}/${x.e[1]}`;
      return `<div class="${cur ? 'cur' : ''}"><i style="background:${x.c}"></i><span><b>${x.n}</b>${cur ? ` · اليوم ${s.day}` : ''}<br><small>${x.t}</small></span><small>${a} → ${b}</small></div>`;
    }).join('');
  }

  // ---- السماء ----
  function renderSky() {
    const c = $('#sky'), ctx = c.getContext('2d'), W = c.width, H = c.height, R = W / 2 - 20;
    const t = $('#skyTime').value; const d = new Date();
    if (t) { const [hh, mm] = t.split(':').map(Number); d.setHours(hh, mm, 0, 0); }
    ctx.clearRect(0, 0, W, H);
    // خلفية
    const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, R);
    g.addColorStop(0, '#1a2750'); g.addColorStop(1, '#050814');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2); ctx.fill();
    // أفق وخطوط
    ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1;
    for (const a of [30, 60]) { ctx.beginPath(); ctx.arc(W / 2, H / 2, R * (1 - a / 90), 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(W / 2, H / 2, R, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke();
    // جهات
    ctx.fillStyle = '#f2b766'; ctx.font = 'bold 22px Cairo'; ctx.textAlign = 'center';
    ctx.fillText('ش', W / 2, H / 2 - R + 24);
    ctx.fillStyle = '#9aa7c0'; ctx.fillText('ج', W / 2, H / 2 + R - 10);
    ctx.fillText('ق', W / 2 + R - 16, H / 2 + 6); ctx.fillText('غ', W / 2 - R + 16, H / 2 + 6);

    const proj = (alt, az) => {
      if (alt < 0) return null;
      const r = (1 - alt / 90) * R, rad = (az - 90) * Math.PI / 180; // شمال فوق، شرق يمين (لكن RTL لا يغيّر الكانفاس)
      // نريد شمال فوق وشرق يسار في RTL؟ نترك شرق يمين (معيار فلكي)
      return [W / 2 + r * Math.cos(rad), H / 2 + r * Math.sin(rad)];
    };
    // نجوم خلفية عشوائية ثابتة
    for (let i = 0; i < 120; i++) {
      const ang = (i * 2.399) % (Math.PI * 2), rr = ((i * 47) % 100) / 100 * R;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + (i % 5) * 0.1})`;
      ctx.beginPath(); ctx.arc(W / 2 + Math.cos(ang) * rr, H / 2 + Math.sin(ang) * rr, 1 + (i % 3) * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    const visible = [];
    Astro.STARS.forEach(s => {
      const p = Astro.altAz(s.ra, s.de, me.lat, me.lon, d);
      const xy = proj(p.alt, p.az); if (!xy) return;
      const size = Math.max(2, 6 - s.m);
      ctx.beginPath(); ctx.fillStyle = '#fff'; ctx.arc(xy[0], xy[1], size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2b766'; ctx.font = '14px Cairo'; ctx.textAlign = 'left';
      ctx.fillText(s.n.split(' ')[0], xy[0] + 6, xy[1] - 4);
      visible.push({ ...s, ...p });
    });
    // القمر
    const mp = Astro.moonPos(d, me.lat, me.lon); const mxy = proj(mp.alt, mp.az);
    if (mxy) { ctx.beginPath(); ctx.fillStyle = '#f6e7b0'; ctx.arc(mxy[0], mxy[1], 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f6e7b0'; ctx.fillText('القمر', mxy[0] + 12, mxy[1] + 4); }

    visible.sort((a, b) => b.alt - a.alt);
    $('#starList').innerHTML = visible.map(s =>
      `<li><b>${s.n}</b> · ارتفاع ${Math.round(s.alt)}° · ${Geo.dirName(s.az)} (${Math.round(s.az)}°)<br><small class="muted">${s.tip}</small></li>`
    ).join('') || '<li class="muted">ما في نجوم دليل ظاهرة الآن — جرّب وقتاً آخر.</li>';
  }
  $('#skyNow').onclick = () => { const n = new Date(); $('#skyTime').value = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; renderSky(); };
  $('#skyTime').onchange = renderSky;

  // ---- البوصلة ----
  let compassOn = false, deviceHeading = null;
  function setDial(deg) {
    $('#dial').style.transform = `rotate(${-deg}deg)`;
    $('#heading').textContent = `${Math.round(deg)}° · ${Geo.dirName(deg)}`;
  }
  function updateCompassInfo() {
    const qb = Astro.qibla(me.lat, me.lon);
    let html = `<p>القبلة من موقعك: <b>${Math.round(qb)}°</b> · ${Geo.dirName(qb)}</p>`;
    $('#qiblaMark').style.transform = `rotate(${qb}deg) translateY(-${Math.min(78, 330) * 0.38}px) rotate(${-qb}deg)`;
    // إصلاح: استخدم نصف قطر ثابت نسبي
    const rad = $('#compass').clientWidth * 0.38;
    $('#qiblaMark').style.transform = `rotate(${qb}deg) translateY(-${rad}px)`;
    if (car) {
      const cb = Geo.bearing(me.lat, me.lon, car.lat, car.lon);
      const cd = Geo.haversine(me.lat, me.lon, car.lat, car.lon);
      $('#carMark').style.display = 'block';
      $('#carMark').style.transform = `rotate(${cb}deg) translateY(-${rad * 0.72}px)`;
      html += `<p>السيارة: <b>${Geo.fmtDist(cd)}</b> · ${Geo.dirName(cb)} (${Math.round(cb)}°)</p>`;
    } else $('#carMark').style.display = 'none';
    if (dest) {
      const db = Geo.bearing(me.lat, me.lon, dest.lat, dest.lon);
      html += `<p>الوجهة: <b>${Geo.fmtDist(Geo.haversine(me.lat, me.lon, dest.lat, dest.lon))}</b> · ${Geo.dirName(db)}</p>`;
    }
    $('#compassInfo').innerHTML = html;
    if (deviceHeading != null) setDial(deviceHeading);
    else if (heading != null) setDial(heading);
  }
  $('#compassStart').onclick = async () => {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
        const p = await DeviceOrientationEvent.requestPermission();
        if (p !== 'granted') return toast('لم يُسمح بالبوصلة');
      }
      window.addEventListener('deviceorientationabsolute', onOrient, true);
      window.addEventListener('deviceorientation', onOrient, true);
      compassOn = true; $('#compassMsg').textContent = 'البوصلة تعمل — أمسك الجوال أفقياً';
      toast('تم تشغيل البوصلة');
    } catch { $('#compassMsg').textContent = 'الجهاز لا يدعم بوصلة — نعرض اتجاه GPS إن توفر'; }
  };
  function onOrient(e) {
    let h = null;
    if (e.absolute && e.alpha != null) h = (360 - e.alpha) % 360;
    else if (e.webkitCompassHeading != null) h = e.webkitCompassHeading;
    else if (e.alpha != null) h = (360 - e.alpha) % 360;
    if (h == null) return;
    deviceHeading = h; setDial(h);
  }

  // ---- Service Worker ----
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(new URL('./sw.js', location.href), { scope: new URL('./', location.href).href }).catch(() => {});
  }

  // بدء
  document.body.dataset.page = 'map';
  onPos();
  startWatch();
  const n = new Date(); $('#skyTime').value = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  $('#topSub').textContent = Astro.seasonOf(n).n + ' · ' + Astro.moon(n).name;
})();

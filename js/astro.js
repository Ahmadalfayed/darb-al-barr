/* درب البر — حسابات فلكية: القمر، الهجري، الطوالع، مواقيت الصلاة، النجوم — كود أصلي */
(function (G) {
  const D = Math.PI / 180;
  const jd = d => d.getTime() / 86400000 + 2440587.5;

  /* ---- القمر ---- */
  function moon(date = new Date()) {
    const syn = 29.530588853, ref = 2451550.1; // محاق 6 يناير 2000
    const age = ((jd(date) - ref) % syn + syn) % syn;
    const illum = (1 - Math.cos(2 * Math.PI * age / syn)) / 2;
    const names = ['محاق', 'هلال متزايد', 'تربيع أول', 'أحدب متزايد', 'بدر', 'أحدب متناقص', 'تربيع ثاني', 'هلال متناقص'];
    const idx = Math.floor(((age / syn) * 8) + 0.5) % 8;
    const nextFull = new Date(date.getTime() + (((syn / 2 - age) % syn + syn) % syn) * 86400000);
    const nextNew = new Date(date.getTime() + (syn - age) * 86400000);
    return { age, illum, name: names[idx], phase: age / syn, nextFull, nextNew };
  }

  /* ---- التاريخ الهجري (تقويم أم القرى من المتصفح) ---- */
  function hijri(date = new Date()) {
    try {
      const f = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', { day: 'numeric', month: 'long', year: 'numeric' });
      return f.format(date);
    } catch (e) { return ''; }
  }
  function hijriParts(date = new Date()) {
    try {
      const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
      const g = t => +p.find(x => x.type === t).value.replace(/\D/g, '');
      return { d: g('day'), m: g('month'), y: g('year') };
    } catch (e) { return null; }
  }

  /* ---- الطوالع (منازل القمر الـ28، 13 يوماً تقريباً) والمواسم — تواريخ تقريبية متداولة في الخليج ---- */
  const TAWALE = [
    ['الشولة', 1, 1], ['النعائم', 1, 14], ['البلدة', 1, 27], ['سعد الذابح', 2, 9], ['سعد بلع', 2, 22],
    ['سعد السعود', 3, 7], ['سعد الأخبية', 3, 20], ['المقدم', 4, 2], ['المؤخر', 4, 15], ['الرشا', 4, 28],
    ['الشرطين', 5, 11], ['البطين', 5, 24], ['الثريا', 6, 7], ['الدبران', 6, 20], ['الهقعة', 7, 3],
    ['الهنعة', 7, 16], ['الذراع', 7, 29], ['النثرة', 8, 11], ['الطرفة', 8, 24], ['الجبهة', 9, 6],
    ['الزبرة', 9, 19], ['الصرفة', 10, 2], ['العواء', 10, 15], ['السماك', 10, 28], ['الغفر', 11, 10],
    ['الزبانا', 11, 23], ['الإكليل', 12, 6], ['القلب', 12, 19]
  ];
  const SEASONS = [
    { n: 'المربعانية', s: [12, 7], e: [1, 14], c: '#7fb3ff', t: 'أشد البرد، 40 يوماً. ليالي طويلة وصقيع في البر.' },
    { n: 'الشبط', s: [1, 15], e: [2, 9], c: '#9ec5ff', t: 'برد قارس ورياح شمالية، تبدأ الأيام بالطول.' },
    { n: 'العقارب', s: [2, 10], e: [3, 6], c: '#b5e48c', t: 'تقلب الجو وبداية الدفء، ربيع البر وظهور الفقع.' },
    { n: 'الحميميات', s: [3, 7], e: [4, 2], c: '#c7e86a', t: 'اعتدال ودفء، أطيب أيام الكشتة.' },
    { n: 'الذراعين', s: [4, 3], e: [4, 28], c: '#ffd166', t: 'بداية الحر وهبوب السرايات (العواصف الرعدية).' },
    { n: 'الكنة', s: [4, 29], e: [6, 6], c: '#ffb703', t: 'سكون الرياح وارتفاع الحرارة.' },
    { n: 'القيظ', s: [6, 7], e: [8, 23], c: '#fb8500', t: 'أشد الحر، وفيه البوارح وجمرة القيظ.' },
    { n: 'سهيل (الصفري)', s: [8, 24], e: [10, 15], c: '#f4a261', t: 'طلوع سهيل؛ يبرد الليل تدريجياً ويبدأ موسم البر.' },
    { n: 'الوسم', s: [10, 16], e: [12, 6], c: '#2a9d8f', t: 'موسم أمطار الوسم المباركة، 52 يوماً؛ ينبت فيها الفقع والربيع.' }
  ];
  const md = (m, d) => m * 100 + d;
  function seasonOf(date = new Date()) {
    const v = md(date.getMonth() + 1, date.getDate());
    for (const s of SEASONS) {
      const a = md(...s.s), b = md(...s.e);
      if (a <= b ? (v >= a && v <= b) : (v >= a || v <= b)) {
        const y = date.getFullYear();
        let start = new Date(y, s.s[0] - 1, s.s[1]); if (start > date) start = new Date(y - 1, s.s[0] - 1, s.s[1]);
        let end = new Date(start.getFullYear(), s.e[0] - 1, s.e[1]); if (end < start) end = new Date(start.getFullYear() + 1, s.e[0] - 1, s.e[1]);
        const day = Math.floor((date - start) / 86400000) + 1, total = Math.round((end - start) / 86400000) + 1;
        return { ...s, day, total, start, end };
      }
    }
  }
  function taliOf(date = new Date()) {
    const v = md(date.getMonth() + 1, date.getDate());
    let cur = TAWALE[TAWALE.length - 1], i = TAWALE.length - 1;
    TAWALE.forEach((t, k) => { if (md(t[1], t[2]) <= v) { cur = t; i = k; } });
    const next = TAWALE[(i + 1) % TAWALE.length];
    let st = new Date(date.getFullYear(), cur[1] - 1, cur[2]); if (st > date) st.setFullYear(st.getFullYear() - 1);
    return { name: cur[0], day: Math.floor((date - st) / 86400000) + 1, next: next[0], nextDate: new Date(st.getFullYear() + (next[1] < cur[1] ? 1 : 0), next[1] - 1, next[2]) };
  }
  // عداد سهيل والوسم
  function countdown(m, d, date = new Date()) {
    let t = new Date(date.getFullYear(), m - 1, d); if (t < new Date(date.toDateString())) t.setFullYear(t.getFullYear() + 1);
    return Math.round((t - new Date(date.toDateString())) / 86400000);
  }

  /* ---- الشمس ومواقيت الصلاة (أسلوب أم القرى: الفجر 18.5°، العشاء بعد المغرب 90 دقيقة، 120 في رمضان) ---- */
  function sunPos(j) {
    const d = j - 2451545.0, g = (357.529 + 0.98560028 * d) * D, q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D, e = (23.439 - 0.00000036 * d) * D;
    const RA = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / D / 15;
    const dec = Math.asin(Math.sin(e) * Math.sin(L)) / D;
    const eqt = q / 15 - ((RA % 24) + 24) % 24;
    return { dec, eqt: ((eqt + 12) % 24 + 24) % 24 - 12 };
  }
  function prayers(date, lat, lon, tz = -date.getTimezoneOffset() / 60) {
    const j0 = jd(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))) - lon / 360;
    const { dec, eqt } = sunPos(j0 + 0.5);
    const noon = 12 - eqt - lon / 15 + tz;
    const ha = ang => { const c = (-Math.sin(ang * D) - Math.sin(lat * D) * Math.sin(dec * D)) / (Math.cos(lat * D) * Math.cos(dec * D)); return Math.acos(Math.max(-1, Math.min(1, c))) / D / 15; };
    const asrAng = -Math.atan(1 / (1 + Math.tan(Math.abs(lat - dec) * D))) / D;
    const hp = hijriParts(date); const ramadan = hp && hp.m === 9;
    const t = {
      fajr: noon - ha(18.5), sunrise: noon - ha(0.833), dhuhr: noon + 2 / 60,
      asr: noon + ha(asrAng), maghrib: noon + ha(0.833)
    };
    t.isha = t.maghrib + (ramadan ? 2 : 1.5);
    return t;
  }
  const fmtH = h => { h = (h + 24) % 24; let H = Math.floor(h), M = Math.round((h - H) * 60); if (M === 60) { H++; M = 0; } const ap = H < 12 ? 'ص' : 'م'; return `${((H + 11) % 12) + 1}:${String(M).padStart(2, '0')} ${ap}`; };
  function qibla(lat, lon) { return Geo.bearing(lat, lon, 21.4225, 39.8262); }

  /* ---- النجوم ---- */
  const STARS = [
    { n: 'الجدي (النجم القطبي)', ra: 2.530, de: 89.264, m: 2.0, tip: 'يدل على الشمال دائماً تقريباً. ارتفاعه = خط عرضك.' },
    { n: 'سهيل', ra: 6.399, de: -52.696, m: -0.7, tip: 'يطلع جهة الجنوب؛ طلوعه بشارة انكسار الحر.' },
    { n: 'الثريا', ra: 3.791, de: 24.105, m: 1.6, tip: 'عنقود نجوم، تطلع من الشرق وتغرب في الغرب.' },
    { n: 'الشعرى اليمانية', ra: 6.752, de: -16.716, m: -1.46, tip: 'ألمع نجم في السماء، جنوب شرق شتاءً.' },
    { n: 'الجوزاء (المرزم)', ra: 5.603, de: -1.202, m: 1.7, tip: 'حزام الجوزاء يطلع من الشرق تماماً ويغرب في الغرب تماماً.' },
    { n: 'العيوق', ra: 5.278, de: 45.998, m: 0.08, tip: 'نجم شمالي لامع، دليل جهة الشمال الشرقي.' },
    { n: 'الدبران', ra: 4.599, de: 16.509, m: 0.85, tip: 'يتبع الثريا دائماً؛ أحمر اللون.' },
    { n: 'السماك الرامح', ra: 14.261, de: 19.182, m: -0.05, tip: 'نجم صيفي لامع برتقالي.' },
    { n: 'قلب العقرب', ra: 16.490, de: -26.432, m: 1.0, tip: 'أحمر، جهة الجنوب صيفاً.' },
    { n: 'النسر الواقع', ra: 18.616, de: 38.784, m: 0.03, tip: 'لامع جداً في ليالي الصيف.' },
    { n: 'النسر الطائر', ra: 19.846, de: 8.868, m: 0.77, tip: 'يتوسط نجمين خافتين.' },
    { n: 'السماك الأعزل', ra: 13.420, de: -11.161, m: 0.97, tip: 'نجم ربيعي أبيض مزرق.' },
    { n: 'بنات نعش (الدب الأكبر)', ra: 11.062, de: 61.751, m: 1.8, tip: 'خط الدليلين فيها يشير إلى الجدي.' },
    { n: 'منكب الجوزاء', ra: 5.919, de: 7.407, m: 0.5, tip: 'نجم أحمر في كتف الجوزاء.' },
    { n: 'رجل الجوزاء', ra: 5.242, de: -8.202, m: 0.13, tip: 'أبيض مزرق أسفل الجوزاء.' }
  ];
  function lst(date, lon) {
    const d = jd(date) - 2451545.0;
    return (((280.46061837 + 360.98564736629 * d + lon) % 360) + 360) % 360;
  }
  function altAz(ra, de, lat, lon, date) {
    const H = (lst(date, lon) - ra * 15) * D, p = lat * D, dd = de * D;
    const alt = Math.asin(Math.sin(p) * Math.sin(dd) + Math.cos(p) * Math.cos(dd) * Math.cos(H));
    const az = Math.atan2(-Math.sin(H) * Math.cos(dd), Math.cos(p) * Math.sin(dd) - Math.sin(p) * Math.cos(dd) * Math.cos(H));
    return { alt: alt / D, az: ((az / D) + 360) % 360 };
  }
  function moonPos(date, lat, lon) { // تقريب بسيط لموقع القمر
    const d = jd(date) - 2451545.0;
    const L = (218.316 + 13.176396 * d) * D, M = (134.963 + 13.064993 * d) * D, F = (93.272 + 13.229350 * d) * D;
    const lam = L + 6.289 * D * Math.sin(M), beta = 5.128 * D * Math.sin(F), e = 23.439 * D;
    const ra = Math.atan2(Math.sin(lam) * Math.cos(e) - Math.tan(beta) * Math.sin(e), Math.cos(lam)) / D / 15;
    const de = Math.asin(Math.sin(beta) * Math.cos(e) + Math.cos(beta) * Math.sin(e) * Math.sin(lam)) / D;
    return altAz((ra + 24) % 24, de, lat, lon, date);
  }
  G.Astro = { moon, hijri, hijriParts, seasonOf, taliOf, countdown, prayers, fmtH, qibla, STARS, SEASONS, TAWALE, altAz, moonPos };
})(typeof window !== 'undefined' ? window : globalThis);

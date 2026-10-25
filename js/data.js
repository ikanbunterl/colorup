/* ============================================================
   ColorUp.io — data.js
   File 3/7 · DATA & GENERATOR PAPAN
   dinamis (Mini/Classic/Epic), kartu, cuaca, kekuatan asimetris,
   nama kota & langkah tutorial sandbox.
   Tidak berisi logika permainan (itu ada di game.js).
   ============================================================ */
'use strict';

const DATA = {
  APP: { name: 'ColorUp.io', version: '1.1.0-prototype', prd: 'PRD v1.1' },

  /* ---------- 3.1 Dynamic Board Sizes ---------- */
  SIZES: {
    mini:    { key: 'mini',    label: 'Mini',    tiles: 20, side: 6,  groups: 4,  est: '15–30 menit' },
    classic: { key: 'classic', label: 'Classic', tiles: 40, side: 11, groups: 8,  est: '45–90 menit' },
    epic:    { key: 'epic',    label: 'Epic',    tiles: 60, side: 16, groups: 10, est: '2–4 jam' }
  },

  MODES: {
    ffa:  { key: 'ffa',  label: 'Free-for-All', desc: 'Semua lawan semua (2–6 pemain)' },
    coop: { key: 'coop', label: 'Co-op Tim',    desc: '2v2 / 3v3 — uang & properti bisa digabung per tim' }
  },

  /* ---------- 3.3 Gameplay Rules (customizable) ---------- */
  DEFAULT_RULES: {
    doubleRentFullSet: true,   // x2 rent saat punya 1 set warna penuh
    vacationCash:      true,   // tile Vacation memberi uang dari treasury
    auction:           true,   // lelang saat pemain menolak membeli
    noRentInPrison:    true,   // tidak dapat sewa saat dipenjara
    mortgage:          true,   // gadai properti = 50% nilai
    evenBuild:         true,   // bangun merata dalam satu set
    randomizeOrder:    true,   // acak urutan main
    powers:            true,   // [BARU] kekuatan asimetris
    weather:           true,   // [BARU] cuaca dinamis
    merging:           true,   // [BARU] property merging / Mega Property
    sabotage:          true,   // [BARU] kartu sabotase
    inflation:         true,   // [BARU] sistem inflasi
    ghost:             true,   // [BARU] bankrupt comeback / ghost mode
    actionLog:         true,   // [BARU] action history log
    antiCollusion:     'warn', // [BARU] off | warn | strict
    mergeMode:         'same', // [BARU] same = satu warna, cross = lintas warna
    inflationEvery:    10,     // ronde
    inflationStep:     0.10,   // +10%
    inflationCap:      0.50,   // maksimal +50%
    weatherEvery:      5,      // ronde
    weatherRounds:     5,      // durasi efek
    ghostStealPct:     0.08,   // 8% uang korban
    ghostStealCap:     150,
    ghostCooldown:     3,      // ronde
    sabotageCooldown:  5,      // 1 kartu / 5 ronde
    sabotageMaxHand:   2,
    gracePeriod:       240,    // detik reconnection grace period (3–5 menit)
    startingCash:      1500,
    maxPlayers:        6,
    jailFine:          50,
    jailTurns:         3,
    megaBonus:         0.25,   // +25% sewa per penggabungan
    megaCap:           1.00    // maksimal +100%
  },

  RULE_INFO: {
    size:                ['Ukuran Papan', 'Mini 20 tile (cepat), Classic 40 (standar), Epic 60 (panjang & strategis).'],
    mode:                ['Mode Permainan', 'Free-for-All atau Co-op tim 2v2/3v3.'],
    doubleRentFullSet: ['Sewa x2 Set Penuh', 'Sewa berlipat dua bila memiliki seluruh properti dalam satu kelompok warna (tanpa bangunan).'],
    vacationCash:      ['Vacation Cash', 'Mendarat di tile Vacation membagikan uang dari treasury pajak.'],
    auction:           ['Lelang', 'Properti yang tidak dibeli pemain yang mendarat akan dilelang ke semua pemain.'],
    noRentInPrison:    ['No Rent in Prison', 'Pemain di penjara tidak menerima sewa dari propertinya.'],
    mortgage:          ['Mortgage', 'Gadai properti untuk mendapat 50% nilainya; tebus dengan 110%.'],
    evenBuild:         ['Even Build', 'Bangunan harus merata dalam satu set sebelum naik tingkat.'],
    randomizeOrder:    ['Acak Urutan', 'Urutan giliran diacak saat game dimulai.'],
    powers:            ['Kekuatan Asimetris [BARU]', 'Tiap avatar punya 1 kemampuan pasif unik. Tidak menumpuk, bisa dimatikan.'],
    weather:           ['Cuaca Dinamis [BARU]', 'Cuaca berubah tiap 5 ronde dan memengaruhi sewa / biaya / pergerakan.'],
    merging:           ['Property Merging [BARU]', 'Gabungkan 2 properti bersebelahan milikmu menjadi Mega Property (+25% sewa).'],
    sabotage:          ['Kartu Sabotase [BARU]', 'Hancurkan 1 tingkat bangunan lawan. Maksimal 1 kartu / 5 ronde.'],
    inflation:         ['Inflasi [BARU]', 'Tiap 10 ronde harga sewa, pajak, dan biaya bangunan naik 10% (maks +50%).'],
    ghost:             ['Ghost Comeback [BARU]', 'Pemain bangkrut jadi Hantu: tetap jalan & bisa mencuri uang kecil (ada cap + cooldown).'],
    actionLog:         ['Action History Log [BARU]', 'Panel riwayat semua dadu, transaksi, trade, kartu, cuaca, dan inflasi.'],
    antiCollusion:     ['Anti-Collusion [BARU]', 'Deteksi trade tidak wajar (mis. $1000 ditukar $1). off / warn / strict.'],
    mergeMode:         ['Mode Merging [BARU]', 'same = hanya satu warna; cross = boleh lintas warna.'],
    inflationEvery:    ['Interval Inflasi', 'Setiap berapa ronde inflasi diterapkan.'],
    inflationStep:     ['Kenaikan Inflasi', 'Persentase kenaikan harga tiap tick inflasi.'],
    inflationCap:      ['Batas Inflasi', 'Kenaikan maksimum yang diizinkan.'],
    weatherEvery:      ['Interval Cuaca', 'Setiap berapa ronde cuaca berganti.'],
    weatherRounds:     ['Durasi Cuaca', 'Berapa ronde efek cuaca bertahan.'],
    ghostStealPct:     ['% Curian Hantu', 'Persentase uang korban yang dicuri Hantu.'],
    ghostStealCap:     ['Cap Curian Hantu', 'Batas maksimum uang yang bisa dicuri sekali jalan (anti-griefing).'],
    ghostCooldown:     ['Cooldown Hantu', 'Jarak minimum antar pencurian (ronde).'],
    sabotageCooldown:  ['Cooldown Sabotase', 'Jarak minimum antar penggunaan kartu sabotase (ronde).'],
    sabotageMaxHand:   ['Maks Kartu Sabotase', 'Jumlah kartu sabotase maksimum di tangan.'],
    gracePeriod:       ['Grace Period Reconnect', 'Detik toleransi sebelum Auto-Bot Takeover (PRD: 3–5 menit).'],
    startingCash:      ['Uang Awal', 'Modal awal tiap pemain ($500–$3000).'],
    maxPlayers:        ['Maks Pemain', 'Jumlah maksimum pemain (2–6).'],
    jailFine:          ['Denda Penjara', 'Biaya menebus diri dari penjara.'],
    jailTurns:         ['Maks Ronde Penjara', 'Setelah ini pemain bebas otomatis.'],
    megaBonus:         ['Bonus Mega Property', 'Tambahan sewa tiap penggabungan.'],
    megaCap:           ['Cap Bonus Mega', 'Batas maksimum bonus sewa Mega Property.']
  },

  /* ---------- 4.1 Color palette & kelompok properti ---------- */
  GROUPS: [
    { key: 'brown',    name: 'Coklat',     color: '#a9714b', tier: 0 },
    { key: 'mint',     name: 'Mint',       color: '#3fd6a4', tier: 1 },
    { key: 'sky',      name: 'Biru Langit',color: '#4aa8ff', tier: 2 },
    { key: 'green',    name: 'Hijau Segar',color: '#39c95b', tier: 3 },
    { key: 'yellow',   name: 'Kuning',     color: '#ffcc2e', tier: 4 },
    { key: 'pink',     name: 'Pink',       color: '#ff5fa2', tier: 5 },
    { key: 'purple',   name: 'Ungu',       color: '#a45cff', tier: 6 },
    { key: 'ultra',    name: 'Ultra',      color: '#5b3df5', tier: 7 },
    { key: 'nebula',   name: 'Nebula',     color: '#ff7a3d', tier: 8 },
    { key: 'glacier',  name: 'Glacier',    color: '#48e0e6', tier: 9 }
  ],

  TOKEN_COLORS: [
    { key: 'violet', name: 'Bright Purple', color: '#8b5cf6' },
    { key: 'pink',   name: 'Vibrant Pink',  color: '#ec4899' },
    { key: 'blue',   name: 'Electric Blue', color: '#38bdf8' },
    { key: 'yellow', name: 'Sunny Yellow',  color: '#facc15' },
    { key: 'green',  name: 'Fresh Green',   color: '#4ade80' },
    { key: 'orange', name: 'Tangerine',     color: '#fb923c' }
  ],

  TOKEN_SHAPES: ['circle', 'star', 'diamond', 'hex', 'heart', 'bolt'],

  /* ---------- 3.8 Player Powers — kekuatan asimetris ---------- */
  POWERS: [
    { key: 'taxman',    name: 'Si Hemat Pajak',   icon: '🧾', desc: 'Pajak yang kamu bayar dipotong 10%.', tag: 'Ekonomi' },
    { key: 'sprinter',  name: 'Sprinter',         icon: '⚡', desc: 'Saat dadu kembar, maju +1 langkah ekstra.', tag: 'Gerak' },
    { key: 'saver',     name: 'Tabungan Start',   icon: '💰', desc: 'Bonus +$50 setiap kali melewati Start.', tag: 'Ekonomi' },
    { key: 'architect', name: 'Arsitek',          icon: '🏗️', desc: 'Upgrade pertama tiap properti diskon 25%.', tag: 'Bangun' },
    { key: 'shield',    name: 'Perisai Sewa',     icon: '🛡️', desc: 'Sewa yang kamu bayar dipotong 10%.', tag: 'Bertahan' },
    { key: 'lucky',     name: 'Si Beruntung',     icon: '🍀', desc: 'Kartu Surprise/Bonus 25% lebih sering memberi uang tunai.', tag: 'Kartu' },
    { key: 'negotiator',name: 'Negosiator',       icon: '🤝', desc: 'Hasil lelang untukmu diskon 10% & boleh menawar sekali lagi.', tag: 'Trade' },
    { key: 'saboteur',  name: 'Sabotase Master',  icon: '💣', desc: 'Mendapat 1 kartu sabotase gratis di awal game.', tag: 'Serang' },
    { key: 'weatherwise',name:'Pengamat Cuaca',   icon: '🌤️', desc: 'Efek cuaca negatif bagimu hanya setengah kekuatan.', tag: 'Cuaca' },
    { key: 'magnate',   name: 'Magnat Properti',  icon: '🏰', desc: 'Biaya merge Mega Property dipotong 20%.', tag: 'Bangun' }
  ],

  /* ---------- 3.9 Dynamic Weather ---------- */
  WEATHER: [
    { key: 'clear',  name: 'Cerah',          icon: '☀️', desc: 'Kondisi normal, tidak ada efek.', mods: {} },
    { key: 'storm',  name: 'Badai',          icon: '⛈️', desc: 'Sewa turun 20% di seluruh papan.', mods: { rent: -0.20 } },
    { key: 'heat',   name: 'Gelombang Panas',icon: '🔥', desc: 'Biaya upgrade bangunan +25%.', mods: { build: 0.25 } },
    { key: 'fog',    name: 'Kabut',          icon: '🌫️', desc: 'Semua pergerakan +1 langkah.', mods: { move: 1 } },
    { key: 'meteor', name: 'Hujan Meteor',   icon: '☄️', desc: 'Tile properti kosong memberi bonus saat didarati.', mods: { meteor: true } },
    { key: 'golden', name: 'Hujan Emas',     icon: '🌈', desc: 'Bonus melewati Start +$100.', mods: { start: 100 } },
    { key: 'frost',  name: 'Badai Salju',    icon: '❄️', desc: 'Tidak boleh membangun / upgrade.', mods: { noBuild: true } }
  ],

  /* ---------- 3.6 Card System (Surprise / Bonus / Sabotase) ---------- */
  CARDS: {
    cash: [
      { t: 'cash', label: 'Dividen investasi warna-warni', amount: 100 },
      { t: 'cash', label: 'Menangkan kontes desain kota', amount: 150 },
      { t: 'cash', label: 'Refund pajak daerah', amount: 75 },
      { t: 'cash', label: 'Sponsor brand neon', amount: 200 },
      { t: 'cash', label: 'Bayar perbaikan papan iklan', amount: -80 },
      { t: 'cash', label: 'Denda parkir sembarangan', amount: -50 },
      { t: 'cash', label: 'Biaya festival kota', amount: -120 },
      { t: 'cash', label: 'Temuan dompet (jujur diberi imbalan)', amount: 60 }
    ],
    jail: [
      { t: 'jailFree', label: 'Kartu Bebas Penjara — simpan untuk nanti!' },
      { t: 'toJail',   label: 'Terjebak razia warna. Langsung ke Penjara.' }
    ],
    move: [
      { t: 'moveToStart', label: 'Naik bus warna. Meluncur ke START, ambil gaji.' },
      { t: 'moveNearestProp', label: 'Teleport ke properti kosong terdekat.' },
      { t: 'move', label: 'Kabut membuatmu tersesat — mundur 3 langkah.', delta: -3 }
    ],
    special: [
      { t: 'sabotage', label: 'Kartu Sabotase: hancurkan 1 tingkat bangunan lawan.', need: 'sabotage' },
      { t: 'megaBoost', label: 'Izin Mega Property: sewa +25% selama 3 ronde.', need: 'merging' },
      { t: 'taxShield', label: 'Perisai Pajak: bebas pajak 2 kali pendaratan.', need: 'any' },
      { t: 'treasury', label: 'Ambil 25% dari treasury pajak kota.', need: 'any' },
      { t: 'doubleNextRent', label: 'Kontrak Premium: sewa berikutnya yang kamu tagih x2.', need: 'any' },
      { t: 'allPay', label: 'Semua pemain memberimu $50 (uang perayaan).', need: 'any' }
    ]
  },

  /* ---------- Nama tempat (generik, aman copyright) ---------- */
  CITIES: [
    'Pelangi', 'Neon', 'Aurora', 'Kristal', 'Safari', 'Metro', 'Samudra', 'Zenit',
    'Komet', 'Laguna', 'Safir', 'Meridian', 'Cakrawala', 'Blossom', 'Obsidian', 'Kanvas'
  ],
  PLACES: [
    'Plaza', 'Avenue', 'Boulevard', 'Heights', 'Garden', 'Harbor', 'Tower', 'Park',
    'Square', 'Terrace', 'Promenade', 'District', 'Arcade', 'Marina', 'Court', 'Ridge'
  ],

  /* ---------- Tutorial sandbox (3.11) ----------
     Tiap langkah boleh punya:
       setup(g, ui)  : menyiapkan papan/dadu agar langkah jelas
       waitClick     : selector yang harus diklik pemain
       until(g)      : kondisi yang harus tercapai setelah klik
       endTurn       : langkah terakhir pada giliran ini              */
  TUTORIAL_STEPS: [
    {
      id: 'welcome',
      title: 'Selamat datang di ColorUp.io 🎨',
      text: 'Mode latihan solo: tanpa tekanan waktu, dadu di-script agar tiap langkah jelas. Urutannya: <b>gerak → beli → sewa → upgrade → merge → trade → sabotase → log</b>. Tekan <b>Lanjut</b>.',
      target: '#hud'
    },
    {
      id: 'roll',
      title: '1. Lempar dadu (RNG teraudit)',
      text: 'Klik <b>🎲 Lempar Dadu</b>. Setiap lemparan memakai seed + nonce + signature yang dicatat — buka <b>🔐 Dice Audit</b> di kanan atas untuk melihatnya (PRD 3.12).',
      target: '#btnRoll',
      waitClick: '#btnRoll',
      until: g => g.phase !== 'roll',
      setup(g) { g.scriptedRoll = [1, 2]; }   // 3 langkah → tile #3 (properti kosong di papan Mini)
    },
    {
      id: 'buy',
      title: '2. Beli properti',
      text: 'Kamu mendarat di properti kosong. Klik <b>🛒 Beli</b> untuk memilikinya. Kalau aturan lelang aktif, ada tombol <b>🔨 Lelang</b> agar semua pemain menawar.',
      target: '#overlayActions',
      waitClick: '[data-choice="buy"]',
      until: g => g.phase === 'end'
    },
    {
      id: 'inspect',
      title: '3. Detail properti',
      text: 'Klik tile mana pun di papan (milikmu = ada titik warna) untuk melihat harga, tabel sewa per tingkat, status set warna, serta tombol <b>Upgrade / Gadai / Merge / Sabotase</b>.',
      target: '.board'
    },
    {
      id: 'endturn1',
      title: '4. Akhiri giliran',
      text: 'Klik <b>✔ Akhiri Giliran</b>. Bot "Tutor" akan bermain otomatis, lalu giliran kembali ke kamu.',
      target: '#btnEnd',
      waitClick: '#btnEnd',
      endTurn: true
    },
    {
      id: 'rent',
      title: '5. Bayar sewa ke lawan',
      text: 'Tutor sekarang punya properti di depanmu. Klik <b>🎲 Lempar Dadu</b> — kamu akan mendarat di sana dan membayar sewa. Perhatikan saldo berkurang & tercatat di Action Log. Sewa dipengaruhi <b>cuaca</b> dan <b>inflasi</b>.',
      target: '#btnRoll',
      waitClick: '#btnRoll',
      until: g => g.phase !== 'roll',
      setup(g, ui) {
        const tutor = g.players[1];
        const target = g.tiles[6];                    // properti di sisi kiri papan Mini
        target.ownerId = tutor.id; target.level = 1; target.mortgaged = false; target.mega = null;
        if (tutor.properties.indexOf(6) === -1) tutor.properties.push(6);
        g.scriptedRoll = [1, 2];                      // dari tile #3 → tile #6
        ui.render();
      }
    },
    {
      id: 'build',
      title: '6. Upgrade & set warna',
      text: 'Tutorial menghadiahkanmu properti tetangga sehingga set warnamu lengkap 🌈. Klik tile milikmu → <b>🏠 Upgrade</b>: sewa naik 2x per tingkat, aturan <b>even build</b> menjaga pembangunan merata.',
      target: '.board',
      setup(g, ui) {
        const me = g.players[0];
        const owned = g.propsOf(me.id).filter(t => !t.mortgaged);
        const anchor = owned[0] || g.tiles.find(t => t.type === 'property');
        // berikan seluruh kelompok warna anchor → set penuh (boleh upgrade) + pasangan bersebelahan (boleh merge)
        g.groupTiles(anchor.group).forEach(t => {
          if (t.ownerId && t.ownerId !== me.id) {
            const o = g.p(t.ownerId);
            o.properties = o.properties.filter(i => i !== t.idx);
          }
          t.ownerId = me.id; t.level = 0; t.mortgaged = false; t.mega = null;
          if (me.properties.indexOf(t.idx) === -1) me.properties.push(t.idx);
        });
        me.cash = Math.max(me.cash, 2000);
        me.sabotageCards = Math.max(me.sabotageCards, 1);   // supaya tombol sabotase bisa dicoba
        g.addLog('sistem', '🎓 Tutorial memberikan satu set warna penuh kepada <b>' + me.name + '</b> untuk latihan upgrade & merge.');
        ui.render();
      }
    },
    {
      id: 'merge',
      title: '7. Property Merging → Mega Property',
      text: 'Punya 2 properti <b>bersebelahan</b>? Klik <b>🏰 Merge</b> untuk menggabungkannya jadi Mega Property dengan bonus sewa +25% (cap +100%). Tile Mega punya glow emas di papan.',
      target: '#btnMerge'
    },
    {
      id: 'trade',
      title: '8. Trade & Anti-Collusion',
      text: 'Klik <b>🤝 Trade</b> untuk menukar properti/uang/kartu. Panel trade menampilkan <b>skor kolusi langsung</b>: trade timpang (mis. $1000 ditukar $1) ditandai 🚩, dan di mode <i>strict</i> diblokir otomatis.',
      target: '#btnTrade'
    },
    {
      id: 'sabotage',
      title: '9. Kartu sabotase',
      text: 'Kartu sabotase didapat dari tile Surprise 🎁. Klik <b>💣 Sabotase</b> untuk menghancurkan <b>1 tingkat</b> bangunan lawan (properti tidak hilang permanen), dengan cooldown 5 ronde dan larangan menyerang rekan tim.',
      target: '#btnSabotage'
    },
    {
      id: 'log',
      title: '10. Action History Log',
      text: 'Panel kanan mencatat dadu, transaksi, trade, kartu, cuaca, dan inflasi. Bisa <b>di-collapse</b>, <b>dipindah ke kiri</b>, <b>disaring</b> per kategori, dan <b>di-export</b> sebagai .txt (PRD 3.11 & §11).',
      target: '#ticker'
    },
    {
      id: 'done',
      title: 'Tutorial selesai 🎉',
      text: 'Sisanya bisa kamu coba di lobi: <b>cuaca dinamis</b>, <b>inflasi</b>, <b>kekuatan asimetris</b>, <b>Ghost Comeback</b>, <b>mode Co-op 2v2/3v3</b>, papan <b>Mini/Classic/Epic</b>, <b>nemesis</b>, <b>karma</b>, dan <b>reconnection grace period</b>. Permainan bebas dilanjutkan — selamat bermain!',
      target: '#hud'
    }
  ]
};

/* ================= Utilitas ================= */
const Util = {
  /** PRNG deterministik (mulberry32) — dasar "server-side dice" + audit seed */
  rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },
  pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length) % arr.length]; },
  shuffle(rnd, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  },
  money(n) {
    const v = Math.round(n);
    return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US');
  },
  pct(n) { return Math.round(n * 100) + '%'; },
  el(id) { return document.getElementById(id); },
  esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  uid() { return Math.random().toString(36).slice(2, 10); },
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
};

/* ================= Generator papan dinamis =================
   Ring papan = 4 x (side-1) tile. Tiap sisi menyumbang 1 corner
   + (side-2) tile biasa. Layout khusus per sisi dibuat agar ada
   "run" properti bersebelahan (syarat Property Merging, PRD 3.2).
   ============================================================ */
const BoardGen = {
  /** Posisi tile khusus (bukan properti) per sisi; key = k (1..side-2) */
  SPECIAL_LAYOUT: {
    6:  [{ 2: 'chance' }, { 4: 'tax' }, { 2: 'chance' }, { 4: 'tax' }],
    11: [{ 2: 'chance', 5: 'tax', 8: 'chance' }, { 2: 'chance', 5: 'tax', 8: 'chance' },
         { 2: 'chance', 5: 'tax', 8: 'chance' }, { 2: 'chance', 5: 'tax', 8: 'chance' }],
    16: [{ 3: 'tax', 6: 'chance', 9: 'tax', 12: 'chance' }, { 3: 'tax', 6: 'chance', 9: 'tax', 12: 'chance' },
         { 3: 'tax', 6: 'chance', 9: 'tax', 12: 'chance' }, { 3: 'tax', 6: 'chance', 9: 'tax', 12: 'chance' }]
  },
  CORNERS: [
    { type: 'start',    name: 'START',      icon: '🏁' },
    { type: 'jail',     name: 'Penjara',    icon: '🚔' },
    { type: 'vacation', name: 'Vacation',   icon: '🏖️' },
    { type: 'gotojail', name: 'Ke Penjara', icon: '👮' }
  ],

  basePrice(tier) { return [60, 100, 140, 180, 220, 260, 300, 350, 400, 450][tier] || 120; },
  baseRent(price) { return Math.max(4, Math.round(price * 0.10 / 2) * 2); },

  /** Bangun ring tile. size = 'mini' | 'classic' | 'epic' */
  build(sizeKey, seedStr) {
    const cfg = DATA.SIZES[sizeKey] || DATA.SIZES.classic;
    const seed = seedStr || 'colorup';
    const rnd = Util.rng(Util.hash(seed + '|' + sizeKey));
    const side = cfg.side, per = side - 1, inner = side - 2;
    const layouts = this.SPECIAL_LAYOUT[side] || this.SPECIAL_LAYOUT[11];

    // 1) hitung slot properti
    let propCount = 0;
    for (let s = 0; s < 4; s++) for (let k = 1; k <= inner; k++) if (!layouts[s][k]) propCount++;

    // 2) bagi slot ke kelompok warna (tiap kelompok >= 2 tile)
    const groups = Util.shuffle(rnd, DATA.GROUPS).slice(0, cfg.groups);
    const base = Math.floor(propCount / groups.length);
    const rem = propCount % groups.length;
    const sizes = groups.map((g, i) => Math.max(2, base + (i < rem ? 1 : 0)));

    // 3) isi pool properti (berurutan per warna agar run bersebelahan sewarna)
    const cities = Util.shuffle(rnd, DATA.CITIES);
    const places = Util.shuffle(rnd, DATA.PLACES);
    const pool = [];
    groups.forEach((g, gi) => {
      const city = cities[gi % cities.length];
      const price = this.basePrice(g.tier);
      const rent = this.baseRent(price);
      for (let k = 0; k < sizes[gi]; k++) {
        const p = price + k * 20;
        pool.push({
          type: 'property', group: g.key, groupName: g.name, color: g.color,
          name: city + ' ' + places[(gi * 4 + k) % places.length],
          price: p, rent: rent + k * 2,
          houseCost: Math.max(50, Math.round(p * 0.5 / 50) * 50),
          groupSize: sizes[gi],
          ownerId: null, level: 0, mortgaged: false, mega: null
        });
      }
    });

    // 4) rakit ring: corner + tile biasa per sisi
    const tiles = [];
    let pi = 0;
    for (let s = 0; s < 4; s++) {
      tiles.push(Object.assign({ idx: s * per }, this.CORNERS[s], { ownerId: null }));
      for (let k = 1; k <= inner; k++) {
        const idx = s * per + k;
        const sp = layouts[s][k];
        if (sp) {
          tiles.push({
            idx, type: sp, ownerId: null,
            name: sp === 'tax' ? 'Pajak Warna' : 'Surprise',
            icon: sp === 'tax' ? '💸' : '🎁',
            amount: 100 + (idx % 3) * 50
          });
        } else {
          tiles.push(Object.assign({}, pool[pi % pool.length], { idx }));
          pi++;
        }
      }
    }
    tiles.forEach(t => { t.id = (t.type === 'property' ? 'p' : 't') + t.idx; });

    return { tiles, side, n: tiles.length, groups: groups.map(g => g.key), seed };
  },

  /** Letak tile pada grid CSS: sisi + koordinat baris/kolom */
  pos(idx, side) {
    const per = side - 1;
    const s = Math.floor(idx / per), k = idx % per;
    if (s === 0) return { side: 'bottom', row: side, col: side - k };
    if (s === 1) return { side: 'left', row: side - k, col: 1 };
    if (s === 2) return { side: 'top', row: 1, col: k + 1 };
    return { side: 'right', row: k + 1, col: side };
  },

  /** Tile bersebelahan di ring (untuk Property Merging) */
  isAdjacent(a, b, n) { return (a + 1) % n === b || (b + 1) % n === a; }
};

/* ekspor untuk Node (headless test) & browser */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DATA, Util, BoardGen };
}

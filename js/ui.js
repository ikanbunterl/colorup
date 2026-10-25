/* ============================================================
   ColorUp.io — js/ui.js
   File 6/8 · UI CONTROLLER + HUMAN DRIVER — PRD v2.1 Fase A (v1.2)
   A.1 Smart Action Bar (1 tombol utama + bottom drawer)
   A.2 Toasts + ticker + log modal (tanpa panel permanen)
   A.3 Topbar ringkas (≤5 chip + tooltip)
   A.4 Papan & tile flat (solid, harga tersembunyi, pips)
   A.11 On-board sabotage targeting (tanpa modal teks)
   A.12 Lobby presets + Advanced Rules modal (search + grup)
   A.13 Trade Wizard 4 langkah (+ drag-and-drop desktop)
   A.14 Podium results (+ sparkline netWorth, screenshot PNG)
   Engine (game.js) tetap tanpa DOM; semua interaksi lewat driver.
   ============================================================ */
'use strict';

/* Storage aman: sessionStorage/localStorage bisa diblokir (private
   mode, iframe sandbox) → fallback memori agar game tetap jalan. */
const Store = {
  mem: {},
  get(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return (k in this.mem) ? this.mem[k] : null; } },
  set(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { this.mem[k] = v; } },
  del(k) { try { window.sessionStorage.removeItem(k); } catch (e) { delete this.mem[k]; } },
  getLocal(k) { try { return window.localStorage.getItem(k); } catch (e) { return (k in this.mem) ? this.mem[k] : null; } },
  setLocal(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { this.mem[k] = v; } }
};

/* ---------- token & dadu (SVG/vektor, bukan emoji) ---------- */
const TOKEN_PATHS = {
  circle: '<circle cx="12" cy="12" r="9"/>',
  star: '<path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9z"/>',
  diamond: '<path d="M12 2l10 10-10 10L2 12z"/>',
  hex: '<path d="M12 2l8.7 5v10L12 22 3.3 17V7z"/>',
  heart: '<path d="M12 21S3.5 15.2 3.5 9.4A4.9 4.9 0 0112 6.6a4.9 4.9 0 018.5 2.8C20.5 15.2 12 21 12 21z"/>',
  bolt: '<path d="M13.5 2L4 13.5h6L9.5 22 20 10h-6.8z"/>'
};
function tokenSVG(shape, color, ghost) {
  return '<svg class="tok-svg" viewBox="0 0 24 24" style="--c:' + color + '"' + (ghost ? ' data-ghost="1"' : '') + '>' +
    (TOKEN_PATHS[shape] || TOKEN_PATHS.circle) + '</svg>';
}
/* glyph geometris tile khusus (A.4: pips/glyph, bukan emoji) */
const TILE_GLYPHS = {
  start: '<path d="M6 20V5"/><path d="M6 5h11l-3 3.5L17 12H6"/>',
  jail: '<path d="M7 5v14M12 5v14M17 5v14M5 5h14"/>',
  vacation: '<path d="M4 14c3-3.5 6 3.5 8 0s5 3.5 8 0"/><path d="M4 18c3-3.5 6 3.5 8 0s5 3.5 8 0"/>',
  gotojail: '<path d="M4 12h11M11 8l4 4-4 4M19 5v14"/>',
  tax: '<path d="M18 6L6 18"/><circle cx="8" cy="8" r="2.4"/><circle cx="16" cy="16" r="2.4"/>',
  chance: '<path d="M9 9a3 3 0 116 0c0 2-3 2.4-3 4.4"/><path d="M12 17.6h.01"/>'
};
function glyphSVG(type) {
  return '<svg class="tglyph" viewBox="0 0 24 24">' + (TILE_GLYPHS[type] || TILE_GLYPHS.chance) + '</svg>';
}
function diceFace(v) {
  const map = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const on = map[v] || [];
  let d = '';
  for (let i = 0; i < 9; i++) d += '<i class="' + (on.indexOf(i) > -1 ? 'on' : '') + '"></i>';
  return '<span class="die" data-v="' + v + '">' + d + '</span>';
}

/* ---------- Preset lobi (A.12) ---------- */
const PRESETS = {
  casual: {
    key: 'casual', name: 'Cepat & Santai', size: 'mini', mode: 'ffa',
    rules: {
      weather: false, inflation: false, sabotage: false, ghost: false, evenBuild: false,
      startingCash: 1500, powers: true, merging: true, auction: true, actionLog: true,
      doubleRentFullSet: true, vacationCash: true, mortgage: true, randomizeOrder: true, antiCollusion: 'warn', mergeMode: 'same'
    }
  },
  strict: {
    key: 'strict', name: 'Strategi Ketat', size: 'classic', mode: 'ffa',
    rules: {
      weather: true, inflation: true, sabotage: true, ghost: true, evenBuild: true,
      antiCollusion: 'strict', mergeMode: 'same', auction: true, startingCash: 1500,
      powers: true, merging: true, actionLog: true, doubleRentFullSet: true, vacationCash: true, mortgage: true, randomizeOrder: true
    }
  },
  chaos: {
    key: 'chaos', name: 'Kekacauan Total', size: 'epic', mode: 'ffa',
    rules: {
      weather: true, weatherEvery: 3, inflation: true, inflationEvery: 5, mergeMode: 'cross',
      ghost: true, sabotage: true, sabotageCooldown: 2, startingCash: 2000,
      powers: true, merging: true, auction: true, actionLog: true, evenBuild: false, antiCollusion: 'warn'
    }
  },
  learn: {
    key: 'learn', name: 'Belajar', size: 'mini', mode: 'ffa', tutorial: true, maxPlayers: 2,
    rules: {
      powers: false, weather: false, inflation: false, ghost: false, auction: false, sabotage: true,
      merging: true, actionLog: true, randomizeOrder: false, startingCash: 2000, evenBuild: true
    }
  }
};
const ADV_GROUPS = [
  { name: 'Papan & Mode', keys: ['size', 'mode', 'maxPlayers', 'startingCash', 'randomizeOrder'] },
  { name: 'Ekonomi', keys: ['doubleRentFullSet', 'vacationCash', 'auction', 'mortgage', 'evenBuild', 'inflation', 'inflationEvery', 'inflationStep', 'inflationCap'] },
  { name: 'Fitur', keys: ['powers', 'weather', 'weatherEvery', 'weatherRounds', 'merging', 'mergeMode', 'megaBonus', 'megaCap', 'sabotage', 'sabotageCooldown', 'sabotageMaxHand', 'ghost', 'ghostStealPct', 'ghostStealCap', 'ghostCooldown'] },
  { name: 'Fair Play & UX', keys: ['actionLog', 'antiCollusion', 'gracePeriod', 'jailFine', 'jailTurns'] }
];

/* ============================================================
   UI Controller
   ============================================================ */
const UI = {
  game: null, drivers: {}, humanId: null, tutorial: false, tutStep: 0,
  loopRunning: false, loopToken: 0, lastHuman: null, lastActivity: Date.now(),
  pendingEndTurn: false, pendingResolve: null, modalLock: false, blockingChoice: false,
  logFilter: 'all', logModal: null, boardBuilt: null, tileEls: [],
  drawerOpen: false, targeting: null, tradeDraft: null,
  presetKey: 'casual', presetDirty: false, karmaStore: {},
  audioUnlocked: false, _tutRes: null,

  /* ---------------- boot ---------------- */
  init() {
    this.el = {};
    ['screenLobby', 'screenGame', 'screenResults', 'presetRow', 'presetName', 'presetChange',
      'lobbyPlayers', 'lobbySummary', 'btnAddPlayer', 'btnFillBots', 'btnClearBots', 'btnRandomize',
      'btnStart', 'btnQuickPlay', 'btnAdvanced', 'btnOpenHelp', 'btnSimDisconnect',
      'reconnectCard', 'btnReconnect', 'reconnectInfo', 'versionTag',
      'topbarChips', 'btnAudio', 'audioPop', 'volMaster', 'volSfx', 'volAmbient',
      'volMasterOut', 'volSfxOut', 'volAmbientOut', 'chkMute',
      'btnLogOpen', 'btnRulesLive', 'btnBackLobby',
      'takeoverBar', 'takeoverText', 'btnTakeover', 'ticker', 'tickerText',
      'rail', 'playersWrap', 'hud', 'board',
      'guideBubble', 'guideText', 'btnGuideNext', 'btnGuideSkip',
      'actionBar', 'turnHint', 'diceBox', 'primarySlot', 'btnDrawer', 'drawerBadge', 'drawer', 'drawerScrim', 'drawerActions',
      'btnRoll', 'btnBuy', 'btnAuction', 'btnJailFine', 'btnEnd',
      'btnBuild', 'btnMerge', 'btnTrade', 'btnSabotage', 'btnSurrender',
      'targetBanner', 'targetText', 'targetCancel', 'miniSheet', 'miniSheetBody',
      'tilePanel', 'tileBody', 'tileClose',
      'overlay', 'overlayBox', 'overlayTitle', 'overlayBody', 'overlayActions', 'toasts',
      'resultBody', 'resSub', 'btnRematch', 'btnResultExport', 'btnResultLobby', 'btnScreenshot',
      'helpBody', 'modalRoot'
    ].forEach(id => { this.el[id] = document.getElementById(id); });

    this.actionButtons = ['btnRoll', 'btnBuy', 'btnAuction', 'btnJailFine', 'btnEnd',
      'btnBuild', 'btnMerge', 'btnTrade', 'btnSabotage', 'btnSurrender'];

    this.defaultLobby();
    this.loadKarma();
    this.loadPresetPref();
    this.lobbyRules = Object.assign({}, DATA.DEFAULT_RULES, (PRESETS[this.presetKey] || PRESETS.casual).rules);
    this.lobbySize = (PRESETS[this.presetKey] || PRESETS.casual).size;
    this.lobbyMode = (PRESETS[this.presetKey] || PRESETS.casual).mode;
    this.bindStatic();
    this.applyPreset(this.presetKey, true);
    this.checkReconnectFlow();
    this.syncAudioUI();

    document.addEventListener('pointerdown', () => { this.lastActivity = Date.now(); this.unlockAudio(); });
    document.addEventListener('keydown', () => { this.lastActivity = Date.now(); });
    setInterval(() => this.tickGrace(), 1000);
  },

  unlockAudio() {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    Sound.manager.loadPrefs(Store);
    Sound.manager.unlock();
    Sound.manager.preload(['click-matte', 'dice-roll', 'dice-land', 'coin-soft', 'coin-out', 'success', 'error', 'toggle-on', 'toggle-off']);
    this.syncAudioUI();
    if (this.el.screenLobby.classList.contains('on')) Sound.ambient('ambient-lobby');
  },

  syncAudioUI() {
    const m = Sound.manager;
    this.el.volMaster.value = Math.round(m.vol.master * 100);
    this.el.volSfx.value = Math.round(m.vol.sfx * 100);
    this.el.volAmbient.value = Math.round(m.vol.ambient * 100);
    this.el.volMasterOut.textContent = Math.round(m.vol.master * 100) + '%';
    this.el.volSfxOut.textContent = Math.round(m.vol.sfx * 100) + '%';
    this.el.volAmbientOut.textContent = Math.round(m.vol.ambient * 100) + '%';
    this.el.chkMute.checked = m.muted;
    this.el.btnAudio.textContent = m.muted ? '🔇' : '🔊';
    this.el.btnAudio.classList.toggle('muted', m.muted);
  },

  /* ---------------- lobi & preset (A.12) ---------------- */
  lobbyPlayers: [], lobbyRules: null, lobbySize: 'mini', lobbyMode: 'ffa',

  defaultLobby() {
    this.lobbyPlayers = [
      { name: 'Kamu', isBot: false, shape: 'star' },
      { name: 'Bot Nova', isBot: true, botLevel: 1, shape: 'circle' },
      { name: 'Bot Zephyr', isBot: true, botLevel: 1, shape: 'diamond' }
    ];
  },

  loadPresetPref() {
    const k = Store.getLocal('cu_preset');
    if (k && PRESETS[k]) this.presetKey = k;
  },

  applyPreset(key, silent) {
    const p = PRESETS[key] || PRESETS.casual;
    this.presetKey = p.key;
    this.presetDirty = false;
    this.lobbyRules = Object.assign({}, DATA.DEFAULT_RULES, p.rules || {});
    this.lobbySize = p.size;
    this.lobbyMode = p.mode;
    Store.setLocal('cu_preset', p.key);
    document.querySelectorAll('.preset').forEach(b => {
      const on = b.dataset.preset === p.key;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    this.el.presetName.textContent = p.name;
    if (p.key === 'learn') {
      while (this.lobbyPlayers.length > 2) this.lobbyPlayers.pop();
      if (this.lobbyPlayers.length < 2) this.lobbyPlayers.push({ name: 'Tutor', isBot: true, botLevel: 0, shape: 'hex' });
      this.lobbyPlayers[1].isBot = true; this.lobbyPlayers[1].botLevel = 0;
    }
    this.buildLobbyPlayers();
    this.renderLobbySummary();
    if (!silent) { Sound.toggle(true); this.toast('Preset diterapkan: <b>' + Util.esc(p.name) + '</b>', 'info'); }
  },

  markPresetDirty() {
    if (this.presetDirty) return;
    this.presetDirty = true;
    this.el.presetName.textContent = 'Custom (dari ' + (PRESETS[this.presetKey] || {}).name + ')';
  },

  renderLobbySummary() {
    const s = DATA.SIZES[this.lobbySize], m = DATA.MODES[this.lobbyMode];
    const humans = this.lobbyPlayers.filter(p => !p.isBot).length;
    this.el.lobbySummary.innerHTML =
      s.label + ' · ' + s.tiles + ' tile · ' + m.label + ' · ' + humans + ' manusia + ' +
      (this.lobbyPlayers.length - humans) + ' bot · uang awal ' + Util.money(this.lobbyRules.startingCash) +
      ' · ' + DATA.SIZES[this.lobbySize].est;
  },

  buildLobbyPlayers() {
    const wrap = this.el.lobbyPlayers;
    wrap.innerHTML = '';
    this.lobbyPlayers.forEach((p, i) => {
      const c = DATA.TOKEN_COLORS[i % DATA.TOKEN_COLORS.length];
      p.color = c.color; p.colorKey = c.key;
      const card = document.createElement('div');
      card.className = 'pcard' + (p.isBot ? ' bot' : ' human');
      card.innerHTML =
        '<div class="pc-top">' +
        '<span class="pc-tok">' + tokenSVG(p.shape || DATA.TOKEN_SHAPES[i % 6], c.color, false) + '</span>' +
        '<input class="pc-name" value="' + Util.esc(p.name) + '" maxlength="14" aria-label="Nama pemain">' +
        '<button class="pc-x" title="Hapus pemain" aria-label="Hapus pemain">×</button>' +
        '</div>' +
        '<div class="pc-row">' +
        '<label class="chk"><input type="checkbox" class="pc-bot"' + (p.isBot ? ' checked' : '') + '><span>Bot</span></label>' +
        '<select class="pc-level"' + (p.isBot ? '' : ' disabled') + ' aria-label="Level bot">' +
        [0, 1, 2].map(l => '<option value="' + l + '"' + ((p.botLevel == null ? 1 : p.botLevel) === l ? ' selected' : '') + '>' + ['Gampang', 'Normal', 'Agresif'][l] + '</option>').join('') +
        '</select>' +
        '</div>' +
        '<div class="pc-row">' +
        '<select class="pc-shape" aria-label="Bentuk token">' + DATA.TOKEN_SHAPES.map(sh => '<option value="' + sh + '"' + ((p.shape || '') === sh ? ' selected' : '') + '>' + sh + '</option>').join('') + '</select>' +
        '<select class="pc-team" aria-label="Tim"><option value="">Tim: —</option><option value="T1">Tim A</option><option value="T2">Tim B</option></select>' +
        '</div>';
      wrap.appendChild(card);
      if (p.team) card.querySelector('.pc-team').value = p.team;
      card.querySelector('.pc-name').addEventListener('input', e => { p.name = e.target.value || ('Pemain ' + (i + 1)); });
      card.querySelector('.pc-bot').addEventListener('change', e => {
        p.isBot = e.target.checked;
        card.classList.toggle('bot', p.isBot); card.classList.toggle('human', !p.isBot);
        card.querySelector('.pc-level').disabled = !p.isBot;
        Sound.toggle(p.isBot);
        this.renderLobbySummary();
      });
      card.querySelector('.pc-level').addEventListener('change', e => { p.botLevel = +e.target.value; });
      card.querySelector('.pc-shape').addEventListener('change', e => {
        p.shape = e.target.value;
        card.querySelector('.pc-tok').innerHTML = tokenSVG(p.shape, c.color, false);
      });
      card.querySelector('.pc-team').addEventListener('change', e => { p.team = e.target.value || null; this.renderLobbySummary(); });
      card.querySelector('.pc-x').addEventListener('click', () => {
        if (this.lobbyPlayers.length <= 2) return this.toast('Minimal 2 pemain.');
        this.lobbyPlayers.splice(i, 1); this.buildLobbyPlayers();
      });
    });
    if (this.lobbyMode === 'coop') this.autoTeams();
    this.renderLobbySummary();
  },

  autoTeams() {
    const n = this.lobbyPlayers.length;
    const per = n >= 6 ? 3 : 2;
    this.lobbyPlayers.forEach((p, i) => { p.team = 'T' + (Math.floor(i / per) + 1); });
    document.querySelectorAll('.pc-team').forEach((s, i) => { if (this.lobbyPlayers[i]) s.value = this.lobbyPlayers[i].team || ''; });
  },

  /* ---------------- Advanced Rules modal (A.12) ---------------- */
  openAdvanced(live) {
    if (live && this.game) { Object.assign(this.game.rules, this.lobbyRules); this.render(); }
    this.lobbyRules.size = this.lobbySize;
    this.lobbyRules.mode = this.lobbyMode;
    const body = this.openOverlay('⚙️ Pengaturan Lanjutan', this.advancedHTML(), [
      { label: 'Reset ke Preset', cls: 'ghostbtn', fn: () => { this.applyPreset(this.presetKey, true); this.closeOverlay(); this.openAdvanced(live); } },
      { label: 'Simpan & Tutup', cls: 'primary', fn: () => { this.closeOverlay(); this.toast('Pengaturan disimpan.', 'ok'); } }
    ]);
    if (!body) return;
    const q = body.querySelector('#advSearch');
    q.addEventListener('input', () => {
      const v = q.value.toLowerCase();
      body.querySelectorAll('.set-row').forEach(r => {
        r.style.display = (!v || r.textContent.toLowerCase().indexOf(v) > -1) ? '' : 'none';
      });
    });
    body.querySelectorAll('[data-rule]').forEach(inp => {
      inp.addEventListener('change', () => {
        const k = inp.dataset.rule;
        if (inp.type === 'checkbox') this.lobbyRules[k] = inp.checked;
        else if (inp.type === 'number') this.lobbyRules[k] = parseFloat(inp.value) || 0;
        else this.lobbyRules[k] = inp.value;
        if (k === 'size') this.lobbySize = inp.value;
        if (k === 'mode') { this.lobbyMode = inp.value; if (inp.value === 'coop') this.autoTeams(); }
        Sound.toggle(inp.type !== 'checkbox' || inp.checked);
        this.markPresetDirty();
        this.renderLobbySummary();
        if (this.game) { Object.assign(this.game.rules, this.lobbyRules); this.render(); }
      });
    });
  },

  advancedHTML() {
    const r = this.lobbyRules;
    let html = '<div class="adv-search"><input id="advSearch" type="search" placeholder="Cari pengaturan… (mis. inflasi, sabotase)" aria-label="Cari pengaturan"></div>';
    ADV_GROUPS.forEach(gr => {
      html += '<div class="adv-group"><h4>' + gr.name + '</h4><div class="set-grid">';
      gr.keys.forEach(k => {
        const info = DATA.RULE_INFO[k];
        if (!info) return;
        const v = r[k];
        if (typeof v === 'boolean') {
          html += '<label class="set-row" title="' + Util.esc(info[1]) + '"><span class="set-name">' + info[0] + '</span>' +
            '<input type="checkbox" class="tgl" data-rule="' + k + '"' + (v ? ' checked' : '') + '>' +
            '<span class="set-desc">' + Util.esc(info[1]) + '</span></label>';
        } else if (typeof v === 'number') {
          const step = (k.indexOf('Pct') > -1 || k.indexOf('Step') > -1 || k.indexOf('Cap') > -1 || k === 'megaBonus' || k === 'megaCap' || k === 'ghostStealPct') ? '0.01' : '1';
          html += '<label class="set-row num"><span class="set-name" title="' + Util.esc(info[1]) + '">' + info[0] + '</span>' +
            '<input type="number" class="numin" data-rule="' + k + '" step="' + step + '" value="' + v + '">' +
            '<span class="set-desc">' + Util.esc(info[1]) + '</span></label>';
        } else if (k === 'size' || k === 'mode') {
          const opts = k === 'size'
            ? Object.keys(DATA.SIZES).map(s => '<option value="' + s + '"' + (s === v ? ' selected' : '') + '>' + DATA.SIZES[s].label + ' (' + DATA.SIZES[s].tiles + ')</option>').join('')
            : Object.keys(DATA.MODES).map(s => '<option value="' + s + '"' + (s === v ? ' selected' : '') + '>' + DATA.MODES[s].label + '</option>').join('');
          html += '<label class="set-row num"><span class="set-name">' + info[0] + '</span><select class="selin" data-rule="' + k + '">' + opts + '</select>' +
            '<span class="set-desc">' + Util.esc(info[1]) + '</span></label>';
        } else {
          const opts = k === 'antiCollusion'
            ? ['off', 'warn', 'strict'].map(x => '<option value="' + x + '"' + (x === v ? ' selected' : '') + '>' + x + '</option>').join('')
            : ['same', 'cross'].map(x => '<option value="' + x + '"' + (x === v ? ' selected' : '') + '>' + x + '</option>').join('');
          html += '<label class="set-row num"><span class="set-name">' + info[0] + '</span><select class="selin" data-rule="' + k + '">' + opts + '</select>' +
            '<span class="set-desc">' + Util.esc(info[1]) + '</span></label>';
        }
      });
      html += '</div></div>';
    });
    return html;
  },

  /* ---------------- binding statis ---------------- */
  bindStatic() {
    document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', () => {
      this.applyPreset(b.dataset.preset);
    }));
    this.el.presetChange.addEventListener('click', () => { Sound.click(); this.el.presetRow.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    this.el.btnAddPlayer.addEventListener('click', () => {
      if (this.lobbyPlayers.length >= (this.lobbyRules.maxPlayers || 6)) return this.toast('Maksimum ' + (this.lobbyRules.maxPlayers || 6) + ' pemain.');
      this.lobbyPlayers.push({ name: 'Pemain ' + (this.lobbyPlayers.length + 1), isBot: false, shape: DATA.TOKEN_SHAPES[this.lobbyPlayers.length % 6] });
      this.buildLobbyPlayers(); Sound.click();
    });
    this.el.btnFillBots.addEventListener('click', () => {
      const names = ['Nova', 'Zephyr', 'Pixel', 'Blitz', 'Orbit', 'Comet'];
      while (this.lobbyPlayers.length < 6) {
        const i = this.lobbyPlayers.length;
        this.lobbyPlayers.push({ name: 'Bot ' + names[i % names.length], isBot: true, botLevel: 1, shape: DATA.TOKEN_SHAPES[i % 6] });
      }
      this.buildLobbyPlayers(); Sound.click();
    });
    this.el.btnClearBots.addEventListener('click', () => {
      this.lobbyPlayers = this.lobbyPlayers.filter(p => !p.isBot);
      if (this.lobbyPlayers.length < 2) this.lobbyPlayers.push({ name: 'Bot Nova', isBot: true, botLevel: 1, shape: 'circle' });
      this.buildLobbyPlayers(); Sound.click();
    });
    this.el.btnRandomize.addEventListener('click', () => {
      this.lobbyPlayers.forEach(p => { p.shape = Util.pick(Math.random, DATA.TOKEN_SHAPES); });
      this.buildLobbyPlayers(); Sound.click();
      this.toast('Token diacak.', 'info');
    });
    this.el.btnAdvanced.addEventListener('click', () => { Sound.click(); this.openAdvanced(false); });
    this.el.btnRulesLive.addEventListener('click', () => { Sound.click(); this.openAdvanced(true); });
    this.el.btnBackLobby.addEventListener('click', () => { Sound.click(); this.toLobby(); });
    this.el.btnOpenHelp.addEventListener('click', () => {
      Sound.click();
      this.openOverlay('📖 Cara Bermain & Fitur', this.el.helpBody.innerHTML, [{ label: 'Tutup', cls: 'primary', fn: () => this.closeOverlay() }]);
    });
    this.el.btnQuickPlay.addEventListener('click', () => { Sound.click(); this.startGame(false); });
    this.el.btnStart.addEventListener('click', () => {
      Sound.click();
      if (this.presetKey === 'learn') this.startTutorial();
      else this.startGame(false);
    });
    this.el.btnSimDisconnect.addEventListener('click', () => this.simulateDisconnect());
    this.el.btnReconnect.addEventListener('click', () => this.doReconnect());

    // audio (A.9)
    this.el.btnAudio.addEventListener('click', e => {
      e.stopPropagation();
      this.unlockAudio();
      Sound.click();
      this.el.audioPop.classList.toggle('hidden');
    });
    document.addEventListener('click', e => {
      if (!this.el.audioPop.classList.contains('hidden') && !this.el.audioPop.contains(e.target) && e.target !== this.el.btnAudio)
        this.el.audioPop.classList.add('hidden');
    });
    [['volMaster', 'master'], ['volSfx', 'sfx'], ['volAmbient', 'ambient']].forEach(([id, bus]) => {
      this.el[id].addEventListener('input', () => {
        Sound.manager.setVolume(bus, this.el[id].value / 100);
        this.syncAudioUI();
      });
    });
    this.el.chkMute.addEventListener('change', () => {
      Sound.manager.setMuted(this.el.chkMute.checked);
      this.syncAudioUI();
      if (!this.el.chkMute.checked) Sound.click();
    });

    // log: ticker → modal (A.2)
    this.el.ticker.addEventListener('click', () => { Sound.click(); this.openLog(); });
    this.el.btnLogOpen.addEventListener('click', () => { Sound.click(); this.openLog(); });

    // drawer (A.1)
    this.el.btnDrawer.addEventListener('click', () => { Sound.click(); this.toggleDrawer(); });
    this.el.drawerScrim.addEventListener('click', () => this.toggleDrawer(false));

    // aksi
    this.el.btnRoll.addEventListener('click', () => this.humanRoll());
    this.el.btnBuy.addEventListener('click', () => this.resolveWith('buy'));
    this.el.btnAuction.addEventListener('click', () => this.resolveWith('auction'));
    this.el.btnJailFine.addEventListener('click', () => {
      const g = this.game; if (!g) return;
      if (g.payJailFine(g.cur)) { Sound.jail(); this.render(); }
    });
    this.el.btnEnd.addEventListener('click', () => this.humanEnd());
    this.el.btnSurrender.addEventListener('click', () => this.confirmSurrender());
    this.el.btnTrade.addEventListener('click', () => { this.toggleDrawer(false); this.openTrade(); });
    this.el.btnSabotage.addEventListener('click', () => { this.toggleDrawer(false); this.startTargeting(); });
    this.el.btnMerge.addEventListener('click', () => { this.toggleDrawer(false); this.openMerge(); });
    this.el.btnBuild.addEventListener('click', () => { this.toggleDrawer(false); this.openBuildHint(); });

    // targeting (A.11)
    this.el.targetCancel.addEventListener('click', () => this.cancelTargeting());
    this.el.tileClose.addEventListener('click', () => { Sound.click(); this.el.tilePanel.classList.add('hidden'); });

    // hasil
    this.el.btnRematch.addEventListener('click', () => this.startGame(false, true));
    this.el.btnResultLobby.addEventListener('click', () => this.toLobby());
    this.el.btnResultExport.addEventListener('click', () => this.exportLog());
    this.el.btnScreenshot.addEventListener('click', () => this.screenshotPodium());

    // tutorial
    this.el.btnGuideNext.addEventListener('click', () => this.tutNext());
    this.el.btnGuideSkip.addEventListener('click', () => this.tutSkip());

    this.el.overlay.addEventListener('click', e => {
      if (e.target !== this.el.overlay) return;
      if (this.targeting) return this.cancelTargeting();
      if (!this.modalLock) this.closeOverlay();
    });
  },

  /* ---------------- overlay / modal ---------------- */
  openOverlay(title, bodyHtml, actions, lock, force) {
    if (this.blockingChoice && !force) {
      this.toast('⏳ Selesaikan dulu pilihan yang sedang terbuka.', 'warn');
      return null;
    }
    this.el.overlayTitle.innerHTML = title;
    this.el.overlayBody.innerHTML = bodyHtml;
    this.el.overlayBody.scrollTop = 0;
    const act = this.el.overlayActions;
    act.innerHTML = '';
    (actions || []).forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || '');
      b.innerHTML = a.label;
      if (a.choice !== undefined && a.choice !== null) b.dataset.choice = String(a.choice);
      b.addEventListener('click', () => { if (a.fn) a.fn(); });
      act.appendChild(b);
    });
    this.modalLock = !!lock;
    this._closeToken = (this._closeToken || 0) + 1;   // batalkan animasi tutup yang tertunda
    this.el.overlayBox.classList.remove('closing');
    this.el.overlay.classList.add('show');
    return this.el.overlayBody;
  },
  closeOverlay() {
    if (this.modalLock) return;
    const tk = (this._closeToken = (this._closeToken || 0) + 1);
    this.el.overlayBox.classList.add('closing');
    setTimeout(() => {
      if (tk !== this._closeToken) return;   // modal baru sudah terbuka: batalkan
      this.el.overlay.classList.remove('show');
      this.el.overlayBox.classList.remove('closing');
    }, 180);
  },
  choose(title, html, options) {
    return new Promise(res => {
      let done = false;
      const finish = v => {
        if (done) return;
        done = true;
        this.pendingResolve = null; this.blockingChoice = false; this.modalLock = false;
        this.closeOverlay();
        Sound.click();
        res(v);
      };
      this.pendingResolve = finish;
      this.blockingChoice = true;
      const acts = options.map(o => ({ label: o.label, cls: o.cls || '', choice: o.value, fn: () => finish(o.value) }));
      this.openOverlay(title, html, acts, true, true);
    });
  },
  resolveWith(v) { if (this.pendingResolve) this.pendingResolve(v); },
  toast(msg, kind) {
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = msg;
    this.el.toasts.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 3400);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  },

  /* ---------------- start game ---------------- */
  startGame(tutorial, rematch) {
    const players = this.lobbyPlayers.map((p, i) => Object.assign({}, p, { id: 'u' + i }));
    if (players.length < 2) return this.toast('Butuh minimal 2 pemain.');
    if (this.lobbyMode === 'coop') {
      const teams = {};
      players.forEach(p => { teams[p.team || '?'] = 1; });
      if (Object.keys(teams).length < 2) return this.toast('Mode co-op butuh minimal 2 tim.');
    }
    this.humanId = (players.find(p => !p.isBot) || players[0]).id;
    const seed = rematch && this.game ? this.game.seed : ('CU-' + Util.uid().toUpperCase());

    const drivers = {};
    players.forEach(p => {
      drivers[p.id] = p.isBot ? new BotDriver(null, p.id, p.botLevel == null ? 1 : p.botLevel) : new UIDriver(this, p.id);
    });
    drivers.auction = new AuctionDriver(this);

    const game = new Game({
      players, size: this.lobbySize, mode: this.lobbyMode,
      rules: this.lobbyRules, seed, drivers, fast: false,
      hooks: {
        onLog: e => this.onLog(e),
        onState: () => this.render(),
        onDice: (a, p) => this.animateDice(a, p),
        onEvent: (k, d) => this.onGameEvent(k, d),
        onGameOver: (w, g) => this.onGameOver(w, g),
        onStep: () => this.renderTokens(),
        onMove: () => this.renderTokens()
      }
    });
    Object.keys(drivers).forEach(k => { drivers[k].game = game; });

    this.loopToken++;
    this.loopRunning = false;
    this.lastHuman = null;
    this.pendingEndTurn = false;
    this.pendingResolve = null;
    this.blockingChoice = false;
    this.targeting = null;
    this.tradeDraft = null;
    this.game = game;
    this.drivers = drivers;
    this.tutorial = !!tutorial;
    this.showScreen('game');
    this.buildBoard();
    this.el.tilePanel.classList.add('hidden');
    this.el.takeoverBar.classList.add('hidden');
    this.el.miniSheet.classList.add('hidden');
    this.el.tickerText.textContent = 'Game dimulai — seed ' + game.seed;
    game.log.forEach(e => this.onLog(e, true));
    game.start();
    this.beginTurnLoop();
    Sound.start();
    Sound.ambient('ambient-game');
  },

  beginTurnLoop() {
    if (this.loopRunning) return;
    this.loopRunning = true;
    this.turnLoop().catch(e => {
      this.loopRunning = false;
      console.error('[ColorUp] turn loop error:', e);
      this.toast('⚠️ Error pada giliran: ' + Util.esc(e.message || e), 'err');
    });
  },

  async turnLoop() {
    const g = this.game;
    const myToken = this.loopToken;
    while (g && g.state === 'playing' && myToken === this.loopToken && this.game === g) {
      this.render();
      const p = g.cur;
      if (!p) break;

      if (this.tutorial) await this.tutStepRun(p);
      if (g.state !== 'playing') break;

      g.checkGrace();
      if (!p.isBot && !p.takeover && !p.ghost) {
        const idle = (Date.now() - this.lastActivity) / 1000;
        if (idle > g.rules.gracePeriod) this.activateTakeover(p);
        else if (idle > g.rules.gracePeriod * 0.6) this.showTakeoverHint(p, Math.ceil(g.rules.gracePeriod - idle));
        else this.hideTakeoverHint();
      } else this.hideTakeoverHint();

      if (!p.isBot && !p.takeover && this.lastHuman !== p.id) {
        this.lastHuman = p.id;
        if (g.players.filter(x => !x.isBot).length > 1)
          this.toast('🎮 Giliran <b>' + Util.esc(p.name) + '</b> (hot-seat)', 'info');
      }
      const drv = p.takeover ? this.ensureTakeoverBot(p) : this.drivers[p.id];
      this.render();
      if (p.ghost) await g.ghostTurn(p);
      else if (drv && drv.turn) await drv.turn();
      this.pendingEndTurn = false;

      if (g.state === 'over') break;
      await g.endTurn();
      await Util.sleep(110);
    }
    this.loopRunning = false;
    this.render();
  },

  ensureTakeoverBot(p) {
    if (!p._bot) { p._bot = new BotDriver(this.game, p.id, 1); p._bot.game = this.game; }
    return p._bot;
  },
  activateTakeover(p) {
    if (p.takeover) return;
    p.takeover = true;
    this.game.addLog('koneksi', '🤖 <b>Auto-Bot Takeover</b>: ' + Util.esc(p.name) + ' melewati grace period ' + this.game.rules.gracePeriod + ' detik.');
    this.el.takeoverText.innerHTML = '🤖 Bot mengambil alih <b>' + Util.esc(p.name) + '</b>. Klik untuk ambil alih kembali.';
    this.el.takeoverBar.classList.remove('hidden');
    this.el.takeoverBar.classList.remove('warn');
    this.el.btnTakeover.onclick = () => this.reclaim(p);
    Sound.warn();
    this.render();
  },
  reclaim(p) {
    p.takeover = false; p._bot = null; p.connected = true;
    this.lastActivity = Date.now();
    this.game.reconnect(p.id);
    this.el.takeoverBar.classList.add('hidden');
    this.render();
  },
  showTakeoverHint(p, left) {
    this.el.takeoverText.innerHTML = '<b>' + Util.esc(p.name) + '</b> tidak aktif — Auto-Bot Takeover dalam <b>' + left + 's</b>.';
    this.el.takeoverBar.classList.remove('hidden');
    this.el.takeoverBar.classList.add('warn');
    this.el.btnTakeover.onclick = () => { this.lastActivity = Date.now(); this.hideTakeoverHint(); };
    this.el.btnTakeover.textContent = 'Saya di sini';
  },
  hideTakeoverHint() {
    this.el.takeoverBar.classList.add('hidden');
    this.el.takeoverBar.classList.remove('warn');
    this.el.btnTakeover.textContent = 'Ambil Alih';
  },
  tickGrace() {
    if (!this.game || this.game.state !== 'playing') return;
    this.game.checkGrace();
  },

  /* ---------------- reconnect (PRD 3.12) ---------------- */
  simulateDisconnect() {
    if (!this.game || this.game.state !== 'playing') {
      Store.set('cu_reconnect', JSON.stringify({
        ts: Date.now(), rules: this.lobbyRules, size: this.lobbySize, mode: this.lobbyMode,
        players: this.lobbyPlayers, preset: this.presetKey
      }));
      this.toast('Menyimpan state room & memuat ulang… (simulasi koneksi putus)', 'info');
      setTimeout(() => location.reload(), 700);
      return;
    }
    const p = this.game.cur && this.game.cur.isBot ? this.game.p(this.humanId) : this.game.cur;
    this.game.markDisconnected(p.id);
    this.el.reconnectInfo.innerHTML = 'State game dipertahankan. Klik "Masuk Kembali" sebelum grace period habis.';
    this.el.reconnectCard.classList.remove('hidden');
    this.render();
  },
  checkReconnectFlow() {
    const raw = Store.get('cu_reconnect');
    if (!raw) return;
    Store.del('cu_reconnect');
    let saved; try { saved = JSON.parse(raw); } catch (e) { return; }
    const away = Math.round((Date.now() - saved.ts) / 1000);
    const grace = (saved.rules && saved.rules.gracePeriod) || 240;
    this.lobbyRules = saved.rules; this.lobbySize = saved.size; this.lobbyMode = saved.mode;
    this.lobbyPlayers = saved.players;
    if (saved.preset && PRESETS[saved.preset]) this.presetKey = saved.preset;
    this.buildLobbyPlayers();
    this.el.reconnectCard.classList.remove('hidden');
    this.el.reconnectInfo.innerHTML = away <= grace
      ? '🔌 Koneksi terputus <b>' + away + 's</b> lalu — masih dalam grace period (<b>' + grace + 's</b>). State room dipulihkan.'
      : '⌛ Kembali setelah <b>' + away + 's</b> (melebihi grace ' + grace + 's) → di produksi <b>Auto-Bot Takeover</b> sudah aktif.';
  },
  doReconnect() {
    this.el.reconnectCard.classList.add('hidden');
    this.toast('🔗 State disinkronkan — selamat datang kembali!', 'ok');
    if (this.game && this.humanId) this.game.reconnect(this.humanId);
    else this.startGame(false);
    this.render();
  },

  /* ---------------- papan (A.4 flat) ---------------- */
  buildBoard() {
    const g = this.game;
    const board = this.el.board;
    board.className = 'board size-' + g.size;
    board.style.setProperty('--side', g.side);
    board.innerHTML = '';
    this.tileEls = [];
    g.tiles.forEach(t => {
      const pos = BoardGen.pos(t.idx, g.side);
      const d = document.createElement('div');
      d.className = 'tile side-' + pos.side + (t.type === 'property' ? ' prop' : ' special s-' + t.type);
      d.style.gridRow = pos.row;
      d.style.gridColumn = pos.col;
      d.dataset.idx = t.idx;
      if (t.type === 'property') d.style.setProperty('--pc', t.color);
      d.innerHTML =
        '<div class="tile-in">' +
        (t.type === 'property' ? '<div class="band"></div>' : glyphSVG(t.type)) +
        '<div class="tname">' + Util.esc(t.name) + '</div>' +
        '<div class="tmeta">' + (t.type === 'property' ? Util.money(t.price) : '') + '</div>' +
        '<div class="pips"></div>' +
        '<div class="ttoks"></div>' +
        '<div class="tflags"></div>' +
        '</div>';
      d.addEventListener('click', () => this.onTileClick(t.idx));
      d.addEventListener('mouseenter', () => this.onTileHover(t.idx, true));
      d.addEventListener('mouseleave', () => this.onTileHover(t.idx, false));
      board.appendChild(d);
      this.tileEls[t.idx] = d;
    });
    const center = document.createElement('div');
    center.className = 'board-center';
    center.style.gridRow = '2 / ' + g.side;
    center.style.gridColumn = '2 / ' + g.side;
    center.innerHTML = '<div id="centerInner"></div>';
    board.appendChild(center);
    this.boardBuilt = g.seed + g.tiles.length;
    this.render();
  },

  onTileClick(idx) {
    if (this.targeting) {
      if (this.targeting.valid.indexOf(idx) > -1) this.confirmSabotage(idx);
      return;
    }
    Sound.click();
    this.openTile(idx);
  },
  onTileHover(idx, on) {
    const old = document.querySelector('.tpreview');
    if (old) old.remove();
    if (!on || !this.targeting) return;
    if (this.targeting.valid.indexOf(idx) === -1) return;
    const g = this.game, t = g.tiles[idx], o = g.p(t.ownerId);
    const r = this.tileEls[idx].getBoundingClientRect();
    const tip = document.createElement('div');
    tip.className = 'tpreview';
    tip.innerHTML = '💣 Hancurkan 1 lvl · <b>' + Util.esc(o.name) + '</b> · ' + Util.esc(t.name);
    tip.style.left = (r.left + r.width / 2) + 'px';
    tip.style.top = (r.top - 4) + 'px';
    document.body.appendChild(tip);
  },

  /* ---------------- render ---------------- */
  render() {
    const g = this.game;
    if (!g) return;
    const h = g.cur;
    const hd = h && this.drivers[h.id];
    if (h && (h.out || h.ghost || h.takeover) && hd && hd.finishTurn) hd.finishTurn();
    this.renderChips();
    this.renderCenter();
    this.renderTiles();
    this.renderTokens();
    this.renderPlayers();
    this.renderActionBar();
  },

  /* A.3 — topbar ≤5 chip + tooltip */
  renderChips() {
    const g = this.game;
    const w = g.weather;
    const chips = [];
    chips.push('<span class="chip" title="Ronde berjalan · papan ' + DATA.SIZES[g.size].label + ' ' + g.tiles.length + ' tile · seed ' + g.seed + '">Ronde <b>' + g.round + '</b></span>');
    if (g.rules.weather) chips.push('<span class="chip w" title="' + Util.esc(w.desc) + ' · berganti tiap ' + g.rules.weatherEvery + ' ronde">' + w.icon + ' <b>' + w.name + '</b> · ' + g.weatherRoundsLeft + 'r</span>');
    if (g.rules.inflation) chips.push('<span class="chip infl' + (g.inflation > 0 ? ' hot' : '') + '" title="Sewa, pajak & biaya bangunan ×' + g.inflationMult.toFixed(2) + ' · cap ' + Util.pct(g.rules.inflationCap) + '">Inflasi <b>' + Util.pct(g.inflation) + '</b></span>');
    chips.push('<span class="chip" title="Kumpulan pajak kota; diambil saat mendarat di Vacation">Treasury <b>' + Util.money(g.treasury) + '</b></span>');
    if (g.nemesis) chips.push('<span class="chip nem" title="Rivalitas terpanas: total sewa timbal-balik ' + Util.money(g.nemesis.total) + '">⚔ <b>' + Util.esc(g.p(g.nemesis.a).name) + '</b> vs <b>' + Util.esc(g.p(g.nemesis.b).name) + '</b></span>');
    this.el.topbarChips.innerHTML = chips.slice(0, 5).join('');
  },

  renderCenter() {
    const g = this.game;
    const inner = document.getElementById('centerInner');
    if (!inner) return;
    const p = g.cur;
    const pw = g.powerInfo(p);
    inner.innerHTML =
      '<div class="c-logo">ColorUp<em>.io</em></div>' +
      '<div class="c-turn">' +
      (p ? '<span class="c-tok">' + tokenSVG(p.shape, p.color, p.ghost) + '</span>' : '') +
      '<div><div class="c-name">' + (p ? Util.esc(p.name) : '-') + (p && p.ghost ? ' 👻' : '') + (p && p.jail ? ' 🚔' : '') + '</div>' +
      '<div class="c-sub">' + (p ? (p.isBot ? 'Bot' : (p.id === this.humanId ? 'Kamu' : 'Pemain')) + (p.team ? ' · ' + p.team : '') + ' · ' + Util.money(p.cash) : '') + '</div>' +
      (pw ? '<div class="c-power" title="' + Util.esc(pw.desc) + '">' + pw.icon + ' ' + Util.esc(pw.name) + '</div>' : '') +
      '</div></div>' +
      '<div class="c-dice">' + (p && p.lastRoll ? diceFace(p.lastRoll[0]) + diceFace(p.lastRoll[1]) : '<span class="dice-idle">··</span>') + '</div>' +
      '<div class="c-phase">' + this.phaseLabel() + '</div>';
  },

  phaseLabel() {
    const g = this.game, p = g.cur;
    if (!p) return '';
    if (g.phase === 'roll') return p.jail ? 'Penjara: bayar denda (drawer) atau lempar dadu kembar' : 'Lempar dadu untuk mulai';
    if (g.phase === 'resolve') return g.pendingBuy ? 'Beli properti ini, atau lelang?' : 'Menyelesaikan tile…';
    if (g.phase === 'auction') return 'Lelang berlangsung…';
    if (g.phase === 'end') return 'Fase aksi: buka ⋯ untuk upgrade / merge / trade / sabotase';
    return '';
  },

  renderTiles() {
    const g = this.game;
    g.tiles.forEach(t => {
      const el = this.tileEls[t.idx];
      if (!el) return;
      const pos = BoardGen.pos(t.idx, g.side);
      const cls = ['tile', 'side-' + pos.side, t.type === 'property' ? 'prop' : 'special', 's-' + t.type];
      const owner = t.ownerId ? g.p(t.ownerId) : null;
      if (owner) { cls.push('owned'); el.style.setProperty('--oc', owner.color); }
      if (t.mortgaged) cls.push('mortgaged');
      if (t.mega) cls.push('mega');
      if (g.nemesis && owner && (owner.id === g.nemesis.a || owner.id === g.nemesis.b)) cls.push('nemesis');
      if (g.pendingBuy && g.pendingBuy.tileIdx === t.idx) cls.push('highlight');
      if (this.targeting && this.targeting.valid.indexOf(t.idx) > -1) cls.push('valid');
      el.className = cls.join(' ');
      if (this.targeting) {
        const valid = this.targeting.valid.indexOf(t.idx) > -1;
        el.tabIndex = valid ? 0 : -1;
        if (valid) el.setAttribute('aria-label', 'Target sabotase: ' + t.name);
      } else el.tabIndex = -1;
      let pips = '';
      if (t.type === 'property') {
        if (t.level >= 5) pips = '<i class="pip hotel" title="Hotel"></i>';
        else for (let i = 0; i < (t.level || 0); i++) pips += '<i class="pip"></i>';
        if (t.mega) pips += '<span class="mega-tag">MEGA</span>';
      }
      el.querySelector('.pips').innerHTML = pips;
      const flags = [];
      if (owner) flags.push('<i class="own-dot" style="background:' + owner.color + '" title="Pemilik: ' + Util.esc(owner.name) + '"></i>');
      if (t.mortgaged) flags.push('<i class="flag" title="Digadaikan">≠</i>');
      el.querySelector('.tflags').innerHTML = flags.join('');
    });
  },

  renderTokens() {
    const g = this.game;
    if (!g) return;
    this.tileEls.forEach(el => { if (el) el.querySelector('.ttoks').innerHTML = ''; });
    const byTile = {};
    g.players.forEach(p => {
      if (p.out && !p.ghost) return;
      (byTile[p.pos] = byTile[p.pos] || []).push(p);
    });
    Object.keys(byTile).forEach(idx => {
      const el = this.tileEls[idx];
      if (!el) return;
      const box = el.querySelector('.ttoks');
      box.dataset.count = byTile[idx].length;
      box.innerHTML = byTile[idx].map(p =>
        '<span class="tok' + (g.cur === p ? ' cur' : '') + (p.ghost ? ' ghost' : '') + '" title="' + Util.esc(p.name) + '">' +
        tokenSVG(p.shape, p.color, p.ghost) + '</span>').join('');
    });
  },

  renderPlayers() {
    const g = this.game;
    const wrap = this.el.playersWrap;
    wrap.innerHTML = '';
    g.players.forEach(p => {
      const pw = g.powerInfo(p);
      const isCur = g.cur === p;
      const isNem = g.nemesis && (p.id === g.nemesis.a || p.id === g.nemesis.b);
      const card = document.createElement('div');
      card.className = 'pl' + (isCur ? ' active' : '') + (p.ghost ? ' ghost' : '') + (p.out ? ' out' : '') +
        (p.jail ? ' jail' : '') + (p.takeover ? ' takeover' : '') + (!p.connected ? ' disc' : '');
      const props = g.propsOf(p.id);
      const sets = {};
      props.forEach(t => { sets[t.group] = 1; });
      const fullSets = Object.keys(sets).filter(k => g.ownsFullSet(p.id, k));
      card.innerHTML =
        '<div class="pl-head">' +
        '<span class="pl-tok' + (isNem ? ' nem' : '') + '" title="' + (isNem ? 'Nemesis' : '') + '">' + tokenSVG(p.shape, p.color, p.ghost) + '</span>' +
        '<div class="pl-id"><b>' + Util.esc(p.name) + '</b>' +
        '<small>' + (p.isBot ? 'Bot' : (p.id === this.humanId ? 'Kamu' : 'Pemain')) + (p.team ? ' · ' + p.team : '') + (p.ghost ? ' · Hantu' : '') + (p.jail ? ' · Penjara' : '') + (p.takeover ? ' · Takeover' : '') + (!p.connected ? ' · Terputus' : '') + '</small></div>' +
        '<div class="pl-cash">' + Util.money(p.cash) + '</div>' +
        '</div>' +
        '<div class="pl-stats">' +
        '<span title="Properti">' + props.length + ' prop</span>' +
        '<span title="Set warna lengkap">' + fullSets.length + ' set</span>' +
        '<span title="Kekayaan bersih">' + Util.money(g.netWorth(p)) + '</span>' +
        '</div>' +
        (pw ? '<div class="pl-power" title="' + Util.esc(pw.desc) + '">' + pw.icon + ' ' + Util.esc(pw.name) + '</div>' : '<div class="pl-power none">Power nonaktif</div>') +
        (g.rules.sabotage ? '<div class="pl-sub">Kartu: ' + p.sabotageCards + ' sabotase' + (p.sabotageCooldown > 0 ? ' (cd ' + p.sabotageCooldown + ')' : '') + ' · ' + p.jailFreeCards + ' bebas penjara</div>' : '') +
        (p.ghost ? '<div class="pl-sub">Curian: ' + Util.money(p.stolenTotal || 0) + ' · cd ' + (p.ghostCooldown || 0) + '</div>' : '') +
        '<div class="pl-bar"><i style="width:' + Math.min(100, Math.round(g.netWorth(p) / Math.max(1, p.netWorthPeak) * 100)) + '%"></i></div>';
      card.addEventListener('click', () => { Sound.click(); this.openPlayerSheet(p.id); });
      wrap.appendChild(card);
    });
  },

  /* ---------------- A.1 Smart Action Bar ---------------- */
  activeHuman() {
    const g = this.game;
    if (!g || !g.cur) return null;
    const p = g.cur;
    return (p.isBot || p.takeover || p.out || p.ghost) ? null : p;
  },
  me() { return this.activeHuman() || (this.game ? this.game.p(this.humanId) : null); },

  renderActionBar() {
    const g = this.game;
    const mine = this.activeHuman();
    const me = mine || g.p(this.humanId);
    if (!me) return;
    const isMine = !!mine;
    const a = isMine ? g.allowedActions(mine.id) : {};

    const endPhase = isMine && g.phase === 'end';
    const canBuild = endPhase && !me.ghost && g.propsOf(me.id).some(t => g.canBuild(me, t.idx).ok);
    const mergeCands = g.rules.merging && endPhase ? g.mergeCandidates(me.id) : [];
    const canTrade = endPhase && !me.ghost && g.activePlayers().some(x => x.id !== me.id && !x.ghost && !x.bankrupt && !(g.mode === 'coop' && x.team === me.team));
    const sabTargets = g.rules.sabotage && endPhase ? g.sabotageTargets(me) : [];
    const canSab = endPhase && !me.ghost && g.rules.sabotage && me.sabotageCards > 0 && me.sabotageCooldown <= 0 && sabTargets.length > 0;

    const set = (id, on, label, title) => {
      const b = this.el[id];
      b.classList.toggle('hidden', !on);
      b.disabled = !on;
      if (label) b.innerHTML = label;
      if (title !== undefined) { if (title) b.title = title; else b.removeAttribute('title'); }
    };
    set('btnRoll', a.roll, '🎲 Lempar Dadu', '');
    set('btnBuy', a.buy, '🛒 Beli ' + (g.pendingBuy ? Util.money(g.pendingBuy.price) : ''), '');
    set('btnAuction', a.auction, '🔨 Lelang', '');
    set('btnJailFine', a.jailFine || (endPhase && me.jail && me.cash >= g.rules.jailFine), '💵 Denda ' + Util.money(g.rules.jailFine), '');
    set('btnEnd', a.end, '✔ Akhiri Giliran', '');
    set('btnBuild', endPhase, '🏠 Upgrade', canBuild ? '' : 'Butuh set warna penuh & dana cukup');
    set('btnMerge', endPhase && g.rules.merging, '🏰 Merge' + (mergeCands.length ? ' (' + mergeCands.length + ')' : ''), mergeCands.length ? '' : 'Butuh 2 properti bertetangga milikmu');
    set('btnTrade', endPhase, '🤝 Trade', canTrade ? '' : 'Tidak ada lawan trade valid');
    set('btnSabotage', endPhase && g.rules.sabotage, '💣 Sabotase' + (me.sabotageCards ? ' (' + me.sabotageCards + ')' : ''),
      canSab ? 'Pilih target langsung di papan' :
        (me.sabotageCards <= 0 ? 'Butuh kartu sabotase' : me.sabotageCooldown > 0 ? 'Cooldown ' + me.sabotageCooldown + ' ronde' : 'Tidak ada properti lawan dengan bangunan'));
    set('btnSurrender', a.surrender, '🏳️ Menyerah', '');
    this.el.btnBuild.disabled = !canBuild;
    this.el.btnMerge.disabled = !mergeCands.length;
    this.el.btnTrade.disabled = !canTrade;
    this.el.btnSabotage.disabled = !canSab;

    // primary per fase
    let primary = null;
    if (a.roll) primary = 'btnRoll';
    else if (a.buy) primary = 'btnBuy';
    else if (a.end) primary = 'btnEnd';
    const secondary = [];
    if (a.auction) secondary.push('btnAuction');
    if (a.buy) secondary.push('btnAuction');
    if (a.jailFine) secondary.push('btnJailFine');
    if (endPhase) ['btnBuild', 'btnMerge', 'btnTrade', 'btnSabotage', 'btnJailFine', 'btnSurrender'].forEach(id => secondary.push(id));

    // penempatan tombol: primer di slot, sekunder di drawer, sisanya di pool tersembunyi
    // (tidak pernah merusak node lewat innerHTML agar referensi & listener tetap hidup)
    const slot = this.el.primarySlot, drawer = this.el.drawerActions;
    const pool = document.getElementById('actionPool');
    this.actionButtons.forEach(id => {
      const b = this.el[id];
      const target = (id === primary) ? slot : (secondary.indexOf(id) > -1 ? drawer : pool);
      if (b.parentElement !== target) target.appendChild(b);
      b.classList.toggle('hidden', false);
    });
    if (!primary) {
      if (!this._primaryWait) {
        this._primaryWait = document.createElement('span');
        this._primaryWait.className = 'mut small';
        this._primaryWait.textContent = 'Menunggu giliran…';
      }
      if (this._primaryWait.parentElement !== slot) slot.appendChild(this._primaryWait);
    } else if (this._primaryWait && this._primaryWait.parentElement === slot) {
      slot.removeChild(this._primaryWait);
    }

    const enabledSec = secondary.filter(id => !this.el[id].disabled && !this.el[id].classList.contains('hidden')).length;
    this.el.drawerBadge.textContent = enabledSec;
    this.el.drawerBadge.classList.toggle('hidden', enabledSec === 0);
    this.el.btnDrawer.disabled = secondary.length === 0;

    const who = !g.cur ? '' : (g.cur.isBot ? 'Bot ' + g.cur.name + ' bermain'
      : (g.cur.takeover ? 'Takeover: ' + g.cur.name
        : (g.cur.id === this.humanId ? 'Giliranmu' : 'Giliran ' + g.cur.name + ' (hot-seat)')));
    this.el.turnHint.innerHTML = (g.cur ? '<span class="th-tok">' + tokenSVG(g.cur.shape, g.cur.color, g.cur.ghost) + '</span>' : '') +
      '<div><b>' + Util.esc(who) + '</b><small>' + this.phaseLabel() + '</small></div>' +
      (this.tutorial ? ' <span class="tag tut">Tutorial</span>' : '');
  },

  toggleDrawer(open) {
    this.drawerOpen = open == null ? !this.drawerOpen : open;
    this.el.drawer.classList.toggle('open', this.drawerOpen);
    this.el.drawerScrim.classList.toggle('show', this.drawerOpen);
  },

  /* ---------------- interaksi manusia ---------------- */
  humanRoll() {
    const g = this.game;
    const me = this.activeHuman();
    if (!g || !me) return;
    if (!g.allowedActions(me.id).roll) return this.toast('Bukan fase lempar dadu.');
    this.lastActivity = Date.now();
    this.toggleDrawer(false);
    Sound.dice();
    g.actRoll();
  },
  humanEnd() {
    const g = this.game;
    const me = this.activeHuman();
    if (!g || !me) return;
    if (g.phase !== 'end') return this.toast('Selesaikan aksi dulu (fase: ' + g.phase + ').');
    if (this.pendingResolve) return this.toast('Masih ada modal pilihan yang terbuka.');
    if (this.targeting) this.cancelTargeting();
    this.lastActivity = Date.now();
    Sound.click();
    this.el.tilePanel.classList.add('hidden');
    this.toggleDrawer(false);
    this.pendingEndTurn = true;
    const drv = this.drivers[me.id];
    if (drv && drv.finishTurn) drv.finishTurn();
  },
  confirmSurrender() {
    const g = this.game, me = this.me();
    this.choose('🏳️ Menyerah?',
      '<p>Kamu dinyatakan bangkrut' + (g.rules.ghost ? ' dan menjadi <b>Hantu</b> (masih bisa mengganggu)' : '') + '. Opsi untuk mengakhiri game panjang (PRD 10.2).</p>',
      [{ label: 'Batal', value: 0 }, { label: 'Ya, menyerah', value: 1, cls: 'danger' }]).then(v => {
        if (v) { g.surrender(me); this.render(); }
      });
  },

  /* ---------------- A.2 ticker + log modal ---------------- */
  onLog(entry, silent) {
    if (!this.game || !this.game.rules.actionLog) return;
    this.el.tickerText.innerHTML = '<b>R' + entry.round + '</b> · ' + entry.text;
    if (this.logModal && this.logModal.isConnected &&
      (this.logFilter === 'all' || entry.kind === this.logFilter)) {
      const list = this.logModal.querySelector('#logList');
      if (list) { list.appendChild(this.logRow(entry)); list.scrollTop = list.scrollHeight; }
    }
    if (this.logModal && this.logModal.isConnected) {
      const c = this.logModal.querySelector('#logCount');
      if (c) c.textContent = this.game.log.length;
    }
    if (!silent) this.logSound(entry);
  },
  logRow(e) {
    const d = document.createElement('div');
    d.className = 'logrow k-' + e.kind;
    d.dataset.kind = e.kind;
    d.innerHTML = '<span class="lr-n">' + e.n + '</span><span class="lr-r">R' + e.round + '</span><span class="lr-t">' + e.text + '</span>';
    return d;
  },
  logSound(e) {
    const m = {
      sewa: () => Sound.rent(), uang: () => Sound.coin(), pajak: () => Sound.coinOut(),
      bangun: () => Sound.build(), mega: () => Sound.mega(), trade: () => Sound.trade(),
      sabotase: () => Sound.sabotage(), cuaca: () => Sound.weather(), inflasi: () => Sound.inflation(),
      penjara: () => Sound.jail(), hantu: () => Sound.ghost(), akhir: () => Sound.podium(),
      bangkrut: () => Sound.err(), lelang: () => Sound.click(), nemesis: () => Sound.warn()
    }[e.kind];
    if (m) m();
  },
  ensureLogModal() {
    if (this.logModal) return this.logModal;
    const d = document.createElement('div');
    d.innerHTML =
      '<div class="log-foot" style="margin:0 0 10px">' +
      '<select id="logFilter" aria-label="Saring kategori log">' +
      '<option value="all">Semua kategori</option>' +
      ['gerak', 'uang', 'sewa', 'properti', 'bangun', 'mega', 'trade', 'anticollusion', 'kartu', 'sabotase',
        'cuaca', 'inflasi', 'hantu', 'koneksi', 'lelang', 'penjara', 'nemesis', 'power', 'bangkrut', 'akhir', 'sistem']
        .map(k => '<option value="' + k + '">' + k + '</option>').join('') +
      '</select>' +
      '<button id="btnShowAudit" class="btn small ghostbtn">🔐 Dice Audit</button>' +
      '<span style="flex:1"></span><span><b id="logCount">0</b> entri</span>' +
      '</div>' +
      '<div id="logList" class="loglist"></div>' +
      '<div class="log-foot">' +
      '<button id="btnExportLog" class="btn small">⬇ Export .txt</button>' +
      '<button id="btnClearLog" class="btn small ghostbtn">Bersihkan tampilan</button>' +
      '</div>';
    d.querySelector('#logFilter').addEventListener('change', e => { this.logFilter = e.target.value; this.renderLogList(); });
    d.querySelector('#btnExportLog').addEventListener('click', () => this.exportLog());
    d.querySelector('#btnClearLog').addEventListener('click', () => { d.querySelector('#logList').innerHTML = ''; });
    d.querySelector('#btnShowAudit').addEventListener('click', () => this.showAudit());
    this.logModal = d;
    return d;
  },
  openLog() {
    const node = this.ensureLogModal();
    const body = this.openOverlay('📜 Action History', '', [{ label: 'Tutup', cls: 'primary', fn: () => this.closeOverlay() }]);
    if (!body) return;
    body.innerHTML = '';
    body.appendChild(node);
    this.renderLogList();
  },
  renderLogList() {
    if (!this.game || !this.logModal) return;
    const list = this.logModal.querySelector('#logList');
    list.innerHTML = '';
    this.game.log.filter(e => this.logFilter === 'all' || e.kind === this.logFilter)
      .forEach(e => list.appendChild(this.logRow(e)));
    list.scrollTop = list.scrollHeight;
    this.logModal.querySelector('#logCount').textContent = this.game.log.length;
  },
  exportLog() {
    if (!this.game) return this.toast('Belum ada game aktif.');
    const text = this.game.exportLog();
    const name = 'colorup-action-log-' + this.game.seed + '.txt';
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      const w = window.open('', '_blank');
      if (w) w.document.write('<pre>' + Util.esc(text) + '</pre>');
    }
    this.toast('Log + dice audit di-export.', 'ok');
  },
  showAudit() {
    if (!this.game) return;
    const rows = this.game.audit.slice(-60).reverse().map(a =>
      '<tr><td>#' + a.n + '</td><td>R' + a.round + '</td><td>' + Util.esc(a.player) + '</td><td>' + a.dice.join(' + ') + '</td><td>' + a.steps + '</td>' +
      '<td><code>' + String(a.sig).slice(0, 20) + '…</code></td><td>' + (a.scripted ? 'scripted' : 'ok') + '</td></tr>').join('');
    this.openOverlay('🔐 Dice Audit — server-side RNG (PRD 3.12)',
      '<p class="mut">Seed <code>' + this.game.seed + '</code> · total lemparan <b>' + this.game.rollCount + '</b> · teraudit <b>' + this.game.auditCount + '</b> (100%).</p>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Ronde</th><th>Pemain</th><th>Dadu</th><th>Langkah</th><th>Signature</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>',
      [{ label: 'Tutup', cls: 'primary', fn: () => this.closeOverlay() }]);
  },

  /* ---------------- tile sheet ---------------- */
  openTile(idx) {
    const g = this.game, t = g.tiles[idx];
    const owner = t.ownerId ? g.p(t.ownerId) : null;
    let html = '<div class="tp-head" style="--pc:' + (t.color || 'var(--accent)') + '">' +
      '<b>' + Util.esc(t.name) + '</b><small>tile #' + t.idx + ' · ' + Util.esc(t.groupName || t.type) + '</small></div>';
    if (t.type === 'property') {
      const setInfo = g.setProgress(owner ? owner.id : '-', t.group);
      const rents = [1, 2, 4, 8, 16, 32].map((m, lv) =>
        '<tr><td>' + (lv === 0 ? 'Dasar' : lv === 5 ? 'Hotel' : 'Rumah ' + lv) + '</td><td>' + Util.money(t.rent * m) + '</td></tr>').join('');
      html += '<div class="tp-body">' +
        '<div class="tp-row"><span>Harga</span><b>' + Util.money(t.price) + '</b></div>' +
        '<div class="tp-row"><span>Pemilik</span><b>' + (owner ? Util.esc(owner.name) : 'Bank') + '</b></div>' +
        '<div class="tp-row"><span>Tingkat</span><b>' + (t.level >= 5 ? 'Hotel' : t.level ? 'Rumah ×' + t.level : '—') + '</b></div>' +
        '<div class="tp-row"><span>Biaya bangunan</span><b>' + Util.money(Math.round(t.houseCost * g.inflationMult)) + '</b></div>' +
        '<div class="tp-row"><span>Set ' + Util.esc(t.groupName) + '</span><b>' + setInfo.owned + '/' + setInfo.total + '</b></div>' +
        '<div class="tp-row"><span>Status</span><b>' + (t.mortgaged ? 'Digadaikan' : 'Aktif') + '</b></div>' +
        (t.mega ? '<div class="tp-mega">MEGA PROPERTY — gabungan ' + t.mega.tiles.length + ' tile, bonus sewa +' + Util.pct(t.mega.bonus) + '</div>' : '') +
        '<table class="tbl small"><thead><tr><th>Tingkat</th><th>Sewa dasar</th></tr></thead><tbody>' + rents + '</tbody></table>' +
        '<div class="tp-rent">Sewa efektif: <b>' + Util.money(owner ? g.calcRent(owner, t).amount : t.rent) + '</b>' +
        (g.inflation > 0 ? ' <small>(inflasi +' + Util.pct(g.inflation) + ')</small>' : '') + '</div>' +
        '<div class="tp-acts">' + this.tileActions(t, owner) + '</div></div>';
    } else {
      const info = {
        start: 'Melewati START memberi ' + Util.money(200) + (g.hasPower(this.me(), 'saver') ? ' (+$50 power)' : '') + '.',
        tax: 'Bayar pajak ' + Util.money(Math.round((t.amount || 100) * g.inflationMult)) + ' ke treasury.',
        chance: 'Tarik kartu Surprise/Bonus.',
        jail: 'Hanya berkunjung — aman.',
        gotojail: 'Langsung masuk penjara tanpa lewat START.',
        vacation: 'Ambil 50% treasury (maks $300).'
      }[t.type] || '';
      html += '<div class="tp-body"><p class="mut">' + info + '</p><div class="tp-row"><span>Treasury</span><b>' + Util.money(g.treasury) + '</b></div></div>';
    }
    this.el.tileBody.innerHTML = html;
    this.el.tilePanel.classList.remove('hidden');
    this.el.tilePanel.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => this.tileAction(b.dataset.act, idx)));
  },

  tileActions(t, owner) {
    const g = this.game, me = this.me();
    if (!me) return '';
    const btns = [];
    const myTurnEnd = g.cur && g.cur.id === me.id && g.phase === 'end' && !me.ghost && !me.takeover;
    if (owner && owner.id === me.id && t.type === 'property') {
      const chk = g.canBuild(me, t.idx);
      btns.push('<button class="btn small primary" data-act="build"' + (chk.ok && me.cash >= chk.cost && myTurnEnd ? '' : ' disabled') + '>🏠 Upgrade ' + (chk.ok ? Util.money(chk.cost) : '') + '</button>');
      if (t.level > 0) btns.push('<button class="btn small" data-act="sell"' + (myTurnEnd ? '' : ' disabled') + '>Jual 1 tingkat</button>');
      if (g.rules.mortgage && !t.mortgaged && t.level === 0 && !t.mega) btns.push('<button class="btn small" data-act="mortgage">Gadai +' + Util.money(Math.round(t.price * 0.5)) + '</button>');
      if (g.rules.mortgage && t.mortgaged) btns.push('<button class="btn small" data-act="unmortgage">Tebus</button>');
      if (t.mega && t.level === 0) btns.push('<button class="btn small" data-act="unmerge">Pisahkan Mega</button>');
    }
    if (g.rules.merging && myTurnEnd) {
      const cand = g.mergeCandidates(me.id).filter(c => c.a === t.idx || c.b === t.idx)[0];
      if (cand) btns.push('<button class="btn small primary" data-act="merge">🏰 Merge ' + Util.money(g.mergeCost(me, cand.a, cand.b)) + '</button>');
    }
    if (g.rules.sabotage && owner && owner.id !== me.id && !g.sameTeam(owner.team, me.team) && t.level > 0 && myTurnEnd) {
      btns.push('<button class="btn small danger" data-act="sabotage"' + (me.sabotageCards > 0 && me.sabotageCooldown <= 0 ? '' : ' disabled') + '>💣 Sabotase</button>');
    }
    return btns.length ? btns.join('') : '<div class="mut small">Tidak ada aksi untuk tile ini sekarang.</div>';
  },

  tileAction(act, idx) {
    const g = this.game, me = this.me(), t = g.tiles[idx];
    if (!me) return this.toast('Tunggu giliranmu.');
    this.lastActivity = Date.now();
    if (act === 'build') { if (g.build(me, idx)) Sound.build(); else Sound.err(); }
    if (act === 'sell') g.sellBuilding(me, idx);
    if (act === 'mortgage') g.mortgage(me, idx);
    if (act === 'unmortgage') g.unmortgage(me, idx);
    if (act === 'unmerge') g.unmerge(me, idx);
    if (act === 'merge') {
      const c = g.mergeCandidates(me.id).find(c => c.a === idx || c.b === idx);
      if (c && g.merge(me, c.a, c.b)) { Sound.mega(); this.confetti(10); }
    }
    if (act === 'sabotage') { this.el.tilePanel.classList.add('hidden'); this.startTargeting(idx); return; }
    this.render();
    this.openTile(idx);
  },

  /* ---------------- A.11 on-board sabotage targeting ---------------- */
  startTargeting(preselect) {
    const g = this.game, me = this.me();
    if (!g || !me || me.out || me.bankrupt || g.state !== 'playing') return;
    if (!g.rules.sabotage) return this.toast('Sabotase dinonaktifkan di room ini.');
    if (me.sabotageCards <= 0) return this.toast('Butuh kartu sabotase.', 'warn');
    if (me.sabotageCooldown > 0) return this.toast('Cooldown ' + me.sabotageCooldown + ' ronde lagi.', 'warn');
    const targets = g.sabotageTargets(me);
    if (!targets.length) return this.toast('Tidak ada properti lawan dengan bangunan.', 'warn');
    this.targeting = { kind: 'sabotage', valid: targets.map(t => t.idx) };
    this.el.board.classList.add('targeting');
    this.el.targetText.innerHTML = '🎯 Pilih target sabotase · <b>' + targets.length + '</b> properti valid · Esc untuk batal';
    this.el.targetBanner.classList.remove('hidden');
    this.el.tilePanel.classList.add('hidden');
    this.toggleDrawer(false);
    this.render();
    Sound.warn();
    if (preselect != null && this.targeting.valid.indexOf(preselect) > -1) this.confirmSabotage(preselect);
  },
  cancelTargeting() {
    if (!this.targeting) return;
    this.targeting = null;
    this.el.board.classList.remove('targeting');
    this.el.targetBanner.classList.add('hidden');
    this.el.miniSheet.classList.add('hidden');
    const tip = document.querySelector('.tpreview');
    if (tip) tip.remove();
    this.render();
  },
  confirmSabotage(idx) {
    const g = this.game, me = this.me(), t = g.tiles[idx], o = g.p(t.ownerId);
    this.el.miniSheetBody.innerHTML =
      '<h4>💣 Sabotase ' + Util.esc(t.name) + '?</h4>' +
      '<p>Milik <b>' + Util.esc(o.name) + '</b> · 1 tingkat hancur · cooldown ' + g.rules.sabotageCooldown + ' ronde</p>' +
      '<div class="ms-btns"><button class="btn small ghostbtn" data-ms="0">Batal</button>' +
      '<button class="btn small danger" data-ms="1">💣 Tembak</button></div>';
    this.el.miniSheet.classList.remove('hidden');
    this.el.miniSheetBody.querySelectorAll('[data-ms]').forEach(b => b.addEventListener('click', () => {
      this.el.miniSheet.classList.add('hidden');
      if (b.dataset.ms === '1') {
        if (g.useSabotage(me, idx)) {
          Sound.sabotage();
          this.flash(idx);
          this.confetti(8);
        } else Sound.err();
        this.cancelTargeting();
      } else { Sound.click(); this.cancelTargeting(); }
    }));
    const fire = this.el.miniSheetBody.querySelector('[data-ms="1"]');
    if (fire) fire.focus();
  },
  flash(idx) {
    const el = this.tileEls[idx];
    if (!el) return;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 900);
  },

  /* ---------------- merge & build ---------------- */
  openMerge() {
    const g = this.game, me = this.me();
    if (!me) return this.toast('Tunggu giliranmu.');
    const cands = g.mergeCandidates(me.id);
    if (!cands.length) return this.toast('Tidak ada pasangan properti bertetangga yang bisa digabung.');
    const rows = cands.map(c => {
      const a = g.tiles[c.a], b = g.tiles[c.b];
      return '<div class="wz-block"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
        '<i class="dot" style="background:' + a.color + '"></i>' + Util.esc(a.name) + ' <span class="mut">+</span> ' +
        '<i class="dot" style="background:' + b.color + '"></i>' + Util.esc(b.name) + '</div>' +
        '<div class="mut small" style="margin:6px 0 8px">' + (c.sameGroup ? 'Set ' + Util.esc(a.groupName) : 'Lintas warna') +
        ' · biaya <b>' + Util.money(g.mergeCost(me, c.a, c.b)) + '</b> · sewa +' + Util.pct(g.rules.megaBonus) + '</div>' +
        '<button class="btn small primary" data-m="' + c.a + ',' + c.b + '">🏰 Gabungkan</button></div>';
    }).join('');
    const body = this.openOverlay('🏰 Property Merging → Mega Property',
      '<p class="mut">Syarat (PRD 3.2): pemilik sama, tile bertetangga, tidak digadaikan; mode room <b>' + g.rules.mergeMode + '</b>. Bonus +' + Util.pct(g.rules.megaBonus) + '/merge, cap +' + Util.pct(g.rules.megaCap) + '.</p>' + rows,
      [{ label: 'Tutup', cls: 'primary', fn: () => this.closeOverlay() }]);
    if (!body) return;
    body.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
      const [x, y] = b.dataset.m.split(',').map(Number);
      if (g.merge(me, x, y)) { Sound.mega(); this.confetti(12); this.closeOverlay(); }
      else Sound.err();
    }));
  },

  openBuildHint() {
    const g = this.game, me = this.me();
    if (!me) return this.toast('Tunggu giliranmu.');
    const rows = g.propsOf(me.id).map(t => {
      const c = g.canBuild(me, t.idx);
      return '<tr><td><i class="dot" style="background:' + t.color + '"></i> ' + Util.esc(t.name) + '</td><td>lvl ' + t.level + '</td>' +
        '<td>' + (c.ok ? Util.money(c.cost) : '<span class="mut">' + Util.esc(c.why) + '</span>') + '</td>' +
        '<td>' + (c.ok ? '<button class="btn small primary" data-b="' + t.idx + '">Bangun</button>' : '') + '</td></tr>';
    }).join('');
    const body = this.openOverlay('🏠 Upgrade Bangunan',
      '<p class="mut">Sewa ×2 per tingkat. Even build ' + (g.rules.evenBuild ? 'AKTIF' : 'nonaktif') + '. ❄️ Badai Salju membekukan pembangunan.</p>' +
      '<div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Properti</th><th>Tingkat</th><th>Biaya</th><th></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="4" class="mut">Kamu belum punya properti.</td></tr>') + '</tbody></table></div>',
      [{ label: 'Tutup', cls: 'primary', fn: () => this.closeOverlay() }]);
    if (!body) return;
    body.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => {
      if (g.build(me, +b.dataset.b)) { Sound.build(); this.closeOverlay(); }
      else { Sound.err(); this.openBuildHint(); }
    }));
  },

  openPlayerSheet(pid) {
    const g = this.game, p = g.p(pid), pw = g.powerInfo(p);
    const props = g.propsOf(pid);
    const rows = props.map(t => '<tr><td><i class="dot" style="background:' + t.color + '"></i> ' + Util.esc(t.name) + '</td>' +
      '<td>' + (t.level >= 5 ? 'Hotel' : (t.level ? 'Rumah ×' + t.level : '—')) + '</td>' +
      '<td>' + Util.money(g.calcRent(p, t).amount) + '</td>' +
      '<td>' + (t.mortgaged ? 'Gadai' : (t.mega ? 'Mega' : 'Aktif')) + '</td></tr>').join('') ||
      '<tr><td colspan="4" class="mut">Belum punya properti.</td></tr>';
    const rivals = g.players.filter(o => o.id !== pid).map(o => ({ o, v: (p.rentTo[o.id] || 0) }))
      .filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3);
    this.openOverlay(tokenSVG(p.shape, p.color, p.ghost) + ' ' + Util.esc(p.name),
      '<div class="sheet">' +
      '<div class="sh-stats">' +
      '<div><small>Uang</small><b>' + Util.money(p.cash) + '</b></div>' +
      '<div><small>Kekayaan</small><b>' + Util.money(g.netWorth(p)) + '</b></div>' +
      '<div><small>Properti</small><b>' + props.length + '</b></div>' +
      '<div><small>Trade</small><b>' + p.trades + '</b></div>' +
      '<div><small>Upgrade</small><b>' + p.builds + '</b></div>' +
      '<div><small>Ronde</small><b>' + p.roundsPlayed + '</b></div>' +
      '</div>' +
      (pw ? '<div class="sh-power"><b>' + pw.icon + ' ' + Util.esc(pw.name) + '</b> <span class="tag">' + Util.esc(pw.tag) + '</span><p>' + Util.esc(pw.desc) + '</p></div>'
        : '<div class="sh-power none">Kekuatan asimetris dinonaktifkan di room ini.</div>') +
      (p.ghost ? '<div class="sh-ghost">👻 HANTU — tidak bisa membeli/trade/menagih sewa. Mencuri maks ' + Util.money(g.rules.ghostStealCap) + '/aksi, cooldown ' + g.rules.ghostCooldown + ' ronde. Total: <b>' + Util.money(p.stolenTotal || 0) + '</b>.</div>' : '') +
      '<h4>Portofolio</h4><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Properti</th><th>Bangunan</th><th>Sewa</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<h4>Sewa terbesar dibayarkan ke</h4>' +
      (rivals.length ? '<ul class="rivals">' + rivals.map(r => '<li>' + Util.esc(r.o.name) + ' — <b>' + Util.money(r.v) + '</b>' +
        (g.nemesis && ((g.nemesis.a === pid && g.nemesis.b === r.o.id) || (g.nemesis.b === pid && g.nemesis.a === r.o.id)) ? ' <span class="tag nem">NEMESIS</span>' : '') + '</li>').join('') + '</ul>'
        : '<p class="mut">Belum ada riwayat sewa.</p>') +
      '</div>',
      [{ label: 'Tutup', cls: 'primary', fn: () => this.closeOverlay() }]);
  },

  /* ---------------- A.13 Trade Wizard ---------------- */
  openTrade() {
    const g = this.game, me = this.me();
    if (!me) return this.toast('Tunggu giliranmu.');
    const others = g.activePlayers().filter(o => o.id !== me.id && !o.ghost && !o.bankrupt && !(g.mode === 'coop' && o.team === me.team));
    if (!others.length) return this.toast('Tidak ada lawan trade yang valid.');
    this.tradeDraft = {
      step: 1, from: me.id, to: others[0].id,
      give: { cash: 0, props: [], sabotage: 0, jailFree: false },
      get: { cash: 0, props: [], sabotage: 0, jailFree: false }
    };
    this.renderWizard();
  },
  wizardDirty() {
    const d = this.tradeDraft;
    if (!d) return false;
    return d.give.cash > 0 || d.get.cash > 0 || d.give.props.length || d.get.props.length ||
      d.give.sabotage || d.get.sabotage || d.give.jailFree || d.get.jailFree;
  },
  collusionNow() {
    const g = this.game, d = this.tradeDraft;
    return g.collusionScore(g.p(d.from), g.p(d.to), { give: d.give, get: d.get });
  },
  renderWizard() {
    const g = this.game, d = this.tradeDraft;
    if (!d) return;
    const me = g.p(d.from), other = g.p(d.to);
    const others = g.activePlayers().filter(o => o.id !== me.id && !o.ghost && !o.bankrupt && !(g.mode === 'coop' && o.team === me.team));
    const steps = ['Pilih Lawan', 'Tawarkan', 'Minta', 'Konfirmasi'];
    let html = '<div class="wz-steps">' + steps.map((s, i) =>
      '<div class="wz-step' + (d.step === i + 1 ? ' on' : (d.step > i + 1 ? ' done' : '')) + '">' + (i + 1) + '. ' + s + '</div>').join('') + '</div>';

    if (d.step === 1) {
      html += '<div class="wz-cards">' + others.map(o =>
        '<div class="wz-card' + (o.id === d.to ? ' sel' : '') + '" data-to="' + o.id + '" role="button" tabindex="0" aria-label="Pilih ' + Util.esc(o.name) + '">' +
        '<div class="wc-tok">' + tokenSVG(o.shape, o.color, o.ghost) + '</div>' +
        '<b>' + Util.esc(o.name) + '</b><small>' + Util.money(o.cash) + ' · ' + g.propsOf(o.id).length + ' properti</small></div>').join('') + '</div>';
    } else if (d.step === 2 || d.step === 3) {
      const giving = d.step === 2;
      const owner = giving ? me : other;
      const side = giving ? 'give' : 'get';
      const sel = d[side];
      html += '<div class="wz-block"><h5>' + (giving ? 'Kamu tawarkan — uang' : 'Kamu minta dari ' + Util.esc(other.name) + ' — uang') + '</h5>' +
        '<div class="wz-cashrow"><input type="range" min="0" max="' + owner.cash + '" value="' + sel.cash + '" data-side="' + side + '" data-f="cash" aria-label="Jumlah uang">' +
        '<input type="number" min="0" max="' + owner.cash + '" value="' + sel.cash + '" data-side="' + side + '" data-f="cashN" aria-label="Jumlah uang (angka)">' +
        '<output>' + Util.money(sel.cash) + '</output></div></div>';
      html += '<div class="wz-block"><h5>Properti — tap untuk ' + (giving ? 'tawarkan' : 'minta') + ', atau drag ke kolom kanan (desktop)</h5>' +
        '<div class="wz-cols"><div class="wz-chips" data-pool="' + side + '">' +
        (g.propsOf(owner.id).map(t => {
          const inSel = sel.props.indexOf(t.idx) > -1;
          const locked = t.level > 0 || t.mega;
          return '<span class="wz-chip' + (inSel ? ' in' : '') + (locked ? ' used' : '') + '"' +
            (locked ? ' title="Jual bangunan / pisahkan Mega dulu"' : ' draggable="true"') +
            ' data-side="' + side + '" data-prop="' + t.idx + '"><i class="dot" style="background:' + t.color + '"></i>' + Util.esc(t.name) + '</span>';
        }).join('') || '<span class="mut small">Tidak ada properti.</span>') +
        '</div><div class="wz-drop" data-drop="' + side + '">' +
        (sel.props.length ? '' : '<span class="dz-hint">Seret / tap aset ke sini</span>') +
        sel.props.map(i => '<span class="wz-chip in" data-side="' + side + '" data-prop="' + i + '"><i class="dot" style="background:' + g.tiles[i].color + '"></i>' + Util.esc(g.tiles[i].name) + '</span>').join('') +
        '</div></div></div>';
      html += '<div class="wz-block"><h5>Kartu</h5><div class="wz-chips">' +
        '<span class="wz-chip' + (sel.sabotage ? ' in' : (owner.sabotageCards > 0 ? '' : ' used')) + '" data-side="' + side + '" data-card="sabotage">💣 Sabotase ×' + owner.sabotageCards + '</span>' +
        '<span class="wz-chip' + (sel.jailFree ? ' in' : (owner.jailFreeCards > 0 ? '' : ' used')) + '" data-side="' + side + '" data-card="jailFree">🎫 Bebas Penjara ×' + owner.jailFreeCards + '</span>' +
        '</div></div>';
      html += this.collusionBox();
    } else {
      const fmt = o => {
        const bits = [];
        if (o.cash) bits.push('<tr><td>Uang</td><td>' + Util.money(o.cash) + '</td></tr>');
        (o.props || []).forEach(i => bits.push('<tr><td>' + Util.esc(g.tiles[i].name) + '</td><td>' + Util.money(g.tiles[i].price) + '</td></tr>'));
        if (o.sabotage) bits.push('<tr><td>💣 Sabotase</td><td>×' + o.sabotage + '</td></tr>');
        if (o.jailFree) bits.push('<tr><td>🎫 Bebas Penjara</td><td>×1</td></tr>');
        return bits.join('') || '<tr><td class="mut">—</td><td></td></tr>';
      };
      const col = this.collusionNow();
      html += '<div class="tbl-wrap"><table class="wz-table"><thead><tr><th>Kamu beri</th><th>Kamu minta</th></tr></thead><tbody>' +
        '<tr><td>' + fmt(d.give) + '</td><td>' + fmt(d.get) + '</td></tr></tbody></table></div>' +
        '<div class="wz-foot"><span>Nilai: beri ≈ <b>' + Util.money(col.va) + '</b> · terima ≈ <b>' + Util.money(col.vb) + '</b></span></div>' +
        this.collusionBox();
    }

    const acts = [];
    if (d.step > 1) acts.push({ label: '← Kembali', cls: 'ghostbtn', fn: () => { d.step--; Sound.click(); this.renderWizard(); } });
    acts.push({ label: 'Batalkan', cls: 'ghostbtn', fn: () => this.cancelTrade() });
    if (d.step < 4) acts.push({ label: 'Lanjut →', cls: 'primary', choice: 'next', fn: () => this.wizardNext() });
    else acts.push({ label: 'Kirim Tawaran →', cls: 'primary', choice: 'send', fn: () => this.sendTrade() });

    const body = this.openOverlay('🤝 Trade Wizard · langkah ' + d.step + '/4', html, acts, true);
    if (!body) return;
    this.bindWizard(body);
  },
  collusionBox() {
    const g = this.game, col = this.collusionNow();
    if (col.score >= 2) {
      return '<div class="col-warn' + (g.rules.antiCollusion === 'strict' ? ' block' : '') + '" data-colbox>🚩 Anti-collusion: trade timpang — selisih ' +
        Util.money(col.diff) + ' (' + Util.pct(col.ratio) + ')' + (col.strategic ? ', ada nilai strategis set.' : ', tanpa nilai strategis.') +
        (g.rules.antiCollusion === 'strict' ? ' Mode strict: akan DIBLOKIR.' : '') + '</div>';
    }
    return '<div class="col-ok" data-colbox>✅ Skor kolusi ' + col.score + '/3 · beri ≈ ' + Util.money(col.va) + ' · terima ≈ ' + Util.money(col.vb) + '</div>';
  },
  refreshCollusion() {
    const box = this.el.overlayBody.querySelector('[data-colbox]');
    if (!box) return;
    const g = this.game, col = this.collusionNow();
    box.className = col.score >= 2 ? ('col-warn' + (g.rules.antiCollusion === 'strict' ? ' block' : '')) : 'col-ok';
    box.innerHTML = col.score >= 2
      ? '🚩 Anti-collusion: selisih ' + Util.money(col.diff) + ' (' + Util.pct(col.ratio) + ')' + (col.strategic ? ', ada nilai strategis.' : '.') + (g.rules.antiCollusion === 'strict' ? ' Akan DIBLOKIR.' : '')
      : '✅ Skor kolusi ' + col.score + '/3 · beri ≈ ' + Util.money(col.va) + ' · terima ≈ ' + Util.money(col.vb);
  },
  bindWizard(body) {
    const g = this.game, d = this.tradeDraft;
    body.querySelectorAll('[data-to]').forEach(c => {
      const pick = () => { d.to = c.dataset.to; Sound.click(); this.renderWizard(); };
      c.addEventListener('click', pick);
      c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    body.querySelectorAll('input[data-f="cash"]').forEach(r => r.addEventListener('input', () => {
      d[r.dataset.side].cash = Math.max(0, Math.min(+r.max, +r.value || 0));
      const out = r.parentElement.querySelector('output');
      if (out) out.textContent = Util.money(d[r.dataset.side].cash);
      const n = body.querySelector('input[data-f="cashN"][data-side="' + r.dataset.side + '"]');
      if (n) n.value = d[r.dataset.side].cash;
      this.refreshCollusion();
    }));
    body.querySelectorAll('input[data-f="cashN"]').forEach(n => n.addEventListener('change', () => {
      const side = n.dataset.side;
      const max = side === 'give' ? g.p(d.from).cash : g.p(d.to).cash;
      d[side].cash = Math.max(0, Math.min(max, +n.value || 0));
      this.renderWizard();
    }));
    const toggleProp = (side, idx) => {
      const t = g.tiles[idx];
      if (t.level > 0 || t.mega) return this.toast('Jual bangunan / pisahkan Mega dulu.', 'warn');
      const arr = d[side].props;
      const i = arr.indexOf(idx);
      if (i > -1) arr.splice(i, 1); else arr.push(idx);
      Sound.toggle(i === -1);
      this.renderWizard();
    };
    body.querySelectorAll('[data-prop]').forEach(ch => {
      ch.addEventListener('click', () => toggleProp(ch.dataset.side, +ch.dataset.prop));
      ch.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', ch.dataset.side + ':' + ch.dataset.prop);
        ch.classList.add('dragging');
      });
      ch.addEventListener('dragend', () => ch.classList.remove('dragging'));
    });
    body.querySelectorAll('[data-drop]').forEach(zone => {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('over'));
      zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('over');
        const [side, idx] = (e.dataTransfer.getData('text/plain') || '').split(':');
        if (side && idx !== undefined && side === zone.dataset.drop) toggleProp(side, +idx);
      });
    });
    body.querySelectorAll('[data-card]').forEach(ch => ch.addEventListener('click', () => {
      const side = ch.dataset.side, key = ch.dataset.card;
      const owner = side === 'give' ? g.p(d.from) : g.p(d.to);
      const have = key === 'sabotage' ? owner.sabotageCards : owner.jailFreeCards;
      if (!have) return this.toast('Kartu tidak tersedia.', 'warn');
      d[side][key] = key === 'sabotage' ? (d[side][key] ? 0 : 1) : !d[side][key];
      Sound.toggle(!!d[side][key]);
      this.renderWizard();
    }));
  },
  wizardNext() {
    const d = this.tradeDraft;
    if (d.step === 1 && !d.to) return this.toast('Pilih lawan dulu.', 'warn');
    Sound.click();
    d.step = Math.min(4, d.step + 1);
    this.renderWizard();
  },
  cancelTrade() {
    if (this.wizardDirty()) {
      this.choose('Batalkan trade?', '<p>Draf tawaran akan hilang.</p>',
        [{ label: 'Kembali', value: 0 }, { label: 'Batalkan', value: 1, cls: 'danger' }]).then(v => {
          if (v) { this.tradeDraft = null; this.modalLock = false; this.closeOverlay(); }
        });
    } else {
      this.tradeDraft = null;
      this.modalLock = false;
      this.closeOverlay();
    }
  },
  async sendTrade() {
    const g = this.game, d = this.tradeDraft;
    const clean = o => ({ cash: o.cash || 0, props: o.props.slice(), sabotage: o.sabotage || 0, jailFree: !!o.jailFree });
    this.modalLock = false;
    this.closeOverlay();
    const other = g.p(d.to);
    this.openOverlay('📨 Mengirim tawaran…',
      '<div class="wz-wait"><div class="spinner"></div><div>Menunggu <b>' + Util.esc(other.name) + '</b> memutuskan…</div></div>', [], true);
    await Util.sleep(420);
    const res = await g.proposeTrade(d.from, d.to, { give: clean(d.give), get: clean(d.get) });
    this.modalLock = false;
    this.closeOverlay();
    this.tradeDraft = null;
    if (res.errors && res.errors.length) { Sound.err(); return this.toast('⚠️ ' + Util.esc(res.errors[0]), 'err'); }
    if (res.blocked) { Sound.err(); return this.toast('⛔ Trade diblokir anti-collusion (mode strict).', 'err'); }
    if (res.declined) { Sound.err(); return this.toast('❌ Tawaran ditolak.', 'err'); }
    if (res.ok) { Sound.trade(); this.toast('🤝 Trade berhasil!', 'ok'); this.confetti(10); }
    this.render();
  },

  /* ---------------- dadu ---------------- */
  animateDice(audit, p) {
    const box = this.el.diceBox;
    if (!box) return;
    box.classList.add('rolling');
    box.innerHTML = diceFace(1) + diceFace(1);
    let ticks = 0;
    const iv = setInterval(() => {
      ticks++;
      box.innerHTML = diceFace(1 + Math.floor(Math.random() * 6)) + diceFace(1 + Math.floor(Math.random() * 6));
      if (ticks > 8) {
        clearInterval(iv);
        box.classList.remove('rolling');
        box.innerHTML = diceFace(audit.dice[0]) + diceFace(audit.dice[1]) +
          '<small>' + audit.steps + ' langkah' + (audit.dice[0] === audit.dice[1] ? ' · kembar' : '') + '</small>';
        box.classList.add('pop');
        setTimeout(() => box.classList.remove('pop'), 450);
        Sound.diceLand();
      }
    }, 70);
  },

  onGameEvent(kind, d) {
    if (kind === 'sabotage') { this.flash(d.tile.idx); this.toast('💣 ' + Util.esc(d.actor.name) + ' menyabotase ' + Util.esc(d.tile.name), 'warn'); }
    if (kind === 'weather') this.toast(d.icon + ' Cuaca: <b>' + Util.esc(d.name) + '</b> — ' + Util.esc(d.desc), 'info');
    if (kind === 'inflation') this.toast('📈 Inflasi naik ke ' + Util.pct(d), 'warn');
    if (kind === 'steal') this.toast('👻 ' + Util.esc(d.actor.name) + ' mencuri ' + Util.money(d.amount) + ' dari ' + Util.esc(d.victim.name), 'warn');
    if (kind === 'takeover') this.toast('🤖 Auto-Bot Takeover: ' + Util.esc(d.name), 'warn');
    if (kind === 'reconnect') this.toast('🔗 ' + Util.esc(d.name) + ' tersambung kembali', 'ok');
    if (kind === 'trade') this.confetti(8);
  },

  confetti(n) {
    const count = n || 30;
    const layer = document.getElementById('confetti') || (() => {
      const d = document.createElement('div'); d.id = 'confetti'; document.body.appendChild(d); return d;
    })();
    const colors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#e5e7eb'];
    for (let i = 0; i < count; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + '%';
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = (Math.random() * 0.6) + 's';
      c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
      layer.appendChild(c);
      setTimeout(() => c.remove(), 3600);
    }
  },

  /* ---------------- A.14 Podium results ---------------- */
  onGameOver(winners, g) {
    this.loopRunning = false;
    this.cancelTargeting();
    this.render();
    const ranked = g.rankByNetWorth();
    const top3 = ranked.slice(0, 3);
    const rest = ranked.slice(3);
    const maxNW = Math.max(1, top3[0] ? g.netWorth(top3[0]) : 1);

    const winTxt = winners.length
      ? (g.mode === 'coop'
        ? '🏆 Tim <b>' + Util.esc(winners[0].team) + '</b> menang! (' + winners.map(w => Util.esc(w.name)).join(', ') + ')'
        : '🏆 <b>' + Util.esc(winners[0].name) + '</b> menang!')
      : '💀 Semua pemain bangkrut — tidak ada pemenang.';
    this.el.resSub.innerHTML = 'Ronde <b>' + g.round + '</b> · ' + DATA.SIZES[g.size].label + ' · ' + DATA.MODES[g.mode].label + ' · seed <code>' + g.seed + '</code>';

    const medals = ['🥇', '', ''];
    const order = [1, 0, 2];
    let podium = '<div class="podium">';
    order.forEach(pi => {
      const p = top3[pi];
      if (!p) { podium += '<div class="pod pod-' + (pi + 1) + '"></div>'; return; }
      const nw = g.netWorth(p);
      const hPct = Math.max(22, Math.round(nw / maxNW * 100));
      podium += '<div class="pod pod-' + (pi + 1) + '">' +
        '<div class="pod-top">' +
        '<div class="pod-medal">' + medals[pi] + '</div>' +
        '<div class="pod-avatar">' + tokenSVG(p.shape, p.color, p.ghost) + '</div>' +
        '<div class="pod-name">' + Util.esc(p.name) + (p.ghost ? ' 👻' : '') + '</div>' +
        '<div class="pod-cash" data-count="' + nw + '">0</div>' +
        '<div class="pod-stat">' + p.properties.length + ' prop · ' + p.trades + ' trade' + (p.steals ? ' · ' + p.steals + ' curian' : '') + '</div>' +
        this.sparkline(p) +
        '</div>' +
        '<div class="pod-bar" style="height:' + hPct + '%"></div>' +
        '</div>';
    });
    podium += '</div>';

    let restHtml = '';
    if (rest.length) {
      restHtml = '<div class="rest-wrap"><table class="tbl small"><thead><tr><th>#</th><th>Pemain</th><th>Kekayaan</th><th>Prop</th><th>Trade</th><th>Curian</th></tr></thead><tbody>' +
        rest.map(p => '<tr><td>' + p.placement + '</td><td>' + tokenSVG(p.shape, p.color, p.ghost) + ' ' + Util.esc(p.name) + (p.team ? ' <span class="tag">' + p.team + '</span>' : '') + '</td>' +
          '<td>' + Util.money(g.netWorth(p)) + '</td><td>' + p.properties.length + '</td><td>' + p.trades + '</td><td>' + (p.steals || 0) + '</td></tr>').join('') +
        '</tbody></table></div>';
    }

    const metrics = '<div class="res-metrics">' +
      '<span>Dice audit <b>' + g.rollCount + '/' + g.auditCount + '</b> (100%)</span>' +
      '<span>Flag anti-collusion <b>' + g.log.filter(l => l.kind === 'anticollusion').length + '</b></span>' +
      '<span>Entri log <b>' + g.log.length + '</b></span>' +
      '<span>Tick inflasi <b>' + g.inflationTicks + '</b></span>' +
      '<span>Trade <b>' + g.log.filter(l => l.kind === 'trade').length + '</b></span>' +
      '</div>';

    const ghosts = g.players.filter(p => p.ghost);
    this.el.resultBody.innerHTML =
      '<div class="res-hero">' + winTxt + '</div>' + podium + restHtml + metrics +
      (ghosts.length ? '<div class="res-ghost">👻 Ghost Comeback: ' + ghosts.map(x => Util.esc(x.name) + ' mencuri total ' + Util.money(x.stolenTotal || 0)).join(', ') + '.</div>' : '') +
      this.karmaHTML(g);

    this.showScreen('results');
    this.countUp();
    Sound.podium();
    setTimeout(() => { Sound.confetti(); this.confetti(46); }, 550);
  },

  sparkline(p) {
    const h = p.netWorthHistory || [];
    if (h.length < 2) return '';
    const vals = h.map(x => x.netWorth);
    const mx = Math.max.apply(null, vals.concat([1])), mn = Math.min.apply(null, vals.concat([0]));
    const W = 110, H = 34;
    const pts = h.map((x, i) => {
      const px = (i / (h.length - 1)) * (W - 4) + 2;
      const py = H - 3 - ((x.netWorth - mn) / Math.max(1, mx - mn)) * (H - 6);
      return px.toFixed(1) + ',' + py.toFixed(1);
    }).join(' ');
    return '<svg class="pod-spark" width="' + W + '" height="' + H + '" role="img" aria-label="Tren kekayaan per ronde">' +
      '<polyline points="' + pts + '" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/></svg>';
  },

  countUp() {
    document.querySelectorAll('.pod-cash[data-count]').forEach(el => {
      const target = +el.dataset.count;
      const t0 = performance.now();
      const dur = 800;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = Util.money(Math.round(target * eased));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  },

  screenshotPodium() {
    const g = this.game;
    if (!g) return;
    const ranked = g.ranking || g.rankByNetWorth();
    const top3 = ranked.slice(0, 3);
    const maxNW = Math.max(1, top3[0] ? g.netWorth(top3[0]) : 1);
    const W = 900, H = 560;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const x = cv.getContext ? cv.getContext('2d') : null;
    if (!x) return this.toast('Canvas tidak tersedia di lingkungan ini.', 'warn');
    x.fillStyle = '#0f0f17'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e5e7eb'; x.font = '700 34px Poppins, sans-serif'; x.textAlign = 'center';
    x.fillText('ColorUp.io — Hasil Pertandingan', W / 2, 58);
    x.font = '400 15px Inter, sans-serif'; x.fillStyle = '#9ca3af';
    x.fillText('Ronde ' + g.round + ' · ' + DATA.SIZES[g.size].label + ' · ' + DATA.MODES[g.mode].label + ' · seed ' + g.seed, W / 2, 84);
    const colors = ['#d4a24c', '#9aa4b2', '#a9714b'];
    [1, 0, 2].forEach((pi, slot) => {
      const p = top3[pi];
      if (!p) return;
      const cx = W / 2 + (slot - 1) * 250;
      const nw = g.netWorth(p);
      const bh = Math.max(40, nw / maxNW * 260);
      x.fillStyle = colors[pi];
      x.fillRect(cx - 80, H - 90 - bh, 160, bh);
      x.fillStyle = '#e5e7eb'; x.font = '600 18px Inter, sans-serif';
      x.fillText(p.name, cx, H - 90 - bh - 46);
      x.font = '700 20px Inter, sans-serif';
      x.fillText(Util.money(nw), cx, H - 90 - bh - 20);
      x.font = '400 26px serif';
      x.fillText(['🥇', '🥈', ''][pi], cx, H - 90 - bh - 74);
      x.font = '600 22px Inter, sans-serif'; x.fillStyle = '#0f0f17';
      x.fillText('#' + (pi + 1), cx, H - 90 - bh + 34);
      x.fillStyle = '#e5e7eb';
    });
    x.fillStyle = '#9ca3af'; x.font = '400 12px Inter, sans-serif';
    x.fillText('colorup.io · ' + new Date().toISOString().slice(0, 10), W / 2, H - 24);
    try {
      const a = document.createElement('a');
      a.href = cv.toDataURL('image/png');
      a.download = 'colorup-podium-' + g.seed + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      this.toast('📸 Podium disimpan sebagai PNG.', 'ok');
    } catch (e) { this.toast('Browser memblokir unduhan gambar.', 'err'); }
  },

  /* ---------------- karma ---------------- */
  karmaHTML(g) {
    const store = this.karmaStore;
    const others = g.players.filter(p => p.id !== this.humanId);
    return '<div class="karma"><h4>⭐ Reputation / Karma (PRD 3.10)</h4>' +
      '<p class="mut small">Rating hanya bisa diberikan setelah game selesai (anti-abuse). Tersimpan lokal di prototype.</p>' +
      '<div class="karma-list">' + others.map(p => {
        const cur = (store[p.name] && store[p.name].rating) || 0;
        return '<div class="krow"><span>' + tokenSVG(p.shape, p.color, false) + ' ' + Util.esc(p.name) + '</span>' +
          '<span class="stars" data-k="' + Util.esc(p.name) + '">' +
          [1, 2, 3, 4, 5].map(i => '<b data-v="' + i + '" class="' + (i <= cur ? 'on' : '') + '" role="button" aria-label="Rating ' + i + ' untuk ' + Util.esc(p.name) + '">★</b>').join('') + '</span>' +
          '<small>' + (cur ? cur + '/5' : 'belum') + '</small></div>';
      }).join('') + '</div>' +
      '<label class="krep"><input type="checkbox" id="kReport"> Laporkan rating tidak wajar / perilaku toxic</label>' +
      '</div>';
  },
  bindKarma() {
    const body = this.el.resultBody;
    body.querySelectorAll('.stars').forEach(s => {
      s.querySelectorAll('b').forEach(st => st.addEventListener('click', () => {
        const name = s.dataset.k, v = +st.dataset.v;
        this.karmaStore[name] = { rating: v, ts: Date.now(), game: this.game.seed };
        this.saveKarma();
        s.querySelectorAll('b').forEach(x => x.classList.toggle('on', +x.dataset.v <= v));
        s.parentElement.querySelector('small').textContent = v + '/5';
        Sound.ok();
        this.toast('⭐ Rating tersimpan untuk ' + Util.esc(name), 'ok');
      }));
    });
    const rep = body.querySelector('#kReport');
    if (rep) rep.addEventListener('change', () => { if (rep.checked) this.toast('🚩 Laporan masuk antrean review.', 'info'); });
  },
  loadKarma() { try { this.karmaStore = JSON.parse(Store.getLocal('cu_karma') || '{}'); } catch (e) { this.karmaStore = {}; } },
  saveKarma() { Store.setLocal('cu_karma', JSON.stringify(this.karmaStore)); },

  /* ---------------- layar ---------------- */
  showScreen(name) {
    ['screenLobby', 'screenGame', 'screenResults'].forEach(id =>
      this.el[id].classList.toggle('on', id === 'screen' + name[0].toUpperCase() + name.slice(1)));
    if (name === 'lobby') Sound.ambient('ambient-lobby');
    if (name === 'game') Sound.ambient('ambient-game');
    if (name === 'results') { Sound.stopAmbient(); setTimeout(() => this.bindKarma(), 60); }
  },
  toLobby() {
    this.loopToken++;
    this.loopRunning = false;
    this.tutorial = false;
    this.lastHuman = null;
    this.cancelTargeting();
    this.toggleDrawer(false);
    this.showScreen('lobby');
    if (this.game && this.game.state === 'playing') {
      this.game.addLog('sistem', '🚪 Kembali ke lobi (game dihentikan).');
      this.game.abandoned = true;
      this.game.state = 'over';
    }
    this.game = null;
    this.renderLobbySummary();
  },

  /* ---------------- Tutorial Sandbox (PRD 3.11) ---------------- */
  startTutorial() {
    this.lobbySize = 'mini';
    this.lobbyMode = 'ffa';
    this.lobbyPlayers = [
      { name: 'Kamu', isBot: false, shape: 'star' },
      { name: 'Tutor', isBot: true, botLevel: 0, shape: 'hex' }
    ];
    this.lobbyRules = Object.assign({}, DATA.DEFAULT_RULES, PRESETS.learn.rules);
    this.buildLobbyPlayers();
    this.startGame(true);
    const gid = this.game.players[1].id;
    this.drivers[gid] = new TutorBotDriver(this.game, gid);
    this.game.drivers[gid] = this.drivers[gid];
    this.game.tutorialMode = true;
    this.tutStep = 0;
    this.game.addLog('sistem', '🎓 <b>Tutorial Sandbox</b> dimulai — tanpa tekanan waktu; beberapa dadu di-script agar langkahnya jelas.');
    this.tutShow();
  },
  tutForceTile(idx, over) {
    const g = this.game;
    if (!g._savedTiles) g._savedTiles = {};
    if (!g._savedTiles[idx]) g._savedTiles[idx] = Object.assign({}, g.tiles[idx]);
    Object.assign(g.tiles[idx], over);
    this.renderTiles();
  },
  async tutStepRun(p) {
    if (!this.tutorial) return;
    if (p.id !== this.humanId) return;
    while (this.tutorial && this.tutStep < DATA.TUTORIAL_STEPS.length) {
      const st = DATA.TUTORIAL_STEPS[this.tutStep];
      if (st.setup) { try { st.setup(this.game, this); } catch (e) { console.warn('tut setup', e); } }
      this.tutShow();
      await this.tutWait(st);
      if (!this.tutorial) return;
      this.tutStep++;
      if (st.endTurn) return;
    }
    this.finishTutorial();
  },
  finishTutorial() {
    if (!this.tutorial) return;
    this.tutorial = false;
    this.el.guideBubble.classList.add('hidden');
    document.querySelectorAll('.guide-target').forEach(e => e.classList.remove('guide-target'));
    if (this.game) this.game.addLog('sistem', '🎓 Tutorial selesai — permainan bebas dilanjutkan.');
    this.toast('🎓 Tutorial selesai! Main bebas dimulai.', 'ok');
    this.confetti(20);
    this.render();
  },
  tutShow() {
    const st = DATA.TUTORIAL_STEPS[this.tutStep];
    if (!st) return;
    const b = this.el.guideBubble;
    b.classList.remove('hidden');
    this.el.guideText.innerHTML = '<h4>' + st.title + '</h4><p>' + st.text + '</p>' +
      '<div class="g-step">Langkah ' + (this.tutStep + 1) + ' / ' + DATA.TUTORIAL_STEPS.length + '</div>';
    document.querySelectorAll('.guide-target').forEach(e => e.classList.remove('guide-target'));
    if (st.target) {
      const t = document.querySelector(st.target);
      if (t) {
        t.classList.add('guide-target');
        if (t.closest && t.closest('#drawer')) this.toggleDrawer(true);
        try { t.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
      }
    }
  },
  tutWait(st) {
    return new Promise(res => {
      const finish = () => { this._tutRes = null; res(); };
      if (!st.waitClick) { this._tutRes = finish; return; }
      const sel = st.waitClick;
      const settle = async () => {
        if (st.until) {
          const t0 = Date.now();
          while (Date.now() - t0 < 12000) { if (st.until(this.game)) break; await Util.sleep(140); }
        } else await Util.sleep(280);
        finish();
      };
      const handler = e => {
        const t = e.target.closest(sel);
        if (!t) return;
        document.removeEventListener('click', handler, true);
        this._tutRes = () => { document.removeEventListener('click', handler, true); res(); };
        settle();
      };
      document.addEventListener('click', handler, true);
      this._tutRes = () => { document.removeEventListener('click', handler, true); res(); };
    });
  },
  tutNext() { if (this._tutRes) this._tutRes(); },
  tutSkip() {
    const wasOn = this.tutorial;
    this.tutorial = false;
    this.el.guideBubble.classList.add('hidden');
    document.querySelectorAll('.guide-target').forEach(e => e.classList.remove('guide-target'));
    if (this.game && wasOn) this.game.addLog('sistem', '🎓 Tutorial dilewati — permainan bebas dilanjutkan.');
    if (this._tutRes) { const f = this._tutRes; this._tutRes = null; f(); }
    this.toast('Tutorial dilewati. Main bebas dimulai!', 'ok');
    this.render();
  }
};

/* ============================================================
   Driver manusia
   ============================================================ */
class UIDriver {
  constructor(ui, pid) { this.ui = ui; this.pid = pid; this.game = null; this._end = null; this._timer = null; }
  get g() { return this.ui.game; }
  async turn() {
    if (this.ui.pendingEndTurn) { this.ui.pendingEndTurn = false; return; }
    await new Promise(res => {
      this._end = res;
      this._timer = setInterval(() => {
        const g = this.ui.game, p = g && g.p(this.pid);
        if (!g || g.state !== 'playing' || !p || p.out || p.ghost || g.cur !== p || p.takeover) {
          clearInterval(this._timer); this._timer = null; this._end = null; res();
        }
      }, 200);
    });
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }
  finishTurn() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    const f = this._end; this._end = null;
    if (f) f();
  }
  onDice() {}
  onState() { this.ui.render(); }

  chooseBuy(p, tile, price) {
    const g = this.g;
    const affordable = p.cash >= price;
    const setInfo = g.setProgress(p.id, tile.group);
    const html =
      '<div class="buy-card" style="--pc:' + tile.color + '">' +
      '<div class="bc-band"></div>' +
      '<h3>' + Util.esc(tile.name) + '</h3>' +
      '<div class="bc-row"><span>Harga</span><b>' + Util.money(price) + '</b></div>' +
      '<div class="bc-row"><span>Sewa dasar</span><b>' + Util.money(tile.rent) + '</b></div>' +
      '<div class="bc-row"><span>Biaya bangunan</span><b>' + Util.money(tile.houseCost) + '</b></div>' +
      '<div class="bc-row"><span>Set ' + Util.esc(tile.groupName) + '</span><b>' + setInfo.owned + '/' + setInfo.total + '</b></div>' +
      '<div class="bc-row"><span>Uangmu</span><b>' + Util.money(p.cash) + '</b></div>' +
      (g.wouldCompleteSet(p, tile) ? '<div class="bc-hint">Membeli ini melengkapi set ' + Util.esc(tile.groupName) + (g.rules.doubleRentFullSet ? ' → sewa ×2!' : '!') + '</div>' : '') +
      (g.inflation > 0 ? '<div class="bc-hint">Inflasi ' + Util.pct(g.inflation) + ' akan menaikkan sewa & biaya bangunan.</div>' : '') +
      '</div>';
    const opts = [{ label: '🛒 Beli (' + Util.money(price) + ')', value: 'buy', cls: 'primary' }];
    if (g.rules.auction) opts.push({ label: '🔨 Lelang', value: 'auction', cls: '' });
    opts.push({ label: 'Lewati', value: 'skip', cls: 'ghostbtn' });
    if (!affordable) opts[0].label = '🛒 Beli (uang kurang)';
    return this.ui.choose('Properti tersedia', html, opts);
  }

  async confirmRaiseCash(p, need, reason) {
    const g = this.g;
    const options = g.propsOf(p.id).filter(t => !t.mortgaged).map(t =>
      '<li>' + Util.esc(t.name) + ' — gadai +' + Util.money(Math.round(t.price * 0.5)) + (t.level ? ' (jual bangunan dulu)' : '') + '</li>').join('');
    const v = await this.ui.choose('Butuh likuiditas',
      '<p>Kurang <b>' + Util.money(need) + '</b> untuk: ' + Util.esc(reason || 'pembayaran') + '.</p>' +
      (g.rules.mortgage ? '<p class="mut">Aset yang bisa dilikuidasi:</p><ul class="small">' + (options || '<li class="mut">Tidak ada.</li>') + '</ul>' : '') +
      '<p>Lanjutkan gadai/jual otomatis, atau bangkrut' + (g.rules.ghost ? ' (lalu jadi Hantu)' : '') + '?</p>',
      [{ label: 'Likuidasi aset', value: 1, cls: 'primary' }, { label: 'Biarkan bangkrut', value: 0, cls: 'danger' }]);
    return !!v;
  }

  async decideTrade(from, to, offer, col) {
    const g = this.g;
    const fmt = o => {
      const bits = [];
      if (o.cash) bits.push('💵 ' + Util.money(o.cash));
      (o.props || []).forEach(i => bits.push('🏠 ' + Util.esc(g.tiles[i].name)));
      if (o.sabotage) bits.push('💣 ×' + o.sabotage);
      if (o.jailFree) bits.push('🎫 Bebas Penjara');
      return bits.length ? bits.join('<br>') : '<span class="mut">—</span>';
    };
    const va = g.valueOfAsset(to, offer.get), vb = g.valueOfAsset(to, offer.give);
    const v = await this.ui.choose('📨 Tawaran dari ' + Util.esc(from.name),
      '<div class="wz-cols"><div class="wz-block"><h5>' + Util.esc(from.name) + ' memberi</h5>' + fmt(offer.give) + '</div>' +
      '<div class="wz-block"><h5>Kamu memberi</h5>' + fmt(offer.get) + '</div></div>' +
      '<p class="mut small">Nilai: terima ≈ <b>' + Util.money(va) + '</b> · beri ≈ <b>' + Util.money(vb) + '</b></p>' +
      (col && col.score >= 2 ? '<div class="col-warn">🚩 Anti-collusion menandai trade ini (skor ' + col.score + '/3).</div>' : ''),
      [{ label: 'Tolak', value: 0, cls: 'ghostbtn' }, { label: 'Terima', value: 1, cls: 'primary' }]);
    return !!v;
  }
}

/* ============================================================
   Driver lelang
   ============================================================ */
class AuctionDriver {
  constructor(ui) { this.ui = ui; this.game = null; }
  get g() { return this.ui.game; }

  async runAuction(tile, bidders, trigger) {
    const g = this.g;
    if (!g) return null;
    const state = bidders.map(p => ({ p, out: false }));
    let current = Math.max(1, Math.round(tile.price * 0.5));
    let leader = null;
    let guard = 0;
    while (guard++ < 24) {
      const active = state.filter(s => !s.out);
      if (active.length <= (leader ? 1 : 0)) break;
      let progressed = false;
      for (const s of active) {
        if (leader && s.p === leader.p) continue;
        let res;
        if (s.p.isBot) {
          const d = g.drivers[s.p.id];
          res = (d && d.bid) ? await d.bid(tile, current) : { bid: null, drop: true };
        } else if (s.p.takeover) {
          res = await this.ui.ensureTakeoverBot(s.p).bid(tile, current);
        } else {
          res = await this.humanBid(s.p, tile, current);
        }
        if (res.drop || !res.bid) { s.out = true; continue; }
        if (res.bid > current) {
          current = res.bid; leader = { p: s.p, bid: current };
          progressed = true;
          this.ui.toast('🔨 ' + Util.esc(leader.p.name) + ' memimpin lelang ' + Util.esc(tile.name) + ' @ ' + Util.money(current), 'info');
        }
      }
      if (!progressed) break;
    }
    if (!leader) { g.addLog('lelang', '🔨 Tidak ada penawaran untuk ' + Util.esc(tile.name) + ' — kembali ke bank.'); return null; }
    let price = leader.bid;
    if (g.hasPower(leader.p, 'negotiator')) {
      const disc = Math.round(price * 0.1);
      price -= disc;
      g.addLog('power', '🤝 <b>Negosiator</b>: diskon lelang ' + Util.money(disc) + '.');
    }
    leader.p.cash -= price;
    tile.ownerId = leader.p.id; tile.level = 0; tile.mortgaged = false;
    if (leader.p.properties.indexOf(tile.idx) === -1) leader.p.properties.push(tile.idx);
    g.addLog('lelang', '🔨 <b>' + Util.esc(leader.p.name) + '</b> memenangkan lelang ' + Util.esc(tile.name) + ' seharga ' + Util.money(price) + '.');
    this.ui.modalLock = false;
    this.ui.closeOverlay();
    this.ui.render();
    return leader.p;
  }

  humanBid(p, tile, current) {
    if (p.isBot || p.takeover || p.ghost) return Promise.resolve({ bid: null, drop: true });
    const max = Math.min(p.cash - 20, Math.round(tile.price * 1.1));
    return this.ui.choose('🔨 Lelang: ' + Util.esc(tile.name),
      '<p>Harga saat ini <b>' + Util.money(current) + '</b> · nilai pasar ' + Util.money(tile.price) + ' · uangmu ' + Util.money(p.cash) + '</p>',
      [
        { label: 'Bid ' + Util.money(current + 10), value: current + 10, cls: 'primary' },
        { label: 'Bid ' + Util.money(Math.min(max, current + 50)), value: Math.min(max, current + 50), cls: '' },
        { label: 'Pass', value: null, cls: 'ghostbtn' }
      ]).then(v => (v == null ? { bid: null, drop: true } : { bid: v, drop: false }));
  }
}

/* ---------------- keyboard ---------------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (UI.targeting) return UI.cancelTargeting();
    if (UI.drawerOpen) return UI.toggleDrawer(false);
    UI.el.tilePanel.classList.add('hidden');
    if (!UI.modalLock) UI.closeOverlay();
    return;
  }
  if (UI.targeting && e.key === 'Enter') {
    const t = document.activeElement;
    if (t && t.classList && t.classList.contains('valid')) {
      UI.confirmSabotage(+t.dataset.idx);
      e.preventDefault();
    }
    return;
  }
  if (!UI.game || UI.game.state !== 'playing') return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') {
    if (UI.targeting || UI.drawerOpen) return;
    e.preventDefault();
    const hm = UI.activeHuman();
    if (!hm) return;
    const a = UI.game.allowedActions(hm.id);
    if (a.roll) UI.humanRoll();
    else if (a.end) UI.humanEnd();
  }
  if (k === 't') UI.openTrade();
  if (k === 's') UI.startTargeting();
  if (k === 'l') UI.openLog();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UI, UIDriver, AuctionDriver, Store, PRESETS, tokenSVG, diceFace, glyphSVG };
}

/* ============================================================
   ColorUp.io — game.js
   File 4/7 · ENGINE
   simulasi + audit log), properti, sewa, upgrade, mortgage,
   Mega Property (merging), kartu, sabotase, cuaca, inflasi,
   ghost comeback, co-op/tim, trade + anti-collusion, nemesis,
   penjara, lelang, kebangkrutan, dan kondisi menang.
   Engine tidak menyentuh DOM: semua interaksi lewat "driver".
   ============================================================ */
'use strict';

class Game {
  /**
   * @param {Object} cfg
   *   cfg.players  : [{id,name,isBot,color,shape,team?,power?}]
   *   cfg.size     : 'mini'|'classic'|'epic'
   *   cfg.mode     : 'ffa'|'coop'
   *   cfg.rules    : partial rules (merge dengan DATA.DEFAULT_RULES)
   *   cfg.seed     : seed string (audit)
   *   cfg.drivers  : {playerId: driver}  driver = UI manusia atau BotDriver
   *   cfg.hooks    : {onLog,onState,onGameOver,onDice,onEvent}
   */
  constructor(cfg) {
    cfg = cfg || {};
    this.cfg = cfg;
    this.rules = Object.assign({}, DATA.DEFAULT_RULES, cfg.rules || {});
    this.mode = cfg.mode || 'ffa';
    this.size = cfg.size || 'classic';
    this.seed = cfg.seed || ('CU-' + Util.uid());
    this.drivers = cfg.drivers || {};
    this.hooks = cfg.hooks || {};

    // PRD 3.12 — "server-side dice": seed disimpan & tiap lemparan diaudit
    this.rnd = Util.rng(Util.hash(this.seed));
    this.rollCount = 0;
    this.audit = [];
    this.auditCount = 0;      // total lemparan teraudit (audit array = ring buffer)
    this.auditCap = 2000;

    const board = BoardGen.build(this.size, this.seed);
    this.tiles = board.tiles;
    this.side = board.side;
    this.groupKeys = board.groups;

    this.state = 'lobby';            // lobby | playing | over
    this.phase = 'idle';             // idle | roll | moved | resolve | end | auction | over
    this.round = 1;
    this.turnIndex = 0;
    this.turnPlayerId = null;
    this.treasury = 0;
    this.inflation = 0;
    this.inflationTicks = 0;
    this.weather = DATA.WEATHER[0];
    this.weatherRoundsLeft = this.rules.weatherEvery;
    this.log = [];
    this.logSeq = 0;
    this.pendingAuction = null;
    this.megaSeq = 0;
    this.winners = [];
    this.scriptedRoll = null;        // dipakai tutorial sandbox
    this.fastMode = !!cfg.fast;

    // ---- pemain ----
    this.players = (cfg.players || []).map((p, i) => this.mkPlayer(p, i));
    const order = this.players.map(p => p.id);
    if (this.rules.randomizeOrder) this.order = Util.shuffle(this.rnd, order);
    else this.order = order;

    // ---- PRD 3.8 kekuatan asimetris (unik, tidak menumpuk) ----
    const powers = Util.shuffle(this.rnd, DATA.POWERS);
    this.players.forEach((p, i) => {
      p.power = this.rules.powers
        ? (p.power || powers[i % powers.length].key)
        : null;
    });
    // power gratis di awal untuk Sabotase Master
    this.players.forEach(p => {
      if (this.rules.sabotage && p.power === 'saboteur') p.sabotageCards = 1;
    });

    if (this.mode === 'coop') this.assignTeams();

    this.addLog('sistem', '🎲 Seed game <b>' + Util.esc(this.seed) + '</b> — semua dadu diaudit (PRD 3.12).');
    this.addLog('sistem', 'Papan <b>' + DATA.SIZES[this.size].label + '</b> (' + this.tiles.length + ' tile), mode <b>' + DATA.MODES[this.mode].label + '</b>.');
    if (this.rules.powers) this.players.forEach(p => {
      const pw = this.powerInfo(p);
      if (pw) this.addLog('power', pw.icon + ' <b>' + p.name + '</b> mendapat kekuatan <b>' + pw.name + '</b> — ' + pw.desc);
    });
  }

  /* =========================================================
     Setup pemain & tim
     ========================================================= */
  mkPlayer(src, i) {
    const tc = DATA.TOKEN_COLORS[i % DATA.TOKEN_COLORS.length];
    return {
      id: src.id || ('p' + i),
      name: src.name || ('Pemain ' + (i + 1)),
      isBot: !!src.isBot,
      botLevel: src.botLevel || 1,
      color: src.color || tc.color,
      colorKey: src.colorKey || tc.key,
      shape: src.shape || DATA.TOKEN_SHAPES[i % DATA.TOKEN_SHAPES.length],
      team: src.team || null,
      power: src.power || null,

      pos: 0, cash: this.rules.startingCash,
      jail: false, jailTurns: 0, jailFreeCards: 0,
      bankrupt: false, ghost: false, out: false,
      connected: true, disconnectedAt: null, takeover: false, afk: false,

      doubles: 0, extraTurn: false, rolledThisTurn: false,
      lastRoll: null, lastSteps: 0,

      properties: [],
      sabotageCards: 0, sabotageCooldown: 0,
      taxShield: 0, doubleNextRent: false,
      megaBoost: 0, megaBoostRounds: 0,
      firstUpgradeUsed: {},          // tileId -> bool (untuk power Arsitek)
      effects: [],                   // efek sementara

      netWorthPeak: this.rules.startingCash,
      netWorthHistory: [{ round: 0, netWorth: this.rules.startingCash }],   // PRD v2.1 A.14
      rentPaid: {}, rentReceived: {}, rentTo: {}, rentFrom: {},
      steals: 0, stealsTotal: 0, trades: 0, builds: 0, roundsPlayed: 0,
      karmaGiven: false, placement: 0, finishOrder: 0
    };
  }

  assignTeams() {
    const active = this.players.filter(p => !p.out);
    const teamSize = active.length >= 6 ? 3 : 2;
    active.forEach((p, i) => { p.team = 'T' + (Math.floor(i / teamSize) + 1); });
    this.teams = Array.from(new Set(active.map(p => p.team)));
  }

  /* =========================================================
     Util engine
     ========================================================= */
  p(id) { return this.players.find(x => x.id === id); }
  tile(i) { return this.tiles[((i % this.tiles.length) + this.tiles.length) % this.tiles.length]; }
  get cur() { return this.p(this.turnPlayerId); }
  /** Driver default: dipakai bila slot tidak punya driver (headless/embedded).
      Menjamin engine tidak pernah crash karena method driver hilang. */
  makeDefaultDriver() {
    const g = this;
    return {
      game: g,
      async turn() {},
      async prompt() { return null; },
      async chooseBuy(p, t, price) { return (p.cash >= price * 1.2) ? 'buy' : (g.rules.auction ? 'auction' : 'skip'); },
      async confirmRaiseCash() { return true; },
      async decideTrade() { return false; },
      async bid() { return { bid: null, drop: true }; }
    };
  }
  driver(pid) {
    const d = this.drivers[pid];
    if (d) return d;
    if (!this._defDriver) this._defDriver = this.makeDefaultDriver();
    return this._defDriver;
  }
  delay(ms) { return this.fastMode ? Util.sleep(Math.min(ms, 60)) : Util.sleep(ms); }

  alive() { return this.players.filter(p => !p.bankrupt); }
  ghosts() { return this.players.filter(p => p.ghost); }
  activePlayers() { return this.players.filter(p => !p.out); }
  teamOf(pid) { const p = this.p(pid); return p ? p.team : null; }
  sameTeam(a, b) { return this.mode === 'coop' && a && b && a === b; }

  powerInfo(p) { return p && p.power ? DATA.POWERS.find(x => x.key === p.power) : null; }
  hasPower(p, key) { return this.rules.powers && p && p.power === key; }

  /** Koefisien cuaca untuk pemain (power Pengamat Cuaca = efek negatif setengah) */
  weatherMod(p, key, signed) {
    if (!this.rules.weather) return 0;
    let v = this.weather.mods[key];
    if (typeof v !== 'number') return 0;
    if (signed && v < 0 && this.hasPower(p, 'weatherwise')) v = v / 2;
    return v;
  }
  weatherFlag(key) { return this.rules.weather && !!this.weather.mods[key]; }

  /** Inflasi: pengali harga (sewa, pajak, bangunan) */
  get inflationMult() { return 1 + this.inflation; }

  ownerOf(idx) {
    const t = this.tiles[idx];
    if (!t || t.type !== 'property') return null;
    return t.ownerId ? this.p(t.ownerId) : null;
  }
  propsOf(pid) { return this.tiles.filter(t => t.type === 'property' && t.ownerId === pid); }
  groupTiles(gkey) { return this.tiles.filter(t => t.type === 'property' && t.group === gkey); }
  ownsFullSet(pid, gkey) {
    const list = this.groupTiles(gkey);
    return list.length > 0 && list.every(t => t.ownerId === pid);
  }
  setProgress(pid, gkey) {
    const list = this.groupTiles(gkey);
    return { owned: list.filter(t => t.ownerId === pid).length, total: list.length };
  }

  /* =========================================================
     PRD 3.11 — Action History Log (+ audit dadu)
     ========================================================= */
  addLog(kind, text, meta) {
    const entry = {
      n: ++this.logSeq, round: this.round, kind: kind || 'info',
      text: text, time: new Date().toISOString(), meta: meta || null
    };
    this.log.push(entry);
    if (this.log.length > 800) this.log.splice(0, this.log.length - 800);
    if (this.hooks.onLog) this.hooks.onLog(entry, this);
    return entry;
  }
  auditDice(entry) {
    this.auditCount++;
    this.audit.push(entry);
    if (this.audit.length > this.auditCap) this.audit.shift();
    if (this.hooks.onAudit) this.hooks.onAudit(entry, this);
  }
  exportLog() {
    const head = [
      '# ColorUp.io — Action History Export',
      'seed: ' + this.seed,
      'board: ' + this.size + ' (' + this.tiles.length + ' tiles)',
      'mode: ' + this.mode,
      'rounds: ' + this.round,
      'generated: ' + new Date().toISOString(),
      '', '## Events', ''
    ];
    const body = this.log.map(l =>
      `[R${l.round}][#${l.n}][${l.kind}] ${l.text.replace(/<[^>]+>/g, '')}`);
    const audit = ['', '## Dice Audit (server-side RNG)', ''].concat(
      this.audit.map(a => `#${a.n} round=${a.round} player=${a.player} seed=${a.seed} dice=${a.dice.join('+')} steps=${a.steps}${a.scripted ? ' (scripted/tutorial)' : ''}`)
    );
    return head.concat(body).concat(audit).join('\n');
  }

  /* =========================================================
     PRD 3.12 — Server-side dice rolling (simulasi + audit)
     ========================================================= */
  rollDice(player) {
    this.rollCount++;
    const scripted = this.scriptedRoll ? this.scriptedRoll.slice() : null;
    const dice = scripted ? [scripted[0], scripted[1]]
      : [1 + Math.floor(this.rnd() * 6), 1 + Math.floor(this.rnd() * 6)];
    if (scripted) this.scriptedRoll = null;
    const entry = {
      n: this.rollCount, round: this.round, player: player ? player.id : '-',
      seed: this.seed, nonce: this.rollCount, dice, steps: dice[0] + dice[1],
      scripted: !!scripted, ts: Date.now(),
      sig: 'sha256:' + Util.hash(this.seed + '|' + this.rollCount + '|' + dice.join('')).toString(16)
    };
    this.auditDice(entry);
    return entry;
  }

  /* =========================================================
     Alur giliran
     ========================================================= */
  start() {
    this.state = 'playing';
    this.turnIndex = 0;
    this.turnPlayerId = this.order[0];
    this.addLog('sistem', '🚩 Game dimulai! Giliran pertama: <b>' + Util.esc(this.cur.name) + '</b>.');
    this.beginTurn();
    if (this.hooks.onState) this.hooks.onState(this);
  }

  beginTurn() {
    const p = this.cur;
    if (!p) return;
    p.roundsPlayed++;
    this.phase = 'roll';
    p.rolledThisTurn = false;
    p.doubles = 0;
    if (p.sabotageCooldown > 0) p.sabotageCooldown--;
    if (p.megaBoostRounds > 0 && --p.megaBoostRounds === 0) {
      p.megaBoost = 0;
      this.addLog('kartu', '🏰 Bonus Mega Property <b>' + Util.esc(p.name) + '</b> berakhir.');
    }
    if (this.hooks.onState) this.hooks.onState(this);
  }

  /** Dadu dilempar → gerak → resolve tile. */
  async actRoll(forced) {
    const p = this.cur;
    if (!p || this.phase !== 'roll') return false;
    const audit = forced
      ? { n: ++this.rollCount, round: this.round, player: p.id, seed: this.seed, nonce: this.rollCount, dice: forced, steps: forced[0] + forced[1], scripted: true, ts: Date.now(), sig: 'forced' }
      : this.rollDice(p);
    if (forced) this.auditDice(audit);

    p.lastRoll = audit.dice;
    p.rolledThisTurn = true;
    const dbl = audit.dice[0] === audit.dice[1];

    // penjara: butuh dadu kembar untuk keluar
    if (p.jail) {
      p.jailTurns--;
      if (dbl) {
        p.jail = false;
        this.addLog('gerak', '🔓 <b>' + Util.esc(p.name) + '</b> melempar dadu kembar (' + audit.dice.join('-') + ') dan bebas dari penjara!');
      } else if (p.jailTurns <= 0) {
        p.jail = false;
        this.pay(p, null, this.rules.jailFine, 'Denda penjara (batas ronde habis)');
        this.addLog('penjara', '⛓️ <b>' + Util.esc(p.name) + '</b> membayar denda ' + Util.money(this.rules.jailFine) + ' dan bebas.');
      } else {
        this.addLog('penjara', '🚔 <b>' + Util.esc(p.name) + '</b> gagal keluar penjara (' + audit.dice.join('-') + '), sisa ' + p.jailTurns + ' ronde.');
        this.phase = 'end';
        if (this.hooks.onDice) this.hooks.onDice(audit, p);
        return true;
      }
    }

    if (this.hooks.onDice) this.hooks.onDice(audit, p);

    let steps = audit.steps;
    const fog = this.weatherMod(p, 'move', false);
    if (fog) {
      steps += fog;
      this.addLog('cuaca', '🌫️ Kabut mendorong <b>' + Util.esc(p.name) + '</b> +' + fog + ' langkah.');
    }
    if (dbl && this.hasPower(p, 'sprinter')) {
      steps += 1;
      this.addLog('power', '⚡ <b>Sprinter</b>: ' + Util.esc(p.name) + ' mendapat +1 langkah saat dadu kembar.');
    }
    p.lastSteps = steps;
    await this.move(p, steps, true);

    if (!p.out) await this.resolveTile(p);

    if (p.out) { this.phase = 'end'; return true; }

    if (dbl && !p.jail && !p.out) {
      p.doubles++;
      if (p.doubles >= 3) {
        this.sendToJail(p, 'tiga kali dadu kembar');
        this.phase = 'end';
      } else {
        p.extraTurn = true;
        this.phase = 'roll';
        this.addLog('gerak', '🎲 Dadu kembar! <b>' + Util.esc(p.name) + '</b> melempar lagi (beruntun ' + p.doubles + ').');
      }
    } else if (!p.out) {
      this.phase = 'end';
    }
    if (this.hooks.onState) this.hooks.onState(this);
    return true;
  }

  async move(p, steps, countPass) {
    const n = this.tiles.length;
    for (let i = 0; i < steps; i++) {
      p.pos = (p.pos + 1) % n;
      if (countPass && p.pos === 0) this.onPassStart(p);
      if (this.hooks.onStep) this.hooks.onStep(p, i, steps);
      await this.delay(this.fastMode ? 12 : 55);
    }
    if (this.hooks.onMove) this.hooks.onMove(p);
  }

  moveTo(p, idx, collect) {
    const n = this.tiles.length;
    if (collect && idx < p.pos) this.onPassStart(p);
    p.pos = ((idx % n) + n) % n;
    if (this.hooks.onMove) this.hooks.onMove(p);
  }

  onPassStart(p) {
    let amount = 200;
    if (this.hasPower(p, 'saver')) amount += 50;
    amount += this.weatherMod(p, 'start', false);
    p.cash += amount;
    this.addLog('uang', '🏁 <b>' + Util.esc(p.name) + '</b> melewati START dan menerima ' + Util.money(amount) + '.');
  }

  /* =========================================================
     Tile resolution
     ========================================================= */
  async resolveTile(p) {
    const t = this.tile(p.pos);
    this.phase = 'resolve';
    if (this.hooks.onState) this.hooks.onState(this);

    switch (t.type) {
      case 'start':
        this.addLog('gerak', '🏁 <b>' + Util.esc(p.name) + '</b> mendarat di START.');
        break;

      case 'gotojail':
        this.sendToJail(p, 'mendarat di tile Ke Penjara');
        break;

      case 'jail':
        this.addLog('gerak', '👀 <b>' + Util.esc(p.name) + '</b> hanya berkunjung ke Penjara.');
        break;

      case 'vacation': {
        if (!this.rules.vacationCash) { this.addLog('gerak', '🏖️ <b>' + Util.esc(p.name) + '</b> berlibur (tanpa efek).'); break; }
        const take = Math.min(300, Math.max(50, Math.floor(this.treasury * 0.5)));
        this.treasury = Math.max(0, this.treasury - take);
        p.cash += take;
        this.addLog('uang', '🏖️ <b>' + Util.esc(p.name) + '</b> menikmati Vacation Cash ' + Util.money(take) + ' dari treasury (sisa ' + Util.money(this.treasury) + ').');
        break;
      }

      case 'tax': {
        let amt = Math.round(t.amount * this.inflationMult);
        if (this.hasPower(p, 'taxman')) {
          const before = amt; amt = Math.round(amt * 0.9);
          this.addLog('power', '🧾 <b>Si Hemat Pajak</b> memotong pajak ' + Util.esc(p.name) + ' ' + Util.money(before - amt) + '.');
        }
        if (p.taxShield > 0) {
          p.taxShield--; amt = 0;
          this.addLog('kartu', '🛡️ Perisai Pajak menyerap pajak <b>' + Util.esc(p.name) + '</b>.');
        }
        if (amt > 0) {
          this.pay(p, null, amt, 'Pajak Warna (' + t.name + ')', 'tax');
          this.treasury += amt;
        }
        this.addLog('pajak', '💸 <b>' + Util.esc(p.name) + '</b> membayar pajak ' + Util.money(amt) + (this.inflation > 0 ? ' (sudah termasuk inflasi ' + Util.pct(this.inflation) + ')' : '') + '.');
        break;
      }

      case 'chance': {
        if (this.weatherFlag('meteor')) {
          const bonus = 80;
          p.cash += bonus;
          this.addLog('cuaca', '☄️ Hujan Meteor menghantam tile Surprise — <b>' + Util.esc(p.name) + '</b> mendapat ' + Util.money(bonus) + '!');
        }
        await this.drawCard(p);
        break;
      }

      case 'property':
        await this.resolveProperty(p, t);
        break;

      default:
        this.addLog('gerak', '• <b>' + Util.esc(p.name) + '</b> mendarat di ' + Util.esc(t.name || t.type) + '.');
    }
  }

  async resolveProperty(p, t) {
    const owner = t.ownerId ? this.p(t.ownerId) : null;

    if (!owner) {
      if (this.weatherFlag('meteor')) {
        const bonus = 60;
        p.cash += bonus;
        this.addLog('cuaca', '☄️ Hujan Meteor di properti kosong — <b>' + Util.esc(p.name) + '</b> memungut ' + Util.money(bonus) + '.');
      }
      if (p.ghost) { this.addLog('hantu', '👻 Hantu tidak dapat membeli properti.'); return; }

      const price = this.buyPrice(p, t);
      this.pendingBuy = { playerId: p.id, tileIdx: t.idx, price };
      if (this.hooks.onState) this.hooks.onState(this);
      const choice = await this.driver(p.id).chooseBuy(p, t, price);
      this.pendingBuy = null;
      if (this.hooks.onState) this.hooks.onState(this);
      if (choice === 'buy') this.buyProperty(p, t);
      else if (choice === 'auction' && this.rules.auction) await this.runAuction(t, p);
      else this.addLog('properti', '↩️ <b>' + Util.esc(p.name) + '</b> melewatkan ' + Util.esc(t.name) + '.');
      return;
    }

    if (owner.id === p.id) {
      this.addLog('properti', '🏠 <b>' + Util.esc(p.name) + '</b> mendarat di propertinya sendiri, ' + Util.esc(t.name) + '.');
      return;
    }
    if (this.sameTeam(owner.team, p.team)) {
      this.addLog('tim', '🤝 <b>' + Util.esc(p.name) + '</b> mendarat di properti rekan tim — sewa dibebaskan (co-op).');
      return;
    }
    if (t.mortgaged) {
      this.addLog('properti', '📄 ' + Util.esc(t.name) + ' sedang digadaikan — tidak ada sewa.');
      return;
    }
    if (owner.jail && this.rules.noRentInPrison) {
      this.addLog('penjara', '🚔 ' + Util.esc(owner.name) + ' di penjara, sewa ' + Util.esc(t.name) + ' tidak ditagih.');
      return;
    }
    if (owner.ghost) { this.addLog('hantu', '👻 Hantu tidak dapat menagih sewa.'); return; }

    const rent = this.calcRent(owner, t);
    this.addLog('sewa', '🏷️ <b>' + Util.esc(p.name) + '</b> membayar sewa ' + Util.money(rent.amount) + ' ke <b>' + Util.esc(owner.name) + '</b> untuk ' + Util.esc(t.name) + rent.note);
    this.pay(p, owner, rent.amount, 'Sewa ' + t.name, 'rent');
    this.trackRent(p, owner, rent.amount);
  }

  buyPrice(p, t) {
    let price = t.price;
    if (this.hasPower(p, 'negotiator')) price = Math.round(price * 0.95);
    return price;
  }

  buyProperty(p, t) {
    const price = this.buyPrice(p, t);
    if (p.cash < price) { this.addLog('properti', '⚠️ Uang <b>' + Util.esc(p.name) + '</b> tidak cukup untuk ' + Util.esc(t.name) + '.'); return false; }
    p.cash -= price;
    t.ownerId = p.id;
    t.level = 0; t.mortgaged = false; t.mega = null;
    p.properties.push(t.idx);
    this.addLog('properti', '🛒 <b>' + Util.esc(p.name) + '</b> membeli <b>' + Util.esc(t.name) + '</b> seharga ' + Util.money(price) + '.');
    if (this.ownsFullSet(p.id, t.group)) {
      this.addLog('set', '🌈 <b>' + Util.esc(p.name) + '</b> melengkapi set ' + Util.esc(t.groupName) + (this.rules.doubleRentFullSet ? ' — sewa x2!' : '!'));
    }
    if (this.hooks.onState) this.hooks.onState(this);
    return true;
  }

  /* --------- Sewa --------- */
  calcRent(owner, t) {
    let base = t.rent;
    const notes = [];
    if (t.mega) {
      base = t.mega.baseRent * (1 + t.mega.bonus);
      notes.push(' (Mega Property +' + Util.pct(t.mega.bonus) + ')');
      base *= Math.pow(2, t.level);
    } else if (t.level > 0) {
      base = t.rent * Math.pow(2, t.level);
      notes.push(' (lvl ' + t.level + ')');
    } else if (this.rules.doubleRentFullSet && this.ownsFullSet(owner.id, t.group)) {
      base *= 2;
      notes.push(' (set penuh x2)');
    }
    if (owner.doubleNextRent) {
      base *= 2; owner.doubleNextRent = false;
      notes.push(' (Kontrak Premium x2)');
    }
    if (owner.megaBoost > 0) { base *= (1 + owner.megaBoost); notes.push(' (Mega Boost +' + Util.pct(owner.megaBoost) + ')'); }

    const storm = this.weatherMod(owner, 'rent', true);
    if (storm) { base *= (1 + storm); notes.push(' (cuaca ' + Util.pct(storm) + ')'); }
    base *= this.inflationMult;
    if (this.inflation > 0) notes.push(' (inflasi +' + Util.pct(this.inflation) + ')');

    let amount = Math.max(1, Math.round(base));
    if (this.hasPower(owner, 'magnate')) { amount = Math.round(amount * 1.1); notes.push(' (Magnat +10%)'); }
    return { amount, note: notes.join('') };
  }

  /* --------- PRD 3.10 Nemesis tracking --------- */
  trackRent(from, to, amount) {
    from.rentPaid[to.id] = (from.rentPaid[to.id] || 0) + amount;
    to.rentReceived[from.id] = (to.rentReceived[from.id] || 0) + amount;
    from.rentTo[to.id] = (from.rentTo[to.id] || 0) + amount;
    to.rentFrom[from.id] = (to.rentFrom[from.id] || 0) + amount;
    this.updateNemesis();
  }

  updateNemesis() {
    let best = null;
    for (const a of this.players) {
      for (const b of this.players) {
        if (a.id === b.id) continue;
        const total = (a.rentTo[b.id] || 0) + (b.rentTo[a.id] || 0);
        if (total >= 200 && (!best || total > best.total)) best = { a: a.id, b: b.id, total };
      }
    }
    const prev = this.nemesis;
    this.nemesis = best;
    if (best && (!prev || prev.a !== best.a || prev.b !== best.b)) {
      this.addLog('nemesis', '⚔️ <b>Rivalitas terpanas</b>: ' + Util.esc(this.p(best.a).name) + ' vs ' + Util.esc(this.p(best.b).name) + ' (total sewa ' + Util.money(best.total) + ').');
    }
  }

  /* --------- Pembayaran, mortgage paksa, kebangkrutan --------- */
  async pay(from, to, amount, reason, kind) {
    amount = Math.max(0, Math.round(amount));
    if (amount === 0) return true;
    if (kind === 'tax' && this.hasPower(from, 'taxman')) { /* sudah dipotong di pemanggil */ }
    if (kind === 'rent' && this.hasPower(from, 'shield')) {
      const before = amount; amount = Math.round(amount * 0.9);
      this.addLog('power', '🛡️ <b>Perisai Sewa</b> mengurangi pembayaran ' + Util.esc(from.name) + ' sebesar ' + Util.money(before - amount) + '.');
    }
    if (from.cash < amount) await this.raiseCash(from, amount - from.cash, reason);
    const paid = Math.min(amount, from.cash);
    from.cash -= paid;
    if (to) { to.cash += paid; } else { /* ke bank / treasury sudah dicatat pemanggil */ }
    if (paid < amount) {
      this.addLog('bangkrut', '💥 <b>' + Util.esc(from.name) + '</b> tidak sanggup membayar ' + Util.money(amount) + ' (' + Util.esc(reason || '') + ') — hanya ' + Util.money(paid) + '.');
      this.bankrupt(from, to, reason);
      return false;
    }
    this.addLog('uang', '💵 <b>' + Util.esc(from.name) + '</b> membayar ' + Util.money(paid) + (to ? ' ke <b>' + Util.esc(to.name) + '</b>' : ' ke bank') + ' — ' + Util.esc(reason || '') + '.');
    return true;
  }

  async raiseCash(p, need, reason) {
    if (need <= 0 || p.ghost) return;
    const target = p.cash + need;
    const canMortgage = this.rules.mortgage && this.propsOf(p.id).some(t => !t.mortgaged);
    if (!canMortgage && !this.propsOf(p.id).some(t => t.level > 0)) return;
    this.addLog('sistem', '🏦 <b>' + Util.esc(p.name) + '</b> kekurangan ' + Util.money(need) + ' — sistem menawarkan likuidasi aset (gadai / jual bangunan).');
    const ok = await this.driver(p.id).confirmRaiseCash(p, need, reason);
    if (!ok) return;

    let guard = 0;
    // 1) jual bangunan dulu (kerugian lebih kecil)
    while (p.cash < target && guard++ < 80) {
      const cand = this.propsOf(p.id).filter(t => t.level > 0 && !t.mega).sort((a, b) => a.level - b.level)[0];
      if (!cand) break;
      this.sellBuilding(p, cand.idx, true);
    }
    // 2) gadai properti termurah
    guard = 0;
    while (this.rules.mortgage && p.cash < target && guard++ < 80) {
      const cand = this.propsOf(p.id).filter(t => !t.mortgaged && t.level === 0 && !t.mega)
        .sort((a, b) => a.price - b.price)[0];
      if (!cand) break;
      this.mortgage(p, cand.idx, true);
    }
  }

  mortgage(p, idx, auto) {
    if (!this.rules.mortgage) { this.addLog('sistem', 'Mortgage dinonaktifkan di room ini.'); return false; }
    const t = this.tiles[idx];
    if (!t || t.type !== 'property' || t.ownerId !== p.id) return false;
    if (t.mortgaged) return false;
    if (t.level > 0) { this.addLog('sistem', '⚠️ Jual dulu bangunan di ' + Util.esc(t.name) + ' sebelum menggadaikan.'); return false; }
    if (t.mega) { this.addLog('sistem', '⚠️ Mega Property harus dipisahkan sebelum digadaikan.'); return false; }
    const cash = Math.round(t.price * 0.5);
    t.mortgaged = true; p.cash += cash;
    this.addLog('gadai', '📄 <b>' + Util.esc(p.name) + '</b> menggadaikan ' + Util.esc(t.name) + ' → +' + Util.money(cash) + (auto ? ' (otomatis)' : '') + '.');
    if (this.hooks.onState) this.hooks.onState(this);
    return true;
  }

  unmortgage(p, idx) {
    const t = this.tiles[idx];
    if (!t || t.ownerId !== p.id || !t.mortgaged) return false;
    const cost = Math.round(t.price * 0.55 * this.inflationMult);
    if (p.cash < cost) { this.addLog('sistem', '⚠️ Butuh ' + Util.money(cost) + ' untuk menebus ' + Util.esc(t.name) + '.'); return false; }
    p.cash -= cost; t.mortgaged = false;
    this.addLog('gadai', '✅ <b>' + Util.esc(p.name) + '</b> menebus ' + Util.esc(t.name) + ' (' + Util.money(cost) + ').');
    if (this.hooks.onState) this.hooks.onState(this);
    return true;
  }

  /* --------- Bangunan / upgrade --------- */
  canBuild(p, idx) {
    const t = this.tiles[idx];
    if (!t || t.type !== 'property' || t.ownerId !== p.id || t.mortgaged) return { ok: false, why: 'Bukan propertimu atau sedang digadaikan.' };
    if (this.weatherFlag('noBuild')) return { ok: false, why: '❄️ Badai Salju: pembangunan dibekukan.' };
    if (t.level >= 5) return { ok: false, why: 'Sudah tingkat maksimum (Hotel).' };
    if (t.mega) return { ok: true, cost: this.buildCost(p, t) };
    if (!this.ownsFullSet(p.id, t.group)) return { ok: false, why: 'Kumpulkan seluruh set ' + t.groupName + ' dulu.' };
    if (this.rules.evenBuild) {
      const min = Math.min.apply(null, this.groupTiles(t.group).map(x => x.level));
      if (t.level > min) return { ok: false, why: 'Even Build: bangun tile lain di set ini dulu.' };
    }
    return { ok: true, cost: this.buildCost(p, t) };
  }

  buildCost(p, t) {
    let cost = t.houseCost * this.inflationMult;
    if (this.weatherMod(p, 'build', true)) cost *= (1 + this.weatherMod(p, 'build', true));
    if (this.hasPower(p, 'architect') && !p.firstUpgradeUsed[t.id]) cost *= 0.75;
    return Math.max(10, Math.round(cost));
  }

  build(p, idx) {
    const t = this.tiles[idx];
    const chk = this.canBuild(p, idx);
    if (!chk.ok) { this.addLog('sistem', '🚫 ' + chk.why); return false; }
    if (p.cash < chk.cost) { this.addLog('sistem', '⚠️ Uang kurang (' + Util.money(chk.cost) + ' dibutuhkan).'); return false; }
    p.cash -= chk.cost;
    t.level++;
    p.builds++;
    if (this.hasPower(p, 'architect') && !p.firstUpgradeUsed[t.id]) {
      p.firstUpgradeUsed[t.id] = true;
      this.addLog('power', '🏗️ <b>Arsitek</b>: upgrade pertama ' + Util.esc(t.name) + ' diskon 25%.');
    }
    const label = t.level >= 5 ? 'Hotel 🏨' : 'Rumah lvl ' + t.level + ' 🏠';
    this.addLog('bangun', '🏗️ <b>' + Util.esc(p.name) + '</b> membangun ' + label + ' di ' + Util.esc(t.name) + ' (' + Util.money(chk.cost) + ').');
    if (this.hooks.onState) this.hooks.onState(this);
    return true;
  }

  sellBuilding(p, idx, auto) {
    const t = this.tiles[idx];
    if (!t || t.ownerId !== p.id || t.level <= 0) return false;
    const refund = Math.round(t.houseCost * 0.5);
    t.level--; p.cash += refund;
    this.addLog('bangun', '🧱 <b>' + Util.esc(p.name) + '</b> menjual 1 tingkat bangunan di ' + Util.esc(t.name) + ' (+' + Util.money(refund) + ')' + (auto ? ' (otomatis)' : '') + '.');
    if (this.hooks.onState) this.hooks.onState(this);
    return true;
  }

  /* --------- PRD 3.2 Property Merging → Mega Property --------- */
  mergeCandidates(pid) {
    if (!this.rules.merging) return [];
    const mine = this.propsOf(pid);
    const out = [];
    const n = this.tiles.length;
    // mode 'same'  : hanya tile benar-benar bersebelahan & satu warna
    // mode 'cross' : bersebelahan ATAU dipisah 1 tile non-properti, warna bebas
    const deltas = this.rules.mergeMode === 'cross' ? [1, 2] : [1];
    for (const t of mine) {
      if (t.mortgaged || t.mega) continue;
      for (const d of deltas) {
        if (t.idx + d >= n) continue;
        const nb = this.tiles[t.idx + d];
        if (!nb || nb.type !== 'property' || nb.ownerId !== pid || nb.mortgaged || nb.mega) continue;
        const sameGroup = nb.group === t.group;
        if (this.rules.mergeMode === 'same' && !sameGroup) continue;
        out.push({ a: t.idx, b: nb.idx, sameGroup, gap: d });
      }
    }
    // hindari duplikat (a,b) dan (b,a)
    const seen = {}, res = [];
    out.forEach(c => {
      const k = [c.a, c.b].sort((x, y) => x - y).join('-');
      if (!seen[k]) { seen[k] = 1; res.push(c); }
    });
    return res;
  }

  mergeCost(p, a, b) {
    const ta = this.tiles[a], tb = this.tiles[b];
    let cost = (ta.price + tb.price) * 0.35 * this.inflationMult;
    if (this.hasPower(p, 'magnate')) cost *= 0.8;
    return Math.max(20, Math.round(cost));
  }

  merge(p, a, b) {
    if (!this.rules.merging) { this.addLog('sistem', 'Property Merging dinonaktifkan di room ini.'); return false; }
    const cand = this.mergeCandidates(p.id).find(c => (c.a === a && c.b === b) || (c.a === b && c.b === a));
    if (!cand) { this.addLog('sistem', '🚫 Kedua properti harus bersebelahan, milikmu, tidak digadaikan, dan memenuhi aturan merge room ini.'); return false; }
    const ta = this.tiles[cand.a], tb = this.tiles[cand.b];
    const cost = this.mergeCost(p, cand.a, cand.b);
    if (p.cash < cost) { this.addLog('sistem', '⚠️ Butuh ' + Util.money(cost) + ' untuk merge.'); return false; }
    p.cash -= cost;

    const existing = ta.mega || tb.mega;
    const mega = existing || {
      id: 'm' + (++this.megaSeq),
      tiles: [], level: 0,
      baseRent: Math.max(ta.rent, tb.rent),
      bonus: 0, name: ''
    };
    [ta, tb].forEach(t => {
      if (mega.tiles.indexOf(t.idx) === -1) mega.tiles.push(t.idx);
      t.mega = mega;
      t.level = mega.level;
      mega.baseRent = Math.max(mega.baseRent, t.rent);
    });
    const cap = this.rules.megaCap;
    mega.bonus = Math.min(cap, mega.bonus + this.rules.megaBonus);
    mega.level = Math.min.apply(null, mega.tiles.map(i => this.tiles[i].level));
    mega.name = this.tiles[mega.tiles[0]].groupName + ' Mega';
    this.addLog('mega', '🏰 <b>' + Util.esc(p.name) + '</b> menggabungkan ' + mega.tiles.map(i => Util.esc(this.tiles[i].name)).join(' + ') +
      ' menjadi <b>Mega Property</b> (sewa +' + Util.pct(mega.bonus) + ', biaya ' + Util.money(cost) + ').');
    if (this.hooks.onState) this.hooks.onState(this);
    return true;
  }

  unmerge(p, a) {
    const t = this.tiles[a];
    if (!t || !t.mega || t.ownerId !== p.id) return false;
    if (t.level > 0) { this.addLog('sistem', '⚠️ Jual semua bangunan sebelum memisahkan Mega Property (PRD 3.2).'); return false; }
    const mega = t.mega;
    mega.tiles.forEach(i => { this.tiles[i].mega = null; this.tiles[i].level = 0; });
    this.addLog('mega', '🔀 <b>' + Util.esc(p.name) + '</b> memisahkan Mega Property (' + Util.esc(mega.name) + ').');
    if (this.hooks.onState) this.hooks.onState(this);
    return true;
  }

  /* --------- Penjara --------- */
  sendToJail(p, why) {
    if (p.jailFreeCards > 0) {
      p.jailFreeCards--;
      this.addLog('kartu', '🎫 <b>' + Util.esc(p.name) + '</b> memakai Kartu Bebas Penjara (' + Util.esc(why || '') + ' diabaikan).');
      return;
    }
    p.jail = true; p.jailTurns = this.rules.jailTurns; p.doubles = 0; p.extraTurn = false;
    this.moveTo(p, this.tiles.findIndex(t => t.type === 'jail'), false);
    this.addLog('penjara', '🚔 <b>' + Util.esc(p.name) + '</b> masuk penjara (' + Util.esc(why || '') + '). Maks ' + this.rules.jailTurns + ' ronde atau bayar ' + Util.money(this.rules.jailFine) + '.');
    this.phase = 'end';
  }

  payJailFine(p) {
    if (!p.jail) return false;
    if (p.cash < this.rules.jailFine) { this.addLog('sistem', '⚠️ Uang kurang untuk membayar denda penjara.'); return false; }
    this.pay(p, null, this.rules.jailFine, 'Denda penjara');
    p.jail = false; p.jailTurns = 0;
    this.addLog('penjara', '🔓 <b>' + Util.esc(p.name) + '</b> membayar denda dan keluar penjara.');
    if (this.hooks.onState) this.hooks.onState(this);
    return true;
  }

  /* --------- PRD 3.6 Kartu --------- */
  cardPool() {
    const r = this.rules;
    const pool = [];
    DATA.CARDS.cash.forEach(c => pool.push(c));
    DATA.CARDS.jail.forEach(c => pool.push(c));
    DATA.CARDS.move.forEach(c => pool.push(c));
    DATA.CARDS.special.forEach(c => {
      if (c.need === 'any' || r[c.need]) pool.push(c);
    });
    return pool;
  }

  async drawCard(p) {
    const pool = this.cardPool();
    let card = Util.pick(this.rnd, pool);
    // power Si Beruntung: 25% lebih sering kartu uang
    if (this.hasPower(p, 'lucky') && this.rnd() < 0.25) {
      const money = DATA.CARDS.cash.filter(c => c.amount > 0);
      card = Util.pick(this.rnd, money);
      this.addLog('power', '🍀 <b>Si Beruntung</b> mengarahkan kartu ke hadiah tunai.');
    }
    this.addLog('kartu', '🎁 <b>' + Util.esc(p.name) + '</b> menarik kartu: "' + Util.esc(card.label) + '"');
    await this.applyCard(p, card);
  }

  async applyCard(p, c) {
    switch (c.t) {
      case 'cash': {
        let amt = c.amount;
        if (amt > 0 && this.hasPower(p, 'lucky')) amt = Math.round(amt * 1.25);
        if (amt > 0) p.cash += amt;
        else await this.pay(p, null, -amt, c.label);
        this.addLog('uang', (amt > 0 ? '💰 +' : '💸 ') + Util.money(amt) + ' — ' + Util.esc(c.label));
        break;
      }
      case 'jailFree':
        p.jailFreeCards++;
        break;
      case 'toJail':
        this.sendToJail(p, 'kartu Surprise');
        break;
      case 'moveToStart':
        this.moveTo(p, 0, true);
        this.addLog('gerak', '🚌 <b>' + Util.esc(p.name) + '</b> pindah ke START.');
        break;
      case 'move': {
        const target = (p.pos + c.delta + this.tiles.length) % this.tiles.length;
        this.moveTo(p, target, c.delta > 0);
        await this.resolveTile(p);
        break;
      }
      case 'moveNearestProp': {
        let i = 1, found = -1;
        while (i < this.tiles.length) {
          const idx = (p.pos + i) % this.tiles.length;
          const t = this.tiles[idx];
          if (t.type === 'property' && !t.ownerId) { found = idx; break; }
          i++;
        }
        if (found < 0) { p.cash += 100; this.addLog('kartu', 'Tidak ada properti kosong — kamu mendapat ' + Util.money(100) + '.'); }
        else {
          this.moveTo(p, found, true);
          this.addLog('kartu', '🌀 <b>' + Util.esc(p.name) + '</b> berpindah ke ' + Util.esc(this.tiles[found].name) + '.');
          const t = this.tiles[found];
          const choice = await this.driver(p.id).chooseBuy(p, t, this.buyPrice(p, t));
          if (choice === 'buy') this.buyProperty(p, t);
          else if (choice === 'auction' && this.rules.auction) await this.runAuction(t, p);
        }
        break;
      }
      case 'sabotage':
        if (!this.rules.sabotage) { p.cash += 75; this.addLog('kartu', 'Sabotase nonaktif — dikonversi jadi ' + Util.money(75) + '.'); }
        else if (p.sabotageCards >= this.rules.sabotageMaxHand) { p.cash += 75; this.addLog('kartu', 'Tangan sabotase penuh — dikonversi jadi ' + Util.money(75) + '.'); }
        else { p.sabotageCards++; this.addLog('kartu', '💣 <b>' + Util.esc(p.name) + '</b> mendapat Kartu Sabotase (total ' + p.sabotageCards + ').'); }
        break;
      case 'megaBoost':
        p.megaBoost = this.rules.megaBonus; p.megaBoostRounds = 3;
        break;
      case 'taxShield':
        p.taxShield += 2;
        break;
      case 'treasury': {
        const take = Math.floor(this.treasury * 0.25);
        this.treasury -= take; p.cash += take;
        this.addLog('uang', '🏦 <b>' + Util.esc(p.name) + '</b> mengambil ' + Util.money(take) + ' dari treasury.');
        break;
      }
      case 'doubleNextRent':
        p.doubleNextRent = true;
        break;
      case 'allPay':
        this.players.filter(x => x.id !== p.id && !x.out && !x.ghost).forEach(o => this.pay(o, p, 50, 'Kartu uang perayaan'));
        break;
    }
    if (this.hooks.onState) this.hooks.onState(this);
  }

  /* --------- PRD 3.6 Kartu Sabotase --------- */
  sabotageTargets(p) {
    if (!this.rules.sabotage) return [];
    return this.tiles.filter(t =>
      t.type === 'property' && t.ownerId && t.ownerId !== p.id &&
      !this.sameTeam(this.p(t.ownerId).team, p.team) &&
      (t.level > 0 || (t.mega && t.mega.level > 0))
    );
  }

  useSabotage(p, idx) {
    if (!this.rules.sabotage) { this.addLog('sistem', 'Kartu sabotase dinonaktifkan di room ini.'); return false; }
    if (p.sabotageCards <= 0) { this.addLog('sistem', '⚠️ Kamu tidak punya kartu sabotase.'); return false; }
    if (p.sabotageCooldown > 0) { this.addLog('sistem', '⏳ Cooldown sabotase: ' + p.sabotageCooldown + ' ronde lagi.'); return false; }
    const t = this.tiles[idx];
    if (!t || t.ownerId === p.id) return false;
    const victim = this.p(t.ownerId);
    if (!victim) return false;
    if (this.sameTeam(victim.team, p.team)) { this.addLog('sistem', '🚫 Tidak bisa menyabotase rekan tim (co-op).'); return false; }
    if (t.level <= 0) { this.addLog('sistem', '⚠️ Tidak ada bangunan untuk dihancurkan di ' + Util.esc(t.name) + '.'); return false; }

    t.level = Math.max(0, t.level - 1);
    if (t.mega) t.mega.level = Math.min.apply(null, t.mega.tiles.map(i => this.tiles[i].level));
    p.sabotageCards--;
    p.sabotageCooldown = this.rules.sabotageCooldown;
    this.addLog('sabotase', '💣 <b>' + Util.esc(p.name) + '</b> menyabotase ' + Util.esc(t.name) + ' milik <b>' + Util.esc(victim.name) + '</b> — 1 tingkat bangunan hancur (properti tetap utuh). Cooldown ' + this.rules.sabotageCooldown + ' ronde.');
    if (this.hooks.onEvent) this.hooks.onEvent('sabotage', { actor: p, victim, tile: t });
    if (this.hooks.onState) this.hooks.onState(this);
    return true;
  }

  /* --------- PRD 3.3 Auction --------- */
  async runAuction(t, trigger) {
    const bidders = this.activePlayers().filter(p => !p.ghost && p.cash >= Math.round(t.price * 0.4));
    if (bidders.length === 0) { this.addLog('lelang', '🔨 Tidak ada peserta lelang untuk ' + Util.esc(t.name) + '.'); return; }
    this.pendingAuction = { tileIdx: t.idx };
    this.phase = 'auction';
    if (this.hooks.onState) this.hooks.onState(this);
    const res = await this.driver('auction').runAuction ? await this.driver('auction').runAuction(t, bidders, trigger)
      : await this.quickAuction(t, bidders, trigger);
    this.pendingAuction = null;
    this.phase = trigger.id === this.turnPlayerId ? 'end' : 'end';
    if (this.hooks.onState) this.hooks.onState(this);
    return res;
  }

  /** Fallback lelang sederhana bila driver UI tidak menyediakan (mis. headless test) */
  async quickAuction(t, bidders, trigger) {
    let high = Math.max(1, Math.round(t.price * 0.5)), winner = null;
    bidders.forEach(b => {
      const v = Math.min(b.cash, Math.round(t.price * (0.6 + this.rnd() * 0.5)));
      if (v > high) { high = v; winner = b; }
    });
    if (!winner) { this.addLog('lelang', '🔨 ' + Util.esc(t.name) + ' tidak terjual.'); return null; }
    winner.cash -= high; t.ownerId = winner.id; t.level = 0; winner.properties.push(t.idx);
    this.addLog('lelang', '🔨 <b>' + Util.esc(winner.name) + '</b> memenangkan lelang ' + Util.esc(t.name) + ' seharga ' + Util.money(high) + '.');
    return winner;
  }

  /* --------- PRD 3.5 Trading + Anti-Collusion --------- */
  valueOfAsset(player, offer) {
    let v = offer.cash || 0;
    (offer.props || []).forEach(idx => {
      const t = this.tiles[idx];
      if (!t) return;
      v += Math.round(t.price * 0.8 + t.level * t.houseCost * 0.5);
      if (this.wouldCompleteSet(player, t)) v += Math.round(t.price * 0.9); // nilai strategis
    });
    (offer.cards || []).forEach(c => { v += c === 'sabotage' ? 120 : 80; });
    return v;
  }
  wouldCompleteSet(player, t) {
    const list = this.groupTiles(t.group);
    const owned = list.filter(x => x.ownerId === player.id).length;
    return owned === list.length - 1;
  }

  /** Deteksi kolusi: trade sangat timpang tanpa nilai strategis */
  collusionScore(a, b, offer) {
    const va = this.valueOfAsset(a, offer.give);
    const vb = this.valueOfAsset(b, offer.get);
    const diff = Math.abs(va - vb);
    const max = Math.max(va, vb, 1);
    const ratio = diff / max;
    const strategic = (offer.give.props || []).some(i => this.wouldCompleteSet(b, this.tiles[i])) ||
                      (offer.get.props || []).some(i => this.wouldCompleteSet(a, this.tiles[i]));
    let score = 0;
    if (ratio > 0.7) score += 1;
    if (ratio > 0.9) score += 1;
    if (diff > 500 && !strategic) score += 1;
    if (max > 300 && diff > 0.8 * max && !strategic) score += 1;
    return { score: Math.min(3, score), ratio, diff, va, vb, strategic };
  }

  validateTrade(a, b, offer) {
    const errs = [];
    if (!a || !b || a.id === b.id) errs.push('Pilih lawan trade yang valid.');
    if (a && a.ghost) errs.push('Hantu tidak dapat bertrading (PRD 3.3).');
    if (b && b.ghost) errs.push('Lawan trade sudah menjadi Hantu.');
    if (a && b && this.mode === 'coop' && a.team === b.team && !this.rules.teamInternalTrade)
      errs.push('Trade internal tim dibatasi di mode co-op (PRD 3.4).');
    const giveProps = offer.give.props || [], getProps = offer.get.props || [];
    giveProps.forEach(i => {
      const t = this.tiles[i];
      if (!t || t.ownerId !== a.id) errs.push('Properti bukan milikmu.');
      else if (t.level > 0) errs.push('Jual bangunan dulu: ' + t.name + '.');
      else if (t.mega) errs.push('Pisahkan Mega Property dulu: ' + t.name + '.');
    });
    getProps.forEach(i => {
      const t = this.tiles[i];
      if (!t || t.ownerId !== b.id) errs.push('Properti bukan milik lawan.');
      else if (t.level > 0) errs.push('Lawan harus menjual bangunan dulu: ' + t.name + '.');
    });
    if ((offer.give.cash || 0) > a.cash) errs.push('Uangmu tidak cukup.');
    if ((offer.get.cash || 0) > b.cash) errs.push('Uang lawan tidak cukup.');
    if ((offer.give.sabotage || 0) > a.sabotageCards) errs.push('Kartu sabotase tidak cukup.');
    if (!giveProps.length && !getProps.length && !(offer.give.cash || 0) && !(offer.get.cash || 0))
      errs.push('Trade kosong.');
    return errs;
  }

  async proposeTrade(fromId, toId, offer) {
    const a = this.p(fromId), b = this.p(toId);
    offer = offer || { give: { cash: 0, props: [], sabotage: 0 }, get: { cash: 0, props: [], sabotage: 0 } };
    const errs = this.validateTrade(a, b, offer);
    if (errs.length) return { ok: false, errors: errs };

    const col = this.collusionScore(a, b, offer);
    if (col.score >= 2 && this.rules.antiCollusion !== 'off') {
      this.addLog('anticollusion', '🚩 <b>Anti-Collusion</b>: trade ' + Util.esc(a.name) + ' ↔ ' + Util.esc(b.name) +
        ' ditandai timpang (selisih nilai ' + Util.money(col.diff) + ', rasio ' + Util.pct(col.ratio) +
        (col.strategic ? ', tapi ada nilai strategis set warna' : ', tanpa nilai strategis') + ').');
      if (this.rules.antiCollusion === 'strict') {
        this.addLog('anticollusion', '⛔ Room ini memakai mode <b>strict</b> — trade dibatalkan & dicatat untuk review.');
        return { ok: false, blocked: true, collusion: col };
      }
    }
    const accepted = await this.driver(b.id).decideTrade(a, b, offer, col);
    if (!accepted) {
      this.addLog('trade', '❌ <b>' + Util.esc(b.name) + '</b> menolak tawaran dari ' + Util.esc(a.name) + '.');
      return { ok: false, declined: true, collusion: col };
    }
    return { ok: this.executeTrade(a, b, offer), collusion: col };
  }

  executeTrade(a, b, offer) {
    const g = offer.give, r = offer.get;
    (g.props || []).forEach(i => {
      const t = this.tiles[i];
      t.ownerId = b.id; t.mortgaged = false;
      a.properties = a.properties.filter(x => x !== i);
      if (b.properties.indexOf(i) === -1) b.properties.push(i);
    });
    (r.props || []).forEach(i => {
      const t = this.tiles[i];
      t.ownerId = a.id; t.mortgaged = false;
      b.properties = b.properties.filter(x => x !== i);
      if (a.properties.indexOf(i) === -1) a.properties.push(i);
    });
    a.cash -= (g.cash || 0); a.cash += (r.cash || 0);
    b.cash -= (r.cash || 0); b.cash += (g.cash || 0);
    a.sabotageCards -= (g.sabotage || 0); a.sabotageCards += (r.sabotage || 0);
    b.sabotageCards -= (r.sabotage || 0); b.sabotageCards += (g.sabotage || 0);
    if (g.jailFree) { a.jailFreeCards--; b.jailFreeCards++; }
    if (r.jailFree) { b.jailFreeCards--; a.jailFreeCards++; }
    a.trades++; b.trades++;
    this.addLog('trade', '🤝 Trade berhasil: <b>' + Util.esc(a.name) + '</b> ⇄ <b>' + Util.esc(b.name) + '</b> — ' + this.describeOffer(offer));
    if (this.hooks.onEvent) this.hooks.onEvent('trade', { a, b, offer });
    if (this.hooks.onState) this.hooks.onState(this);
    return true;
  }

  describeOffer(offer) {
    const part = (o) => {
      const bits = [];
      if (o.cash) bits.push(Util.money(o.cash));
      (o.props || []).forEach(i => bits.push(this.tiles[i].name));
      if (o.sabotage) bits.push(o.sabotage + 'x 💣');
      if (o.jailFree) bits.push('🎫 Bebas Penjara');
      return bits.length ? bits.join(', ') : '—';
    };
    return part(offer.give) + '  ⇄  ' + part(offer.get);
  }

  /* --------- PRD 3.3 Ghost Comeback --------- */
  async ghostTurn(p) {
    if (p.ghostCooldown > 0) p.ghostCooldown--;
    const audit = this.rollDice(p);
    if (this.hooks.onDice) this.hooks.onDice(audit, p);
    await this.move(p, audit.steps, true);
    const t = this.tile(p.pos);
    if (t.type === 'property' && t.ownerId && t.ownerId !== p.id) {
      const owner = this.p(t.ownerId);
      if (owner && !owner.ghost && !this.sameTeam(owner.team, p.team)) {
        if (p.ghostCooldown <= 0) {
          const amt = Math.min(this.rules.ghostStealCap, Math.round(owner.cash * this.rules.ghostStealPct));
          if (amt > 0) {
            owner.cash -= amt; p.stolenTotal = (p.stolenTotal || 0) + amt;
            p.steals++; p.stealsTotal += amt; p.ghostCooldown = this.rules.ghostCooldown;
            this.addLog('hantu', '👻 <b>' + Util.esc(p.name) + '</b> mencuri ' + Util.money(amt) + ' dari <b>' + Util.esc(owner.name) + '</b> di ' + Util.esc(t.name) + ' (cap ' + Util.money(this.rules.ghostStealCap) + ', cooldown ' + this.rules.ghostCooldown + ' ronde).');
            if (this.hooks.onEvent) this.hooks.onEvent('steal', { actor: p, victim: owner, amount: amt });
          }
        } else this.addLog('hantu', '👻 <b>' + Util.esc(p.name) + '</b> melewati ' + Util.esc(t.name) + ' — cooldown pencurian (' + p.ghostCooldown + ' ronde lagi).');
      }
    } else if (t.type === 'vacation') {
      const amt = 25;
      p.stolenTotal = (p.stolenTotal || 0) + amt;
      this.addLog('hantu', '👻 Hantu <b>' + Util.esc(p.name) + '</b> memungut ' + Util.money(amt) + ' sisa liburan (tidak bisa menang).');
    }
    if (this.hooks.onState) this.hooks.onState(this);
  }

  /* --------- Kebangkrutan & kondisi menang --------- */
  bankrupt(p, creditor, reason) {
    if (p.bankrupt) return;
    p.bankrupt = true;
    const cashLeft = p.cash;
    p.cash = 0;
    p.finishOrder = this.players.filter(x => x.out || x.bankrupt).length;
    this.addLog('bangkrut', '💥 <b>' + Util.esc(p.name) + '</b> BANGKRUT' + (reason ? ' (' + Util.esc(reason) + ')' : '') + '.');

    if (creditor && !creditor.ghost && creditor.id !== p.id) {
      p.properties.slice().forEach(i => {
        const t = this.tiles[i];
        t.ownerId = creditor.id;
        if (creditor.properties.indexOf(i) === -1) creditor.properties.push(i);
      });
      creditor.cash += cashLeft;
      this.addLog('bangkrut', '📦 Aset <b>' + Util.esc(p.name) + '</b> (' + p.properties.length + ' properti) diambil alih <b>' + Util.esc(creditor.name) + '</b>.');
    } else {
      p.properties.slice().forEach(i => {
        const t = this.tiles[i];
        t.ownerId = null; t.level = 0; t.mortgaged = false;
        if (t.mega) { t.mega.tiles.forEach(j => { this.tiles[j].mega = null; this.tiles[j].level = 0; }); t.mega = null; }
      });
      this.addLog('bangkrut', '🏦 Properti <b>' + Util.esc(p.name) + '</b> kembali ke bank.');
    }
    p.properties = [];

    if (this.rules.ghost && !this.tutorialMode) {
      p.ghost = true; p.out = false; p.jail = false;
      p.ghostCooldown = 0; p.steals = 0; p.stolenTotal = 0;
      this.addLog('hantu', '👻 <b>' + Util.esc(p.name) + '</b> kembali sebagai <b>HANTU</b> — tetap bergerak, tidak bisa beli/trade/sewa, tapi bisa mencuri uang kecil (ada cap & cooldown).');
    } else {
      p.out = true; p.ghost = false;
      this.addLog('sistem', '🪦 <b>' + Util.esc(p.name) + '</b> keluar dari permainan.');
    }
    this.order = this.order.filter(id => !this.p(id).out);
    this.checkWin();
    if (this.hooks.onState) this.hooks.onState(this);
  }

  checkWin() {
    if (this.state === 'over') return false;
    const alive = this.alive();
    if (this.mode === 'ffa') {
      if (alive.length <= 1 && this.players.length > 1) {
        this.winners = alive.length ? [alive[0]] : [];
        this.endGame(this.winners, alive.length ? Util.esc(alive[0].name) + ' adalah pemain terakhir yang bertahan!' : 'Semua pemain bangkrut bersamaan.');
        return true;
      }
    } else {
      const teams = Array.from(new Set(this.players.map(p => p.team).filter(Boolean)));
      const aliveTeams = teams.filter(t => this.players.some(p => p.team === t && !p.bankrupt));
      if (aliveTeams.length === 1) {
        this.winners = this.players.filter(p => p.team === aliveTeams[0]);
        this.endGame(this.winners, 'Tim <b>' + aliveTeams[0] + '</b> memenangkan pertandingan co-op!');
        return true;
      }
      if (aliveTeams.length === 0) { this.endGame([], 'Semua tim bangkrut — seri.'); return true; }
    }
    return false;
  }

  endGame(winners, text) {
    this.state = 'over';
    this.phase = 'over';
    this.players.forEach(p => {
      const h = p.netWorthHistory || (p.netWorthHistory = []);
      const last = h[h.length - 1];
      const nw = this.netWorth(p);
      if (!last || last.round !== this.round) h.push({ round: this.round, netWorth: nw });
      else last.netWorth = nw;
    });
    this.addLog('akhir', '🏆 <b>GAME SELESAI</b> — ' + (text || ''));
    this.rankByNetWorth();
    if (this.hooks.onGameOver) this.hooks.onGameOver(winners || [], this);
  }

  netWorth(p) {
    let v = p.cash;
    this.propsOf(p.id).forEach(t => {
      v += t.mortgaged ? Math.round(t.price * 0.5) : t.price;
      v += t.level * t.houseCost * 0.6;
      if (t.mega) v += Math.round(t.price * 0.2);
    });
    v += p.sabotageCards * 100 + p.jailFreeCards * 60;
    return Math.round(v);
  }

  rankByNetWorth() {
    const ranked = this.players.slice().sort((a, b) => this.netWorth(b) - this.netWorth(a));
    ranked.forEach((p, i) => { p.placement = i + 1; });
    this.ranking = ranked;
    return ranked;
  }

  surrender(p) {
    this.addLog('sistem', '🏳️ <b>' + Util.esc(p.name) + '</b> menyerah (PRD 10.2: opsi mengakhiri game panjang).');
    this.bankrupt(p, null, 'menyerah');
    if (this.state !== 'over') this.checkWin();
  }

  /* --------- Akhir giliran: cuaca, inflasi, urutan --------- */
  async endTurn() {
    const p = this.cur;
    if (p) { p.extraTurn = false; p.doubles = 0; p.rolledThisTurn = false; }

    if (this.state === 'over') return;
    this.advance();
    if (this.state === 'over') return;

    // giliran hantu (cepat, tidak memblokir)
    for (const g of this.ghosts()) {
      if (this.state === 'over') break;
      await this.ghostTurn(g);
    }

    this.beginTurn();
  }

  advance() {
    const n = this.order.length;
    if (!n) { this.endGame([], 'Tidak ada pemain tersisa di urutan giliran.'); return; }
    let guard = 0;
    do {
      this.turnIndex = (this.turnIndex + 1) % n;
      guard++;
      if (guard > n * 3) break;
    } while (!this.orderActive(this.order[this.turnIndex]));

    if (this.turnIndex === 0) this.onNewRound();
    this.turnPlayerId = this.order[this.turnIndex];
  }

  orderActive(id) {
    const p = this.p(id);
    return !!p && !p.out;
  }

  onNewRound() {
    this.round++;
    this.players.forEach(p => {
      const nw = this.netWorth(p);
      p.netWorthPeak = Math.max(p.netWorthPeak, nw);
      const h = p.netWorthHistory || (p.netWorthHistory = []);
      h.push({ round: this.round, netWorth: nw });
      if (h.length > 200) h.shift();
    });

    // PRD 3.9 cuaca dinamis
    if (this.rules.weather) {
      this.weatherRoundsLeft--;
      if (this.weatherRoundsLeft <= 0) this.setWeather(Util.pick(this.rnd, DATA.WEATHER));
    }
    // PRD 3.9 inflasi
    if (this.rules.inflation && this.round % this.rules.inflationEvery === 0) this.applyInflation();

    if (this.rules.antiCollusion !== 'off') this.scanTradePatterns();
  }

  setWeather(w) {
    this.weather = w;
    this.weatherRoundsLeft = this.rules.weatherRounds;
    this.addLog('cuaca', w.icon + ' <b>Cuaca berubah: ' + w.name + '</b> — ' + w.desc + ' (bertahan ' + this.rules.weatherRounds + ' ronde).');
    if (this.hooks.onEvent) this.hooks.onEvent('weather', w);
  }

  applyInflation() {
    if (this.inflation >= this.rules.inflationCap) {
      this.addLog('inflasi', '📈 Inflasi sudah di batas maksimum (' + Util.pct(this.rules.inflationCap) + ').');
      return;
    }
    this.inflation = Math.min(this.rules.inflationCap, this.inflation + this.rules.inflationStep);
    this.inflationTicks++;
    this.addLog('inflasi', '📈 <b>INFLASI</b> naik jadi ' + Util.pct(this.inflation) + ' — sewa, pajak, dan biaya bangunan ikut naik (maks ' + Util.pct(this.rules.inflationCap) + ').');
    if (this.hooks.onEvent) this.hooks.onEvent('inflation', this.inflation);
  }

  /** PRD 3.12 — pola kerja sama curang lintas ronde (bukan hanya per trade) */
  scanTradePatterns() {
    const flagged = this.log.filter(l => l.kind === 'anticollusion').length;
    if (flagged >= 3 && !this._collusionWarned) {
      this._collusionWarned = true;
      this.addLog('anticollusion', '🕵️ Sistem mendeteksi pola trade berulang yang tidak wajar. Di public/ranked match, trade room ini akan dibatasi & masuk antrean review manual. Pemain dapat mengajukan banding bila ini false positive.');
    }
  }

  /* --------- PRD 3.12 Reconnection grace period --------- */
  markDisconnected(pid) {
    const p = this.p(pid);
    if (!p || !p.connected) return;
    p.connected = false;
    p.disconnectedAt = Date.now();
    this.addLog('koneksi', '🔌 <b>' + Util.esc(p.name) + '</b> terputus. Grace period ' + this.rules.gracePeriod + ' detik dimulai (state dipertahankan, bot TIDAK mengambil alih).');
    if (this.hooks.onEvent) this.hooks.onEvent('disconnect', p);
  }

  checkGrace() {
    const now = Date.now();
    this.players.forEach(p => {
      if (p.connected || p.isBot || p.out || !p.disconnectedAt) return;
      const left = this.rules.gracePeriod - Math.floor((now - p.disconnectedAt) / 1000);
      if (left <= 0 && !p.takeover) {
        p.takeover = true;
        this.addLog('koneksi', '🤖 Grace period habis — <b>Auto-Bot Takeover</b> aktif untuk ' + Util.esc(p.name) + '.');
        if (this.hooks.onEvent) this.hooks.onEvent('takeover', p);
      } else if (left > 0 && left % 60 === 0 && !p._warned) {
        p._warned = true;
      }
      p.graceLeft = Math.max(0, left);
    });
  }

  reconnect(pid) {
    const p = this.p(pid);
    if (!p) return false;
    p.connected = true; p.disconnectedAt = null; p._warned = false;
    const wasTakeover = p.takeover;
    p.takeover = false;
    this.addLog('koneksi', '🔗 <b>' + Util.esc(p.name) + '</b> tersambung kembali' + (wasTakeover ? ' dan mengambil alih dari bot' : ' dalam grace period') + ' — state disinkronkan.');
    if (this.hooks.onEvent) this.hooks.onEvent('reconnect', p);
    return true;
  }

  /* --------- Snapshot state (untuk sync/UI) --------- */
  snapshot() {
    return {
      seed: this.seed, round: this.round, phase: this.phase, state: this.state,
      turn: this.turnPlayerId, weather: this.weather.key, inflation: this.inflation,
      treasury: this.treasury, nemesis: this.nemesis || null,
      players: this.players.map(p => ({
        id: p.id, name: p.name, cash: p.cash, pos: p.pos, props: p.properties.length,
        ghost: p.ghost, jail: p.jail, out: p.out, team: p.team, power: p.power,
        netWorth: this.netWorth(p), connected: p.connected, takeover: p.takeover
      })),
      tiles: this.tiles.map(t => ({ idx: t.idx, type: t.type, owner: t.ownerId || null, level: t.level || 0, mega: !!t.mega, mortgaged: !!t.mortgaged }))
    };
  }

  /* --------- Aksi yang boleh dilakukan pemain pada fase tertentu --------- */
  allowedActions(pid) {
    const p = this.p(pid);
    const a = { roll: false, buy: false, auction: false, end: false, build: false, trade: false, sabotage: false, jailFine: false, merge: false, surrender: false };
    if (!p || this.state !== 'playing' || p.out) return a;
    const isTurn = pid === this.turnPlayerId;
    a.surrender = isTurn;
    if (!isTurn) return a;
    if (p.jail) a.jailFine = p.cash >= this.rules.jailFine;
    if (this.phase === 'roll' && (p.extraTurn || !p.rolledThisTurn)) a.roll = true;
    if (this.phase === 'resolve' && this.pendingBuy && this.pendingBuy.playerId === pid) {
      a.buy = p.cash >= this.pendingBuy.price && !p.ghost;
      a.auction = this.rules.auction;
    }
    if (this.phase === 'end') {
      a.end = true;
      a.build = !p.ghost && this.propsOf(pid).some(t => this.canBuild(p, t.idx).ok);
      a.trade = !p.ghost && this.activePlayers().some(x => x.id !== pid && !x.ghost && !(this.mode === 'coop' && x.team === p.team));
      a.sabotage = !p.ghost && this.rules.sabotage && p.sabotageCards > 0 && p.sabotageCooldown <= 0 && this.sabotageTargets(p).length > 0;
      a.merge = !p.ghost && this.rules.merging && this.mergeCandidates(pid).length > 0;
    }
    return a;
  }
}

/* ekspor untuk Node (headless test) & browser */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Game };
}

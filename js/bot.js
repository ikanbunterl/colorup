/* ============================================================
   ColorUp.io — bot.js
   File 5/7 · BOT / AI DRIVER
   Mengisi slot kosong (PRD 3.4), mengambil alih pemain yang
   kehabisan grace period reconnect (Auto-Bot Takeover), dan
   menjadi lawan di Tutorial Sandbox.
   Bot memakai interface "driver" yang sama dengan UI manusia,
   sehingga engine tidak perlu tahu siapa yang bermain.
   ============================================================ */
'use strict';

class BotDriver {
  /**
   * @param {Game} game
   * @param {string} pid  id pemain yang dikendalikan
   * @param {number} level 0 = gampang, 1 = normal, 2 = agresif/pintar
   */
  constructor(game, pid, level) {
    this.game = game;
    this.pid = pid;
    this.level = level == null ? 1 : level;
    this.id = pid;
  }
  get p() { return this.game.p(this.pid); }
  get g() { return this.game; }
  sleep(ms) { return this.g.delay(ms); }
  rnd() { return this.g.rnd(); }

  /* ---------- API driver (dipanggil engine) ---------- */
  async prompt() { return null; }
  onDice() {}
  onState() {}

  async chooseBuy(p, tile, price) {
    await this.sleep(500);
    if (p.ghost || p.cash < price) return 'skip';
    const completes = this.g.wouldCompleteSet(p, tile) || this.g.ownsFullSet(p.id, tile.group);
    const reserve = 60 + 90 * this.level;
    let score = 0.42 + 0.12 * this.level;
    if (completes) score += 0.42;
    if (tile.price <= 140) score += 0.12;
    if (tile.groupSize >= 4) score += 0.05;
    if (p.cash - price < reserve) score -= 0.35;
    if (this.g.inflation > 0.2) score += 0.06;
    const buy = this.rnd() < Math.min(0.96, Math.max(0.05, score));
    if (buy) return 'buy';
    if (this.g.rules.auction && this.level >= 1 && this.rnd() < 0.55) return 'auction';
    return 'skip';
  }

  async confirmRaiseCash(p, need, reason) {
    await this.sleep(350);
    return true; // bot selalu melikuidasi aset demi bertahan
  }

  async decideTrade(from, to, offer, col) {
    await this.sleep(700);
    if (col && col.score >= 3) {
      this.g.addLog('anticollusion', '🤖 <b>' + to.name + '</b> (bot) menolak trade yang ditandai kolusi.');
      return false;
    }
    const got = this.g.valueOfAsset(to, offer.get);
    const gave = this.g.valueOfAsset(to, offer.give);
    const margin = [0.28, 0.10, -0.08][this.level] || 0.1;
    if (got >= gave * (1 + margin)) return true;
    if (got >= gave * 0.96 && (offer.get.props || []).some(i => this.g.wouldCompleteSet(to, this.g.tiles[i]))) return true;
    return false;
  }

  /** Satu putaran bid pada lelang; return {bid:number|null, drop:boolean} */
  async bid(tile, currentBid) {
    const p = this.p;
    await this.sleep(420);
    if (p.ghost || p.out) return { bid: null, drop: true };
    let target = tile.price * (0.62 + 0.22 * this.level + this.rnd() * 0.25);
    if (this.g.wouldCompleteSet(p, tile) || this.g.ownsFullSet(p.id, tile.group)) target *= 1.35;
    if (this.g.hasPower(p, 'negotiator')) target *= 1.08;
    target = Math.min(target, p.cash * 0.85);
    const next = Math.max(currentBid + 10, Math.round(target * (0.75 + this.rnd() * 0.2) / 5) * 5);
    if (next <= target && next < p.cash) return { bid: next, drop: false };
    return { bid: null, drop: true };
  }

  /* ---------- Giliran penuh bot ---------- */
  async turn() {
    const g = this.g, p = this.p;
    if (!p || p.out || p.ghost) return;
    await this.sleep(450);

    // 1) lempar dadu (engine yang memegang RNG)
    while (g.phase === 'roll' && g.cur === p && g.state === 'playing') {
      await g.actRoll();
      await this.sleep(280);
      if (p.out || p.jail) break;
      if (!p.extraTurn) break;
    }
    if (p.out || g.state === 'over') return;

    // 2) fase akhir: bangun, merge, sabotase, trade
    if (g.phase === 'end' && g.cur === p) {
      await this.tryBuild(p);
      await this.tryMerge(p);
      await this.trySabotage(p);
      await this.tryTrade(p);
      await this.tryUnmortgage(p);
    }
  }

  async tryBuild(p) {
    const g = this.g;
    let guard = 0;
    while (guard++ < 25) {
      const list = g.propsOf(p.id)
        .filter(t => g.canBuild(p, t.idx).ok)
        .sort((a, b) => {
          const ca = g.canBuild(p, a.idx).cost, cb = g.canBuild(p, b.idx).cost;
          if (g.ownsFullSet(p.id, a.group) !== g.ownsFullSet(p.id, b.group))
            return g.ownsFullSet(p.id, b.group) ? 1 : -1;
          return (a.rent / ca) - (b.rent / cb) * -1;
        });
      if (!list.length) break;
      const t = list[0];
      const cost = g.canBuild(p, t.idx).cost;
      const buffer = this.level >= 2 ? 80 : 160;
      if (p.cash - cost < buffer) break;
      if (!g.build(p, t.idx)) break;
      await this.sleep(320);
    }
  }

  async tryMerge(p) {
    const g = this.g;
    if (!g.rules.merging) return;
    const cands = g.mergeCandidates(p.id);
    if (!cands.length) return;
    const c = cands.sort((x, y) => (y.sameGroup ? 1 : 0) - (x.sameGroup ? 1 : 0))[0];
    const cost = g.mergeCost(p, c.a, c.b);
    if (p.cash - cost > 220 && this.rnd() < (c.sameGroup ? 0.85 : 0.5)) {
      g.merge(p, c.a, c.b);
      await this.sleep(320);
    }
  }

  async trySabotage(p) {
    const g = this.g;
    if (!g.rules.sabotage || p.sabotageCards <= 0 || p.sabotageCooldown > 0) return;
    const targets = g.sabotageTargets(p);
    if (!targets.length) return;
    if (this.level === 0 && this.rnd() < 0.5) return; // bot gampang kadang ragu
    const best = targets.sort((a, b) => (b.level * b.rent) - (a.level * a.rent))[0];
    g.useSabotage(p, best.idx);
    await this.sleep(380);
  }

  async tryUnmortgage(p) {
    const g = this.g;
    if (!g.rules.mortgage) return;
    const list = g.propsOf(p.id).filter(t => t.mortgaged).sort((a, b) => a.price - b.price);
    for (const t of list) {
      const cost = Math.round(t.price * 0.55 * g.inflationMult);
      if (p.cash - cost > 400 + 200 * this.level) { g.unmortgage(p, t.idx); await this.sleep(250); }
      else break;
    }
  }

  /** Bot mencari trade saling menguntungkan (melengkapi set warna) */
  async tryTrade(p) {
    const g = this.g;
    if (this.level === 0 || this.rnd() > 0.55) return;
    const others = g.activePlayers().filter(o =>
      o.id !== p.id && !o.ghost && !o.bankrupt &&
      !(g.mode === 'coop' && o.team === p.team));
    if (!others.length) return;

    for (const o of others) {
      const want = g.propsOf(o.id).filter(t => t.level === 0 && !t.mega && g.wouldCompleteSet(p, t));
      if (!want.length) continue;
      const target = want[0];

      const giveProps = g.propsOf(p.id).filter(t =>
        t.level === 0 && !t.mega && t.group !== target.group && g.wouldCompleteSet(o, t));

      const give = { cash: 0, props: [], sabotage: 0 };
      const get = { cash: 0, props: [target.idx], sabotage: 0 };

      if (giveProps.length) give.props.push(giveProps[0].idx);
      let diff = g.valueOfAsset(p, get) - g.valueOfAsset(p, give);
      if (diff > 0) give.cash = Math.min(p.cash - 120, Math.round(diff * 0.85));
      else get.cash = Math.min(o.cash - 60, Math.round(-diff * 0.7));
      if (give.cash < 0) give.cash = 0;
      if (get.cash < 0) get.cash = 0;
      if (!give.props.length && give.cash <= 0) continue;

      const errs = g.validateTrade(p, o, { give, get });
      if (errs.length) continue;
      const res = await g.proposeTrade(p.id, o.id, { give, get });
      await this.sleep(420);
      if (res && res.ok) return;
    }
  }
}

/* AI bot untuk tutorial: sabar, murah hati, tidak agresif */
class TutorBotDriver extends BotDriver {
  constructor(game, pid) { super(game, pid, 0); }
  async chooseBuy(p, tile, price) { await this.sleep(400); return p.cash >= price ? 'buy' : 'skip'; }
  async trySabotage() {}
  async tryTrade() {}
  async bid() { return { bid: null, drop: true }; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BotDriver, TutorBotDriver };
}

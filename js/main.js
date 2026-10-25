/* ============================================================
   ColorUp.io — js/main.js
   File 8/8 · BOOTSTRAP — PRD v2.1 Fase A (v1.2 "Clarity & Polish")
   Menyiapkan lobi (preset default), menghidupkan UI + AudioManager,
   shortcut keyboard global, dan ekspor objek untuk testing.
   ============================================================ */
'use strict';

(function () {

  function boot() {
    UI.init();
    UI.showScreen('lobby');

    const ver = document.getElementById('versionTag');
    if (ver) ver.textContent = 'ColorUp.io · v1.2.0 "Clarity & Polish" · implementasi PRD v2.1 Fase A';

    console.log(
      '%c ColorUp.io v1.2.0 ',
      'background:#3b82f6;color:#fff;font-size:14px;border-radius:6px;padding:4px 8px',
      '\nFase A "Clarity & Polish" (PRD v2.1): presets, smart action bar, ticker+log modal,',
      '\nflat board, spring motion, AudioManager matte, on-board sabotage, trade wizard, podium.',
      '\n8 file framework: index.html, style.css, data.js, game.js, bot.js, audio.js, ui.js, main.js.'
    );

    window.ColorUp = {
      UI, UIDriver, AuctionDriver, BotDriver, TutorBotDriver, Game,
      DATA, Util, BoardGen, Sound, AudioManager, Store, PRESETS, AUDIO_MANIFEST
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();

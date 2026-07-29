(function(){
  // Canvas und Zeichenkontext holen
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height; // 900 x 600, siehe index.html

  // die vier Tonnen, in der Reihenfolge, in der sie später nebeneinander stehen
  const BIN_TYPES = ['papier','bio','verpackung','restmuell'];
  const BIN_INFO = {
    papier:     { label:'Papier',     color:'#2C5FA8', dark:'#1F4680' },
    bio:        { label:'Bio',        color:'#7A4B2E', dark:'#5C3820' },
    verpackung: { label:'Verpackung', color:'#F4B400', dark:'#C89200' },
    restmuell:  { label:'Restmüll',   color:'#383C40', dark:'#24272A' }
  };

  // ein paar Zahlen fürs Layout, einfach so lange angepasst bis es sich gut gespielt hat
  const BIN_HEIGHT = 130;
  const BIN_Y = H - BIN_HEIGHT;   // ab hier (von oben gemessen) stehen die Tonnen
  const BIN_WIDTH = W / 4;        // jede Tonne bekommt ein Viertel der Breite
  const PLAYER_Y = BIN_Y - 55;    // die Figur steht ein Stück über den Tonnen
  const PLAYER_RADIUS = 28;
  const CATCH_RADIUS = 58;        // wie nah man am fallenden Müll sein muss, um ihn zu fangen
  const PLAYER_SPEED = 560;       // Pixel pro Sekunde

  // vor welcher der 4 Tonnen (0 bis 3) steht die Figur gerade
  function binZoneIndex(x){
    return Math.min(3, Math.max(0, Math.floor(x / BIN_WIDTH)));
  }

  // Canvas kann von Haus aus keine abgerundeten Rechtecke, deshalb selbst gebaut
  function roundRect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  // Die Müll-Symbole. Alles mit einfachen Formen gezeichnet (Kreise, Rechtecke, ein
  // paar Kurven), damit keine Bilddateien mitgeliefert werden müssen.
  function drawApple(x,y,s){
    ctx.fillStyle = '#D6473C';
    ctx.beginPath(); ctx.arc(x, y, s*0.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(237,234,224,0.9)';
    ctx.beginPath(); ctx.arc(x + s*0.32, y - s*0.06, s*0.16, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#6B4A2E'; ctx.lineWidth = s*0.08; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x, y - s*0.5); ctx.lineTo(x + s*0.06, y - s*0.74); ctx.stroke();
    ctx.fillStyle = '#5EA24B';
    ctx.beginPath(); ctx.ellipse(x + s*0.2, y - s*0.66, s*0.14, s*0.08, -0.5, 0, Math.PI*2); ctx.fill();
  }
  function drawBanana(x,y,s){
    ctx.strokeStyle = '#E8C13B'; ctx.lineWidth = s*0.26; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s*0.36, y + s*0.3);
    ctx.quadraticCurveTo(x, y - s*0.48, x + s*0.38, y + s*0.02);
    ctx.stroke();
    ctx.fillStyle = '#7A6B3A';
    ctx.beginPath(); ctx.arc(x - s*0.36, y + s*0.3, s*0.07, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s*0.38, y + s*0.02, s*0.06, 0, Math.PI*2); ctx.fill();
  }
  function drawNewspaper(x,y,s){
    ctx.fillStyle = '#E7E5DD';
    ctx.fillRect(x - s*0.45, y - s*0.32, s*0.9, s*0.64);
    ctx.strokeStyle = '#B7B3A5'; ctx.lineWidth = s*0.035;
    ctx.strokeRect(x - s*0.45, y - s*0.32, s*0.9, s*0.64);
    ctx.strokeStyle = '#9B978A'; ctx.lineWidth = s*0.03;
    // die paar Linien sollen einfach nur wie Textzeilen aussehen
    for (let i=0;i<3;i++){
      ctx.beginPath();
      ctx.moveTo(x - s*0.32, y - s*0.14 + i*s*0.18);
      ctx.lineTo(x + s*0.32, y - s*0.14 + i*s*0.18);
      ctx.stroke();
    }
  }
  function drawBox(x,y,s){
    ctx.fillStyle = '#B98650';
    ctx.fillRect(x - s*0.42, y - s*0.34, s*0.84, s*0.68);
    ctx.strokeStyle = '#8A5F34'; ctx.lineWidth = s*0.05;
    ctx.strokeRect(x - s*0.42, y - s*0.34, s*0.84, s*0.68);
    ctx.beginPath(); ctx.moveTo(x - s*0.42, y - s*0.02); ctx.lineTo(x + s*0.42, y - s*0.02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - s*0.34); ctx.lineTo(x, y - s*0.02); ctx.stroke();
  }
  function drawYogurt(x,y,s){
    ctx.fillStyle = '#F7F4EA';
    ctx.beginPath();
    ctx.moveTo(x - s*0.28, y - s*0.3);
    ctx.lineTo(x + s*0.28, y - s*0.3);
    ctx.lineTo(x + s*0.2, y + s*0.36);
    ctx.lineTo(x - s*0.2, y + s*0.36);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#D8D2C0'; ctx.lineWidth = s*0.03; ctx.stroke();
    ctx.fillStyle = '#E1503F';
    ctx.fillRect(x - s*0.3, y - s*0.4, s*0.6, s*0.12); // der Deckel
  }
  function drawCan(x,y,s){
    ctx.fillStyle = '#C6CBCF';
    ctx.fillRect(x - s*0.3, y - s*0.4, s*0.6, s*0.8);
    ctx.fillStyle = '#E1503F';
    ctx.fillRect(x - s*0.3, y - s*0.12, s*0.6, s*0.22); // Etikett
    ctx.strokeStyle = '#9FA6AC'; ctx.lineWidth = s*0.04;
    ctx.strokeRect(x - s*0.3, y - s*0.4, s*0.6, s*0.8);
  }
  function drawPlate(x,y,s){
    ctx.fillStyle = '#D8DADC';
    ctx.beginPath(); ctx.arc(x,y,s*0.48,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#AEB2B6'; ctx.lineWidth = s*0.04;
    ctx.beginPath(); ctx.arc(x,y,s*0.48,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x,y,s*0.28,0,Math.PI*2); ctx.stroke();
    // der Sprung im Teller
    ctx.strokeStyle = '#6D7176'; ctx.lineWidth = s*0.05;
    ctx.beginPath();
    ctx.moveTo(x - s*0.3, y - s*0.32);
    ctx.lineTo(x + s*0.05, y - s*0.02);
    ctx.lineTo(x - s*0.12, y + s*0.3);
    ctx.stroke();
  }
  function drawGum(x,y,s){
    ctx.fillStyle = '#E792B0';
    ctx.beginPath();
    ctx.moveTo(x - s*0.3, y);
    ctx.quadraticCurveTo(x - s*0.3, y - s*0.35, x, y - s*0.3);
    ctx.quadraticCurveTo(x + s*0.35, y - s*0.3, x + s*0.28, y + s*0.05);
    ctx.quadraticCurveTo(x + s*0.2, y + s*0.35, x - s*0.1, y + s*0.28);
    ctx.quadraticCurveTo(x - s*0.35, y + s*0.25, x - s*0.3, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#C96693';
    ctx.beginPath(); ctx.arc(x - s*0.05, y - s*0.05, s*0.06, 0, Math.PI*2); ctx.fill();
  }

  // welches Symbol gehört zu welcher Tonne
  const ITEM_TYPES = [
    { type:'bio',        name:'Apfelrest',       draw:drawApple },
    { type:'bio',        name:'Bananenschale',   draw:drawBanana },
    { type:'papier',     name:'Zeitung',         draw:drawNewspaper },
    { type:'papier',     name:'Karton',          draw:drawBox },
    { type:'verpackung', name:'Joghurtbecher',   draw:drawYogurt },
    { type:'verpackung', name:'Konservendose',   draw:drawCan },
    { type:'restmuell',  name:'Kaputter Teller', draw:drawPlate },
    { type:'restmuell',  name:'Kaugummi',        draw:drawGum }
  ];

  // Sound: keine Audio-Dateien im Projekt, sondern einfache Pieptöne live per Web Audio
  // API erzeugt. audioCtx darf erst nach einem Klick erzeugt werden, sonst blockieren
  // die meisten Browser die Wiedergabe automatisch.
  let audioCtx = null;
  function ensureAudio(){
    if (!audioCtx){
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e){ audioCtx = null; }
    } else if (audioCtx.state === 'suspended'){
      audioCtx.resume();
    }
  }
  function beep(freq, dur, type, vol, delay){
    if (!audioCtx) return;
    type = type || 'sine'; vol = (vol===undefined)?0.2:vol; delay = delay||0;
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur); // sanftes Ausklingen statt hartem Abbruch
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  const sfx = {
    catchIt: function(){ beep(520,0.08,'triangle',0.16); },
    correct: function(){ beep(660,0.09,'triangle',0.18); beep(880,0.13,'triangle',0.16,0.09); },
    wrong:   function(){ beep(150,0.24,'sawtooth',0.14); },
    miss:    function(){ beep(230,0.16,'sine',0.12); beep(150,0.2,'sine',0.1,0.06); },
    gameover:function(){ beep(420,0.16,'sine',0.16); beep(320,0.16,'sine',0.16,0.16); beep(210,0.32,'sine',0.16,0.32); },
    start:   function(){ beep(440,0.08,'triangle',0.16); beep(660,0.11,'triangle',0.16,0.08); }
  };

  // ------------------------------------------------------------
  // Der ganze Spielzustand steht hier oben, damit man ihn nicht
  // in jeder Funktion neu suchen muss
  // ------------------------------------------------------------
  let state = 'title'; // 'title', 'playing' oder 'gameover'
  let player = { x: W/2, carrying: null };
  let items = [];
  let effects = [];
  let binFlashState = [null,null,null,null];
  let score = 0, highScore = 0, pollution = 0, combo = 0;
  let spawnTimer = 1.2, spawnInterval = 2.6;
  let fallSpeed = 120;
  let elapsed = 0;
  let keys = { left:false, right:false };
  let dropRequested = false;
  let lastTime = null;
  let cloudOffset = 0;
  let playerName = 'Spieler';

  // Bestenliste: bewusst nur lokal im Browser gespeichert (kein Server, keine
  // Datenbank dahinter). Reicht völlig, wenn bei einer Vorführung mehrere Leute
  // nacheinander auf demselben Rechner spielen - setzt sich aber beim Neuladen
  // der Seite zurück, weil es keinen echten Speicherort dafür gibt.
  let leaderboard = [];

  const scoreVal = document.getElementById('scoreVal');
  const highScoreVal = document.getElementById('highScoreVal');
  const enviroFill = document.getElementById('enviroFill');
  const enviroIcon = document.getElementById('enviroIcon');
  const titlePanel = document.getElementById('titlePanel');
  const gameOverPanel = document.getElementById('gameOverPanel');
  const nameInput = document.getElementById('nameInput');
  const finalScore = document.getElementById('finalScore');
  const finalHigh = document.getElementById('finalHigh');

  // falls jemand seinen Namen mit Sonderzeichen wie < oder " eintippt, soll das
  // nicht das HTML der Bestenliste durcheinanderbringen
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function renderLeaderboard(){
    const lists = document.querySelectorAll('.lb-list');
    const html = leaderboard.length === 0
      ? '<li class="lb-empty">Noch keine Einträge – sei der Erste!</li>'
      : leaderboard.map(function(e, i){
          return '<li><span>' + (i+1) + '. ' + escapeHtml(e.name) + '</span><span>' + e.score + '</span></li>';
        }).join('');
    lists.forEach(function(el){ el.innerHTML = html; });
  }

  function submitScore(name, sc){
    leaderboard.push({ name:name, score:sc });
    leaderboard.sort(function(a,b){ return b.score - a.score; });
    leaderboard = leaderboard.slice(0, 8); // nur die Top 8 behalten, mehr braucht die Liste nicht
    renderLeaderboard();
  }

  function resetGame(){
    player = { x: W/2, carrying:null };
    items = [];
    effects = [];
    binFlashState = [null,null,null,null];
    score = 0; pollution = 0; combo = 0;
    spawnTimer = 1.2; spawnInterval = 2.6;
    fallSpeed = 120; elapsed = 0;
    updateHud();
  }

  function updateHud(){
    scoreVal.textContent = score;
    highScoreVal.textContent = highScore;
    const health = Math.max(0, 100 - pollution); // Umweltbalken ist quasi das Gegenteil von "pollution"
    enviroFill.style.width = health + '%';
    let color;
    if (health > 66) color = '#43B369';
    else if (health > 33) color = '#E3A93B';
    else color = '#E1503F';
    enviroFill.style.backgroundColor = color;
    enviroIcon.textContent = health > 66 ? '🙂' : (health > 33 ? '😟' : '💨');
  }

  function spawnItem(){
    const typeInfo = ITEM_TYPES[Math.floor(Math.random()*ITEM_TYPES.length)];
    const margin = 50; // damit nichts direkt am Bildschirmrand spawnt
    const x = margin + Math.random() * (W - margin*2);
    items.push({ x:x, y:-30, vy:fallSpeed, typeInfo:typeInfo, size:46 });
  }

  function addEffect(x,y,text,color){
    effects.push({ x:x, y:y, text:text, color:color, life:0, maxLife:0.8 });
  }

  function flashBin(idx, good){
    binFlashState[idx] = { life:0.4, good:good };
  }

  function startGame(){
    ensureAudio(); // erst hier, weil der Browser einen Klick vom Nutzer sehen will
    sfx.start();
    playerName = (nameInput.value || '').trim().slice(0,14) || 'Spieler';
    resetGame();
    state = 'playing';
    titlePanel.classList.add('hidden');
    gameOverPanel.classList.add('hidden');
  }

  function endGame(){
    state = 'gameover';
    if (score > highScore) highScore = score;
    finalScore.textContent = score;
    finalHigh.textContent = highScore;
    updateHud();
    submitScore(playerName, score);
    gameOverPanel.classList.remove('hidden');
    sfx.gameover();
  }

  function update(dt){
    elapsed += dt;
    cloudOffset += dt * 8;

    // je länger man spielt, desto schneller/enger wird es -- die Zahlen sind
    // einfach durch Ausprobieren entstanden, bis es sich fair, aber fordernd anfühlt
    fallSpeed = 120 + Math.min(140, elapsed * 2.2);
    spawnInterval = Math.max(1.1, 2.6 - elapsed * 0.03);

    let dir = 0;
    if (keys.left) dir -= 1;
    if (keys.right) dir += 1;
    player.x += dir * PLAYER_SPEED * dt;
    player.x = Math.max(PLAYER_RADIUS, Math.min(W - PLAYER_RADIUS, player.x));

    // Abliefern passiert NICHT automatisch, sondern nur wenn die Leertaste gedrückt
    // wurde. Am Anfang hatte ich das automatisch gemacht (sobald man in einer Zone
    // steht), aber dann landete der Müll immer sofort in der Tonne, in der man ihn
    // zufällig gefangen hat -- man konnte gar nicht mehr woanders hinlaufen. Deshalb
    // jetzt bewusst als eigene Aktion.
    if (dropRequested){
      if (player.carrying !== null){
        const zone = binZoneIndex(player.x);
        const zoneType = BIN_TYPES[zone];
        if (zoneType === player.carrying.type){
          const bonus = combo >= 3 ? Math.min(20, (combo-2)*2) : 0;
          const gained = 10 + bonus;
          score += gained;
          combo += 1;
          pollution = Math.max(0, pollution - 6); // richtig sortieren "heilt" die Umwelt ein bisschen
          addEffect(player.x, PLAYER_Y - 40, '+' + gained, '#2E8248');
          flashBin(zone, true);
          sfx.correct();
        } else {
          pollution = Math.min(100, pollution + 12);
          combo = 0;
          addEffect(player.x, PLAYER_Y - 40, 'Falsch!', '#B23A2C');
          flashBin(zone, false);
          sfx.wrong();
        }
        player.carrying = null;
        updateHud();
      }
      dropRequested = false;
      if (pollution >= 100){ endGame(); return; }
    }

    // alle fallenden Gegenstände einen Schritt weiter nach unten bewegen und prüfen,
    // ob einer davon gerade die Höhe der Spielfigur erreicht hat
    for (let i = items.length - 1; i >= 0; i--){
      const it = items[i];
      it.y += it.vy * dt;

      if (it.y >= PLAYER_Y){
        if (player.carrying === null && Math.abs(it.x - player.x) <= CATCH_RADIUS){
          // nah genug dran und die Hände sind frei -> gefangen
          player.carrying = it.typeInfo;
          addEffect(it.x, PLAYER_Y - 20, '✓', '#2E8248');
          sfx.catchIt();
        } else {
          // entweder war man zu weit weg, oder man trägt schon was -> verpasst
          pollution = Math.min(100, pollution + 15);
          combo = 0;
          addEffect(it.x, PLAYER_Y, 'verpasst', '#B23A2C');
          sfx.miss();
          updateHud();
        }
        items.splice(i,1);
        if (pollution >= 100){ endGame(); return; }
        continue;
      }
      if (it.y > H + 40){ items.splice(i,1); } // ganz unten aus dem Bild raus, aufräumen
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0){
      spawnItem();
      spawnTimer = spawnInterval + Math.random()*0.4; // etwas Zufall, damit es nicht wie ein Metronom tickt
    }

    // kleine Text-/Partikeleffekte ausblenden lassen
    for (let i = effects.length - 1; i >= 0; i--){
      effects[i].life += dt;
      if (effects[i].life >= effects[i].maxLife) effects.splice(i,1);
    }
    for (let i=0;i<4;i++){
      if (binFlashState[i]){
        binFlashState[i].life -= dt;
        if (binFlashState[i].life <= 0) binFlashState[i] = null;
      }
    }
  }

  // -------------------- ab hier nur noch Zeichnen --------------------

  function drawSky(){
    const g = ctx.createLinearGradient(0,0,0,BIN_Y);
    g.addColorStop(0, '#BFEFDD');
    g.addColorStop(1, '#EAF9F0');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,BIN_Y);
  }
  function drawCloud(x,y,r){
    // eine Wolke ist einfach ein Haufen überlappender Kreise
    ctx.beginPath();
    ctx.arc(x, y, r*0.6, 0, Math.PI*2);
    ctx.arc(x+r*0.55, y+r*0.1, r*0.45, 0, Math.PI*2);
    ctx.arc(x-r*0.5, y+r*0.15, r*0.4, 0, Math.PI*2);
    ctx.arc(x+r*0.1, y-r*0.2, r*0.42, 0, Math.PI*2);
    ctx.fill();
  }
  function drawClouds(){
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const positions = [[100,70,50],[420,50,62],[700,90,45]];
    positions.forEach(function(p, idx){
      const x = ((p[0] + cloudOffset*(0.5+idx*0.2)) % (W+160)) - 80;
      drawCloud(x, p[1], p[2]);
    });
  }
  function drawGround(){
    ctx.fillStyle = '#BFE3A8';
    ctx.fillRect(0, BIN_Y - 18, W, 18);
    ctx.fillStyle = '#8FBF6E';
    for (let i=0;i<10;i++){
      ctx.beginPath();
      ctx.arc(20 + i*(W-40)/9, BIN_Y - 18, 5, Math.PI, 0);
      ctx.fill();
    }
  }
  function drawBins(){
    const playerZone = (state==='playing') ? binZoneIndex(player.x) : -1;
    const targetZone = (state==='playing' && player.carrying) ? BIN_TYPES.indexOf(player.carrying.type) : -1;

    BIN_TYPES.forEach(function(type, i){
      const info = BIN_INFO[type];
      const x0 = i * BIN_WIDTH;
      const highlight = (i === playerZone);   // hier steht die Figur gerade
      const target = (i === targetZone);      // hier sollte der getragene Müll hin
      const flash = binFlashState[i];

      ctx.save();
      if (target){
        // dezentes Pulsieren als Hinweis, welche Tonne die richtige ist
        const pulse = 0.5 + 0.5*Math.sin(elapsed*6);
        ctx.shadowColor = 'rgba(67,179,105,' + (0.5+0.3*pulse) + ')';
        ctx.shadowBlur = 22;
      }
      ctx.fillStyle = info.color;
      roundRect(x0+14, BIN_Y+22, BIN_WIDTH-28, BIN_HEIGHT-32, 10);
      ctx.fill();
      ctx.fillStyle = info.dark;
      roundRect(x0+8, BIN_Y+6, BIN_WIDTH-16, 22, 8); // der Deckel
      ctx.fill();
      ctx.restore();

      if (highlight){
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 4;
        roundRect(x0+14, BIN_Y+22, BIN_WIDTH-28, BIN_HEIGHT-32, 10);
        ctx.stroke();
      }
      if (flash){
        const a = Math.max(0, flash.life/0.4) * 0.55;
        ctx.fillStyle = flash.good ? 'rgba(67,179,105,'+a+')' : 'rgba(225,80,63,'+a+')';
        roundRect(x0+14, BIN_Y+22, BIN_WIDTH-28, BIN_HEIGHT-32, 10);
        ctx.fill();
      }

      ctx.fillStyle = '#FFF7EA';
      ctx.font = "700 15px 'Baloo 2', 'Trebuchet MS', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(info.label, x0 + BIN_WIDTH/2, BIN_Y + BIN_HEIGHT - 12);
    });
  }
  function drawItems(){
    items.forEach(function(it){ it.typeInfo.draw(it.x, it.y, it.size); });
  }
  function drawPlayer(){
    const x = player.x, y = PLAYER_Y;
    // Füße
    ctx.fillStyle = '#33635C';
    ctx.beginPath(); ctx.ellipse(x-12,y+24,9,5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x+12,y+24,9,5,0,0,Math.PI*2); ctx.fill();

    // Körper
    ctx.fillStyle = '#4FC1B0';
    roundRect(x-26, y-26, 52, 50, 16); ctx.fill();

    // Gesichtsplatte
    ctx.fillStyle = '#FFF7EA';
    roundRect(x-18, y-14, 36, 24, 10); ctx.fill();

    // Augen
    ctx.fillStyle = '#2B2620';
    ctx.beginPath(); ctx.arc(x-8, y-2, 3.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x+8, y-2, 3.2, 0, Math.PI*2); ctx.fill();

    // Antenne
    ctx.strokeStyle = '#33635C'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y-26); ctx.lineTo(x, y-38); ctx.stroke();
    ctx.fillStyle = '#F4B400';
    ctx.beginPath(); ctx.arc(x, y-40, 4, 0, Math.PI*2); ctx.fill();

    // falls gerade was getragen wird, schwebt es leicht wippend über dem Kopf
    if (player.carrying){
      const bob = Math.sin(elapsed*6) * 4;
      player.carrying.draw(x, y-58+bob, 34);
      ctx.fillStyle = 'rgba(43,38,32,0.6)';
      ctx.font = "700 11px 'Nunito', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('Leertaste zum Ablegen', x, y-82+bob);
    }
  }
  function drawEffects(){
    // kleine Texte, die nach oben wegfliegen und dabei ausblenden
    effects.forEach(function(e){
      const t = e.life / e.maxLife;
      ctx.globalAlpha = Math.max(0, 1-t);
      ctx.fillStyle = e.color;
      ctx.font = "700 18px 'Baloo 2', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(e.text, e.x, e.y - t*30);
      ctx.globalAlpha = 1;
    });
  }
  function render(){
    ctx.clearRect(0,0,W,H);
    drawSky();
    drawClouds();
    drawGround();
    drawBins();
    drawItems();
    drawPlayer();
    drawEffects();
  }

  function loop(ts){
    if (lastTime === null) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    lastTime = ts;
    dt = Math.min(dt, 0.05); // falls der Tab kurz inaktiv war, keinen riesigen Sprung machen
    if (state === 'playing') update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // -------------------- Steuerung --------------------
  window.addEventListener('keydown', function(e){
    const typing = (document.activeElement === nameInput);
    if (typing){
      // im Namensfeld sollen Pfeiltasten & Co ganz normal funktionieren, nicht die Figur bewegen
      if (e.code === 'Enter' && state === 'title') startGame();
      return;
    }
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].indexOf(e.code) !== -1) e.preventDefault();
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space' || e.code === 'Enter'){
      if (state === 'title' || state === 'gameover') startGame();
      else if (state === 'playing') dropRequested = true;
    }
    if ((e.code === 'ArrowDown' || e.code === 'KeyS') && state === 'playing') dropRequested = true;
  });
  window.addEventListener('keyup', function(e){
    if (document.activeElement === nameInput) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  });

  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('restartBtn').addEventListener('click', startGame);
  document.getElementById('toTitleBtn').addEventListener('click', function(){
    gameOverPanel.classList.add('hidden');
    titlePanel.classList.remove('hidden');
    state = 'title';
  });

  // kleine Hilfsfunktion, damit ich den Touch-Buttons nicht 6 Zeilen einzeln schreiben muss
  function bindHold(el, onDown, onUp){
    const start = function(ev){ ev.preventDefault(); onDown(); };
    const end = function(ev){ ev.preventDefault(); onUp(); };
    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start, {passive:false});
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }
  bindHold(document.getElementById('touchLeft'),  function(){keys.left=true;},  function(){keys.left=false;});
  bindHold(document.getElementById('touchRight'), function(){keys.right=true;}, function(){keys.right=false;});
  bindHold(document.getElementById('touchDrop'),  function(){ if (state==='playing') dropRequested = true; }, function(){});

  // einmal beim Laden der Seite die Anzeige auf den Startzustand bringen
  updateHud();
  renderLeaderboard();
})();

// Alles hier drin steckt in einer sofort ausgeführten Funktion (IIFE).
// Der Grund: alle let/const-Variablen darin (score, player, ...) bleiben
// PRIVAT innerhalb dieser Funktion und landen nicht im globalen
// Namensraum des Browsers. Ohne das könnte irgendein anderes Skript aus
// Versehen eine Variable "score" überschreiben und alles durcheinanderbringen.
(function(){
  // getElementById holt sich das <canvas> aus dem HTML (id="gameCanvas").
  // getContext('2d') gibt das Werkzeug zum Zeichnen zurück -- ctx ist ab
  // hier das Objekt, mit dem ALLES gezeichnet wird (ctx.fillRect, ctx.arc, ...).
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height; // 900 x 600, siehe index.html

  // die vier Tonnen, in der Reihenfolge, in der sie später nebeneinander
  // stehen (Index 0 = ganz links, Index 3 = ganz rechts)
  const BIN_TYPES = ['papier','bio','verpackung','restmuell'];
  // BIN_INFO ist wie eine kleine Tabelle: Schlüssel 'papier' -> Zusatzinfos
  // (Anzeigename + zwei Farbtöne fürs Zeichnen)
  const BIN_INFO = {
    papier:     { label:'Papier',     color:'#2C5FA8', dark:'#1F4680' },
    bio:        { label:'Bio',        color:'#7A4B2E', dark:'#5C3820' },
    verpackung: { label:'Verpackung', color:'#F4B400', dark:'#C89200' },
    restmuell:  { label:'Restmüll',   color:'#383C40', dark:'#24272A' }
  };

  // Wichtig beim Canvas: (0,0) ist OBEN LINKS, y wird größer
  // je weiter man nach unten geht.
  const BIN_HEIGHT = 130;
  const BIN_Y = H - BIN_HEIGHT;   // ab hier (von oben gemessen) stehen die Tonnen
  const BIN_WIDTH = W / 4;        // jede Tonne bekommt ein Viertel der Breite
  const PLAYER_Y = BIN_Y - 55;    // die Figur steht ein Stück über den Tonnen
  const PLAYER_RADIUS = 28;
  const CATCH_RADIUS = 58;        // wie nah man am fallenden Müll sein muss, um ihn zu fangen
  const PLAYER_SPEED = 560;       // Pixel pro Sekunde

  // rechnet aus einer x-Position aus, vor welcher der 4 Tonnen (0-3) man
  // gerade steht. Math.floor(x / BIN_WIDTH) rundet ab (z.B. 2.4 -> 2).
  // Math.max(0,...) und Math.min(3,...) sind eine Sicherheitsklammer: die
  // verhindern, dass bei extremen x-Werten ein Index < 0 oder > 3
  // rauskommt, was später einen Absturz verursachen würde (BIN_TYPES[4]
  // gibt es nicht).
  function binZoneIndex(x){
    return Math.min(3, Math.max(0, Math.floor(x / BIN_WIDTH)));
  }

  // Canvas kann von Haus aus nur scharfe Ecken (ctx.rect), deshalb hier
  // selbst gebaut: moveTo setzt den Startpunkt, jedes arcTo zeichnet eine
  // gerade Kante UND die abgerundete Ecke danach in einem Rutsch (r =
  // Eckenradius). Zeichnet nur den Pfad vor -- ob gefüllt (ctx.fill()) oder
  // nur umrandet (ctx.stroke()) wird, entscheidet der Code der das aufruft.
  function roundRect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  // new Image() erzeugt ein leeres Bild-Objekt im Speicher. Sobald img.src
  // gesetzt wird, startet der Browser IM HINTERGRUND (asynchron) den
  // Download -- der Code läuft direkt weiter, ohne zu warten. Deshalb kann
  // man das Bild nicht sofort zeichnen, siehe drawItemImage() unten.
  function loadItemImage(src){
    const img = new Image();
    img.src = src;
    return img;
  }

  // zeichnet ein Bild zentriert bei (x,y), so groß dass es in ein s×s Feld
  // passt, aber ohne das Seitenverhältnis zu verzerren.
  function drawItemImage(img, x, y, s){
    // img.complete ist true, sobald der Download fertig ist (egal ob
    // erfolgreich oder nicht). img.naturalWidth > 0 prüft zusätzlich, ob
    // es WIRKLICH ein gültiges Bild ist -- bei falschem Pfad wird
    // complete trotzdem true, aber naturalWidth bleibt 0.
    if (img.complete && img.naturalWidth > 0){
      const ratio = img.naturalWidth / img.naturalHeight;
      let w = s, h = s;
      // passt Breite/Höhe so an, dass ein hohes Bild schmaler, ein
      // breites Bild flacher gezeichnet wird -- nie verzerrt.
      if (ratio > 1){ h = s / ratio; } else { w = s * ratio; }
      // drawImage nimmt x/y als LINKE OBERE Ecke, deshalb x-w/2 (nicht
      // einfach x), um das Bild um den Mittelpunkt herum zu zentrieren.
      ctx.drawImage(img, x - w/2, y - h/2, w, h);
    } else {
      // Bild noch nicht geladen oder Pfad falsch -- grauer Platzhalter,
      // damit man sofort sieht wo ein Bild fehlt, statt einer leeren Fläche.
      ctx.fillStyle = 'rgba(150,150,150,0.5)';
      ctx.beginPath(); ctx.arc(x, y, s*0.4, 0, Math.PI*2); ctx.fill();
    }
  }

  // welches Bild gehört zu welcher Tonne -- Dateinamen ggf. an die eigenen
  // Bilder anpassen. "type" muss zu einem Wert aus BIN_TYPES passen.
  const ITEM_TYPES = [
    { type:'bio',        name:'Apfelrest',       img: loadItemImage('images/apfelrest.png') },
    { type:'bio',        name:'Bananenschale',   img: loadItemImage('images/bananenschale.png') },
    { type:'papier',     name:'Zeitung',         img: loadItemImage('images/zeitung.png') },
    { type:'papier',     name:'Karton',          img: loadItemImage('images/karton.png') },
    { type:'verpackung', name:'Joghurtbecher',   img: loadItemImage('images/joghurtbecher.png') },
    { type:'verpackung', name:'Konservendose',   img: loadItemImage('images/konservendose.png') },
    { type:'restmuell',  name:'Kaputter Teller', img: loadItemImage('images/kaputter-teller.png') },
    { type:'restmuell',  name:'Kaugummi',        img: loadItemImage('images/kaugummi.png') }
  ];

  // ---- Sound ----
  // Web Audio API: erzeugt Töne direkt im Code, ganz ohne MP3-Dateien.
  let audioCtx = null;
  function ensureAudio(){
    if (!audioCtx){
      // window.AudioContext || window.webkitAudioContext: manche älteren
      // Browser kennen nur den Namen mit webkit-Vorsilbe, || (oder)
      // nimmt einfach was verfügbar ist. try/catch fängt ab, falls der
      // Browser gar keine Web Audio API kann -- Spiel läuft dann einfach
      // ohne Sound weiter statt abzustürzen.
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e){ audioCtx = null; }
    } else if (audioCtx.state === 'suspended'){
      audioCtx.resume();
    }
  }
  // erzeugt einen einzelnen Piepton. Browser verbieten Audio-Start VOR
  // einem Klick vom Nutzer (Autoplay-Schutz) -- deshalb wird ensureAudio()
  // erst in startGame() aufgerufen, also nach dem Klick auf "Spiel starten".
  function beep(freq, dur, type, vol, delay){
    if (!audioCtx) return;
    type = type || 'sine'; vol = (vol===undefined)?0.2:vol; delay = delay||0;
    const t0 = audioCtx.currentTime + delay;
    // ein oscillator erzeugt eine Schwingung mit bestimmter Tonhöhe
    // (frequency) und Wellenform (type -- 'sine' klingt weich, 'sawtooth'
    // schärfer/aggressiver, passend für den "Falsch"-Ton). gain regelt
    // die Lautstärke.
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur); // sanftes Ausklingen statt hartem Abbruch (klickt/knackt sonst)
    // connect() verbindet die Bausteine wie Kabel: Oszillator -> Lautstärkeregler -> Lautsprecher
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  // für jeden Spielmoment eine kleine Melodie -- manche nur ein Piepton,
  // manche zwei kurz hintereinander (letzter Parameter bei beep() ist die
  // Verzögerung in Sekunden, ergibt z.B. bei "correct" einen kleinen
  // aufsteigenden Erfolgs-Sound).
  const sfx = {
    catchIt: function(){ beep(520,0.08,'triangle',0.16); },
    correct: function(){ beep(660,0.09,'triangle',0.18); beep(880,0.13,'triangle',0.16,0.09); },
    wrong:   function(){ beep(150,0.24,'sawtooth',0.14); },
    miss:    function(){ beep(230,0.16,'sine',0.12); beep(150,0.2,'sine',0.1,0.06); },
    gameover:function(){ beep(420,0.16,'sine',0.16); beep(320,0.16,'sine',0.16,0.16); beep(210,0.32,'sine',0.16,0.32); },
    start:   function(){ beep(440,0.08,'triangle',0.16); beep(660,0.11,'triangle',0.16,0.08); }
  };

  // ------------------------------------------------------------
  // Der komplette Spielzustand, an einer Stelle gesammelt. "state" ist ein
  // simpler Text ('title'/'playing'/'gameover'), der überall abgefragt
  // wird um zu wissen was gerade zu tun ist ("Zustandsmaschine"-Prinzip).
  // player.carrying ist entweder null (trägt nichts) oder eines der
  // Objekte aus ITEM_TYPES. items/effects sind Arrays, die während des
  // Spiels wachsen und schrumpfen.
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

  // alle Verweise auf HTML-Elemente EINMAL am Anfang geholt und gespeichert,
  // statt sie immer wieder neu zu suchen (getElementById ist vergleichsweise
  // "teuer", einmal reicht).
  const scoreVal = document.getElementById('scoreVal');
  const highScoreVal = document.getElementById('highScoreVal');
  const enviroFill = document.getElementById('enviroFill');
  const enviroIcon = document.getElementById('enviroIcon');
  const titlePanel = document.getElementById('titlePanel');
  const gameOverPanel = document.getElementById('gameOverPanel');
  const nameInput = document.getElementById('nameInput');
  const finalScore = document.getElementById('finalScore');
  const finalHigh = document.getElementById('finalHigh');

  // Sicherheits-Detail: tippt jemand z.B. <b>Test</b> ins Namensfeld und der
  // Name landet später per innerHTML in der Bestenliste, würde der Browser
  // das als ECHTES HTML interpretieren statt als Text anzuzeigen (könnte
  // das Layout kaputt machen). Der reguläre Ausdruck /[&<>"']/g sucht nach
  // diesen Sonderzeichen und ersetzt jedes durch seinen harmlosen HTML-Code
  // (z.B. "<" -> "&lt;"), sodass es nur noch als Text angezeigt wird.
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function renderLeaderboard(){
    // querySelectorAll('.lb-list') findet ALLE Elemente mit dieser Klasse
    // (die zwei <ol>-Listen aus dem HTML: Start- und Game-Over-Bildschirm)
    const lists = document.querySelectorAll('.lb-list');
    // der ?: ist ein ternärer Operator -- Kurzform für if/else in einem
    // Ausdruck: "ist die Liste leer, nimm den linken Text, sonst den rechten"
    const html = leaderboard.length === 0
      ? '<li class="lb-empty">Noch keine Einträge – sei der Erste!</li>'
      // .map(...) erzeugt aus dem Array leaderboard ein neues Array aus
      // HTML-Text-Zeilen (ein <li> pro Eintrag), .join('') klebt diese
      // Zeilen zu einem einzigen langen String zusammen
      : leaderboard.map(function(e, i){
          return '<li><span>' + (i+1) + '. ' + escapeHtml(e.name) + '</span><span>' + e.score + '</span></li>';
        }).join('');
    // setzt den HTML-Text in BEIDE gefundenen Listen gleichzeitig ein
    lists.forEach(function(el){ el.innerHTML = html; });
  }

  function submitScore(name, sc){
    leaderboard.push({ name:name, score:sc }); // push() hängt hinten an
    // sort() mit (a,b) => b.score - a.score ist die Standard-Art, ein Array
    // ABSTEIGEND nach Zahlen zu sortieren: ist das Ergebnis negativ, bleibt
    // a vor b; ist es positiv, tauschen sie die Plätze. b.score - a.score
    // sorgt dafür, dass der HÖHERE Score vorne landet.
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
    items.push({ x:x, y:-30, vy:fallSpeed, typeInfo:typeInfo, size:70 });
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

  // dt = "Delta Time" -- die Zeit in Sekunden seit dem letzten Frame (meist
  // ca. 0.016s bei 60 Bildern/Sekunde). WARUM DAS WICHTIG IST: würde man
  // z.B. player.x += 5 pro Frame rechnen, wäre die Bewegung auf einem
  // schnellen Bildschirm (120Hz, doppelt so viele Frames) doppelt so
  // schnell wie auf einem langsamen (60Hz). Rechnet man stattdessen
  // GESCHWINDIGKEIT * dt, bewegt sich alles auf JEDEM Gerät gleich schnell
  // (Pixel pro SEKUNDE, nicht pro Frame).
  function update(dt){
    elapsed += dt;
    cloudOffset += dt * 8;

    // Schwierigkeitskurve: elapsed ist die Gesamtzeit seit Spielstart.
    // fallSpeed startet bei 120 und steigt mit der Zeit, aber Math.min(140,..)
    // deckelt den ZUWACHS bei 140 (Endgeschwindigkeit max. 260) -- sonst würde
    // das Spiel nach ein paar Minuten unspielbar schnell. spawnInterval
    // (Pause zwischen zwei neuen Gegenständen) sinkt entsprechend, aber
    // Math.max(1.1,..) verhindert eine Pause kürzer als 1,1 Sekunden.
    // Die Zahlen sind einfach durch Ausprobieren entstanden, bis es sich
    // fair, aber fordernd anfühlt.
    fallSpeed = 120 + Math.min(140, elapsed * 2.2);
    spawnInterval = Math.max(1.1, 2.6 - elapsed * 0.03);

    // keys.left/right sind einfache true/false-Werte, von den
    // Tastatur-Events weiter unten gesetzt. Sind beide gedrückt, heben sie
    // sich gegenseitig auf (dir bleibt 0) -- praktisch, ohne Extra-Abfrage.
    let dir = 0;
    if (keys.left) dir -= 1;
    if (keys.right) dir += 1;
    player.x += dir * PLAYER_SPEED * dt;
    // Begrenzung (Clamping): verhindert, dass die Figur über den linken
    // oder rechten Bildschirmrand hinausläuft.
    player.x = Math.max(PLAYER_RADIUS, Math.min(W - PLAYER_RADIUS, player.x));

    // Abliefern passiert NICHT automatisch, sondern nur wenn die Leertaste
    // gedrückt wurde. Am Anfang war das automatisch (sobald man in einer
    // Zone steht), aber dann landete der Müll immer sofort in der Tonne, in
    // der man ihn zufällig gefangen hat -- man konnte gar nicht mehr
    // woanders hinlaufen. Deshalb jetzt bewusst als eigene Aktion.
    if (dropRequested){
      if (player.carrying !== null){
        const zone = binZoneIndex(player.x);
        const zoneType = BIN_TYPES[zone];
        if (zoneType === player.carrying.type){
          // Kombo-Bonus: ab der 4. richtigen Sortierung in Folge gibt's
          // Extra-Punkte, gedeckelt bei +20
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
      // return bricht die GESAMTE update()-Funktion sofort ab, falls das
      // Spiel gerade vorbei ist -- der restliche Code in diesem Frame
      // (Gegenstände bewegen, neue spawnen) würde nach einem Game Over
      // sowieso keinen Sinn mehr ergeben.
      if (pollution >= 100){ endGame(); return; }
    }

    // Diese Schleife zählt RÜCKWÄRTS (i--), das ist ein bewusster Trick:
    // items.splice(i,1) entfernt ein Element mitten aus dem Array und
    // rückt alle nachfolgenden eine Position nach vorne. Würde man
    // VORWÄRTS zählen, würde man nach dem Entfernen eines Elements das
    // nächste überspringen (weil es an die Stelle des gelöschten gerutscht
    // ist). Rückwärts zählen vermeidet das komplett.
    for (let i = items.length - 1; i >= 0; i--){
      const it = items[i];
      it.y += it.vy * dt;

      // it.y >= PLAYER_Y prüft, ob der Gegenstand die Höhe der Spielfigur
      // erreicht hat -- der Moment, in dem entschieden wird: gefangen oder
      // verpasst.
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

    // simpler Countdown-Timer: jeden Frame wird dt abgezogen, bei 0 (oder
    // darunter) wird ein neuer Gegenstand erzeugt und der Timer neu
    // gestartet. Math.random()*0.4 addiert eine kleine zufällige Schwankung,
    // damit es nicht wie ein Metronom tickt.
    spawnTimer -= dt;
    if (spawnTimer <= 0){
      spawnItem();
      spawnTimer = spawnInterval + Math.random()*0.4;
    }

    // kleine Text-/Partikeleffekte ausblenden lassen (gleiches
    // Rückwärts-Prinzip wie oben bei den fallenden Gegenständen)
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
    // createLinearGradient(x0,y0,x1,y1) erzeugt einen Farbverlauf entlang
    // einer gedachten Linie -- hier von (0,0) oben nach (0,BIN_Y) kurz vor
    // den Tonnen, also senkrecht. addColorStop(0,farbe) legt die Farbe am
    // START der Linie fest, addColorStop(1,farbe) die Farbe am ENDE;
    // dazwischen mischt der Browser automatisch.
    const g = ctx.createLinearGradient(0,0,0,BIN_Y);
    g.addColorStop(0, '#BFEFDD');
    g.addColorStop(1, '#EAF9F0');
    ctx.fillStyle = g; // diesen Verlauf wie eine normale Farbe benutzen
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
    // % (Modulo) sorgt dafür, dass die Wolken-x-Position beim
    // Rausschieben rechts wieder links reinkommt (Endlosschleife)
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
    // playerZone/targetZone werden EINMAL VOR der Schleife berechnet
    // (nicht in jedem Durchlauf neu), weil sie sich für alle vier Tonnen
    // gleich bleiben -- spart unnötige Wiederholungen.
    const playerZone = (state==='playing') ? binZoneIndex(player.x) : -1;
    const targetZone = (state==='playing' && player.carrying) ? BIN_TYPES.indexOf(player.carrying.type) : -1;

    // BIN_TYPES.forEach((type, i) => ...) läuft einmal durch alle vier
    // Tonnen-Namen; type ist der Name selbst, i ist automatisch die
    // laufende Nummer (0,1,2,3), daraus wird die x-Position jeder Tonne
    // berechnet.
    BIN_TYPES.forEach(function(type, i){
      const info = BIN_INFO[type];
      const x0 = i * BIN_WIDTH;
      const highlight = (i === playerZone);   // hier steht die Figur gerade
      const target = (i === targetZone);      // hier sollte der getragene Müll hin
      const flash = binFlashState[i];

      // ctx.save() merkt sich den aktuellen Zeichenzustand (Farben,
      // Schatten-Einstellungen...), ctx.restore() stellt ihn wieder her.
      // Wichtig, weil shadowBlur/shadowColor sonst auch ALLE folgenden
      // Zeichenoperationen beeinflussen würden (auch Spielfigur,
      // Texteffekte...) -- mit save/restore gilt der Schatten nur für
      // diese eine Tonne dazwischen.
      ctx.save();
      if (target){
        // Math.sin(elapsed*6) schwingt stetig zwischen -1 und 1; 0.5+0.5*...
        // verschiebt das auf 0 bis 1 -- ergibt ein sanftes, endloses
        // Pulsieren (die Ziel-Tonne "atmet" quasi) als Hinweis, welche
        // Tonne die richtige ist.
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
    items.forEach(function(it){ drawItemImage(it.typeInfo.img, it.x, it.y, it.size); });
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
      drawItemImage(player.carrying.img, x, y-58+bob, 52);
      ctx.fillStyle = 'rgba(43,38,32,0.6)';
      ctx.font = "700 11px 'Nunito', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('Leertaste zum Ablegen', x, y-82+bob);
    }
  }
  function drawEffects(){
    // kleine Texte, die nach oben wegfliegen und dabei ausblenden.
    // t geht von 0 (frisch) bis 1 (fertig) -- globalAlpha steuert die
    // Durchsichtigkeit (1 = voll sichtbar, 0 = unsichtbar), e.y - t*30
    // lässt den Text dabei nach oben wandern.
    effects.forEach(function(e){
      const t = e.life / e.maxLife;
      ctx.globalAlpha = Math.max(0, 1-t);
      ctx.fillStyle = e.color;
      ctx.font = "700 18px 'Baloo 2', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(e.text, e.x, e.y - t*30);
      ctx.globalAlpha = 1; // wieder zurücksetzen, sonst wäre ALLES Folgende auch durchsichtig
    });
  }
  // render() zeichnet ein komplettes Bild -- Reihenfolge ist wichtig:
  // was zuerst gezeichnet wird, liegt HINTEN (wird von späteren
  // Aufrufen überdeckt). Himmel -> Wolken -> Boden -> Tonnen -> Müll ->
  // Figur -> Effekte, genau wie man es auch von hinten nach vorne malen würde.
  function render(){
    ctx.clearRect(0,0,W,H); // erst alles löschen, sonst würde sich das Bild vom letzten Frame durchmischen
    drawSky();
    drawClouds();
    drawGround();
    drawBins();
    drawItems();
    drawPlayer();
    drawEffects();
  }

  // Das ist die SPIELSCHLEIFE ("Game Loop") -- das Herzstück, das alles am
  // Laufen hält. requestAnimationFrame(loop) sagt dem Browser: "ruf loop
  // kurz vor dem nächsten Bildaufbau erneut auf" (meist 60x/Sekunde).
  function loop(ts){
    // ts = Zeitstempel in Millisekunden, den der Browser automatisch mitliefert
    if (lastTime === null) lastTime = ts;
    let dt = (ts - lastTime) / 1000; // Millisekunden -> Sekunden
    lastTime = ts;
    // Sicherheitsbremse: wechselt man kurz den Browser-Tab, könnte dt
    // plötzlich riesig sein (mehrere Sekunden) -- ohne diese Grenze würde
    // die Figur beim Zurückkommen einen riesigen Sprung machen.
    dt = Math.min(dt, 0.05);
    if (state === 'playing') update(dt);
    render();
    requestAnimationFrame(loop); // plant sich selbst für den nächsten Frame ein
  }
  requestAnimationFrame(loop); // startet die Schleife einmalig, danach hält sie sich von selbst am Laufen

  // -------------------- Steuerung --------------------
  window.addEventListener('keydown', function(e){
    // e enthält Infos über das Ereignis, u.a. e.code (welche Taste, z.B. 'ArrowLeft')
    const typing = (document.activeElement === nameInput);
    if (typing){
      // document.activeElement verrät, welches Element gerade den
      // Eingabefokus hat. Ist das Namensfeld dran, soll die Tastatur ganz
      // normal Text eintippen können statt die Figur zu bewegen.
      if (e.code === 'Enter' && state === 'title') startGame();
      return;
    }
    // e.preventDefault() unterdrückt das Standardverhalten des Browsers
    // für diese Taste -- Pfeiltasten/Leertaste würden sonst die Seite
    // scrollen, was beim Spielen ständig mitwackeln würde.
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

  // Hilfsfunktion, damit der Touch-Button-Code nicht 3x wiederholt werden
  // muss. onDown/onUp sind selbst Funktionen, die man beim Aufruf übergibt
  // (sogenannte "Callbacks"). Es werden bewusst BEIDE Event-Typen
  // abgedeckt (mousedown/up für Maus, touchstart/end für Touch), damit die
  // Buttons sowohl am PC (zum Testen) als auch auf dem Handy funktionieren.
  // mouseleave/touchcancel fangen ab, dass man den Finger wegzieht ohne
  // offiziell loszulassen -- sonst würde die Taste "hängen bleiben".
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
  // (0 Punkte, volle Umweltleiste, "Noch keine Einträge"), statt dass sie
  // leer/kaputt aussieht bevor man das erste Mal spielt
  updateHud();
  renderLeaderboard();
})();

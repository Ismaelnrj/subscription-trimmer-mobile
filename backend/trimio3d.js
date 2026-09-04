/* Trimio 3D backdrop.
 *
 * A depth field of subscription cards drifting behind the page. As the
 * reader scrolls past "how it works", the cards flip from forgotten
 * (grey, unmarked, no date) to tracked (mint chevron, price, and a
 * "seen coming" line). That is the whole product argument, told with
 * geometry instead of another paragraph.
 *
 * Progressive enhancement only: no WebGL, no three.js, or reduced-motion
 * preference and the page renders exactly as it does without this file.
 */
(function () {
  if (!window.THREE) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var probe = document.createElement('canvas');
  var gl = null;
  try { gl = probe.getContext('webgl') || probe.getContext('experimental-webgl'); } catch (e) { return; }
  if (!gl) return;

  /* Palette, kept in lockstep with the custom properties in landing.html.
     Mint marks the cards, it never letters them: as type on white it sits
     at 1.6:1, so every word on a card is ink navy or slate. */
  var GROUND = 0xf7f6f1;
  var GROUND_2 = 0xefede5;
  var CARD = '#ffffff';
  var TYPE = '#142b3a';
  var TYPE_3 = '#52616b';
  var TYPE_4 = '#7e8890';
  var MINT = '#55c6a3';
  var MINT_TEXT = '#1f7a62';
  var RULE_SOFT = 'rgba(20,43,58,0.16)';

  var UNIT = 6.5;            /* world units per viewport height */
  var TURN_SELECTOR = '#how-it-works';

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.domElement.id = 'bg3d';
  document.body.appendChild(renderer.domElement);
  document.documentElement.classList.add('has3d');

  var groundColor = new THREE.Color(GROUND);
  var ground2Color = new THREE.Color(GROUND_2);

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(groundColor.clone(), 9, 30);
  var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  camera.position.set(0, 0, 14);

  var cards = [];
  var motes = [];
  var worldH = 40;

  var SERVICES = [
    ['Netflix', '15.49', '4 Mar'], ['Spotify', '10.99', '11 Mar'],
    ['Disney+', '9.99', '17 Mar'], ['iCloud+', '2.99', '2 Mar'],
    ['YouTube Premium', '13.99', '22 Mar'], ['Game Pass', '19.99', '8 Mar'],
    ['Audible', '7.95', '26 Mar'], ['Crunchyroll', '7.99', '14 Mar'],
    ['NordVPN', '4.99', '30 Mar'], ['Duolingo Plus', '6.99', '6 Mar'],
    ['Dropbox', '11.99', '19 Mar'], ['HBO Max', '15.99', '24 Mar'],
    ['Adobe CC', '24.99', '12 Mar'], ['Headspace', '12.99', '28 Mar'],
    ['Kindle Unlimited', '11.99', '9 Mar'], ['Notion', '9.50', '21 Mar']
  ];

  /* The chevron from the logo, so a tracked card carries the same mark as
     the header and the eyebrows. */
  function chevron(x, px, py, w, h) {
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + w, py + h / 2);
    x.lineTo(px, py + h);
    x.closePath();
    x.fill();
  }

  function cardTexture(name, price, date, tracked) {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 320;
    var x = c.getContext('2d');
    x.clearRect(0, 0, 512, 320);

    /* Hard offset shadow, no blur: the print device the whole page uses. */
    x.fillStyle = tracked ? 'rgba(85,198,163,0.95)' : 'rgba(20,43,58,0.16)';
    x.fillRect(34, 36, 462, 268);

    x.fillStyle = CARD;
    x.fillRect(16, 16, 462, 268);
    x.lineWidth = 2;
    x.strokeStyle = 'rgba(20,43,58,0.24)';
    x.strokeRect(16, 16, 462, 268);

    if (tracked) {
      x.fillStyle = MINT;
      chevron(x, 48, 50, 24, 28);
    } else {
      x.fillStyle = 'rgba(20,43,58,0.16)';
      x.fillRect(46, 58, 30, 9);
    }

    x.fillStyle = tracked ? TYPE : TYPE_3;
    x.font = '600 31px Manrope, system-ui, sans-serif';
    x.fillText(name, 92, 74, 356);

    x.fillStyle = TYPE_4;
    x.font = '700 15px Manrope, system-ui, sans-serif';
    x.fillText('MONTHLY', 47, 148);

    x.fillStyle = tracked ? TYPE : TYPE_4;
    x.font = '600 66px Fraunces, Georgia, serif';
    x.fillText('€' + price, 45, 218);

    x.beginPath();
    x.moveTo(45, 240);
    x.lineTo(449, 240);
    x.lineWidth = 1;
    x.strokeStyle = RULE_SOFT;
    x.stroke();

    x.font = '700 15px Manrope, system-ui, sans-serif';
    if (tracked) {
      x.fillStyle = MINT_TEXT;
      x.fillText('SEEN COMING · ' + date.toUpperCase(), 45, 268);
    } else {
      x.fillStyle = 'rgba(20,43,58,0.28)';
      x.fillText('NO WARNING', 45, 268);
    }

    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  function turnWorldY() {
    var el = document.querySelector(TURN_SELECTOR);
    var vh = window.innerHeight;
    if (!el) return worldH * 0.4;
    return (el.offsetTop / vh) * UNIT;
  }

  function disposeWorld() {
    cards.forEach(function (m) {
      scene.remove(m);
      if (m.material.map) m.material.map.dispose();
      m.material.dispose();
      m.geometry.dispose();
    });
    motes.forEach(function (m) { scene.remove(m); m.material.dispose(); });
    cards = [];
    motes = [];
  }

  function buildWorld() {
    disposeWorld();
    var vh = window.innerHeight;
    var docH = Math.max(document.documentElement.scrollHeight - vh, 1);
    worldH = (docH / vh) * UNIT;
    var turnY = turnWorldY();

    var narrow = window.innerWidth < 900;
    var aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    var halfAngle = Math.tan((camera.fov * Math.PI) / 360);

    var geo = new THREE.PlaneGeometry(2.7, 1.69);
    for (var i = 0; i < SERVICES.length; i++) {
      var y = -(i / (SERVICES.length - 1)) * worldH + (Math.random() - 0.5) * 2.2;
      var tracked = -y > turnY;
      var mat = new THREE.MeshBasicMaterial({
        map: cardTexture(SERVICES[i][0], SERVICES[i][1], SERVICES[i][2], tracked),
        transparent: true,
        opacity: (tracked ? 0.95 : 0.85) * (narrow ? 0.62 : 1),
        side: THREE.DoubleSide,
        depthWrite: false
      });
      var m = new THREE.Mesh(geo, mat);
      /* Copy in this layout is left anchored, so anything inside the first
         viewport is kept on the free right half. Below the fold both sides
         are used. Placement is expressed as a fraction of the frame's own
         half width at that depth, so cards hug the margins on a phone the
         same way they do on a desktop instead of drifting onto the type. */
      var side = -y < UNIT * 0.95 ? 1 : (i % 2 === 0 ? -1 : 1);
      var z = narrow ? -9 - Math.random() * 9 : -5.5 - Math.random() * 7;
      var halfW = halfAngle * (camera.position.z - z) * aspect;
      m.position.set(side * halfW * (0.5 + Math.random() * 0.38), y, z);
      m.rotation.set(
        (Math.random() - 0.5) * 0.34,
        (Math.random() - 0.5) * 0.85,
        (Math.random() - 0.5) * 0.16
      );
      m.userData = { bx: m.position.x, ry: m.rotation.y, seed: Math.random() * 9, base: mat.opacity };
      scene.add(m);
      cards.push(m);
    }

    /* Grain: sparse, mostly ink with a few mint, faint enough on paper to
       read as texture rather than a second layer of content. */
    var moteGeo = new THREE.SphereGeometry(1, 12, 12);
    for (var j = 0; j < 14; j++) {
      var s = 0.045 + Math.random() * 0.13;
      var mm = new THREE.Mesh(moteGeo, new THREE.MeshBasicMaterial({
        color: j % 5 === 0 ? 0x55c6a3 : 0x142b3a,
        transparent: true,
        opacity: 0.03 + Math.random() * 0.07,
        depthWrite: false
      }));
      mm.scale.setScalar(s);
      var mz = -3 - Math.random() * 9;
      var mHalfW = halfAngle * (camera.position.z - mz) * aspect;
      mm.position.set((Math.random() - 0.5) * 2 * mHalfW, -Math.random() * worldH, mz);
      mm.userData = { seed: Math.random() * 9, drift: 0.0015 + Math.random() * 0.0035, base: mm.material.opacity };
      scene.add(mm);
      motes.push(mm);
    }
  }

  var px = 0, py = 0, tx = 0, ty = 0;
  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  /* 0 before the reader reaches "how it works", 1 once past it. Used to
     warm the ground a shade, nothing louder: the page is one light world
     by design. */
  function warmthAt(scrollY) {
    var el = document.querySelector(TURN_SELECTOR);
    if (!el) return 1;
    var vh = window.innerHeight;
    var center = scrollY + vh * 0.55;
    var a = el.offsetTop - vh * 0.35;
    var b = el.offsetTop + vh * 0.45;
    return Math.max(0, Math.min(1, (center - a) / (b - a)));
  }

  var resizeTimer = null;
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    buildWorld();
  }
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 180);
  });
  resize();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(buildWorld);
  }

  var warm = 0;
  var veil = 1;
  var bg = groundColor.clone();
  function frame(t) {
    var sec = t * 0.001;
    var vh = window.innerHeight;
    var docH = Math.max(document.documentElement.scrollHeight - vh, 1);
    var scrollY = window.scrollY || 0;
    camera.position.y = -(scrollY / docH) * worldH;

    px += (tx - px) * 0.06;
    py += (ty - py) * 0.06;
    camera.rotation.y = -px * 0.1;
    camera.rotation.x = -py * 0.07;

    var target = warmthAt(scrollY);
    warm += (target - warm) * 0.08;
    bg.copy(groundColor).lerp(ground2Color, warm);
    renderer.setClearColor(bg);
    scene.fog.color.copy(bg);

    /* Full strength across the first screen, then dialled back so the rest
       of the page reads as a printed piece with depth behind it rather than
       a slideshow the copy has to compete with. */
    var veilTarget = scrollY < vh * 0.35 ? 1 : 0.3;
    veil += (veilTarget - veil) * 0.05;

    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], u = c.userData;
      c.position.x = u.bx + Math.sin(sec * 0.35 + u.seed) * 0.18;
      c.rotation.y = u.ry + Math.sin(sec * 0.25 + u.seed) * 0.15;
      c.rotation.z = Math.sin(sec * 0.3 + u.seed * 2) * 0.045;
      c.material.opacity = u.base * veil;
    }
    for (var j = 0; j < motes.length; j++) {
      var o = motes[j];
      o.position.y += o.userData.drift;
      o.position.x += Math.sin(sec * 0.5 + o.userData.seed) * 0.002;
      if (o.position.y > 2) o.position.y = -worldH - 1;
      o.material.opacity = o.userData.base * veil;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

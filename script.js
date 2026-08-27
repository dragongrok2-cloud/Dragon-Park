const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const WORLD_W = 2800, WORLD_H = 1600, ROUND = 90;
const keys = new Set();
let injected = null;
let touch = { x: 0, y: 0, on: false, boost: false };
let mode = "title", score = 0, timeLeft = ROUND, combo = 0, comboT = 0;
let best = 0, mute = false, message = "", messageT = 0, acc = 0, last = performance.now(), time = 0, trauma = 0, circuitDone = false;
try {
  const s = JSON.parse(localStorage.getItem("dragon-park-save") || "{}");
  best = s.best || 0;
  mute = !!s.mute;
} catch {}
document.getElementById("best").textContent = best;

const dragon = { x: 420, y: 720, vx: 40, vy: 0, wing: 0, facing: 1, fuel: 1 };
const cam = { x: 0, y: 0 };
const items = [];
const parts = [];
const pops = [];
const landmarks = [
  { id: "observatory", x: 280, y: 420, r: 78, name: "Обсерватория", bonus: 35, cool: 0, seen: false },
  { id: "lake", x: 620, y: 880, r: 96, name: "Озеро", bonus: 25, cool: 0, seen: false },
  { id: "wheel", x: 980, y: 620, r: 88, name: "Колесо", bonus: 32, cool: 0, seen: false },
  { id: "carousel", x: 1180, y: 1080, r: 80, name: "Карусель", bonus: 30, cool: 0, seen: false },
  { id: "meadow", x: 1680, y: 1120, r: 74, name: "Луг", bonus: 20, cool: 0, seen: false },
  { id: "market", x: 1860, y: 740, r: 86, name: "Рынок", bonus: 28, cool: 0, seen: false },
  { id: "castle", x: 2380, y: 720, r: 118, name: "Замок", bonus: 45, cool: 0, seen: false },
];
const trees = Array.from({ length: 42 }, () => ({
  x: 40 + Math.random() * (WORLD_W - 80),
  y: 760 + Math.random() * 620,
  s: 38 + Math.random() * 72,
}));
const clouds = Array.from({ length: 10 }, () => ({
  x: Math.random() * WORLD_W, y: 36 + Math.random() * 240, s: 48 + Math.random() * 70, spd: 8 + Math.random() * 16,
}));
const fireflies = Array.from({ length: 40 }, () => ({
  x: Math.random() * WORLD_W, y: 200 + Math.random() * (WORLD_H - 280), phase: Math.random() * 6,
}));

const audio = {
  ctx: null, master: null, sfx: null, lastFlap: 0,
  unlock() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      this.ctx = new C({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.apply();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },
  apply() {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(mute ? 0 : 0.55, this.ctx.currentTime, 0.03);
  },
  tone(freq, dur, type, gain) {
    if (!this.ctx || !this.sfx || mute) return;
    const t = this.ctx.currentTime, osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * (0.97 + Math.random() * 0.06), t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.sfx);
    osc.start(t); osc.stop(t + dur + 0.02);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
  },
  noise(dur, gain, cutoff) {
    if (!this.ctx || !this.sfx || mute) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filter = this.ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = cutoff;
    const g = this.ctx.createGain(); const t = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.sfx);
    src.start(t); src.stop(t + dur);
    src.onended = () => { src.disconnect(); filter.disconnect(); g.disconnect(); };
  },
  collect(c) { this.tone(520 + Math.min(c, 10) * 36, 0.09, "triangle", 0.18); },
  chest() { this.tone(180, 0.18, "sine", 0.22); this.tone(270, 0.22, "triangle", 0.12); },
  landmark() { this.tone(392, 0.16, "sine", 0.14); this.tone(494, 0.2, "triangle", 0.1); },
  circuit() { this.tone(392, 0.18, "sine", 0.16); this.tone(523, 0.22, "triangle", 0.12); this.tone(659, 0.28, "sine", 0.1); },
  boost() { this.noise(0.12, 0.08, 900); },
  flap(now) { if (now - this.lastFlap < 0.28) return; this.lastFlap = now; this.noise(0.05, 0.035, 420); },
  end(record) { record ? (this.tone(392, 0.2, "sine", 0.16), this.tone(784, 0.4, "sine", 0.1)) : this.tone(247, 0.32, "triangle", 0.1); },
};

function spawn(kind) {
  const chest = kind === "chest", star = kind === "star", lantern = kind === "lantern", pearl = kind === "pearl";
  return {
    kind,
    x: pearl ? 420 + Math.random() * 420 : 80 + Math.random() * (WORLD_W - 160),
    y: pearl ? 820 + Math.random() * 140 : 140 + Math.random() * (WORLD_H - 300),
    phase: Math.random() * 6, taken: false,
    r: chest ? 14 : star ? 12 : lantern ? 10 : pearl ? 8 : 6,
    value: chest ? 40 : star ? 10 : lantern ? 15 : pearl ? 18 : 5,
    wait: 0, drift: lantern ? 12 + Math.random() * 18 : 0,
  };
}
function fillItems() {
  items.length = 0;
  for (let i = 0; i < 12; i++) items.push(spawn("star"));
  for (let i = 0; i < 14; i++) items.push(spawn("ember"));
  for (let i = 0; i < 4; i++) items.push(spawn("chest"));
  for (let i = 0; i < 8; i++) items.push(spawn("lantern"));
  for (let i = 0; i < 6; i++) items.push(spawn("pearl"));
}
fillItems();

function toast(t) { message = t; messageT = 2.2; document.getElementById("toast").textContent = t; }
function saveBest() {
  try { localStorage.setItem("dragon-park-save", JSON.stringify({ version: 3, best, mute })); } catch {}
}
function setMute(next) {
  mute = next; audio.apply(); saveBest();
  document.getElementById("muteBtn").textContent = mute ? "Тихо" : "Звук";
}
setMute(mute);

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = innerWidth, h = innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
resize();

function held(code) { return injected ? injected.includes(code) : keys.has(code); }

addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.code === "KeyM") { audio.unlock(); setMute(!mute); }
  if ((e.code === "Escape" || e.code === "KeyP") && mode === "play") {
    mode = "pause";
    document.getElementById("panel").hidden = false;
    document.querySelector(".lead").textContent = "Седло ждёт. Escape — снова в воздух.";
    document.getElementById("startBtn").textContent = "Продолжить";
  } else if ((e.code === "Escape" || e.code === "KeyP") && mode === "pause") {
    mode = "play";
    document.getElementById("panel").hidden = true;
  }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") audio.unlock(); });

const stick = document.getElementById("stick");
const knob = document.getElementById("knob");
function setStick(ev) {
  const r = stick.getBoundingClientRect();
  let x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  let y = ((ev.clientY - r.top) / r.height) * 2 - 1;
  const m = Math.hypot(x, y) || 1;
  if (m > 1) { x /= m; y /= m; }
  touch = { ...touch, x, y, on: true };
  knob.style.transform = `translate(calc(-50% + ${x * 28}px), calc(-50% + ${y * 28}px))`;
}
stick.addEventListener("pointerdown", (e) => { stick.setPointerCapture(e.pointerId); setStick(e); });
stick.addEventListener("pointermove", (e) => { if (touch.on) setStick(e); });
stick.addEventListener("pointerup", () => {
  touch = { ...touch, x: 0, y: 0, on: false };
  knob.style.transform = "translate(-50%, -50%)";
});
document.getElementById("boostBtn").addEventListener("pointerdown", (e) => { e.preventDefault(); touch.boost = true; });
document.getElementById("boostBtn").addEventListener("pointerup", () => { touch.boost = false; });
document.getElementById("muteBtn").addEventListener("click", () => { audio.unlock(); setMute(!mute); });

function start() {
  audio.unlock();
  if (mode === "pause") {
    mode = "play";
    document.getElementById("panel").hidden = true;
    return;
  }
  mode = "play";
  score = 0; timeLeft = ROUND; combo = 0; circuitDone = false;
  dragon.x = 420; dragon.y = 720; dragon.vx = 90; dragon.vy = 0; dragon.fuel = 1;
  fillItems();
  landmarks.forEach((l) => { l.cool = 0; l.seen = false; });
  document.getElementById("panel").hidden = true;
  document.getElementById("hud").hidden = false;
  document.getElementById("touch").hidden = innerWidth < 800;
  toast("Полетели. Гость в седле — парк отвечает.");
}
document.getElementById("startBtn").addEventListener("click", start);

function ellipse(x, y, rx, ry, fill) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ra = (pa >> 16) & 255, ga = (pa >> 8) & 255, ba = pa & 255;
  const rb = (pb >> 16) & 255, gb = (pb >> 8) & 255, bb = pb & 255;
  return `rgb(${Math.round(ra + (rb - ra) * t)},${Math.round(ga + (gb - ga) * t)},${Math.round(ba + (bb - ba) * t)})`;
}

function drawSky(w, h) {
  const d = (mode === "play" || mode === "end") ? 1 - timeLeft / ROUND : 0.18;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mix("#12182a", "#3a4a72", d));
  g.addColorStop(0.38, mix("#2c314c", "#6a5a72", d));
  g.addColorStop(0.68, mix("#8a4a3a", "#d4894a", d));
  g.addColorStop(1, mix("#d4894a", "#f0c48a", d));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1 - d * 0.7;
  ellipse(w * 0.78, h * 0.22 + d * 40, 42, 42, "#f4d7a8");
  ctx.globalAlpha = 1;
  if (d > 0.35) { ctx.globalAlpha = (d - 0.35) * 1.2; ellipse(w * 0.18, h * 0.62, 36, 36, "#f4c878"); ctx.globalAlpha = 1; }
}

function drawDragon() {
  const flap = Math.sin(dragon.wing) * 0.45;
  ctx.save();
  ctx.translate(dragon.x, dragon.y);
  ctx.scale(dragon.facing, 1);
  ctx.rotate(Math.max(-0.25, Math.min(0.25, dragon.vy * 0.001)));
  ctx.fillStyle = "rgba(18,16,14,0.28)";
  ctx.beginPath(); ctx.ellipse(4, 28, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.rotate(-0.5 + flap);
  ctx.fillStyle = "#8b2e28";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-36, -34, -6, -50); ctx.quadraticCurveTo(-16, -16, 4, -4); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#d4544a";
  ctx.beginPath(); ctx.moveTo(-26, 4); ctx.quadraticCurveTo(-60, -14, -74, 10); ctx.quadraticCurveTo(-54, 8, -24, 12); ctx.fill();
  ellipse(0, 4, 28, 15, "#d4544a");
  ellipse(2, 10, 20, 9, "#e8a090");
  ctx.fillStyle = "#5c3a24"; ctx.fillRect(-10, -6, 24, 11);
  ctx.fillStyle = "#c4a15a"; ctx.fillRect(-6, -3, 16, 5);
  ctx.fillStyle = "#2a221c";
  ctx.beginPath(); ctx.moveTo(-2, -8); ctx.quadraticCurveTo(6, 6, 14, 2); ctx.quadraticCurveTo(4, -2, 8, -10); ctx.closePath(); ctx.fill();
  ellipse(4, -14, 5, 6, "#1c1612");
  ellipse(5, -12, 4, 4.4, "#e8c4a0");
  ctx.strokeStyle = "#2c241c"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(10, 13); ctx.moveTo(10, 4); ctx.lineTo(14, 13); ctx.stroke();
  ctx.fillStyle = "#2c241c";
  ctx.beginPath(); ctx.ellipse(2, -10, 5, 7, -0.2, 0, Math.PI * 2); ctx.fill();
  ellipse(26, -2, 15, 12, "#d4544a");
  ctx.fillStyle = "#d4544a";
  ctx.beginPath(); ctx.moveTo(34, -8); ctx.lineTo(40, -20); ctx.lineTo(28, -8); ctx.fill();
  ellipse(38, 2, 9, 6, "#d4544a");
  ctx.fillStyle = "#f3ebe0"; ctx.beginPath(); ctx.arc(32, -4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1a1210"; ctx.beginPath(); ctx.arc(33.4, -4, 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#3a1c18"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(36, 4, 5, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.save(); ctx.rotate(0.3 - flap);
  ctx.fillStyle = "#a33830";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-26, -40, 6, -54); ctx.quadraticCurveTo(-6, -18, 8, -4); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawWorld(vw) {
  ctx.save(); ctx.translate(-cam.x, -cam.y);
  ctx.fillStyle = "#24352c";
  ctx.fillRect(-40, 700, WORLD_W + 80, WORLD_H);
  ctx.fillStyle = "#1d2c24";
  ctx.fillRect(-40, 900, WORLD_W + 80, WORLD_H);
  ellipse(620, 910, 220, 70, "#2f5a66");
  ellipse(620, 900, 168, 44, "#3d7380");
  ctx.strokeStyle = "#c4a882"; ctx.lineWidth = 22; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(40, 1080); ctx.lineTo(640, 1000); ctx.lineTo(1180, 1140); ctx.lineTo(1760, 1060); ctx.lineTo(2360, 920); ctx.stroke();
  for (const t of trees) {
    if (t.x < cam.x - 60 || t.x > cam.x + vw + 60) continue;
    ctx.fillStyle = "#4a3424"; ctx.fillRect(t.x - 6, t.y, 12, t.s * 0.45);
    ellipse(t.x, t.y - t.s * 0.2, t.s * 0.38, t.s * 0.32, "#2f6a4c");
  }
  ctx.fillStyle = "#3a3d4e";
  ctx.fillRect(2290, 700, 180, 118);
  ctx.fillRect(2262, 662, 44, 156);
  ctx.fillRect(2454, 662, 44, 156);
  ctx.fillRect(2360, 640, 36, 70);
  ctx.fillStyle = "#e25a3c"; ctx.fillRect(2274, 650, 18, 10); ctx.fillRect(2466, 650, 18, 10);
  ctx.fillStyle = "rgba(240,210,122,0.55)";
  ctx.fillRect(2320, 730, 10, 14); ctx.fillRect(2380, 730, 10, 14); ctx.fillRect(2440, 730, 10, 14);
  ctx.fillStyle = "#3d4254"; ctx.fillRect(244, 420, 72, 54);
  ellipse(280, 420, 48, 28, "#4a5064");
  ctx.strokeStyle = "#c4a882"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(980, 620, 70, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = time * 0.35 + (i * Math.PI) / 4;
    ctx.fillStyle = i % 2 ? "#e25a3c" : "#f0d27a";
    ctx.fillRect(980 + Math.cos(a) * 70 - 6, 620 + Math.sin(a) * 70 - 4, 12, 10);
  }
  ctx.fillStyle = "#e25a3c";
  ctx.beginPath(); ctx.moveTo(1126, 1040); ctx.lineTo(1180, 1000); ctx.lineTo(1234, 1040); ctx.fill();
  ctx.strokeStyle = "#c45c3e"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(1180, 1080, 46, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = "#5c3a24";
  ctx.fillRect(1838, 760, 44, 28); ctx.fillRect(1906, 754, 44, 28);
  ctx.fillStyle = "#e25a3c";
  ctx.beginPath(); ctx.moveTo(1832, 764); ctx.lineTo(1860, 738); ctx.lineTo(1888, 764); ctx.fill();
  ctx.font = "600 13px Segoe UI, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(243,235,224,0.8)";
  for (const l of landmarks) {
    ctx.fillText(l.name, l.x, l.y - 92);
    if (l.seen) { ctx.fillStyle = "#e25a3c"; ctx.beginPath(); ctx.arc(l.x, l.y - 104, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgba(243,235,224,0.8)"; }
  }
  for (const it of items) {
    if (it.taken) continue;
    const p = Math.sin(it.phase) * 2;
    ctx.save(); ctx.translate(it.x, it.y + p);
    if (it.kind === "star") {
      ctx.rotate(it.phase * 0.3); ctx.fillStyle = "#f0d27a"; ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
        ctx.lineTo(Math.cos(a + Math.PI / 5) * 5, Math.sin(a + Math.PI / 5) * 5);
      }
      ctx.closePath(); ctx.fill();
    } else if (it.kind === "ember") ellipse(0, 0, 5, 5, "#e25a3c");
    else if (it.kind === "lantern") { ellipse(0, 0, 8, 10, "#e25a3c"); ellipse(0, 1, 4, 5, "#f0d27a"); }
    else if (it.kind === "pearl") { ellipse(0, 0, 7, 7, "#9ad4d8"); ellipse(-2, -2, 2, 2, "#f3ebe0"); }
    else { ctx.fillStyle = "#5c3a24"; ctx.fillRect(-11, -7, 22, 16); ctx.fillStyle = "#c4a15a"; ctx.fillRect(-11, -1, 22, 4); }
    ctx.restore();
  }
  drawDragon();
  for (const p of parts) { ctx.globalAlpha = p.life / p.max; ellipse(p.x, p.y, p.s, p.s, p.c); }
  ctx.globalAlpha = 1;
  for (const f of fireflies) {
    ctx.globalAlpha = 0.25 + Math.sin(time * 3 + f.phase) * 0.25;
    ellipse(f.x, f.y, 2, 2, "#f0d27a");
  }
  ctx.globalAlpha = 1;
  ctx.font = "700 14px Segoe UI, sans-serif"; ctx.textAlign = "center";
  for (const p of pops) {
    const k = p.life / p.max; ctx.globalAlpha = k; ctx.fillStyle = "#f3ebe0";
    ctx.fillText(p.text, p.x, p.y - (1 - k) * 28);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawMinimap(vw) {
  const mw = 168, mh = 96, x = vw - mw - 16, y = 72;
  ctx.fillStyle = "rgba(18,21,28,0.72)";
  ctx.fillRect(x, y, mw, mh);
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  for (const l of landmarks) {
    ctx.fillStyle = l.seen ? "#e25a3c" : "rgba(243,235,224,0.35)";
    ctx.beginPath(); ctx.arc(x + l.x * sx, y + l.y * sy, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#e25a3c";
  ctx.beginPath(); ctx.arc(x + dragon.x * sx, y + dragon.y * sy, 3.2, 0, Math.PI * 2); ctx.fill();
}

function burst(x, y, c) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2, s = 50 + Math.random() * 120;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, max: 0.5, s: 2, c });
  }
}

function collect(it) {
  it.taken = true; it.wait = it.kind === "chest" ? 8 : it.kind === "lantern" ? 2.4 : it.kind === "pearl" ? 3.2 : 1;
  combo += 1; comboT = 2;
  const gain = Math.round(it.value * (1 + Math.min(combo - 1, 8) * 0.15));
  score += gain;
  burst(it.x, it.y, it.kind === "ember" ? "#e25a3c" : it.kind === "pearl" ? "#9ad4d8" : "#f0d27a");
  pops.push({ x: it.x, y: it.y - 18, text: "+" + gain, life: 0.9, max: 0.9 });
  if (it.kind === "chest") { trauma = Math.min(1, trauma + 0.35); audio.chest(); }
  else audio.collect(combo);
  toast(combo > 4 ? "Держи комбо — парк любит скорость." : "Свет в седле звенит громче.");
}

function step(dt) {
  time += dt;
  if (mode === "pause") return;
  let ax = 0, ay = 0;
  if (held("KeyA") || held("ArrowLeft")) ax -= 1;
  if (held("KeyD") || held("ArrowRight")) ax += 1;
  if (held("KeyW") || held("ArrowUp")) ay -= 1;
  if (held("KeyS") || held("ArrowDown")) ay += 1;
  if (touch.on) { ax += touch.x; ay += touch.y; }
  if (mode !== "play") { ax = Math.sin(time * 0.35); ay = Math.cos(time * 0.22) * 0.3; }
  const mag = Math.hypot(ax, ay) || 1;
  if (mag > 1) { ax /= mag; ay /= mag; }
  const boosting = mode === "play" && (held("Space") || touch.boost) && dragon.fuel > 0.05;
  if (boosting) {
    dragon.fuel = Math.max(0, dragon.fuel - dt * 0.55);
    if (Math.random() < 0.4) parts.push({ x: dragon.x - dragon.facing * 28, y: dragon.y + 6, vx: -dragon.vx * 0.2, vy: -20, life: 0.35, max: 0.35, s: 3, c: "#e25a3c" });
  } else dragon.fuel = Math.min(1, dragon.fuel + dt * 0.22);
  const max = boosting ? 520 : 310;
  dragon.vx += ax * 980 * dt; dragon.vy += ay * 980 * dt;
  dragon.vx -= dragon.vx * 2.6 * dt; dragon.vy -= dragon.vy * 2.6 * dt;
  const spd = Math.hypot(dragon.vx, dragon.vy);
  if (spd > max) { dragon.vx = (dragon.vx / spd) * max; dragon.vy = (dragon.vy / spd) * max; }
  dragon.x = Math.max(50, Math.min(WORLD_W - 50, dragon.x + dragon.vx * dt));
  dragon.y = Math.max(70, Math.min(WORLD_H - 80, dragon.y + dragon.vy * dt));
  if (Math.abs(dragon.vx) > 12) dragon.facing = dragon.vx > 0 ? 1 : -1;
  dragon.wing += (1.8 + spd * 0.012) * dt * Math.PI * 2;
  if (mode === "play" && spd > 80) audio.flap(time);
  if (boosting && Math.floor(time * 8) !== Math.floor((time - dt) * 8)) audio.boost();
  const vw = innerWidth, vh = innerHeight;
  let tx = dragon.x - vw / 2 + dragon.vx * 0.2;
  let ty = dragon.y - vh / 2 + dragon.vy * 0.14;
  tx = Math.max(0, Math.min(Math.max(0, WORLD_W - vw), tx));
  ty = Math.max(0, Math.min(Math.max(0, WORLD_H - vh), ty));
  const k = 1 - Math.exp(-4.2 * dt);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  for (const c of clouds) { c.x += c.spd * dt; if (c.x > WORLD_W + 80) c.x = -80; }
  trauma = Math.max(0, trauma - dt * 1.6);
  if (mode === "play") {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0; mode = "end";
      const record = score > best;
      if (record) { best = score; saveBest(); }
      audio.end(record);
      document.getElementById("panel").hidden = false;
      document.getElementById("hud").hidden = true;
      document.getElementById("touch").hidden = true;
      document.querySelector(".lead").textContent = `Круг закрыт. Очки ${score}. Рекорд ${best}.${circuitDone ? " Полный круг." : ""}`;
      document.getElementById("startBtn").textContent = "Ещё круг";
      toast(record ? "Новый рекорд." : "Ещё один круг?");
    }
    comboT -= dt; if (comboT <= 0) combo = 0;
    messageT -= dt; if (messageT <= 0) { message = ""; document.getElementById("toast").textContent = ""; }
    for (const it of items) {
      it.phase += dt * 3;
      if (it.kind === "lantern" && !it.taken) {
        it.y -= it.drift * dt;
        if (it.y < 80) it.y = WORLD_H - 100;
      }
      if (it.taken) {
        it.wait -= dt;
        if (it.wait <= 0) Object.assign(it, spawn(it.kind));
        continue;
      }
      if (Math.hypot(dragon.x - it.x, dragon.y - it.y) < 42) collect(it);
    }
    for (const l of landmarks) {
      l.cool = Math.max(0, l.cool - dt);
      if (l.cool === 0 && Math.hypot(dragon.x - l.x, dragon.y - l.y) < l.r) {
        l.cool = 12; score += l.bonus; burst(l.x, l.y, "#f3ebe0");
        pops.push({ x: l.x, y: l.y - 70, text: "+" + l.bonus, life: 0.9, max: 0.9 });
        audio.landmark();
        if (!l.seen) {
          l.seen = true;
          const n = landmarks.filter((x) => x.seen).length;
          if (n === 7 && !circuitDone) {
            circuitDone = true; score += 150;
            pops.push({ x: dragon.x, y: dragon.y - 40, text: "+150 круг", life: 1.1, max: 1.1 });
            audio.circuit(); toast("Полный круг. Парк кланяется.");
          } else toast(`${l.name}: парк дарит очки. ${n}/7`);
        } else toast(`${l.name}: парк дарит очки.`);
      }
    }
  }
  for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
  for (const p of pops) p.life -= dt;
  for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
}

function hud() {
  document.getElementById("score").textContent = score;
  const s = Math.max(0, Math.ceil(timeLeft));
  document.getElementById("timer").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  document.getElementById("best").textContent = best;
  document.getElementById("circuit").textContent = `${landmarks.filter((l) => l.seen).length}/7`;
  document.getElementById("fuelBar").style.width = Math.round(dragon.fuel * 100) + "%";
  const chip = document.getElementById("comboChip");
  if (combo > 1) { chip.hidden = false; document.getElementById("combo").textContent = "×" + combo; }
  else chip.hidden = true;
}

function frame(now) {
  const raw = Math.min(0.1, (now - last) / 1000);
  last = now; acc += raw;
  while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
  const vw = innerWidth, vh = innerHeight;
  const shake = trauma * trauma;
  ctx.save();
  if (shake) ctx.translate((Math.random() * 2 - 1) * 10 * shake, (Math.random() * 2 - 1) * 8 * shake);
  drawSky(vw, vh);
  ctx.save(); ctx.translate(-cam.x * 0.32, -cam.y * 0.12);
  for (const c of clouds) {
    ellipse(c.x, c.y, c.s * 0.5, c.s * 0.24, "rgba(255,236,214,0.5)");
    ellipse(c.x + c.s * 0.3, c.y + 4, c.s * 0.36, c.s * 0.18, "rgba(255,236,214,0.4)");
  }
  ctx.restore();
  drawWorld(vw);
  if (mode === "play") drawMinimap(vw);
  ctx.restore();
  hud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__controlsTest = {
  getYaw: () => Math.atan2(-dragon.vy, dragon.vx),
  getSpeed: () => Math.hypot(dragon.vx, dragon.vy),
  setKeys: (codes) => { injected = codes; },
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const WORLD_W = 2800, WORLD_H = 1600, ROUND = 90;
const keys = new Set();
let injected = null;
let touch = { x: 0, y: 0, on: false, boost: false, wave: false };
let mode = "title", score = 0, timeLeft = ROUND, combo = 0, comboT = 0;
let best = 0, mute = false, message = "", messageT = 0, acc = 0, last = performance.now(), time = 0, trauma = 0, circuitDone = false;
let waveCool = 0, inWind = false, windToast = 0;
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
const winds = [
  { x: 180, y: 470, w: 560, h: 96, vx: 1, vy: 0.12 },
  { x: 860, y: 840, w: 520, h: 88, vx: -0.75, vy: -0.18 },
  { x: 1680, y: 460, w: 620, h: 110, vx: 0.85, vy: 0.08 },
];

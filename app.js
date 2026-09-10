"use strict";

const canvas = document.getElementById("coordinate-canvas");
const ctx = canvas.getContext("2d");
const inputs = {
  x: document.getElementById("x-input"),
  y: document.getElementById("y-input"),
  z: document.getElementById("z-input")
};
const sourceSelect = document.getElementById("source-system");
const targetSelect = document.getElementById("target-system");
const mainSystemSelect = document.getElementById("main-system");
const diagramCanvases = {
  source: document.getElementById("source-canvas"),
  target: document.getElementById("target-canvas")
};

const state = {
  point: { x: 3, y: 4, z: 2 },
  mainSystem: "cartesian",
  angleUnit: "degrees",
  yaw: 0,
  pitch: 0,
  zoom: 1,
  dragging: false,
  lastX: 0,
  lastY: 0
};
const diagramViews = {
  source: { yaw: 0, pitch: 0, zoom: 1, dragging: false, lastX: 0, lastY: 0 },
  target: { yaw: 0, pitch: 0, zoom: 1, dragging: false, lastX: 0, lastY: 0 }
};

const colors = {
  grid: "rgba(23, 49, 59, 0.12)",
  axis: "rgba(23, 49, 59, 0.62)",
  text: "rgba(23, 49, 59, 0.78)",
  x: "#c74752",
  y: "#087f83",
  z: "#2c6f9f",
  violet: "#80569c",
  point: "#e5664f",
  guide: "rgba(229, 102, 79, 0.58)",
  plane: "rgba(8, 127, 131, 0.055)"
};

const systems = {
  cartesian: {
    name: "Descartes-rendszer",
    dimension: "3D",
    explanation: "Három egymásra merőleges tengely adja meg a pont előjeles x, y és z távolságát."
  },
  polar: {
    name: "Polár rendszer",
    dimension: "2D",
    explanation: "Az xy síkon az r sugár és a pozitív x tengelytől mért θ szög jelöli ki a pontot."
  },
  cylindrical: {
    name: "Hengerkoordináta-rendszer",
    dimension: "3D",
    explanation: "A pont xy vetületét ρ és θ írja le, ehhez adódik hozzá a z magasság."
  },
  spherical: {
    name: "Gömbi koordináta-rendszer",
    dimension: "3D",
    explanation: "Az r sugár, a θ azimutszög és a pozitív z tengelytől mért φ polárszög jelöli ki a pontot."
  }
};

function cleanNumber(value) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 0.0000001) value = 0;
  return Number(value.toFixed(3)).toString();
}

function angle(value) {
  if (!Number.isFinite(value)) return "—";
  return state.angleUnit === "degrees"
    ? `${cleanNumber(value * 180 / Math.PI)}°`
    : `${cleanNumber(value)} rad`;
}

function coordinateSet() {
  const { x, y, z } = state.point;
  const rho = Math.hypot(x, y);
  const radius = Math.hypot(x, y, z);
  const theta = Math.atan2(y, x);
  const phi = radius === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, z / radius)));
  return { x, y, z, rho, radius, theta, phi };
}

function systemValue(system) {
  const c = coordinateSet();
  if (system === "cartesian") return `(x; y; z) = (${cleanNumber(c.x)}; ${cleanNumber(c.y)}; ${cleanNumber(c.z)})`;
  if (system === "polar") return `(r; θ) = (${cleanNumber(c.rho)}; ${angle(c.theta)})`;
  if (system === "cylindrical") return `(ρ; θ; z) = (${cleanNumber(c.rho)}; ${angle(c.theta)}; ${cleanNumber(c.z)})`;
  return `(r; θ; φ) = (${cleanNumber(c.radius)}; ${angle(c.theta)}; ${angle(c.phi)})`;
}

function calculate() {
  const { x, y, z } = state.point;
  const rho = Math.hypot(x, y);
  const radius = Math.hypot(x, y, z);
  const azimuth = Math.atan2(y, x);
  const polar = radius === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, z / radius)));

  document.getElementById("polar-r").textContent = cleanNumber(rho);
  document.getElementById("polar-theta").textContent = angle(azimuth);
  document.getElementById("cyl-rho").textContent = cleanNumber(rho);
  document.getElementById("cyl-phi").textContent = angle(azimuth);
  document.getElementById("cyl-z").textContent = cleanNumber(z);
  document.getElementById("sphere-r").textContent = cleanNumber(radius);
  document.getElementById("sphere-theta").textContent = angle(azimuth);
  document.getElementById("sphere-phi").textContent = angle(polar);

  document.getElementById("main-readout").textContent = systemValue(state.mainSystem);
  updateComparison();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function line(a, b, color, width = 1, dash = []) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.restore();
}

function label(text, p, color = colors.text, align = "center") {
  ctx.save();
  ctx.font = '500 11px "DM Mono", monospace';
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, p.x, p.y);
  ctx.restore();
}

function dot(p, radius, fill, glow = false) {
  ctx.save();
  if (glow) { ctx.shadowColor = fill; ctx.shadowBlur = 18; }
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function getScale(width, height) {
  const max = Math.max(5, Math.abs(state.point.x), Math.abs(state.point.y), Math.abs(state.point.z));
  return Math.min(width, height) * 0.33 / (max * 1.18) * state.zoom;
}

function draw2D(width, height) {
  const origin = { x: width * .52, y: height * .54 };
  const scale = getScale(width, height);
  const spanX = width / scale;
  const spanY = height / scale;
  const step = Math.max(1, Math.ceil(Math.max(spanX, spanY) / 12));

  for (let i = -20; i <= 20; i += step) {
    const gx = origin.x + i * scale;
    const gy = origin.y - i * scale;
    if (gx > 0 && gx < width) line({x: gx, y: 0}, {x: gx, y: height}, colors.grid);
    if (gy > 0 && gy < height) line({x: 0, y: gy}, {x: width, y: gy}, colors.grid);
  }
  line({x: 18, y: origin.y}, {x: width - 18, y: origin.y}, colors.x, 1.5);
  line({x: origin.x, y: height - 18}, {x: origin.x, y: 18}, colors.y, 1.5);
  label("+x", {x: width - 28, y: origin.y - 14}, colors.x);
  label("+y", {x: origin.x + 20, y: 27}, colors.y);

  const p = { x: origin.x + state.point.x * scale, y: origin.y - state.point.y * scale };
  const px = { x: p.x, y: origin.y };
  line(px, p, colors.guide, 1.2, [5, 5]);
  line(origin, p, colors.point, 2);
  line(origin, px, colors.x, 2);

  const theta = Math.atan2(state.point.y, state.point.x);
  if (Math.hypot(state.point.x, state.point.y) > .001) {
    const arcRadius = Math.min(48, Math.max(24, Math.hypot(p.x-origin.x, p.y-origin.y) * .25));
    ctx.save();
    ctx.beginPath();
    const segments = Math.max(12, Math.ceil(Math.abs(theta) * 16));
    for (let i = 0; i <= segments; i++) {
      const a = theta * i / segments;
      const ax = origin.x + Math.cos(a) * arcRadius;
      const ay = origin.y - Math.sin(a) * arcRadius;
      if (i === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
    }
    ctx.strokeStyle = colors.y;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    label("θ", {x: origin.x + Math.cos(-theta/2) * (arcRadius+13), y: origin.y + Math.sin(-theta/2) * (arcRadius+13)}, colors.y);
  }

  dot(origin, 3, colors.text);
  dot(px, 3, colors.x);
  dot(p, 7, colors.point, true);
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.75)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
  label("r", {x: (origin.x+p.x)/2 + 9, y: (origin.y+p.y)/2 - 11}, colors.point);
  label("P", {x: p.x + 15, y: p.y - 14}, colors.point, "left");
}

function project3D(point, width, height, scale) {
  const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
  const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
  const x1 = point.x * cy - point.y * sy;
  const y1 = point.x * sy + point.y * cy;
  const z1 = point.z;
  const y2 = y1 * cp - z1 * sp;
  const z2 = y1 * sp + z1 * cp;
  const perspective = 1 / (1 + y2 * .014);
  return {
    x: width * .53 + (x1 - y2 * .62) * scale * perspective,
    y: height * .54 + (-z2 + y2 * .58) * scale * perspective,
    depth: y2
  };
}

function arrowHead(from, to, color) {
  const direction = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 8;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - Math.cos(direction - .48) * size, to.y - Math.sin(direction - .48) * size);
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - Math.cos(direction + .48) * size, to.y - Math.sin(direction + .48) * size);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function draw3D(width, height) {
  const scale = getScale(width, height);
  const proj = p => project3D(p, width, height, scale);
  const extent = Math.max(6, Math.ceil(Math.max(Math.abs(state.point.x), Math.abs(state.point.y), Math.abs(state.point.z)) + 1));
  const gridStep = extent > 9 ? 2 : 1;

  ctx.save();
  ctx.beginPath();
  const plane = [proj({x:-extent,y:-extent,z:0}),proj({x:extent,y:-extent,z:0}),proj({x:extent,y:extent,z:0}),proj({x:-extent,y:extent,z:0})];
  ctx.moveTo(plane[0].x,plane[0].y); plane.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.closePath();
  ctx.fillStyle = colors.plane; ctx.fill(); ctx.restore();

  for (let i = -extent; i <= extent; i += gridStep) {
    line(proj({x:i,y:-extent,z:0}), proj({x:i,y:extent,z:0}), colors.grid);
    line(proj({x:-extent,y:i,z:0}), proj({x:extent,y:i,z:0}), colors.grid);
  }

  const axes = [
    {a:{x:-extent,y:0,z:0}, b:{x:extent,y:0,z:0}, color:colors.x, positive:"+x", negative:"−x"},
    {a:{x:0,y:-extent,z:0}, b:{x:0,y:extent,z:0}, color:colors.y, positive:"+y", negative:"−y"},
    {a:{x:0,y:0,z:-extent}, b:{x:0,y:0,z:extent}, color:colors.z, positive:"+z", negative:"−z"}
  ];
  axes.forEach(axis => {
    const start = proj(axis.a);
    const end = proj(axis.b);
    line(start, end, axis.color, 1.5);
    arrowHead(proj({x:0,y:0,z:0}), end, axis.color);
    label(axis.positive, {x:end.x+11,y:end.y-11}, axis.color);
    label(axis.negative, {x:start.x-11,y:start.y+11}, axis.color);
  });

  const o = proj({x:0,y:0,z:0});
  const point = proj(state.point);
  const base = proj({x:state.point.x,y:state.point.y,z:0});
  const xFoot = proj({x:state.point.x,y:0,z:0});
  const yFoot = proj({x:0,y:state.point.y,z:0});

  line(xFoot, base, "rgba(84,230,216,.38)", 1, [5,5]);
  line(yFoot, base, "rgba(255,107,118,.38)", 1, [5,5]);
  line(base, point, colors.z, 1.4, [6,5]);
  line(o, base, "rgba(255,158,87,.42)", 1.5);
  line(o, point, colors.point, 2.4);
  dot(o, 3, colors.text);
  dot(base, 4, "rgba(84,230,216,.9)");
  dot(point, 7, colors.point, true);
  ctx.save(); ctx.beginPath(); ctx.arc(point.x,point.y,11,0,Math.PI*2); ctx.strokeStyle="rgba(255,255,255,.7)"; ctx.stroke(); ctx.restore();
  label("ρ", {x:(o.x+base.x)/2+9,y:(o.y+base.y)/2-10}, colors.y);
  label("r", {x:(o.x+point.x)/2-9,y:(o.y+point.y)/2-10}, colors.point);
  label("z", {x:(base.x+point.x)/2+12,y:(base.y+point.y)/2}, colors.z);
  label("P", {x:point.x+14,y:point.y-15},colors.point,"left");
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  if (state.mainSystem === "polar") draw2D(rect.width, rect.height);
  else if (state.mainSystem === "cartesian") draw3D(rect.width, rect.height);
  else drawEducationalDiagram(canvas, state.mainSystem, state);
  drawComparisonDiagrams();
}

function diagramContext(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(rect.width * dpr);
  const pixelHeight = Math.round(rect.height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  return { context, width: rect.width, height: rect.height };
}

function drawEducationalDiagram(canvas, system, view = { yaw: 0, pitch: 0, zoom: 1 }) {
  const { context: dctx, width, height } = diagramContext(canvas);
  if (!width || !height) return;
  const c = coordinateSet();
  const origin = { x: width * .51, y: height * .55 };
  const extent = Math.max(5, Math.abs(c.x), Math.abs(c.y), Math.abs(c.z), c.rho, c.radius);
  const scale = Math.min(width, height) * .31 / extent * view.zoom;

  const dline = (a, b, color, lineWidth = 1, dash = []) => {
    dctx.save(); dctx.beginPath(); dctx.moveTo(a.x,a.y); dctx.lineTo(b.x,b.y);
    dctx.strokeStyle=color; dctx.lineWidth=lineWidth; dctx.setLineDash(dash); dctx.stroke(); dctx.restore();
  };
  const ddot = (p, radius, color, glow = false) => {
    dctx.save(); if (glow) { dctx.shadowColor=color; dctx.shadowBlur=14; }
    dctx.beginPath(); dctx.arc(p.x,p.y,radius,0,Math.PI*2); dctx.fillStyle=color; dctx.fill(); dctx.restore();
  };
  const dlabel = (text, p, color = colors.text, align = "center") => {
    dctx.save(); dctx.font='500 10px "DM Mono", monospace'; dctx.textAlign=align; dctx.textBaseline="middle"; dctx.fillStyle=color; dctx.fillText(text,p.x,p.y); dctx.restore();
  };
  const project = p => {
    const cy=Math.cos(view.yaw),sy=Math.sin(view.yaw),cp=Math.cos(view.pitch),sp=Math.sin(view.pitch);
    const x1=p.x*cy-p.y*sy;
    const y1=p.x*sy+p.y*cy;
    const y2=y1*cp-p.z*sp;
    const z2=y1*sp+p.z*cp;
    return { x: origin.x + (x1-y2*.62)*scale, y: origin.y + (-z2+y2*.58)*scale };
  };
  const drawAxes3D = () => {
    const e = extent * .92;
    [[{x:-e,y:0,z:0},{x:e,y:0,z:0},colors.x,"x"],[{x:0,y:-e,z:0},{x:0,y:e,z:0},colors.y,"y"],[{x:0,y:0,z:-e},{x:0,y:0,z:e},colors.z,"z"]].forEach(([a,b,color,name])=>{
      const pa=project(a),pb=project(b); dline(pa,pb,color,1.2); dlabel(`+${name}`,{x:pb.x+9,y:pb.y-8},color);
    });
  };
  const point = project(c);

  if (system === "polar") {
    const p = { x: origin.x + c.x*scale, y: origin.y - c.y*scale };
    dline({x:18,y:origin.y},{x:width-18,y:origin.y},colors.x,1.2);
    dline({x:origin.x,y:height-16},{x:origin.x,y:16},colors.y,1.2);
    dctx.save(); dctx.beginPath(); dctx.arc(origin.x,origin.y,c.rho*scale,0,Math.PI*2); dctx.strokeStyle="rgba(84,230,216,.2)"; dctx.stroke(); dctx.restore();
    dline(origin,p,colors.point,2);
    const arcRadius=Math.min(36,Math.max(20,c.rho*scale*.3));
    dctx.save(); dctx.beginPath();
    const count=Math.max(10,Math.ceil(Math.abs(c.theta)*14));
    for(let i=0;i<=count;i++){const a=c.theta*i/count;const ax=origin.x+Math.cos(a)*arcRadius;const ay=origin.y-Math.sin(a)*arcRadius;i?dctx.lineTo(ax,ay):dctx.moveTo(ax,ay);}
    dctx.strokeStyle=colors.y; dctx.lineWidth=1.4; dctx.stroke(); dctx.restore();
    dlabel("θ",{x:origin.x+Math.cos(-c.theta/2)*(arcRadius+12),y:origin.y+Math.sin(-c.theta/2)*(arcRadius+12)},colors.y);
    dlabel("r",{x:(origin.x+p.x)/2+8,y:(origin.y+p.y)/2-9},colors.point);
    ddot(p,6,colors.point,true); dlabel("P",{x:p.x+12,y:p.y-12},colors.point,"left");
    return;
  }

  drawAxes3D();
  const base = project({x:c.x,y:c.y,z:0});
  if (system === "cartesian") {
    dline(project({x:c.x,y:0,z:0}),base,"rgba(84,230,216,.42)",1,[4,4]);
    dline(project({x:0,y:c.y,z:0}),base,"rgba(255,107,118,.42)",1,[4,4]);
    dline(base,point,colors.z,1.2,[4,4]);
    dline(origin,point,colors.point,2);
  } else if (system === "cylindrical") {
    const radius = c.rho;
    const levels = [0,c.z];
    levels.forEach(level=>{
      dctx.save(); dctx.beginPath();
      for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;const p=project({x:Math.cos(a)*radius,y:Math.sin(a)*radius,z:level});i?dctx.lineTo(p.x,p.y):dctx.moveTo(p.x,p.y);}
      dctx.strokeStyle=level===0?"rgba(84,230,216,.24)":"rgba(255,158,87,.34)"; dctx.lineWidth=1; dctx.stroke(); dctx.restore();
    });
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]) dline(project({x:Math.cos(a)*radius,y:Math.sin(a)*radius,z:0}),project({x:Math.cos(a)*radius,y:Math.sin(a)*radius,z:c.z}),"rgba(114,183,255,.18)");
    dline(origin,base,colors.y,1.8); dline(base,point,colors.z,1.4,[4,4]);
    dlabel("ρ",{x:(origin.x+base.x)/2+8,y:(origin.y+base.y)/2-8},colors.y);
    dlabel("z",{x:(base.x+point.x)/2+10,y:(base.y+point.y)/2},colors.z);
  } else {
    const r=c.radius;
    const rings=[
      a=>({x:Math.cos(a)*r,y:Math.sin(a)*r,z:0}),
      a=>({x:Math.cos(a)*r,y:0,z:Math.sin(a)*r}),
      a=>({x:0,y:Math.cos(a)*r,z:Math.sin(a)*r})
    ];
    rings.forEach((ring,index)=>{dctx.save();dctx.beginPath();for(let i=0;i<=72;i++){const p=project(ring(i/72*Math.PI*2));i?dctx.lineTo(p.x,p.y):dctx.moveTo(p.x,p.y);}dctx.strokeStyle=index?"rgba(169,150,255,.2)":"rgba(84,230,216,.24)";dctx.stroke();dctx.restore();});
    dline(origin,point,colors.point,2);
    dline(origin,base,"rgba(84,230,216,.45)",1,[4,4]);
    dline(base,point,"rgba(114,183,255,.45)",1,[4,4]);
    dlabel("r",{x:(origin.x+point.x)/2+8,y:(origin.y+point.y)/2-8},colors.point);
    dlabel("φ",{x:origin.x+12,y:origin.y-27},colors.violet);
  }
  ddot(origin,3,colors.text); ddot(point,6,colors.point,true); dlabel("P",{x:point.x+12,y:point.y-12},colors.point,"left");
}

function updateComparison() {
  for (const role of ["source","target"]) {
    const select = role === "source" ? sourceSelect : targetSelect;
    const system = systems[select.value];
    document.getElementById(`${role}-title`).textContent = system.name;
    document.getElementById(`${role}-dimension`).textContent = system.dimension;
    document.getElementById(`${role}-values`).textContent = systemValue(select.value);
    document.getElementById(`${role}-explanation`).textContent = system.explanation;
    diagramCanvases[role].closest(".system-diagram").classList.toggle("is-2d", select.value === "polar");
  }
  drawComparisonDiagrams();
}

function drawComparisonDiagrams() {
  drawEducationalDiagram(diagramCanvases.source, sourceSelect.value, diagramViews.source);
  drawEducationalDiagram(diagramCanvases.target, targetSelect.value, diagramViews.target);
}

function updateFromInputs() {
  for (const key of ["x", "y", "z"]) {
    const parsed = Number.parseFloat(inputs[key].value.replace?.(",", ".") ?? inputs[key].value);
    state.point[key] = Number.isFinite(parsed) ? parsed : 0;
  }
  calculate();
  draw();
}

Object.values(inputs).forEach(input => input.addEventListener("input", updateFromInputs));

document.querySelectorAll("[data-point]").forEach(button => {
  button.addEventListener("click", () => {
    const [x,y,z] = button.dataset.point.split(",").map(Number);
    Object.assign(state.point,{x,y,z});
    inputs.x.value=x; inputs.y.value=y; inputs.z.value=z;
    calculate(); draw();
  });
});

function setMainSystem(system) {
  state.mainSystem = system;
  state.yaw = 0;
  state.pitch = 0;
  state.zoom = 1;
  const is2D = system === "polar";
  document.getElementById("view-name").textContent = systems[system].name;
  document.getElementById("interaction-hint").textContent = is2D ? "Síkbeli sugár és irányszög" : "Húzd a forgatáshoz · görgess a nagyításhoz";
  document.getElementById("reset-view").hidden = is2D;
  canvas.style.cursor = is2D ? "default" : "grab";
  document.getElementById("main-readout").textContent = systemValue(system);
  draw();
}
mainSystemSelect.addEventListener("change", () => setMainSystem(mainSystemSelect.value));

function setAngleUnit(unit) {
  state.angleUnit = unit;
  document.getElementById("degrees-button").setAttribute("aria-pressed", String(unit === "degrees"));
  document.getElementById("radians-button").setAttribute("aria-pressed", String(unit === "radians"));
  calculate();
}
document.getElementById("degrees-button").addEventListener("click", () => setAngleUnit("degrees"));
document.getElementById("radians-button").addEventListener("click", () => setAngleUnit("radians"));

sourceSelect.addEventListener("change", updateComparison);
targetSelect.addEventListener("change", updateComparison);
document.getElementById("swap-systems").addEventListener("click", () => {
  const previousSource = sourceSelect.value;
  sourceSelect.value = targetSelect.value;
  targetSelect.value = previousSource;
  updateComparison();
});

document.querySelectorAll(".formula-toggle").forEach(button => {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.getAttribute("aria-controls"));
    const open = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!open));
    target.hidden = open;
    button.querySelector("span").textContent = open ? "＋" : "−";
  });
});

canvas.addEventListener("pointerdown", event => {
  if (state.mainSystem === "polar") return;
  state.dragging = true; state.lastX = event.clientX; state.lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", event => {
  if (!state.dragging || state.mainSystem === "polar") return;
  state.yaw += (event.clientX - state.lastX) * .008;
  state.pitch = Math.max(-1.35, Math.min(1.35, state.pitch + (event.clientY - state.lastY) * .008));
  state.lastX = event.clientX; state.lastY = event.clientY; draw();
});
canvas.addEventListener("pointerup", event => { state.dragging = false; canvas.releasePointerCapture?.(event.pointerId); });
canvas.addEventListener("pointercancel", () => { state.dragging = false; });
canvas.addEventListener("wheel", event => {
  if (state.mainSystem === "polar") return;
  event.preventDefault(); state.zoom = Math.max(.55, Math.min(2.2, state.zoom * (event.deltaY > 0 ? .9 : 1.1))); draw();
}, { passive: false });

document.getElementById("reset-view").addEventListener("click", () => { state.yaw=0; state.pitch=0; state.zoom=1; draw(); });

function installDiagramInteraction(role) {
  const diagramCanvas = diagramCanvases[role];
  const view = diagramViews[role];
  const select = role === "source" ? sourceSelect : targetSelect;
  diagramCanvas.addEventListener("pointerdown", event => {
    if (select.value === "polar") return;
    view.dragging=true; view.lastX=event.clientX; view.lastY=event.clientY;
    diagramCanvas.setPointerCapture(event.pointerId);
  });
  diagramCanvas.addEventListener("pointermove", event => {
    if (!view.dragging || select.value === "polar") return;
    view.yaw += (event.clientX-view.lastX)*.01;
    view.pitch = Math.max(-1.35,Math.min(1.35,view.pitch+(event.clientY-view.lastY)*.01));
    view.lastX=event.clientX; view.lastY=event.clientY;
    drawEducationalDiagram(diagramCanvas,select.value,view);
  });
  const endDrag = event => { view.dragging=false; if (event.pointerId !== undefined && diagramCanvas.hasPointerCapture?.(event.pointerId)) diagramCanvas.releasePointerCapture(event.pointerId); };
  diagramCanvas.addEventListener("pointerup",endDrag);
  diagramCanvas.addEventListener("pointercancel",endDrag);
  diagramCanvas.addEventListener("wheel",event=>{
    if(select.value==="polar") return;
    event.preventDefault();
    view.zoom=Math.max(.6,Math.min(1.8,view.zoom*(event.deltaY>0?.9:1.1)));
    drawEducationalDiagram(diagramCanvas,select.value,view);
  },{passive:false});
  document.getElementById(`${role}-reset`).addEventListener("click",()=>{
    view.yaw=0; view.pitch=0; view.zoom=1;
    drawEducationalDiagram(diagramCanvas,select.value,view);
  });
}

installDiagramInteraction("source");
installDiagramInteraction("target");
window.addEventListener("resize", resizeCanvas);

calculate();
setMainSystem("cartesian");
resizeCanvas();

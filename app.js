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
  const azimuth = Math.PI / 4 + state.yaw;
  const elevation = Math.atan(1 / Math.sqrt(2)) + state.pitch;
  const rightX = Math.cos(azimuth);
  const rightY = -Math.sin(azimuth);
  const downX = Math.sin(elevation) * Math.sin(azimuth);
  const downY = Math.sin(elevation) * Math.cos(azimuth);
  const downZ = -Math.cos(elevation);
  return {
    x: width * .53 + (point.x * rightX + point.y * rightY) * scale,
    y: height * .54 + (point.x * downX + point.y * downY + point.z * downZ) * scale,
    depth: point.x * Math.cos(elevation) * Math.sin(azimuth) + point.y * Math.cos(elevation) * Math.cos(azimuth) + point.z * Math.sin(elevation)
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
    const azimuth=Math.PI/4+view.yaw;
    const elevation=Math.atan(1/Math.sqrt(2))+view.pitch;
    const screenX=p.x*Math.cos(azimuth)-p.y*Math.sin(azimuth);
    const screenY=p.x*Math.sin(elevation)*Math.sin(azimuth)+p.y*Math.sin(elevation)*Math.cos(azimuth)-p.z*Math.cos(elevation);
    return {x:origin.x+screenX*scale,y:origin.y+screenY*scale};
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
  document.getElementById("interaction-hint").textContent = is2D ? "Síkbeli sugár és irányszög" : "90°-os térbeli tengelyek · húzd a forgatáshoz";
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

// --- Biztonságos, interaktív 3D függvényábrázoló ---------------------------
const functionCanvas = document.getElementById("function-canvas");
const functionCtx = functionCanvas.getContext("2d");
const functionInput = document.getElementById("function-input");
const functionError = document.getElementById("function-error");
const plotMinInput = document.getElementById("plot-min");
const plotMaxInput = document.getElementById("plot-max");
const plotResolutionInput = document.getElementById("plot-resolution");
const linearizeToggle = document.getElementById("linearize-toggle");
const linearXInput = document.getElementById("linear-x");
const linearYInput = document.getElementById("linear-y");
const plotHeightInput = document.getElementById("plot-height");

const plotState = {
  yaw: 0,
  pitch: 0,
  zoom: 1,
  dragging: false,
  lastX: 0,
  lastY: 0,
  samples: [],
  size: 0,
  rangeMin: -5,
  rangeMax: 5,
  zLimit: 1,
  rawMin: 0,
  rawMax: 0,
  linear: null,
  displayMode: "both",
  heightScale: .7
};

const plotFunctions = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
  log: Math.log, ln: Math.log, floor: Math.floor,
  ceil: Math.ceil, round: Math.round, min: Math.min,
  max: Math.max, pow: Math.pow
};
const plotConstants = { pi: Math.PI, e: Math.E };

function normalizeExpression(source) {
  let expression = String(source).trim()
    .replace(/[−–]/g, "-").replace(/×/g, "*").replace(/÷/g, "/")
    .replace(/π/g, "pi").replace(/√\s*\(/g, "sqrt(");
  if (expression.includes("=")) expression = expression.slice(expression.lastIndexOf("=") + 1).trim();
  if (!expression) throw new Error("Írj be egy függvényt, például: sin(x) + cos(y).");
  return expression;
}

function tokenizeExpression(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (/\s/.test(char)) { i++; continue; }
    if (/[0-9.]/.test(char)) {
      const match = source.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (!match) throw new Error(`Nem értelmezhető szám a(z) ${i + 1}. karakternél.`);
      tokens.push({ type: "number", value: Number(match[0]) });
      i += match[0].length;
      continue;
    }
    if (/[a-zA-Z]/.test(char)) {
      const match = source.slice(i).match(/^[a-zA-Z]+/)[0].toLowerCase();
      if (/^[xy]+$/.test(match) && match.length > 1) {
        [...match].forEach(value => tokens.push({ type: "name", value }));
      } else {
        tokens.push({ type: "name", value: match });
      }
      i += match.length;
      continue;
    }
    if ("+-*/^(),".includes(char)) {
      tokens.push({ type: char === "," ? "comma" : char === "(" || char === ")" ? "paren" : "operator", value: char });
      i++;
      continue;
    }
    throw new Error(`A(z) „${char}” karakter nem használható.`);
  }

  const withMultiplication = [];
  const endsValue = token => token && (token.type === "number" || token.type === "name" && !plotFunctions[token.value] || token.type === "paren" && token.value === ")");
  const startsValue = token => token && (token.type === "number" || token.type === "name" || token.type === "paren" && token.value === "(");
  tokens.forEach(token => {
    const previous = withMultiplication[withMultiplication.length - 1];
    const isFunctionCall = previous?.type === "name" && plotFunctions[previous.value] && token.type === "paren" && token.value === "(";
    if (endsValue(previous) && startsValue(token) && !isFunctionCall) withMultiplication.push({ type: "operator", value: "*" });
    withMultiplication.push(token);
  });
  return withMultiplication;
}

function compileExpression(source) {
  const normalized = normalizeExpression(source);
  const tokens = tokenizeExpression(normalized);
  let position = 0;

  function parsePrimary() {
    const token = tokens[position++];
    if (!token) throw new Error("A képlet váratlanul véget ért.");
    if (token.type === "number") return () => token.value;
    if (token.type === "name") {
      if (token.value === "x") return x => x;
      if (token.value === "y") return (_x, y) => y;
      if (token.value in plotConstants) return () => plotConstants[token.value];
      const operation = plotFunctions[token.value];
      if (!operation) throw new Error(`Ismeretlen név: „${token.value}”.`);
      if (tokens[position]?.value !== "(") throw new Error(`A(z) ${token.value} után tegyél zárójelet.`);
      position++;
      const argumentsList = [];
      if (tokens[position]?.value !== ")") {
        while (true) {
          argumentsList.push(parseExpression(0));
          if (tokens[position]?.type !== "comma") break;
          position++;
        }
      }
      if (tokens[position]?.value !== ")") throw new Error("Hiányzik egy bezáró zárójel.");
      position++;
      return (x, y) => operation(...argumentsList.map(argument => argument(x, y)));
    }
    if (token.value === "(") {
      const inside = parseExpression(0);
      if (tokens[position]?.value !== ")") throw new Error("Hiányzik egy bezáró zárójel.");
      position++;
      return inside;
    }
    throw new Error(`Váratlan jel: „${token.value}”.`);
  }

  function parsePrefix() {
    const token = tokens[position];
    if (token?.type === "operator" && (token.value === "+" || token.value === "-")) {
      position++;
      const value = parseExpression(3);
      return token.value === "-" ? (x, y) => -value(x, y) : value;
    }
    return parsePrimary();
  }

  function parseExpression(minimumPrecedence) {
    let left = parsePrefix();
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };
    while (true) {
      const operator = tokens[position];
      const currentPrecedence = operator?.type === "operator" ? precedence[operator.value] : undefined;
      if (currentPrecedence === undefined || currentPrecedence < minimumPrecedence) break;
      position++;
      const right = parseExpression(operator.value === "^" ? currentPrecedence : currentPrecedence + 1);
      const previousLeft = left;
      if (operator.value === "+") left = (x, y) => previousLeft(x, y) + right(x, y);
      if (operator.value === "-") left = (x, y) => previousLeft(x, y) - right(x, y);
      if (operator.value === "*") left = (x, y) => previousLeft(x, y) * right(x, y);
      if (operator.value === "/") left = (x, y) => previousLeft(x, y) / right(x, y);
      if (operator.value === "^") left = (x, y) => Math.pow(previousLeft(x, y), right(x, y));
    }
    return left;
  }

  const evaluate = parseExpression(0);
  if (position < tokens.length) throw new Error(`Váratlan jel: „${tokens[position].value}”.`);
  return { normalized, evaluate };
}

function plotNumber(value) {
  if (!Number.isFinite(value)) return "–";
  if (Math.abs(value) >= 1000 || Math.abs(value) < .001 && value !== 0) return value.toExponential(2);
  return Number(value.toFixed(3)).toString();
}

function displayExpression(expression) {
  return expression.replace(/sqrt/g, "√").replace(/\*/g, "·").replace(/\^2\b/g, "²");
}

function finitePlotValue(evaluate, x, y) {
  try {
    const value = evaluate(x, y);
    return Number.isFinite(value) && Math.abs(value) < 1e10 ? value : null;
  } catch {
    return null;
  }
}

function numericalDerivative(evaluate, x, y, axis, step, centerValue) {
  const before = axis === "x" ? finitePlotValue(evaluate, x - step, y) : finitePlotValue(evaluate, x, y - step);
  const after = axis === "x" ? finitePlotValue(evaluate, x + step, y) : finitePlotValue(evaluate, x, y + step);
  if (before !== null && after !== null) {
    const leftSlope = (centerValue - before) / step;
    const rightSlope = (after - centerValue) / step;
    const tolerance = Math.max(1e-3, Math.max(Math.abs(leftSlope), Math.abs(rightSlope), 1) * .02);
    if (Math.abs(leftSlope - rightSlope) > tolerance) return null;
    return (leftSlope + rightSlope) / 2;
  }
  if (after !== null) return (after - centerValue) / step;
  if (before !== null) return (centerValue - before) / step;
  return null;
}

function linearFormula(linear) {
  const constant = linear.z0 - linear.fx * linear.x0 - linear.fy * linear.y0;
  const terms = [{ value: linear.fx, variable: "x" }, { value: linear.fy, variable: "y" }, { value: constant, variable: "" }]
    .filter(term => Math.abs(term.value) > 1e-9);
  if (!terms.length) return "L(x, y) = 0";
  const formula = terms.map((term, index) => {
    const body = `${plotNumber(Math.abs(term.value))}${term.variable ? `·${term.variable}` : ""}`;
    if (index === 0) return term.value < 0 ? `−${body}` : body;
    return `${term.value < 0 ? "−" : "+"} ${body}`;
  }).join(" ");
  return `L(x, y) = ${formula}`;
}

function updateLayerControls() {
  document.querySelectorAll("[data-layer]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.layer === plotState.displayMode));
  });
  document.getElementById("surface-legend").hidden = Boolean(plotState.linear) && plotState.displayMode === "plane";
  document.getElementById("tangent-legend").hidden = !plotState.linear || plotState.displayMode === "surface";
}

function createFunctionPlot() {
  try {
    const rangeMin = Number(plotMinInput.value);
    const rangeMax = Number(plotMaxInput.value);
    if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax) || rangeMin >= rangeMax) {
      throw new Error("A tartomány eleje legyen kisebb a végénél.");
    }
    const compiled = compileExpression(functionInput.value);
    const size = Math.max(12, Math.min(60, Number(plotResolutionInput.value) || 36));
    const samples = [];
    const finiteValues = [];
    for (let row = 0; row <= size; row++) {
      const y = rangeMin + (rangeMax - rangeMin) * row / size;
      const line = [];
      for (let column = 0; column <= size; column++) {
        const x = rangeMin + (rangeMax - rangeMin) * column / size;
        let z;
        try { z = compiled.evaluate(x, y); } catch { z = NaN; }
        if (Number.isFinite(z) && Math.abs(z) < 1e10) finiteValues.push(z);
        else z = null;
        line.push({ x, y, z });
      }
      samples.push(line);
    }
    if (!finiteValues.length) throw new Error("Ebben a tartományban a függvénynek nincs kirajzolható értéke.");
    const sortedAbsolute = finiteValues.map(Math.abs).sort((a, b) => a - b);
    const percentile = sortedAbsolute[Math.floor((sortedAbsolute.length - 1) * .95)];
    plotState.samples = samples;
    plotState.size = size;
    plotState.rangeMin = rangeMin;
    plotState.rangeMax = rangeMax;
    plotState.zLimit = Math.max(percentile, .001);
    plotState.rawMin = Math.min(...finiteValues);
    plotState.rawMax = Math.max(...finiteValues);
    plotState.linear = null;
    if (linearizeToggle.checked) {
      const x0 = Number(linearXInput.value);
      const y0 = Number(linearYInput.value);
      if (!Number.isFinite(x0) || !Number.isFinite(y0)) throw new Error("Adj meg érvényes x₀ és y₀ értéket.");
      if (x0 < rangeMin || x0 > rangeMax || y0 < rangeMin || y0 > rangeMax) {
        throw new Error("A közelítés pontja legyen a megadott ábrázolási tartományban.");
      }
      const z0 = finitePlotValue(compiled.evaluate, x0, y0);
      if (z0 === null) throw new Error("A függvény ebben a pontban nem értelmezhető.");
      const derivativeStep = Math.max((rangeMax - rangeMin) * 1e-4, 1e-6);
      const fx = numericalDerivative(compiled.evaluate, x0, y0, "x", derivativeStep, z0);
      const fy = numericalDerivative(compiled.evaluate, x0, y0, "y", derivativeStep, z0);
      if (fx === null || fy === null || !Number.isFinite(fx) || !Number.isFinite(fy)) {
        throw new Error("Ebben a pontban nem határozható meg stabil lineáris közelítés.");
      }
      plotState.linear = { x0, y0, z0, fx, fy };
      document.getElementById("linear-formula").textContent = linearFormula(plotState.linear);
      document.getElementById("linear-details").textContent = `P = (${plotNumber(x0)}; ${plotNumber(y0)}; ${plotNumber(z0)}) · ∇f = (${plotNumber(fx)}; ${plotNumber(fy)})`;
    }
    updateLayerControls();
    functionError.hidden = true;
    document.getElementById("expression-field").classList.remove("has-error");
    document.getElementById("plot-formula").textContent = `z = ${displayExpression(compiled.normalized)}`;
    document.getElementById("plot-status").textContent = `z: ${plotNumber(plotState.rawMin)} … ${plotNumber(plotState.rawMax)}`;
    drawFunctionPlot();
  } catch (error) {
    if (linearizeToggle.checked && !plotState.linear) {
      document.getElementById("tangent-legend").hidden = true;
      document.getElementById("linear-formula").textContent = "L(x, y) = nem határozható meg";
      document.getElementById("linear-details").textContent = "Válassz olyan pontot, ahol a függvény sima és értelmezhető.";
      drawFunctionPlot();
    }
    functionError.textContent = error.message;
    functionError.hidden = false;
    document.getElementById("expression-field").classList.add("has-error");
  }
}

function projectFunctionPoint(point, width, height) {
  const halfRange = (plotState.rangeMax - plotState.rangeMin) / 2;
  const midpoint = (plotState.rangeMin + plotState.rangeMax) / 2;
  const x = (point.x - midpoint) / halfRange;
  const y = (point.y - midpoint) / halfRange;
  const z = Math.max(-1.15, Math.min(1.15, point.z / plotState.zLimit)) * plotState.heightScale;
  const angle = plotState.yaw - Math.PI / 4;
  const elevation = plotState.pitch + .62;
  const horizontal = x * Math.cos(angle) - y * Math.sin(angle);
  const receding = x * Math.sin(angle) + y * Math.cos(angle);
  const vertical = receding * Math.sin(elevation) - z * Math.cos(elevation);
  const depth = receding * Math.cos(elevation) + z * Math.sin(elevation);
  const scale = Math.min(width, height) * .34 * plotState.zoom;
  return { x: width * .51 + horizontal * scale, y: height * .51 + vertical * scale, depth };
}

function surfaceColor(value, alpha = .78) {
  const t = Math.max(0, Math.min(1, value / plotState.zLimit / 2 + .5));
  const stops = t < .5
    ? [[22,124,128], [242,193,78], t * 2]
    : [[242,193,78], [229,102,79], (t - .5) * 2];
  const rgb = stops[0].map((channel, index) => Math.round(channel + (stops[1][index] - channel) * stops[2]));
  return `rgba(${rgb.join(",")},${alpha})`;
}

function drawFunctionLine(points, color, width, canvasWidth, canvasHeight) {
  functionCtx.beginPath();
  points.forEach((point, index) => {
    const projected = projectFunctionPoint(point, canvasWidth, canvasHeight);
    if (index) functionCtx.lineTo(projected.x, projected.y); else functionCtx.moveTo(projected.x, projected.y);
  });
  functionCtx.strokeStyle = color;
  functionCtx.lineWidth = width;
  functionCtx.stroke();
}

function drawFunctionPlot() {
  const ratio = window.devicePixelRatio || 1;
  const rect = functionCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (!width || !height) return;
  if (functionCanvas.width !== Math.round(width * ratio) || functionCanvas.height !== Math.round(height * ratio)) {
    functionCanvas.width = Math.round(width * ratio);
    functionCanvas.height = Math.round(height * ratio);
  }
  functionCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  functionCtx.clearRect(0, 0, width, height);
  if (!plotState.samples.length) return;

  const min = plotState.rangeMin;
  const max = plotState.rangeMax;
  const middle = (min + max) / 2;
  const gridColor = "rgba(23,49,59,.14)";
  for (let index = 0; index <= 8; index++) {
    const value = min + (max - min) * index / 8;
    drawFunctionLine([{x:min,y:value,z:0},{x:max,y:value,z:0}], gridColor, 1, width, height);
    drawFunctionLine([{x:value,y:min,z:0},{x:value,y:max,z:0}], gridColor, 1, width, height);
  }

  const quads = [];
  let planeBoundary = null;
  if (!plotState.linear || plotState.displayMode !== "plane") {
    for (let row = 0; row < plotState.size; row++) {
      for (let column = 0; column < plotState.size; column++) {
        const points = [plotState.samples[row][column], plotState.samples[row][column+1], plotState.samples[row+1][column+1], plotState.samples[row+1][column]];
        if (points.some(point => point.z === null)) continue;
        const visibleZ = points.map(point => Math.max(-plotState.zLimit * 1.15, Math.min(plotState.zLimit * 1.15, point.z)));
        if (Math.max(...visibleZ) - Math.min(...visibleZ) > plotState.zLimit * 1.5) continue;
        const projected = points.map(point => projectFunctionPoint(point, width, height));
        quads.push({ kind: "surface", projected, depth: projected.reduce((sum, point) => sum + point.depth, 0) / 4, z: points.reduce((sum, point) => sum + point.z, 0) / 4 });
      }
    }
  }
  if (plotState.linear && plotState.displayMode !== "surface") {
    const linear = plotState.linear;
    const span = max - min;
    const baseHalfSize = span * .24;
    const cornerChange = (Math.abs(linear.fx) + Math.abs(linear.fy)) * baseHalfSize;
    const safeChange = plotState.zLimit * .68;
    const adaptiveScale = cornerChange > safeChange ? safeChange / cornerChange : 1;
    const halfSize = baseHalfSize * adaptiveScale;
    const patchMinX = Math.max(min, linear.x0 - halfSize);
    const patchMaxX = Math.min(max, linear.x0 + halfSize);
    const patchMinY = Math.max(min, linear.y0 - halfSize);
    const patchMaxY = Math.min(max, linear.y0 + halfSize);
    const planeSize = 9;
    const planeValue = (x, y) => linear.z0 + linear.fx * (x - linear.x0) + linear.fy * (y - linear.y0);
    planeBoundary = [
      {x:patchMinX,y:patchMinY,z:planeValue(patchMinX,patchMinY)},
      {x:patchMaxX,y:patchMinY,z:planeValue(patchMaxX,patchMinY)},
      {x:patchMaxX,y:patchMaxY,z:planeValue(patchMaxX,patchMaxY)},
      {x:patchMinX,y:patchMaxY,z:planeValue(patchMinX,patchMaxY)},
      {x:patchMinX,y:patchMinY,z:planeValue(patchMinX,patchMinY)}
    ];
    for (let row = 0; row < planeSize; row++) {
      for (let column = 0; column < planeSize; column++) {
        const x1 = patchMinX + (patchMaxX - patchMinX) * column / planeSize;
        const x2 = patchMinX + (patchMaxX - patchMinX) * (column + 1) / planeSize;
        const y1 = patchMinY + (patchMaxY - patchMinY) * row / planeSize;
        const y2 = patchMinY + (patchMaxY - patchMinY) * (row + 1) / planeSize;
        const points = [{x:x1,y:y1,z:planeValue(x1,y1)},{x:x2,y:y1,z:planeValue(x2,y1)},{x:x2,y:y2,z:planeValue(x2,y2)},{x:x1,y:y2,z:planeValue(x1,y2)}];
        const projected = points.map(point => projectFunctionPoint(point, width, height));
        quads.push({ kind: "plane", projected, depth: projected.reduce((sum, point) => sum + point.depth, 0) / 4, z: points.reduce((sum, point) => sum + point.z, 0) / 4 });
      }
    }
  }
  quads.sort((a, b) => a.depth - b.depth);
  quads.forEach(quad => {
    functionCtx.beginPath();
    quad.projected.forEach((point, index) => index ? functionCtx.lineTo(point.x, point.y) : functionCtx.moveTo(point.x, point.y));
    functionCtx.closePath();
    const surfaceAlpha = plotState.linear && plotState.displayMode === "both" ? .66 : .82;
    functionCtx.fillStyle = quad.kind === "plane" ? "rgba(128,86,156,.25)" : surfaceColor(quad.z, surfaceAlpha);
    functionCtx.fill();
    functionCtx.strokeStyle = quad.kind === "plane" ? "rgba(92,55,119,.38)" : "rgba(23,49,59,.12)";
    functionCtx.lineWidth = quad.kind === "plane" ? .75 : .6;
    functionCtx.stroke();
  });
  if (planeBoundary) drawFunctionLine(planeBoundary, "rgba(104,66,127,.92)", 2.2, width, height);

  const axes = [
    { points:[{x:min,y:middle,z:0},{x:max,y:middle,z:0}], label:"x", color:"#c74752" },
    { points:[{x:middle,y:min,z:0},{x:middle,y:max,z:0}], label:"y", color:"#2c6f9f" },
    { points:[{x:middle,y:middle,z:-plotState.zLimit},{x:middle,y:middle,z:plotState.zLimit}], label:"z", color:"#087f83" }
  ];
  functionCtx.font = "600 13px IBM Plex Mono, monospace";
  axes.forEach(axis => {
    drawFunctionLine(axis.points, axis.color, 2, width, height);
    const endpoint = projectFunctionPoint(axis.points[1], width, height);
    functionCtx.fillStyle = axis.color;
    functionCtx.fillText(axis.label, endpoint.x + 7, endpoint.y - 7);
  });
  if (plotState.linear) {
    const point = projectFunctionPoint({ x: plotState.linear.x0, y: plotState.linear.y0, z: plotState.linear.z0 }, width, height);
    functionCtx.beginPath();
    functionCtx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    functionCtx.fillStyle = "#80569c";
    functionCtx.fill();
    functionCtx.strokeStyle = "#fffdf6";
    functionCtx.lineWidth = 2;
    functionCtx.stroke();
    functionCtx.fillStyle = "#68427f";
    functionCtx.font = "600 10px IBM Plex Mono, monospace";
    functionCtx.fillText(`(${plotNumber(plotState.linear.x0)}; ${plotNumber(plotState.linear.y0)})`, point.x + 9, point.y - 8);
  }
}

function insertMathToken(token) {
  const start = functionInput.selectionStart ?? functionInput.value.length;
  const end = functionInput.selectionEnd ?? start;
  const selected = functionInput.value.slice(start, end);
  let insertion = token;
  let caretOffset = token.length;
  if (token.endsWith("()")) {
    insertion = `${token.slice(0, -1)}${selected})`;
    caretOffset = token.length - 1 + selected.length;
  } else if (token === "()") {
    insertion = `(${selected})`;
    caretOffset = 1 + selected.length;
  }
  functionInput.setRangeText(insertion, start, end, "end");
  functionInput.focus();
  functionInput.setSelectionRange(start + caretOffset, start + caretOffset);
}

let plotInputTimer;
document.getElementById("plot-function").addEventListener("click", createFunctionPlot);
functionInput.addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); createFunctionPlot(); }
});
functionInput.addEventListener("input", () => {
  clearTimeout(plotInputTimer);
  plotInputTimer = setTimeout(createFunctionPlot, 420);
});
document.querySelectorAll("[data-math]").forEach(button => button.addEventListener("click", () => {
  insertMathToken(button.dataset.math);
  createFunctionPlot();
}));
document.querySelectorAll("[data-function]").forEach(button => button.addEventListener("click", () => {
  functionInput.value = button.dataset.function;
  createFunctionPlot();
}));
[plotMinInput, plotMaxInput, plotResolutionInput].forEach(control => control.addEventListener("change", createFunctionPlot));
linearizeToggle.addEventListener("change", () => {
  document.getElementById("linearization-settings").hidden = !linearizeToggle.checked;
  createFunctionPlot();
});
[linearXInput, linearYInput].forEach(input => input.addEventListener("input", () => {
  clearTimeout(plotInputTimer);
  plotInputTimer = setTimeout(createFunctionPlot, 260);
}));
document.querySelectorAll("[data-layer]").forEach(button => button.addEventListener("click", () => {
  plotState.displayMode = button.dataset.layer;
  updateLayerControls();
  drawFunctionPlot();
}));
plotHeightInput.addEventListener("input", () => {
  plotState.heightScale = Number(plotHeightInput.value);
  document.getElementById("plot-height-value").textContent = `${Math.round(plotState.heightScale * 100)}%`;
  drawFunctionPlot();
});

functionCanvas.addEventListener("pointerdown", event => {
  plotState.dragging = true;
  plotState.lastX = event.clientX;
  plotState.lastY = event.clientY;
  functionCanvas.setPointerCapture(event.pointerId);
});
functionCanvas.addEventListener("pointermove", event => {
  if (!plotState.dragging) return;
  plotState.yaw += (event.clientX - plotState.lastX) * .009;
  plotState.pitch = Math.max(-1.35, Math.min(.8, plotState.pitch + (event.clientY - plotState.lastY) * .008));
  plotState.lastX = event.clientX;
  plotState.lastY = event.clientY;
  drawFunctionPlot();
});
function endFunctionDrag(event) {
  plotState.dragging = false;
  if (event.pointerId !== undefined && functionCanvas.hasPointerCapture?.(event.pointerId)) functionCanvas.releasePointerCapture(event.pointerId);
}
functionCanvas.addEventListener("pointerup", endFunctionDrag);
functionCanvas.addEventListener("pointercancel", endFunctionDrag);
functionCanvas.addEventListener("wheel", event => {
  event.preventDefault();
  plotState.zoom = Math.max(.55, Math.min(2.1, plotState.zoom * (event.deltaY > 0 ? .9 : 1.1)));
  drawFunctionPlot();
}, { passive: false });
document.getElementById("reset-plot").addEventListener("click", () => {
  plotState.yaw = 0;
  plotState.pitch = 0;
  plotState.zoom = 1;
  plotState.heightScale = .7;
  plotHeightInput.value = ".7";
  document.getElementById("plot-height-value").textContent = "70%";
  drawFunctionPlot();
});

installDiagramInteraction("source");
installDiagramInteraction("target");
window.addEventListener("resize", () => { resizeCanvas(); drawFunctionPlot(); });

calculate();
setMainSystem("cartesian");
resizeCanvas();
createFunctionPlot();

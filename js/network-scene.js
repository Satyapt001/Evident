// Decorative 3D network. Illustrative only: no real telemetry.
// Tune visual intensity here.
export const CONFIG = {
  nodes: 70,        // node count (lower on weak devices)
  links: 3,         // nearest neighbours linked per node
  signals: 18,      // travelling signal particles
  threats: 4,       // highlighted threat nodes
  speed: 0.35,      // signal speed
  rotation: 0.04,   // idle rotation (radians/sec)
  parallax: 0.35,   // pointer influence
  glow: 1.0         // overall brightness 0.3 to 1.5
};

export async function initNetwork(canvas, container, { reduceMotion = false } = {}) {
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
  const THREE = await import('three');
  const C = { ...CONFIG };
  if (innerWidth < 700) { C.nodes = 40; C.signals = 10; }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 11);
  const group = new THREE.Group(); scene.add(group);

  // Nodes distributed in a flattened sphere
  const pos = [];
  for (let i = 0; i < C.nodes; i++) {
    const u = Math.random(), v = Math.random(), th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1), r = 3 + Math.random() * 3.2;
    pos.push(new THREE.Vector3(r * Math.sin(ph) * Math.cos(th) * 1.4, r * Math.sin(ph) * Math.sin(th) * .8, r * Math.cos(ph)));
  }
  // Edges: link each node to its nearest neighbours
  const edges = [], seen = new Set();
  pos.forEach((p, i) => {
    pos.map((q, j) => [j, p.distanceToSquared(q)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, C.links)
      .forEach(([j]) => { const k = i < j ? i + '-' + j : j + '-' + i; if (!seen.has(k)) { seen.add(k); edges.push([i, j]); } });
  });
  const lineGeo = new THREE.BufferGeometry().setFromPoints(edges.flatMap(([a, b]) => [pos[a], pos[b]]));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x7d8a99, transparent: true, opacity: .35 * C.glow });
  group.add(new THREE.LineSegments(lineGeo, lineMat));

  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
  const dot = (size, color, op) => new THREE.PointsMaterial({ size: size * 2.2, map: tex, color, transparent: true, opacity: op, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const threatIdx = new Set(); while (threatIdx.size < C.threats) threatIdx.add((Math.random() * C.nodes) | 0);
  const normal = pos.filter((_, i) => !threatIdx.has(i)), threat = [...threatIdx].map(i => pos[i]);
  const nodeMat = dot(.16, 0xf2f2f0, .95 * Math.min(C.glow, 1)), threatMat = dot(.34, 0xff3b30, .95 * Math.min(C.glow, 1));
  group.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(normal), nodeMat));
  group.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(threat), threatMat));

  // Signals travelling along edges
  const sigs = Array.from({ length: C.signals }, () => ({ e: edges[(Math.random() * edges.length) | 0], t: Math.random(), dir: Math.random() < .5 ? 1 : -1 }));
  const sigPos = new Float32Array(C.signals * 3);
  const sigGeo = new THREE.BufferGeometry(); sigGeo.setAttribute('position', new THREE.BufferAttribute(sigPos, 3));
  const sigMat = dot(.26, 0x00d4ff, .95 * Math.min(C.glow, 1));
  group.add(new THREE.Points(sigGeo, sigMat));
  const haloMat = dot(.9, 0x00d4ff, 0);
  const halo = new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]), haloMat); scene.add(halo);
  const tmp = new THREE.Vector3();
  const step = dt => sigs.forEach((s, i) => {
    s.t += dt * C.speed * s.dir;
    if (s.t > 1 || s.t < 0) { // hop to a connected edge from the endpoint reached
      const end = s.t > 1 ? s.e[1] : s.e[0], next = edges.filter(e => e.includes(end));
      const ne = next[(Math.random() * next.length) | 0] || s.e;
      s.e = ne; s.dir = ne[0] === end ? 1 : -1; s.t = s.dir === 1 ? 0 : 1;
    }
    tmp.lerpVectors(pos[s.e[0]], pos[s.e[1]], s.t); tmp.toArray(sigPos, i * 3);
  });
  step(0); sigGeo.attributes.position.needsUpdate = true;

  // Sizing
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.position.x = w > 900 ? -3.2 : 0; // keep headline area clear on wide screens
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  // Pointer parallax (listens on window, canvas never captures input)
  const mouse = { x: 0, y: 0 }, look = { x: 0, y: 0 };
  const ndc = { x: 0, y: 0 }; let inside = false;
  const onMove = e => {
    mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5;
    const r = container.getBoundingClientRect();
    inside = e.clientY >= r.top && e.clientY <= r.bottom;
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1; ndc.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    start();
  };
  const onLeave = () => { inside = false; start(); };
  addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  // Loop, paused when offscreen or tab hidden
  let raf = 0, visible = true, last = performance.now(), clock = 0, spin = 0;
  const frame = now => {
    raf = 0; const dt = Math.min((now - last) / 1000, .05); last = now;
    if (!reduceMotion) { // ambient motion only when allowed; pointer tilt is user-driven
      clock += dt; spin += dt * C.rotation; step(dt); sigGeo.attributes.position.needsUpdate = true;
      threatMat.opacity = (.55 + .4 * Math.sin(clock * 2)) * Math.min(C.glow, 1);
    }
    look.x += (mouse.x - look.x) * .08; look.y += (mouse.y - look.y) * .08;
    group.rotation.y = spin + look.x * C.parallax * 3; group.rotation.x = look.y * C.parallax * 2;
    camera.rotation.y = -look.x * C.parallax * .3; camera.rotation.x = -look.y * C.parallax * .2;
    camera.updateMatrixWorld();
    tmp.set(ndc.x, ndc.y, .5).unproject(camera).sub(camera.position).normalize();
    halo.position.copy(camera.position).addScaledVector(tmp, -camera.position.z / tmp.z);
    haloMat.opacity += ((inside ? .55 * C.glow : 0) - haloMat.opacity) * .12;
    renderer.render(scene, camera);
    const settled = Math.abs(mouse.x - look.x) < .0005 && Math.abs(mouse.y - look.y) < .0005 && Math.abs(haloMat.opacity - (inside ? .55 * C.glow : 0)) < .01;
    if (visible && !document.hidden && !(reduceMotion && settled)) raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : (cancelAnimationFrame(raf), raf = 0); });
  io.observe(container);
  const onVis = () => (document.hidden ? (cancelAnimationFrame(raf), raf = 0) : start());
  document.addEventListener('visibilitychange', onVis);
  renderer.render(scene, camera); // static frame also serves reduced motion
  start();

  const onLost = e => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; container.classList.add('no-webgl'); };
  canvas.addEventListener('webglcontextlost', onLost);

  return {
    destroy() {
      cancelAnimationFrame(raf); raf = 0; io.disconnect(); ro.disconnect();
      removeEventListener('pointermove', onMove); document.documentElement.removeEventListener('pointerleave', onLeave); tex.dispose(); document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      scene.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); });
      renderer.dispose();
    }
  };
}

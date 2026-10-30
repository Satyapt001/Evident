const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
$('#yr').textContent = new Date().getFullYear();

// Mobile menu
const btn = $('.menu-btn'), menu = $('#menu');
const setMenu = o => { menu.classList.toggle('open', o); btn.setAttribute('aria-expanded', o); };
btn.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
menu.addEventListener('click', e => e.target.closest('a') && setMenu(false));
addEventListener('keydown', e => e.key === 'Escape' && setMenu(false));

// Reveal on scroll
$$('.cards .card').forEach((c, i) => c.style.setProperty('--i', i));
const rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }), { threshold: .12 });
$$('.reveal').forEach(el => rio.observe(el));

// Card details
$$('.card .more').forEach(b => b.addEventListener('click', () => {
  const open = b.getAttribute('aria-expanded') === 'true';
  b.setAttribute('aria-expanded', !open);
  b.nextElementSibling.hidden = open;
}));

// Workflow progression
const stages = $$('#flow .stage'), flow = $('#flow');
const setStage = i => {
  stages.forEach((s, k) => { s.classList.toggle('active', k === i); s.classList.toggle('done', k < i); $('button', s).setAttribute('aria-pressed', k === i); });
  flow.style.setProperty('--p', (i / (stages.length - 1)) * 94 + '%');
};
stages.forEach((s, i) => $('button', s).addEventListener('click', () => { userPicked = true; setStage(i); }));
let userPicked = false, timer = null, cur = 0;
const fio = new IntersectionObserver(([e]) => {
  clearInterval(timer);
  if (e.isIntersecting && !reduce) timer = setInterval(() => { if (!userPicked) { cur = (cur + 1) % stages.length; setStage(cur); } }, 2200);
}, { threshold: .4 });
fio.observe(flow); setStage(0);

// Hero 3D network
const scene = $('#scene');
let net = null;
try { const { initNetwork } = await import('./js/network-scene.js'); net = await initNetwork($('#net'), scene, { reduceMotion: reduce }); }
catch (err) { console.warn('3D network unavailable, using fallback.', err); }
if (!net) scene.classList.add('no-webgl');
addEventListener('pagehide', () => net && net.destroy());

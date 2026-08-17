import { db } from './firebase-config.js';
import {
  collection, query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const cpGrid = document.getElementById('cpGrid');
const cpEmpty = document.getElementById('cpEmpty');
const featuredWrap = document.getElementById('featuredWrap');
const featuredGrid = document.getElementById('featuredGrid');
const filtersWrap = document.getElementById('cpFilters');

let allProjects = [];
let activeFilter = 'All';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatDate(ts) {
  if (!ts || !ts.toDate) return '';
  return ts.toDate().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function projectCard(p) {
  const thumb = p.thumbnailUrl
    ? `style="background-image:url('${escapeHtml(p.thumbnailUrl)}')"`
    : '';
  const thumbLabel = p.thumbnailUrl ? '' : (p.title || 'PROJECT');
  const tech = (p.technologies || []).slice(0, 4)
    .map(t => `<span>${escapeHtml(t)}</span>`).join('');
  const year = p.completionYear || (p.completionDate && p.completionDate.toDate
    ? p.completionDate.toDate().getFullYear() : '');

  const footAction = p.projectUrl
    ? `<a class="view" href="${escapeHtml(p.projectUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">View Project →</a>`
    : `<span class="view">View Details →</span>`;

  const card = document.createElement('div');
  card.className = 'project-card';
  card.innerHTML = `
    <div class="project-thumb" ${thumb}>${thumbLabel}</div>
    <div class="project-body">
      <div class="project-cat">${escapeHtml(p.category)}</div>
      <h3>${escapeHtml(p.title)}</h3>
      <p class="project-desc">${escapeHtml(p.shortDescription)}</p>
      <div class="project-meta">${tech}</div>
      <div class="project-foot">
        <span>${p.clientName ? escapeHtml(p.clientName) + ' · ' : ''}${year}</span>
        ${footAction}
      </div>
    </div>
  `;
  card.addEventListener('click', () => {
    if (!p.projectUrl) openModal(p);
  });
  return card;
}

function render() {
  const filtered = activeFilter === 'All'
    ? allProjects
    : allProjects.filter(p => p.category === activeFilter);

  cpGrid.innerHTML = '';
  filtered.forEach(p => cpGrid.appendChild(projectCard(p)));

  cpEmpty.hidden = allProjects.length > 0;
  cpGrid.hidden = allProjects.length === 0;
  filtersWrap.hidden = allProjects.length === 0;

  const featured = allProjects.filter(p => p.featured === true);
  featuredWrap.hidden = featured.length === 0;
  featuredGrid.innerHTML = '';
  featured.forEach(p => featuredGrid.appendChild(projectCard(p)));
}

filtersWrap.addEventListener('click', (e) => {
  const btn = e.target.closest('.cp-filter-btn');
  if (!btn) return;
  filtersWrap.querySelectorAll('.cp-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  cpGrid.classList.add('filtering');
  setTimeout(() => {
    render();
    cpGrid.classList.remove('filtering');
  }, 150);
});

// ---- Modal ----
const overlay = document.getElementById('cpModalOverlay');
const modalClose = document.getElementById('cpModalClose');

function openModal(p) {
  document.getElementById('cpModalThumb').style.backgroundImage = p.thumbnailUrl ? `url('${p.thumbnailUrl}')` : 'none';
  document.getElementById('cpModalCat').textContent = p.category || '';
  document.getElementById('cpModalTitle').textContent = p.title || '';
  document.getElementById('cpModalDesc').textContent = p.description || p.shortDescription || '';

  const meta = document.getElementById('cpModalMeta');
  meta.innerHTML = '';
  if (p.clientName) meta.innerHTML += `<span><strong>Client:</strong> ${escapeHtml(p.clientName)}</span>`;
  const dateStr = formatDate(p.completionDate) || p.completionYear;
  if (dateStr) meta.innerHTML += `<span><strong>Completed:</strong> ${escapeHtml(String(dateStr))}</span>`;

  const tech = document.getElementById('cpModalTech');
  tech.innerHTML = (p.technologies || []).map(t => `<span>${escapeHtml(t)}</span>`).join('');

  const gallery = document.getElementById('cpModalGallery');
  gallery.innerHTML = (p.galleryImages || []).filter(Boolean)
    .map(url => `<img src="${escapeHtml(url)}" alt="">`).join('');

  const urlWrap = document.getElementById('cpModalUrlWrap');
  const urlLink = document.getElementById('cpModalUrl');
  if (p.projectUrl) {
    urlWrap.hidden = false;
    urlLink.href = p.projectUrl;
  } else {
    urlWrap.hidden = true;
  }

  overlay.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.classList.remove('modal-open');
}
modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ---- Firestore live query: published projects, newest first ----
const q = query(
  collection(db, 'projects'),
  where('published', '==', true),
  orderBy('completionDate', 'desc')
);

onSnapshot(q, (snap) => {
  allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
}, (err) => {
  console.error('Failed to load projects:', err);
  cpEmpty.hidden = false;
  cpGrid.hidden = true;
});

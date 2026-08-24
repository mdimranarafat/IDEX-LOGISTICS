import { auth, db, configIsPlaceholder } from './firebase-config.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection, doc, setDoc, updateDoc, deleteDoc, getDoc, onSnapshot,
  serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------------- Auth / role gate ----------------
const loginScreen = document.getElementById('loginScreen');
const adminShell = document.getElementById('adminShell');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');

function setLoginStatus(msg) { loginError.textContent = msg || ''; }

function describeAuthError(err) {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password.';
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error — check your internet connection and try again.';
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Firebase API key is missing or invalid — check firebase-config.js.';
    case 'auth/unauthorized-domain':
      return `This domain (${location.hostname}) is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.`;
    default:
      return (err?.message ? err.message : 'Sign-in failed.') + (code ? ` (${code})` : '');
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoginStatus('');

  // Fail fast if the project was never configured — Firebase will only
  // return a cryptic auth/invalid-api-key otherwise.
  if (configIsPlaceholder) {
    setLoginStatus('Firebase is not configured yet. Open firebase-config.js and paste your real project keys.');
    return;
  }

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  loginSubmitBtn.disabled = true;
  const originalLabel = loginSubmitBtn.textContent;
  loginSubmitBtn.textContent = 'Signing in…';
  try {
    await signInWithEmailAndPassword(auth, email, password);
    // On success onAuthStateChanged below takes over (role check + panel).
  } catch (err) {
    console.error('Sign-in failed:', err?.code, err?.message, err);
    setLoginStatus(describeAuthError(err));
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = originalLabel;
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

let unsubscribeProjects = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginScreen.style.display = 'flex';
    adminShell.classList.remove('active');
    if (unsubscribeProjects) { unsubscribeProjects(); unsubscribeProjects = null; }
    return;
  }

  // Signed in successfully — verify the admin role in Firestore before
  // revealing the panel. Show a visible state so this doesn't look "stuck".
  setLoginStatus('Verifying admin access…');
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const role = userDoc.exists() ? userDoc.data().role : null;
    if (role !== 'admin') {
      console.warn(
        `Signed in as ${user.email}, but users/${user.uid} does not exist or does not have role === "admin".`
      );
      setLoginStatus(
        `Signed in as ${user.email}, but this account has no admin role. In Firestore create collection ` +
        `"users" with document ID "${user.uid}" containing field role (string) = "admin", then log in again.`
      );
      await signOut(auth);
      return;
    }
  } catch (err) {
    console.error('Admin role verification failed:', err?.code, err?.message, err);
    setLoginStatus(
      'Could not verify admin access' + (err?.code ? ` (${err.code})` : '') +
      '. Make sure firestore.rules are published in the Firebase Console, then try again.'
    );
    await signOut(auth);
    return;
  }

  setLoginStatus('');
  loginScreen.style.display = 'none';
  adminShell.classList.add('active');
  subscribeProjects();
});

// ---------------- Sidebar nav ----------------
document.querySelectorAll('.side-link[data-page]').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.side-link[data-page]').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + link.dataset.page).classList.add('active');
  });
});

// ---------------- Toast ----------------
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { t.style.display = 'none'; }, 2600);
}

// ---------------- Data state ----------------
let allProjects = [];

function subscribeProjects() {
  unsubscribeProjects = onSnapshot(collection(db, 'projects'), (snap) => {
    allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateStats();
    updateYearFilterOptions();
    renderTable();
  }, (err) => console.error('projects listener error', err));
}

function updateStats() {
  document.getElementById('statTotal').textContent = allProjects.length;
  document.getElementById('statPublished').textContent = allProjects.filter(p => p.published).length;
  document.getElementById('statDraft').textContent = allProjects.filter(p => !p.published).length;
  document.getElementById('statFeatured').textContent = allProjects.filter(p => p.featured).length;
}

function updateYearFilterOptions() {
  const sel = document.getElementById('filterYear');
  const current = sel.value;
  const years = [...new Set(allProjects.map(p => p.completionYear).filter(Boolean))].sort((a, b) => b - a);
  sel.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  sel.value = current;
}

// ---------------- Table render (search / filter / sort) ----------------
const searchInput = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const filterStatus = document.getElementById('filterStatus');
const filterFeatured = document.getElementById('filterFeatured');
const filterYear = document.getElementById('filterYear');
const sortBy = document.getElementById('sortBy');
[searchInput, filterCategory, filterStatus, filterFeatured, filterYear, sortBy].forEach(el =>
  el.addEventListener('input', renderTable)
);

function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

function renderTable() {
  const term = searchInput.value.trim().toLowerCase();
  let list = allProjects.filter(p => {
    if (term) {
      const hay = `${p.title || ''} ${p.clientName || ''} ${p.category || ''}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    if (filterCategory.value && p.category !== filterCategory.value) return false;
    if (filterStatus.value === 'published' && !p.published) return false;
    if (filterStatus.value === 'draft' && p.published) return false;
    if (filterFeatured.value === 'yes' && !p.featured) return false;
    if (filterFeatured.value === 'no' && p.featured) return false;
    if (filterYear.value && String(p.completionYear) !== filterYear.value) return false;
    return true;
  });

  const getTime = p => p.completionDate && p.completionDate.toDate ? p.completionDate.toDate().getTime() : 0;
  if (sortBy.value === 'newest') list.sort((a, b) => getTime(b) - getTime(a));
  else if (sortBy.value === 'oldest') list.sort((a, b) => getTime(a) - getTime(b));
  else if (sortBy.value === 'az') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (sortBy.value === 'za') list.sort((a, b) => (b.title || '').localeCompare(a.title || ''));

  const tbody = document.getElementById('projectsTbody');
  tbody.innerHTML = '';
  document.getElementById('noProjectsMsg').style.display = list.length === 0 ? 'block' : 'none';

  list.forEach(p => {
    const created = p.createdAt && p.createdAt.toDate ? p.createdAt.toDate().toLocaleDateString() : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Thumb"><div class="row-thumb" style="${p.thumbnailUrl ? `background-image:url('${esc(p.thumbnailUrl)}')` : ''}"></div></td>
      <td data-label="Name">${esc(p.title)}</td>
      <td data-label="Category">${esc(p.category)}</td>
      <td data-label="Client">${esc(p.clientName) || '—'}</td>
      <td data-label="Year">${p.completionYear || '—'}</td>
      <td data-label="Published"><label class="toggle"><input type="checkbox" class="pub-toggle" data-id="${p.id}" ${p.published ? 'checked' : ''}><span class="track"><span class="thumb"></span></span></label></td>
      <td data-label="Featured"><label class="toggle"><input type="checkbox" class="feat-toggle" data-id="${p.id}" ${p.featured ? 'checked' : ''}><span class="track"><span class="thumb"></span></span></label></td>
      <td data-label="Created">${created}</td>
      <td data-label="Actions">
        <div class="row-actions">
          ${p.projectUrl ? `<a class="icon-btn" href="${esc(p.projectUrl)}" target="_blank" rel="noopener noreferrer">View</a>` : `<button class="icon-btn view-btn" data-id="${p.id}">View</button>`}
          <button class="icon-btn edit-btn" data-id="${p.id}">Edit</button>
          <button class="icon-btn danger delete-btn" data-id="${p.id}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('projectsTbody').addEventListener('change', async (e) => {
  if (e.target.classList.contains('pub-toggle') || e.target.classList.contains('feat-toggle')) {
    const id = e.target.dataset.id;
    const field = e.target.classList.contains('pub-toggle') ? 'published' : 'featured';
    try {
      await updateDoc(doc(db, 'projects', id), { [field]: e.target.checked, updatedAt: serverTimestamp() });
      showToast(field === 'published' ? (e.target.checked ? 'Project published' : 'Moved to draft') : (e.target.checked ? 'Marked as featured' : 'Removed from featured'));
    } catch (err) {
      showToast('Failed to update: ' + err.message);
      e.target.checked = !e.target.checked;
    }
  }
});

document.getElementById('projectsTbody').addEventListener('click', (e) => {
  const editBtn = e.target.closest('.edit-btn');
  const deleteBtn = e.target.closest('.delete-btn');
  const viewBtn = e.target.closest('.view-btn');
  if (editBtn) openForm(allProjects.find(p => p.id === editBtn.dataset.id));
  if (deleteBtn) openDeleteConfirm(deleteBtn.dataset.id);
  if (viewBtn) openPreview(allProjects.find(p => p.id === viewBtn.dataset.id));
});

// ---------------- Add/Edit form ----------------
const formOverlay = document.getElementById('formOverlay');
const projectForm = document.getElementById('projectForm');
const formTitle = document.getElementById('formTitle');
const formError = document.getElementById('formError');
let editingId = null;
let currentTags = [];
let currentThumbnailUrl = '';
let currentGalleryUrls = [];

document.getElementById('addProjectBtn').addEventListener('click', () => openForm(null));
document.getElementById('cancelFormBtn').addEventListener('click', closeForm);

function openForm(project) {
  formError.textContent = '';
  editingId = project ? project.id : doc(collection(db, 'projects')).id;
  formTitle.textContent = project ? 'Edit Project' : 'Add New Project';
  document.getElementById('f_title').value = project?.title || '';
  document.getElementById('f_shortDescription').value = project?.shortDescription || '';
  document.getElementById('f_description').value = project?.description || '';
  document.getElementById('f_category').value = project?.category || '';
  document.getElementById('f_clientName').value = project?.clientName || '';
  document.getElementById('f_projectUrl').value = project?.projectUrl || '';
  document.getElementById('f_featured').checked = !!project?.featured;
  document.getElementById('f_published').checked = !!project?.published;

  if (project?.completionDate?.toDate) {
    const d = project.completionDate.toDate();
    document.getElementById('f_completionDate').value = d.toISOString().slice(0, 10);
  } else {
    document.getElementById('f_completionDate').value = '';
  }

  currentTags = [...(project?.technologies || [])];
  renderTags();

  currentThumbnailUrl = project?.thumbnailUrl || '';
  renderThumbPreview();

  currentGalleryUrls = [...(project?.galleryImages || [])].filter(Boolean);
  renderGalleryPreview();

  document.getElementById('f_thumbnailFile').value = '';
  document.getElementById('f_galleryFiles').value = '';
  document.getElementById('thumbStatus').textContent = '';
  document.getElementById('galleryStatus').textContent = '';

  formOverlay.classList.add('open');
}

function closeForm() {
  formOverlay.classList.remove('open');
  editingId = null;
}

// tags
const tagInput = document.getElementById('tagInput');
tagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && tagInput.value.trim()) {
    e.preventDefault();
    currentTags.push(tagInput.value.trim());
    tagInput.value = '';
    renderTags();
  }
});
function renderTags() {
  document.querySelectorAll('.tag-chip').forEach(c => c.remove());
  currentTags.forEach((t, i) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${esc(t)} <button type="button" data-i="${i}">✕</button>`;
    chip.querySelector('button').addEventListener('click', () => { currentTags.splice(i, 1); renderTags(); });
    tagInput.parentElement.insertBefore(chip, tagInput);
  });
}

// image compression helper — outputs a Base64 Data URL string
// (stored directly in the Firestore document, no Firebase Storage)
function compressImage(file, maxWidth = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_MB = 5;

function renderThumbPreview() {
  const el = document.getElementById('thumbPreview');
  if (currentThumbnailUrl) {
    el.style.backgroundImage = `url('${currentThumbnailUrl}')`;
    el.textContent = '';
  } else {
    el.style.backgroundImage = 'none';
    el.textContent = 'No thumbnail';
  }
}

document.getElementById('f_thumbnailFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('thumbStatus');
  if (!ALLOWED_TYPES.includes(file.type)) { statusEl.textContent = 'Only JPG, PNG, or WebP allowed.'; return; }
  if (file.size > MAX_FILE_MB * 1024 * 1024) { statusEl.textContent = `File too large (max ${MAX_FILE_MB}MB).`; return; }
  statusEl.textContent = 'Processing…';
  try {
    currentThumbnailUrl = await compressImage(file);
    renderThumbPreview();
    statusEl.textContent = 'Thumbnail ready.';
  } catch (err) {
    statusEl.textContent = 'Failed to process image: ' + err.message;
  }
});

function renderGalleryPreview() {
  const wrap = document.getElementById('galleryPreview');
  wrap.innerHTML = '';
  currentGalleryUrls.forEach((url, i) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.style.backgroundImage = `url('${url}')`;
    item.innerHTML = `<button type="button" data-i="${i}">✕</button>`;
    item.querySelector('button').addEventListener('click', () => {
      currentGalleryUrls.splice(i, 1);
      renderGalleryPreview();
    });
    wrap.appendChild(item);
  });
}

document.getElementById('f_galleryFiles').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  const statusEl = document.getElementById('galleryStatus');
  statusEl.textContent = 'Processing…';
  let added = 0;
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) { statusEl.textContent = `Skipped ${file.name}: unsupported type.`; continue; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { statusEl.textContent = `Skipped ${file.name}: too large.`; continue; }
    try {
      const dataUrl = await compressImage(file);
      currentGalleryUrls.push(dataUrl);
      added++;
      renderGalleryPreview();
    } catch (err) {
      statusEl.textContent = 'Failed to process ' + file.name + ': ' + err.message;
    }
  }
  statusEl.textContent = added ? 'Gallery images added.' : '';
});

function collectFormData() {
  const dateVal = document.getElementById('f_completionDate').value;
  const completionYear = dateVal ? new Date(dateVal).getFullYear() : null;
  return {
    title: document.getElementById('f_title').value.trim(),
    shortDescription: document.getElementById('f_shortDescription').value.trim(),
    description: document.getElementById('f_description').value.trim(),
    category: document.getElementById('f_category').value,
    clientName: document.getElementById('f_clientName').value.trim(),
    projectUrl: document.getElementById('f_projectUrl').value.trim(),
    technologies: currentTags,
    thumbnailUrl: currentThumbnailUrl,
    galleryImages: currentGalleryUrls,
    featured: document.getElementById('f_featured').checked,
    published: document.getElementById('f_published').checked,
    completionDate: dateVal ? Timestamp.fromDate(new Date(dateVal)) : null,
    completionYear
  };
}

projectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';
  const data = collectFormData();
  if (!data.title || !data.shortDescription || !data.category) {
    formError.textContent = 'Project name, short description, and category are required.';
    return;
  }
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';
  try {
    const isNew = !allProjects.some(p => p.id === editingId);
    const ref_ = doc(db, 'projects', editingId);
    if (isNew) {
      await setDoc(ref_, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      showToast('Project created.');
    } else {
      await updateDoc(ref_, { ...data, updatedAt: serverTimestamp() });
      showToast('Project updated.');
    }
    closeForm();
  } catch (err) {
    formError.textContent = 'Save failed: ' + err.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Project';
  }
});

// ---------------- Delete ----------------
const deleteOverlay = document.getElementById('deleteOverlay');
let pendingDeleteId = null;
function openDeleteConfirm(id) { pendingDeleteId = id; deleteOverlay.classList.add('open'); }
document.getElementById('deleteCancelBtn').addEventListener('click', () => { deleteOverlay.classList.remove('open'); pendingDeleteId = null; });
document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  try {
    await deleteDoc(doc(db, 'projects', pendingDeleteId));
    showToast('Project deleted.');
  } catch (err) {
    showToast('Delete failed: ' + err.message);
  }
  deleteOverlay.classList.remove('open');
  pendingDeleteId = null;
});

// ---------------- Preview ----------------
const previewOverlay = document.getElementById('previewOverlay');
document.getElementById('previewBtn').addEventListener('click', () => openPreview(collectFormData()));
document.getElementById('previewCloseBtn').addEventListener('click', () => previewOverlay.classList.remove('open'));

function openPreview(p) {
  document.getElementById('pv_thumb').style.backgroundImage = p.thumbnailUrl ? `url('${p.thumbnailUrl}')` : 'none';
  document.getElementById('pv_thumb').textContent = p.thumbnailUrl ? '' : 'No thumbnail';
  document.getElementById('pv_title').textContent = p.title || '';
  const year = p.completionYear || (p.completionDate?.toDate ? p.completionDate.toDate().getFullYear() : '');
  document.getElementById('pv_meta').textContent = `${p.category || ''}${p.clientName ? ' · ' + p.clientName : ''}${year ? ' · ' + year : ''}`;
  document.getElementById('pv_desc').textContent = p.description || p.shortDescription || '';
  document.getElementById('pv_tech').innerHTML = (p.technologies || []).map(t => `<span class="tag-chip">${esc(t)}</span>`).join('');
  previewOverlay.classList.add('open');
}

// close overlays on backdrop click
[formOverlay, deleteOverlay, previewOverlay].forEach(ov => {
  ov.addEventListener('click', (e) => { if (e.target === ov && ov !== formOverlay) ov.classList.remove('open'); });
});

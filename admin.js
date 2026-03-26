/* ═══ ADMIN PANEL ═══ */
const STORAGE_KEY = 'royar_data';
const AUTH_KEY = 'royar_auth';
const PW_KEY = 'royar_pw';
const DEFAULT_PW = 'royar2026';
function getPassword() { return localStorage.getItem(PW_KEY) || DEFAULT_PW; }

let DATA = {};

/* ═══ DATA LAYER ═══ */
async function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    DATA = JSON.parse(stored);
    return;
  }
  const res = await fetch('data.json');
  DATA = await res.json();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
}

function confirmAction(msg) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = '<div class="confirm-box"><p>' + msg + '</p><div class="confirm-actions"><button class="confirm-yes">Ja, löschen</button><button class="confirm-no">Abbrechen</button></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.confirm-yes').addEventListener('click', () => { overlay.remove(); resolve(true); });
    overlay.querySelector('.confirm-no').addEventListener('click', () => { overlay.remove(); resolve(false); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

function showToast(msg) {
  const t = document.getElementById('adminToast');
  t.textContent = msg || 'Gespeichert!';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

/* ═══ AUTH ═══ */
function checkAuth() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  if (u === 'admin' && p === getPassword()) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    showAdmin();
  } else {
    document.getElementById('loginError').style.display = 'block';
  }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem(AUTH_KEY);
  document.getElementById('adminWrap').style.display = 'none';
  document.getElementById('loginWrap').style.display = 'flex';
});

async function showAdmin() {
  document.getElementById('loginWrap').style.display = 'none';
  document.getElementById('adminWrap').style.display = 'block';
  await loadData();
  renderGallery();
  renderServices();
  renderProducts();
  renderHours();
  renderContact();
}

if (checkAuth()) showAdmin();

/* ═══ TABS ═══ */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
  });
});

/* ═══ GALLERY ═══ */
const galGrid = document.getElementById('galGrid');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > 1200) { h = Math.round(h * 1200 / w); w = 1200; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const src = await compressImage(file);
    const id = Date.now() + Math.random();
    DATA.gallery.push({ id, src, alt: file.name.replace(/\.[^.]+$/, '') });
  }
  saveData();
  renderGallery();
  fileInput.value = '';
}

function renderGallery() {
  galGrid.innerHTML = '';
  DATA.gallery.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'gal-admin-item';
    div.draggable = true;
    div.dataset.idx = idx;
    div.innerHTML = '<img src="' + item.src + '" alt="' + (item.alt || '') + '"><button class="del-btn" title="Löschen">&times;</button>';
    div.querySelector('.del-btn').addEventListener('click', async () => {
      if (!await confirmAction('Dieses Foto wirklich löschen?')) return;
      DATA.gallery.splice(idx, 1);
      saveData();
      renderGallery();
      showToast('Foto gelöscht!');
    });
    // drag & drop reorder
    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', idx);
      div.classList.add('dragging');
    });
    div.addEventListener('dragend', () => div.classList.remove('dragging'));
    div.addEventListener('dragover', e => e.preventDefault());
    div.addEventListener('drop', e => {
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData('text/plain'));
      const to = idx;
      if (from === to) return;
      const item = DATA.gallery.splice(from, 1)[0];
      DATA.gallery.splice(to, 0, item);
      saveData();
      renderGallery();
    });
    galGrid.appendChild(div);
  });
}

document.getElementById('saveGallery').addEventListener('click', () => {
  saveData();
  showToast('Galerie gespeichert!');
});

/* ═══ SERVICES ═══ */
function renderServices() {
  const tbody = document.querySelector('#servicesTable tbody');
  tbody.innerHTML = '';
  DATA.services.forEach((svc, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td><input type="text" value="' + svc.name + '" data-field="name"></td>' +
      '<td><input type="number" class="price-input" value="' + svc.price + '" min="0" data-field="price"></td>' +
      '<td style="text-align:center"><input type="checkbox" class="popular-check"' + (svc.popular ? ' checked' : '') + '></td>' +
      '<td><button class="del-row" title="Löschen">&times;</button></td>';
    tr.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('change', () => {
        const field = input.dataset.field;
        DATA.services[idx][field] = field === 'price' ? parseFloat(input.value) : input.value;
      });
    });
    tr.querySelector('.popular-check').addEventListener('change', e => {
      DATA.services.forEach(s => s.popular = false);
      if (e.target.checked) DATA.services[idx].popular = true;
      renderServices();
    });
    tr.querySelector('.del-row').addEventListener('click', async () => {
      if (!await confirmAction('Diese Dienstleistung wirklich löschen?')) return;
      DATA.services.splice(idx, 1);
      renderServices();
    });
    tbody.appendChild(tr);
  });
}

document.getElementById('addService').addEventListener('click', () => {
  DATA.services.push({ id: Date.now(), name: '', price: 0 });
  renderServices();
});

/* ═══ PRODUCTS ═══ */
function renderProducts() {
  const tbody = document.querySelector('#productsTable tbody');
  tbody.innerHTML = '';
  DATA.products.forEach((prod, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td><input type="text" value="' + prod.name + '" data-field="name"></td>' +
      '<td><input type="number" class="price-input" value="' + prod.price + '" min="0" data-field="price"></td>' +
      '<td><button class="del-row" title="Löschen">&times;</button></td>';
    tr.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('change', () => {
        const field = input.dataset.field;
        DATA.products[idx][field] = field === 'price' ? parseFloat(input.value) : input.value;
      });
    });
    tr.querySelector('.del-row').addEventListener('click', async () => {
      if (!await confirmAction('Dieses Produkt wirklich löschen?')) return;
      DATA.products.splice(idx, 1);
      renderProducts();
    });
    tbody.appendChild(tr);
  });
}

document.getElementById('addProduct').addEventListener('click', () => {
  DATA.products.push({ id: Date.now(), name: '', price: 0 });
  renderProducts();
});

document.getElementById('savePrices').addEventListener('click', () => {
  saveData();
  showToast('Preisliste gespeichert!');
});

/* ═══ HOURS ═══ */
function renderHours() {
  const h = DATA.hours;
  document.getElementById('mfOpen').value = h.monday_friday.open;
  document.getElementById('mfClose').value = h.monday_friday.close;
  document.getElementById('satOpen').value = h.saturday.open;
  document.getElementById('satClose').value = h.saturday.close;
  const isClosed = h.sunday.closed !== false;
  const toggle = document.getElementById('sunToggle');
  toggle.classList.toggle('on', isClosed);
  document.getElementById('sunLabel').textContent = isClosed ? 'Geschlossen' : 'Geöffnet';
  document.getElementById('sunTimes').style.display = isClosed ? 'none' : 'block';
  if (!isClosed) {
    document.getElementById('sunOpen').value = h.sunday.open || '';
    document.getElementById('sunClose').value = h.sunday.close || '';
  }
}

document.getElementById('sunToggle').addEventListener('click', () => {
  const toggle = document.getElementById('sunToggle');
  const isClosed = toggle.classList.toggle('on');
  document.getElementById('sunLabel').textContent = isClosed ? 'Geschlossen' : 'Geöffnet';
  document.getElementById('sunTimes').style.display = isClosed ? 'none' : 'block';
});

document.getElementById('saveHours').addEventListener('click', () => {
  const isClosed = document.getElementById('sunToggle').classList.contains('on');
  DATA.hours = {
    monday_friday: { open: document.getElementById('mfOpen').value, close: document.getElementById('mfClose').value },
    saturday: { open: document.getElementById('satOpen').value, close: document.getElementById('satClose').value },
    sunday: isClosed
      ? { open: '', close: '', closed: true }
      : { open: document.getElementById('sunOpen').value, close: document.getElementById('sunClose').value, closed: false }
  };
  saveData();
  showToast('Öffnungszeiten gespeichert!');
});

/* ═══ CONTACT ═══ */
function renderContact() {
  const c = DATA.contact;
  document.getElementById('cPhone').value = c.phone_display || '';
  document.getElementById('cPhoneTel').value = c.phone || '';
  document.getElementById('cEmail').value = c.email || '';
  document.getElementById('cAddress').value = c.address || '';
  document.getElementById('cMaps').value = c.maps_url || '';
}

document.getElementById('saveContact').addEventListener('click', () => {
  DATA.contact = {
    phone: document.getElementById('cPhoneTel').value,
    phone_display: document.getElementById('cPhone').value,
    email: document.getElementById('cEmail').value,
    address: document.getElementById('cAddress').value,
    maps_url: document.getElementById('cMaps').value
  };
  saveData();
  showToast('Kontaktdaten gespeichert!');
});

/* ═══ PASSWORD CHANGE ═══ */
document.getElementById('savePassword').addEventListener('click', () => {
  const errEl = document.getElementById('pwError');
  const sucEl = document.getElementById('pwSuccess');
  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  const current = document.getElementById('pwCurrent').value;
  const newPw = document.getElementById('pwNew').value;
  const confirm = document.getElementById('pwConfirm').value;

  if (current !== getPassword()) {
    errEl.textContent = 'Aktuelles Passwort ist falsch.';
    errEl.style.display = 'block';
    return;
  }
  if (newPw.length < 6) {
    errEl.textContent = 'Neues Passwort muss mindestens 6 Zeichen haben.';
    errEl.style.display = 'block';
    return;
  }
  if (newPw !== confirm) {
    errEl.textContent = 'Passwörter stimmen nicht überein.';
    errEl.style.display = 'block';
    return;
  }

  localStorage.setItem(PW_KEY, newPw);
  document.getElementById('pwCurrent').value = '';
  document.getElementById('pwNew').value = '';
  document.getElementById('pwConfirm').value = '';
  sucEl.textContent = 'Passwort erfolgreich geändert!';
  sucEl.style.display = 'block';
  showToast('Passwort geändert!');
});

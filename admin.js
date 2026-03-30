/* ═══ ADMIN PANEL ═══ */
const API = 'api';
let DATA = {};
let CSRF_TOKEN = '';

/* ═══ API HELPER ═══ */
async function api(endpoint, options = {}) {
  const opts = { ...options };
  if (!opts.headers) opts.headers = {};
  if (CSRF_TOKEN) opts.headers['X-CSRF-Token'] = CSRF_TOKEN;
  opts.credentials = 'same-origin';
  const res = await fetch(API + '/' + endpoint, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Fehler');
  return json;
}

/* ═══ DATA LAYER ═══ */
async function loadData() {
  const res = await fetch('data.json?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('data.json fetch failed: ' + res.status);
  DATA = await res.json();
}

async function saveData() {
  const res = await api('save-data.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DATA)
  });
  return res;
}

function confirmAction(msg) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    const box = document.createElement('div');
    box.className = 'confirm-box';
    const p = document.createElement('p');
    p.textContent = msg;
    const actions = document.createElement('div');
    actions.className = 'confirm-actions';
    const yesBtn = document.createElement('button');
    yesBtn.className = 'confirm-yes';
    yesBtn.textContent = 'Ja, löschen';
    const noBtn = document.createElement('button');
    noBtn.className = 'confirm-no';
    noBtn.textContent = 'Abbrechen';
    actions.appendChild(yesBtn);
    actions.appendChild(noBtn);
    box.appendChild(p);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    yesBtn.addEventListener('click', () => { overlay.remove(); resolve(true); });
    noBtn.addEventListener('click', () => { overlay.remove(); resolve(false); });
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
document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  try {
    const res = await api('login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    CSRF_TOKEN = res.data.csrf_token;
    sessionStorage.setItem('csrf_token', CSRF_TOKEN);
    showAdmin();
  } catch {
    document.getElementById('loginError').style.display = 'block';
  }
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await api('logout.php', { method: 'POST' }); } catch {}
  CSRF_TOKEN = '';
  sessionStorage.removeItem('csrf_token');
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

// Restore session if csrf_token exists
(function initSession() {
  const token = sessionStorage.getItem('csrf_token');
  if (token) {
    CSRF_TOKEN = token;
    showAdmin();
  }
})();

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

async function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await api('upload-image.php', { method: 'POST', body: formData });
      DATA.gallery.push({ id: res.filename, src: 'uploads/' + res.filename, alt: file.name.replace(/\.[^.]+$/, '') });
    } catch (err) {
      showToast('Upload fehlgeschlagen: ' + err.message);
    }
  }
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
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.alt || '';
    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.title = 'Löschen';
    delBtn.textContent = '\u00D7';
    div.appendChild(img);
    div.appendChild(delBtn);
    delBtn.addEventListener('click', async () => {
      if (!await confirmAction('Dieses Foto wirklich löschen?')) return;
      try {
        await api('delete-image.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id })
        });
        DATA.gallery.splice(idx, 1);
        renderGallery();
        showToast('Foto gelöscht!');
      } catch (err) {
        showToast('Fehler: ' + err.message);
      }
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
      const moved = DATA.gallery.splice(from, 1)[0];
      DATA.gallery.splice(to, 0, moved);
      renderGallery();
    });
    galGrid.appendChild(div);
  });
}

document.getElementById('saveGallery').addEventListener('click', async () => {
  try {
    await saveData();
    showToast('Galerie gespeichert!');
  } catch (err) {
    showToast('Fehler: ' + err.message);
  }
});

/* ═══ SERVICES ═══ */
function renderServices() {
  const tbody = document.querySelector('#servicesTable tbody');
  tbody.innerHTML = '';
  DATA.services.forEach((svc, idx) => {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.value = svc.name; nameInput.dataset.field = 'name'; nameInput.maxLength = 200;
    td1.appendChild(nameInput);
    const td2 = document.createElement('td');
    const priceInput = document.createElement('input');
    priceInput.type = 'number'; priceInput.className = 'price-input'; priceInput.value = svc.price; priceInput.min = '0'; priceInput.max = '99999'; priceInput.dataset.field = 'price';
    td2.appendChild(priceInput);
    const td3 = document.createElement('td');
    td3.style.textAlign = 'center';
    const popCheck = document.createElement('input');
    popCheck.type = 'checkbox'; popCheck.className = 'popular-check'; popCheck.checked = !!svc.popular;
    td3.appendChild(popCheck);
    const td4 = document.createElement('td');
    const delRowBtn = document.createElement('button');
    delRowBtn.className = 'del-row'; delRowBtn.title = 'Löschen'; delRowBtn.textContent = '\u00D7';
    td4.appendChild(delRowBtn);
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
    [nameInput, priceInput].forEach(input => {
      input.addEventListener('change', () => {
        const field = input.dataset.field;
        DATA.services[idx][field] = field === 'price' ? parseFloat(input.value) : input.value;
      });
    });
    popCheck.addEventListener('change', e => {
      DATA.services.forEach(s => s.popular = false);
      if (e.target.checked) DATA.services[idx].popular = true;
      renderServices();
    });
    delRowBtn.addEventListener('click', async () => {
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
    const td1 = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.value = prod.name; nameInput.dataset.field = 'name'; nameInput.maxLength = 200;
    td1.appendChild(nameInput);
    const td2 = document.createElement('td');
    const priceInput = document.createElement('input');
    priceInput.type = 'number'; priceInput.className = 'price-input'; priceInput.value = prod.price; priceInput.min = '0'; priceInput.max = '99999'; priceInput.dataset.field = 'price';
    td2.appendChild(priceInput);
    const td3 = document.createElement('td');
    const delRowBtn = document.createElement('button');
    delRowBtn.className = 'del-row'; delRowBtn.title = 'Löschen'; delRowBtn.textContent = '\u00D7';
    td3.appendChild(delRowBtn);
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
    [nameInput, priceInput].forEach(input => {
      input.addEventListener('change', () => {
        const field = input.dataset.field;
        DATA.products[idx][field] = field === 'price' ? parseFloat(input.value) : input.value;
      });
    });
    delRowBtn.addEventListener('click', async () => {
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

document.getElementById('savePrices').addEventListener('click', async () => {
  try {
    await saveData();
    showToast('Preisliste gespeichert!');
  } catch (err) {
    showToast('Fehler: ' + err.message);
  }
});

/* ═══ HOURS ═══ */
function renderHours() {
  const h = DATA.hours;
  document.getElementById('mtOpen').value = h.monday_thursday.open;
  document.getElementById('mtClose').value = h.monday_thursday.close;
  document.getElementById('friOpen').value = h.friday.open;
  document.getElementById('friClose').value = h.friday.close;
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

document.getElementById('saveHours').addEventListener('click', async () => {
  const isClosed = document.getElementById('sunToggle').classList.contains('on');
  DATA.hours = {
    monday_thursday: { open: document.getElementById('mtOpen').value, close: document.getElementById('mtClose').value },
    friday: { open: document.getElementById('friOpen').value, close: document.getElementById('friClose').value },
    saturday: { open: document.getElementById('satOpen').value, close: document.getElementById('satClose').value },
    sunday: isClosed
      ? { closed: true }
      : { open: document.getElementById('sunOpen').value, close: document.getElementById('sunClose').value, closed: false }
  };
  try {
    await saveData();
    showToast('Öffnungszeiten gespeichert!');
  } catch (err) {
    showToast('Fehler: ' + err.message);
  }
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

document.getElementById('saveContact').addEventListener('click', async () => {
  DATA.contact = {
    phone: document.getElementById('cPhoneTel').value,
    phone_display: document.getElementById('cPhone').value,
    email: document.getElementById('cEmail').value,
    address: document.getElementById('cAddress').value,
    maps_url: document.getElementById('cMaps').value
  };
  try {
    await saveData();
    showToast('Kontaktdaten gespeichert!');
  } catch (err) {
    showToast('Fehler: ' + err.message);
  }
});

/* ═══ PASSWORD CHANGE ═══ */
document.getElementById('savePassword').addEventListener('click', async () => {
  const errEl = document.getElementById('pwError');
  const sucEl = document.getElementById('pwSuccess');
  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  const current = document.getElementById('pwCurrent').value;
  const newPw = document.getElementById('pwNew').value;
  const confirm = document.getElementById('pwConfirm').value;

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

  try {
    const pwRes = await api('change-password.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_password: current, new_password: newPw })
    });
    // Yeni CSRF token varsa güncelle
    if (pwRes.data && pwRes.data.csrf_token) {
      CSRF_TOKEN = pwRes.data.csrf_token;
      sessionStorage.setItem('csrf_token', CSRF_TOKEN);
    }
    document.getElementById('pwCurrent').value = '';
    document.getElementById('pwNew').value = '';
    document.getElementById('pwConfirm').value = '';
    sucEl.textContent = 'Passwort erfolgreich geändert!';
    sucEl.style.display = 'block';
    showToast('Passwort geändert!');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

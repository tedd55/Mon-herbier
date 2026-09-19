(function () {
  const grid = document.getElementById('grid');
  const searchInput = document.getElementById('search');
  const groupSelect = document.getElementById('group-filter');
  const photoOnly = document.getElementById('photo-only');
  const countEl = document.getElementById('result-count');
  const totalEl = document.getElementById('total-count');
  const overlay = document.getElementById('overlay');
  const sheet = document.getElementById('sheet');

  totalEl.textContent = SPECIES.length;

  const groups = Array.from(new Set(SPECIES.map(s => s.path[0] || 'Autre'))).sort();
  for (const g of groups) {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    groupSelect.appendChild(opt);
  }

  function norm(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function matches(sp, q) {
    if (!q) return true;
    const hay = norm([sp.latin_name, sp.common_name_fr, sp.title, ...sp.path].join(' '));
    return hay.includes(q);
  }

  function render() {
    const q = norm(searchInput.value.trim());
    const g = groupSelect.value;
    const needPhoto = photoOnly.checked;

    const results = SPECIES.filter(sp => {
      if (g && (sp.path[0] || 'Autre') !== g) return false;
      if (needPhoto && (!sp.images || sp.images.length === 0)) return false;
      return matches(sp, q);
    });

    countEl.textContent = results.length;
    grid.innerHTML = '';

    if (results.length === 0) {
      grid.innerHTML = '<div class="empty-state">Aucune planche ne correspond à cette recherche.</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    for (const sp of results) {
      const card = document.createElement('div');
      card.className = 'card';
      card.tabIndex = 0;

      const thumb = document.createElement('div');
      if (sp.images && sp.images.length) {
        thumb.className = 'thumb';
        thumb.style.backgroundImage = `url('images/${sp.images[0]}')`;
      } else {
        thumb.className = 'thumb noimg';
        thumb.textContent = 'Pas de planche photographique';
      }
      const stamp = document.createElement('div');
      stamp.className = 'code-stamp';
      stamp.textContent = sp.code;
      thumb.appendChild(stamp);

      const info = document.createElement('div');
      info.className = 'info';
      info.innerHTML = `
        <div class="latin">${sp.latin_name}</div>
        ${sp.common_name_fr ? `<div class="common">${sp.common_name_fr}</div>` : ''}
        <div class="family">${sp.path[sp.path.length - 1] || ''}</div>
      `;

      card.appendChild(thumb);
      card.appendChild(info);
      card.addEventListener('click', () => openSheet(sp));
      card.addEventListener('keypress', (e) => { if (e.key === 'Enter') openSheet(sp); });

      frag.appendChild(card);
    }
    grid.appendChild(frag);
  }

  function openSheet(sp) {
    const breadcrumb = sp.path.map(p => `<span>${p}</span>`).join('');
    const photos = (sp.images && sp.images.length)
      ? `<div class="photos">${sp.images.map(f => `<img src="images/${f}" loading="lazy" alt="${sp.latin_name}">`).join('')}</div>`
      : `<div class="no-photos">Aucune planche photographique disponible pour cette entrée.</div>`;

    sheet.innerHTML = `
      <button class="close" aria-label="Fermer">&times;</button>
      <div class="head">
        <div class="breadcrumb">${breadcrumb}</div>
        <h2>${sp.latin_name}</h2>
        ${sp.common_name_fr ? `<div class="common-name">${sp.common_name_fr}</div>` : ''}
        <div class="meta">Réf. ${sp.code} — PDF p.${sp.pdf_page}</div>
      </div>
      ${photos}
    `;
    sheet.querySelector('.close').addEventListener('click', closeSheet);
    overlay.classList.remove('hidden');
  }

  function closeSheet() {
    overlay.classList.add('hidden');
    sheet.innerHTML = '';
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  searchInput.addEventListener('input', render);
  groupSelect.addEventListener('change', render);
  photoOnly.addEventListener('change', render);

  render();
})();

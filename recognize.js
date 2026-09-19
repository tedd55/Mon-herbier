(function () {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const resultArea = document.getElementById('result-area');
  const overlay = document.getElementById('overlay');
  const sheet = document.getElementById('sheet');

  // filename -> species (built from SPECIES data)
  const fileToSpecies = {};
  for (const sp of SPECIES) {
    for (const f of (sp.images || [])) fileToSpecies[f] = sp;
  }

  // Max possible distance for normalization: 192 dims, each up to 255 diff -> sqrt(192*255^2)
  const MAX_DIST = Math.sqrt(192 * 255 * 255);

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      resultArea.innerHTML = `<div class="empty-state">Ce fichier n'est pas une image.</div>`;
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const vec = extractFeatures(img);
      const matches = findMatches(vec);
      renderResults(url, matches);
    };
    img.onerror = () => {
      resultArea.innerHTML = `<div class="empty-state">Impossible de lire cette image.</div>`;
    };
    img.src = url;
  }

  function extractFeatures(img) {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 8, 8);
    const data = ctx.getImageData(0, 0, 8, 8).data; // RGBA, 8x8
    const vec = new Array(192);
    let vi = 0;
    for (let i = 0; i < data.length; i += 4) {
      vec[vi++] = data[i];
      vec[vi++] = data[i + 1];
      vec[vi++] = data[i + 2];
    }
    return vec;
  }

  function dist(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      s += d * d;
    }
    return Math.sqrt(s);
  }

  function findMatches(vec) {
    const scored = [];
    for (const fname in FEATURES) {
      const sp = fileToSpecies[fname];
      if (!sp) continue;
      const d = dist(vec, FEATURES[fname]);
      scored.push({ fname, sp, dist: d });
    }
    scored.sort((a, b) => a.dist - b.dist);

    // dedupe by species, keep best (lowest dist) match per species
    const seen = new Set();
    const top = [];
    for (const s of scored) {
      if (seen.has(s.sp.code)) continue;
      seen.add(s.sp.code);
      top.push(s);
      if (top.length === 8) break;
    }
    return top;
  }

  function renderResults(inputUrl, matches) {
    const rows = matches.map((m, i) => {
      const similarity = Math.max(0, Math.round((1 - m.dist / MAX_DIST) * 100));
      return `
        <div class="match-row ${i === 0 ? 'rank-1' : ''}" data-code="${m.sp.code}">
          <div class="match-rank">${i + 1}</div>
          <img class="match-thumb" src="images/${m.fname}" alt="">
          <div class="match-info">
            <div class="match-latin">${m.sp.latin_name}</div>
            <div class="match-common">${m.sp.common_name_fr || m.sp.path[m.sp.path.length - 1] || ''}</div>
          </div>
          <div class="match-score">
            ${similarity}% proche
            <div class="match-bar"><div class="match-bar-fill" style="width:${similarity}%"></div></div>
          </div>
        </div>
      `;
    }).join('');

    resultArea.innerHTML = `
      <div class="recog-input-preview">
        <img src="${inputUrl}" alt="Photo importée">
        <div class="recog-input-meta">
          Ta photo, comparée aux 533 planches du corpus.<br>
          <button class="btn" id="retry-btn">Essayer une autre photo</button>
        </div>
      </div>
      <div class="match-list">${rows}</div>
    `;
    document.getElementById('retry-btn').addEventListener('click', () => {
      fileInput.value = '';
      resultArea.innerHTML = '';
    });
    resultArea.querySelectorAll('.match-row').forEach(row => {
      row.addEventListener('click', () => {
        const sp = SPECIES.find(s => s.code === row.dataset.code);
        if (sp) openSheet(sp);
      });
    });
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
})();

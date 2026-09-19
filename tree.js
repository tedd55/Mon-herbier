(function () {
  const treeRoot = document.getElementById('tree-root');
  const searchInput = document.getElementById('tree-search');
  const nodeCount = document.getElementById('node-count');
  const expandAllBtn = document.getElementById('expand-all');
  const collapseAllBtn = document.getElementById('collapse-all');
  const overlay = document.getElementById('overlay');
  const sheet = document.getElementById('sheet');

  const speciesByCode = {};
  for (const sp of SPECIES) speciesByCode[sp.code] = sp;

  function norm(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  let totalNodes = 0;

  function buildNode(node, depth) {
    totalNodes++;
    const li = document.createElement('li');
    li.className = 'tnode';
    if (depth >= 2) li.classList.add('collapsed');

    const hasChildren = node.children && node.children.length > 0;
    const isLeaf = node.is_leaf === true;
    const sp = isLeaf ? speciesByCode[node.code] : null;

    const row = document.createElement('div');
    row.className = 'tnode-row' + (isLeaf ? ' is-leaf' : '');
    row.dataset.title = norm(node.title);
    if (sp) {
      row.dataset.extra = norm([sp.latin_name, sp.common_name_fr].filter(Boolean).join(' '));
    }

    const toggle = document.createElement('span');
    if (hasChildren) {
      toggle.className = 'tnode-toggle';
      toggle.textContent = depth >= 2 ? '▸' : '▾';
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        li.classList.toggle('collapsed');
        toggle.textContent = li.classList.contains('collapsed') ? '▸' : '▾';
      });
    } else {
      toggle.className = 'tnode-toggle leaf-spacer';
      toggle.textContent = '·';
    }

    const dot = document.createElement('span');
    dot.className = 'tnode-dot';

    const label = document.createElement('span');
    label.className = 'tnode-label';
    label.textContent = node.title;

    row.appendChild(toggle);
    row.appendChild(dot);
    row.appendChild(label);

    if (node.code) {
      const codeEl = document.createElement('span');
      codeEl.className = 'tnode-code';
      codeEl.textContent = node.code;
      row.appendChild(codeEl);
    }

    if (isLeaf && sp) {
      row.addEventListener('click', () => openSheet(sp));
    } else if (hasChildren) {
      row.addEventListener('click', () => {
        li.classList.toggle('collapsed');
        toggle.textContent = li.classList.contains('collapsed') ? '▸' : '▾';
      });
    }

    li.appendChild(row);

    if (hasChildren) {
      const ul = document.createElement('ul');
      ul.className = 'tnode-children';
      for (const child of node.children) {
        ul.appendChild(buildNode(child, depth + 1));
      }
      li.appendChild(ul);
    }

    return li;
  }

  function render() {
    treeRoot.innerHTML = '';
    totalNodes = 0;
    const ul = document.createElement('ul');
    ul.className = 'tnode-children';
    for (const child of TREE.children) {
      ul.appendChild(buildNode(child, 0));
    }
    treeRoot.appendChild(ul);
    nodeCount.textContent = totalNodes;
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

  function applySearch() {
    const q = norm(searchInput.value.trim());
    const rows = treeRoot.querySelectorAll('.tnode-row');
    if (!q) {
      rows.forEach(r => { r.classList.remove('hidden-node', 'matched'); });
      treeRoot.querySelectorAll('.tnode').forEach(li => {
        // restore default collapse state based on depth: simplest = leave as-is
      });
      return;
    }
    // mark matches, show only matching rows + their ancestors, expand ancestors
    rows.forEach(r => { r.classList.remove('hidden-node', 'matched'); r.closest('li').classList.add('collapsed'); });
    let anyMatch = false;
    rows.forEach(row => {
      const hay = row.dataset.title + ' ' + (row.dataset.extra || '');
      if (hay.includes(q)) {
        anyMatch = true;
        row.classList.add('matched');
        row.classList.remove('hidden-node');
        // walk up ancestors: expand and unhide
        let li = row.closest('li');
        while (li) {
          li.classList.remove('collapsed');
          const parentRow = li.parentElement.closest('li');
          const rowEl = li.querySelector(':scope > .tnode-row');
          if (rowEl) rowEl.classList.remove('hidden-node');
          const toggleEl = li.querySelector(':scope > .tnode-row > .tnode-toggle');
          if (toggleEl && !toggleEl.classList.contains('leaf-spacer')) toggleEl.textContent = '▾';
          li = parentRow;
        }
      }
    });
    if (!anyMatch) {
      rows.forEach(r => r.classList.add('hidden-node'));
    } else {
      // hide rows that are neither matched nor ancestor-of-match (those already unhidden above)
      rows.forEach(row => {
        if (!row.classList.contains('matched')) {
          // was it unhidden as ancestor? ancestors are non-leaf rows whose li contains a matched descendant
          const li = row.closest('li');
          const hasMatchedDescendant = li.querySelector('.tnode-row.matched');
          if (!hasMatchedDescendant) row.classList.add('hidden-node');
        }
      });
    }
  }

  searchInput.addEventListener('input', applySearch);
  expandAllBtn.addEventListener('click', () => {
    treeRoot.querySelectorAll('.tnode.collapsed').forEach(li => li.classList.remove('collapsed'));
    treeRoot.querySelectorAll('.tnode-toggle').forEach(t => { if (!t.classList.contains('leaf-spacer')) t.textContent = '▾'; });
  });
  collapseAllBtn.addEventListener('click', () => {
    treeRoot.querySelectorAll('.tnode').forEach(li => {
      if (li.querySelector(':scope > ul.tnode-children')) li.classList.add('collapsed');
    });
    treeRoot.querySelectorAll('.tnode-toggle').forEach(t => { if (!t.classList.contains('leaf-spacer')) t.textContent = '▸'; });
    searchInput.value = '';
  });

  render();
})();

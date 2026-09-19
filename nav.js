(function () {
  const TOOLS = [
    { href: 'index.html', label: 'Recherche' },
    { href: 'quiz.html', label: 'Quiz' },
    { href: 'arbre.html', label: 'Arbre' },
    { href: 'reconnaissance.html', label: 'Reconnaissance' },
  ];
  const here = (document.body.getAttribute('data-page') || '');
  const nav = document.createElement('nav');
  nav.className = 'herbier-nav';
  const brand = document.createElement('a');
  brand.className = 'brand';
  brand.href = 'index.html';
  brand.textContent = '🌿 Herbier APG';
  const links = document.createElement('div');
  links.className = 'links';
  for (const t of TOOLS) {
    const a = document.createElement('a');
    a.className = 'tool' + (t.href.startsWith(here) ? ' active' : '');
    a.href = t.href;
    a.textContent = t.label;
    links.appendChild(a);
  }
  nav.appendChild(brand);
  nav.appendChild(links);
  document.body.insertBefore(nav, document.body.firstChild);
})();

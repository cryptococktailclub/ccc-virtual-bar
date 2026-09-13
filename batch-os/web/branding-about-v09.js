(() => {
  const about = document.getElementById('aboutView');
  if (!about) return;

  const originalSetView = window.setView;
  window.setView = function(name) {
    about.hidden = name !== 'about';
    if (name === 'about') {
      const recipes = document.getElementById('recipesView');
      const create = document.getElementById('createView');
      if (recipes) recipes.hidden = true;
      if (create) create.hidden = true;
      document.querySelectorAll('.nav-link[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === 'about'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (typeof originalSetView === 'function') originalSetView(name);
  };

  const aboutButton = document.querySelector('.nav-link[data-view="about"]');
  if (aboutButton) aboutButton.onclick = () => window.setView('about');

  // Keep the primary workflow nav centered; About belongs beside account controls.
  const header = document.querySelector('.header');
  const accountButton = document.getElementById('accountButton');
  if (header && aboutButton && accountButton) {
    let actions = header.querySelector('.header-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'header-actions';
      actions.style.justifySelf = 'end';
      actions.style.display = 'flex';
      actions.style.alignItems = 'center';
      actions.style.gap = '4px';
      header.appendChild(actions);
    }
    actions.appendChild(aboutButton);
    actions.appendChild(accountButton);
    accountButton.style.justifySelf = 'auto';
  }

  // Force browsers to pick up the transparent-edge official mark instead of a cached v9 favicon.
  document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(link => {
    link.href = 'assets/batch-icon.png?v=10';
  });
  const brandIcon = document.querySelector('.brand-icon');
  if (brandIcon) brandIcon.src = 'assets/batch-icon.png?v=10';

  document.getElementById('aboutGetStarted')?.addEventListener('click', () => window.setView('recipes'));
  document.getElementById('aboutCreateRecipe')?.addEventListener('click', () => {
    if (typeof state !== 'undefined') state.editingId = null;
    window.setView('create');
  });
  document.getElementById('aboutBottomCta')?.addEventListener('click', () => window.setView('recipes'));

  const brand = document.querySelector('.brand');
  if (brand) brand.onclick = event => {
    event.preventDefault();
    window.setView('recipes');
  };
})();

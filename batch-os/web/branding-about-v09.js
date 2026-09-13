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

  document.querySelectorAll('.nav-link[data-view]').forEach(button => {
    if (button.dataset.view === 'about') button.onclick = () => window.setView('about');
  });

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

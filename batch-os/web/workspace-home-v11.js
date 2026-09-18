(() => {
  const browse = document.getElementById('heroBrowseRecipes');
  const create = document.getElementById('heroCreateRecipe');
  const search = document.getElementById('search');

  browse?.addEventListener('click', () => {
    search?.focus();
    document.querySelector('.browser')?.scrollTo({ top: 0, behavior: 'smooth' });
  });

  create?.addEventListener('click', () => {
    if (typeof state !== 'undefined') state.editingId = null;
    if (typeof setView === 'function') setView('create');
  });

  const brand = document.querySelector('.brand');
  if (brand) {
    brand.addEventListener('click', event => {
      event.preventDefault();
      if (typeof setView === 'function') setView('recipes');
    });
  }
})();

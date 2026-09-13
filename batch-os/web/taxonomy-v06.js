(() => {
  function styleOptions() {
    return [...new Set(state.recipes
      .filter(recipe => String(recipe.category || '').trim().toLowerCase() === 'style')
      .map(recipe => String(recipe.name || '').trim())
      .filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function baseSpiritOptions() {
    return [...new Set(state.recipes
      .map(recipe => String(recipe.category || '').trim())
      .filter(category => category && category.toLowerCase() !== 'style'))]
      .sort((a, b) => a.localeCompare(b));
  }

  function fillSelect(select, values, selectedValue = '') {
    if (!select) return;
    const current = selectedValue || select.value || '';
    const normalized = [...values];
    if (current && !normalized.includes(current)) normalized.unshift(current);
    select.innerHTML = `<option value="">Not specified</option>${normalized.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}`;
    select.value = current;
  }

  function refreshTaxonomyFormOptions(recipe = null) {
    fillSelect($('customStyle'), styleOptions(), recipe?.style || $('customStyle')?.value || '');
    fillSelect($('customBaseSpirit'), baseSpiritOptions(), recipe?.baseSpirit || $('customBaseSpirit')?.value || '');
  }

  const originalRecipeMatches = recipeMatches;
  recipeMatches = function(recipe, query) {
    if (!query) return true;
    if (originalRecipeMatches(recipe, query)) return true;
    return [recipe.style, recipe.baseSpirit].filter(Boolean).join(' ').toLowerCase().includes(query);
  };

  spiritCategories = function() {
    const counts = new Map();
    state.recipes.forEach(recipe => {
      const category = String(recipe.category || '').trim();
      if (!category || category.toLowerCase() === 'style') return;
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    state.customRecipes.forEach(recipe => {
      const spirit = String(recipe.baseSpirit || '').trim();
      if (!spirit) return;
      counts.set(spirit, (counts.get(spirit) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  const originalRenderBrowseControls = renderBrowseControls;
  renderBrowseControls = function() {
    originalRenderBrowseControls();
    const customStyleCount = state.customRecipes.filter(recipe => String(recipe.style || '').trim()).length;
    const customSpiritCount = state.customRecipes.filter(recipe => String(recipe.baseSpirit || '').trim()).length;
    const libraryStyleCount = state.recipes.filter(recipe => String(recipe.category || '').trim().toLowerCase() === 'style').length;
    const librarySpiritCount = state.recipes.length - libraryStyleCount;
    $('styleCount').textContent = libraryStyleCount + customStyleCount;
    $('spiritCount').textContent = librarySpiritCount + customSpiritCount;
    refreshTaxonomyFormOptions();
  };

  recipeButton = function(recipe, type) {
    const id = type === 'custom' ? recipe.id : recipe.name;
    const active = state.selected && state.selectedType === type && (type === 'custom' ? state.selected.id === recipe.id : state.selected.name === recipe.name);
    const detail = type === 'custom'
      ? ['My recipe', recipe.style, recipe.baseSpirit].filter(Boolean).join(' · ')
      : [recipe.category, recipe.method].filter(Boolean).join(' · ') || 'Cocktail';
    return `<button class="recipe-item ${active ? 'active' : ''}" data-type="${type}" data-id="${esc(id)}"><strong>${esc(recipe.name)}</strong><small>${esc(detail || 'My recipe')}</small></button>`;
  };

  function customMatchesBrowse(recipe, query) {
    if (!recipeMatches(recipe, query)) return false;
    if (state.browseMode === 'style') return Boolean(String(recipe.style || '').trim());
    const spirit = String(recipe.baseSpirit || '').trim();
    if (!spirit) return false;
    return state.selectedSpirit === 'All' || spirit === state.selectedSpirit;
  }

  renderRecipeLists = function() {
    const q = $('search').value.trim().toLowerCase();
    const custom = state.customRecipes.filter(recipe => recipeMatches(recipe, q));
    const library = filteredLibrary(q);
    const customBrowse = state.customRecipes.filter(recipe => customMatchesBrowse(recipe, q));
    const browseEntries = [
      ...customBrowse.map(recipe => ({ recipe, type: 'custom' })),
      ...library.map(recipe => ({ recipe, type: 'library' }))
    ];

    $('customSection').hidden = custom.length === 0;
    $('customList').innerHTML = custom.map(recipe => recipeButton(recipe, 'custom')).join('');
    $('browseLabel').textContent = state.browseMode === 'style' ? 'Styles' : (state.selectedSpirit === 'All' ? 'Spirits' : state.selectedSpirit);
    $('browseResultCount').textContent = `${browseEntries.length}`;
    $('recipeList').innerHTML = browseEntries.length
      ? browseEntries.map(entry => recipeButton(entry.recipe, entry.type)).join('')
      : '<div class="muted small list-empty">No recipes in this view.</div>';

    document.querySelectorAll('.recipe-item').forEach(button => {
      button.onclick = () => {
        const type = button.dataset.type;
        const id = button.dataset.id;
        const recipe = type === 'custom'
          ? state.customRecipes.find(item => item.id === id)
          : state.recipes.find(item => item.name === id);
        if (recipe) selectRecipe(recipe, type);
      };
    });

    const customStyleCount = state.customRecipes.filter(recipe => String(recipe.style || '').trim()).length;
    const customSpiritCount = state.customRecipes.filter(recipe => String(recipe.baseSpirit || '').trim()).length;
    const libraryStyleCount = state.recipes.filter(recipe => String(recipe.category || '').trim().toLowerCase() === 'style').length;
    $('styleCount').textContent = libraryStyleCount + customStyleCount;
    $('spiritCount').textContent = (state.recipes.length - libraryStyleCount) + customSpiritCount;
  };

  const originalSelectRecipe = selectRecipe;
  selectRecipe = function(recipe, type) {
    originalSelectRecipe(recipe, type);
    if (type === 'custom') {
      $('recipeCategory').textContent = ['MY RECIPE', recipe.style, recipe.baseSpirit].filter(Boolean).join(' · ').toUpperCase();
    }
  };

  const originalResetRecipeForm = resetRecipeForm;
  resetRecipeForm = function(recipe = null) {
    originalResetRecipeForm(recipe);
    refreshTaxonomyFormOptions(recipe);
    if ($('customStyle')) $('customStyle').value = recipe?.style || '';
    if ($('customBaseSpirit')) $('customBaseSpirit').value = recipe?.baseSpirit || '';
  };

  const originalRecipeFromForm = recipeFromForm;
  recipeFromForm = function() {
    return {
      ...originalRecipeFromForm(),
      style: $('customStyle')?.value || '',
      baseSpirit: $('customBaseSpirit')?.value || ''
    };
  };

  const originalLoadCloudRecipes = loadCloudRecipes;
  loadCloudRecipes = async function() {
    await originalLoadCloudRecipes();
    renderBrowseControls();
  };

  refreshTaxonomyFormOptions();
})();

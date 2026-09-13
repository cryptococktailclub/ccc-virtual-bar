(() => {
  const STYLE_TAXONOMY = [
    'Sour / Fix',
    'Daisy / Margarita / Sidecar',
    'Old Fashioned',
    'Martini / Martinez',
    'Manhattan / Rob Roy',
    'Negroni / Americano',
    'Collins / Fizz / Rickey',
    'Highball / Buck / Mule',
    'Smash / Maid / Julep',
    'Cobbler',
    'Spritz / Sparkling',
    'Tiki / Tropical / Punch',
    'Flip / Egg / Cream',
    'Hot / Coffee',
    'Spirit-Forward / Stirred',
    'Specialty / Other'
  ];

  const STYLE_ALIASES = new Map([
    ['fix', 'Sour / Fix'], ['sour', 'Sour / Fix'], ['torch light', 'Sour / Fix'],
    ['cobbler', 'Cobbler'], ['fizz or collins', 'Collins / Fizz / Rickey'], ['rickey', 'Collins / Fizz / Rickey'],
    ['highball or buck', 'Highball / Buck / Mule'], ['maid', 'Smash / Maid / Julep'], ['smash', 'Smash / Maid / Julep'],
    ['regal', 'Specialty / Other']
  ]);

  const lower = value => String(value || '').trim().toLowerCase();
  const isStyleTemplate = recipe => lower(recipe.category) === 'style';
  const recipeText = recipe => [recipe.name, recipe.method, recipe.glass, recipe.ice, recipe.garnish,
    ...(recipe.ingredients || []).flatMap(item => [item.ingredient, item.amount])
  ].filter(Boolean).join(' ').toLowerCase();
  const containsAny = (text, terms) => terms.some(term => text.includes(term));

  state.expandedBrowseGroup = state.expandedBrowseGroup || '';
  state.recipeIndexReady = Boolean(state.recipes?.length);
  let retryTimer = null;
  let loadingIndex = false;

  function normalizeExplicitStyle(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const alias = STYLE_ALIASES.get(raw.toLowerCase());
    if (alias) return alias;
    return STYLE_TAXONOMY.find(style => style.toLowerCase() === raw.toLowerCase()) || raw;
  }

  function classifyStyle(recipe) {
    const explicit = normalizeExplicitStyle(recipe.style);
    if (explicit) return explicit;

    const name = lower(recipe.name);
    const text = recipeText(recipe);
    const method = lower(recipe.method);
    const glass = lower(recipe.glass);
    const ice = lower(recipe.ice);
    const ingredientText = (recipe.ingredients || []).map(item => lower(item.ingredient)).join(' ');

    const hasCitrus = /\b(lemon|lime|grapefruit|yuzu|citrus|orange juice)\b/.test(ingredientText);
    const hasSweet = /\b(syrup|sugar|honey|agave|grenadine|orgeat|maple|demerara)\b/.test(ingredientText);
    const hasBubbles = /\b(soda|club soda|seltzer|sparkling|champagne|prosecco|cava|tonic|ginger beer|ginger ale|cola)\b/.test(ingredientText);
    const hasGinger = /\b(ginger beer|ginger ale|ginger syrup)\b/.test(ingredientText);
    const hasOrangeLiqueur = /\b(cointreau|curaçao|curacao|triple sec|grand marnier|orange liqueur)\b/.test(ingredientText);
    const hasSweetVermouth = /\b(sweet vermouth|rosso vermouth|carpano|punt e mes)\b/.test(ingredientText);
    const hasDryVermouth = /\b(dry vermouth|lillet|cocchi americano|kina lillet)\b/.test(ingredientText);
    const hasAperitivo = /\b(campari|aperol|select aperitivo|cappelletti)\b/.test(ingredientText);
    const hasBitters = /\bbitters\b/.test(ingredientText);
    const hasHerb = /\b(mint|cucumber|basil|shiso|cilantro|sage|rosemary)\b/.test(ingredientText);
    const hasTropical = /\b(pineapple|passion ?fruit|orgeat|falernum|coconut|guava|banana|allspice dram|tiki)\b/.test(text);
    const hasEggCream = /\b(egg|egg white|egg yolk|cream|milk|half and half|coconut cream)\b/.test(ingredientText);
    const hasCoffeeHot = /\b(coffee|espresso|hot water|tea|cider)\b/.test(ingredientText) || /\b(hot toddy|irish coffee)\b/.test(name);

    if (hasCoffeeHot) return 'Hot / Coffee';
    if (containsAny(name, ['mai tai','zombie','painkiller','jungle bird','pina colada','piña colada','swizzle','scorpion','hurricane','punch']) || hasTropical) return 'Tiki / Tropical / Punch';
    if (hasEggCream || containsAny(name, ['flip','nog','alexander','grasshopper','ramos'])) return 'Flip / Egg / Cream';
    if (containsAny(name, ['spritz','bellini','mimosa','kir royale','french 75','champagne cocktail']) || /\b(champagne|prosecco|cava|sparkling wine)\b/.test(ingredientText)) return 'Spritz / Sparkling';
    if (name.includes('cobbler') || (ice.includes('crush') && /\b(sherry|port|madeira|wine)\b/.test(ingredientText))) return 'Cobbler';
    if (containsAny(name, ['julep','smash','maid']) || (hasHerb && (method.includes('muddle') || ice.includes('crush')))) return 'Smash / Maid / Julep';
    if (containsAny(name, ['negroni','boulevardier','americano']) || (hasAperitivo && hasSweetVermouth && !hasCitrus)) return 'Negroni / Americano';
    if (containsAny(name, ['martini','martinez','vesper','gibson']) || (/\b(gin|vodka)\b/.test(ingredientText) && (hasDryVermouth || hasSweetVermouth) && !hasCitrus)) return 'Martini / Martinez';
    if (containsAny(name, ['manhattan','rob roy']) || (hasSweetVermouth && /\b(whiskey|whisky|rye|bourbon|scotch|brandy|cognac|rum|tequila)\b/.test(ingredientText) && !hasCitrus)) return 'Manhattan / Rob Roy';
    if (containsAny(name, ['old fashioned','sazerac']) || (hasBitters && hasSweet && !hasCitrus && !hasSweetVermouth && !hasDryVermouth && !hasBubbles)) return 'Old Fashioned';
    if (containsAny(name, ['mule','buck','dark n stormy','dark & stormy','highball','gin and tonic','gin & tonic','scotch and soda']) || hasGinger || (/\btonic\b/.test(ingredientText) && !hasCitrus)) return 'Highball / Buck / Mule';
    if (containsAny(name, ['collins','fizz','rickey']) || (hasBubbles && hasCitrus && !/\b(champagne|prosecco|cava|sparkling wine)\b/.test(ingredientText))) return 'Collins / Fizz / Rickey';
    if (containsAny(name, ['margarita','sidecar','daisy','crusta']) || (hasOrangeLiqueur && hasCitrus)) return 'Daisy / Margarita / Sidecar';
    if (containsAny(name, ['sour','daiquiri','gimlet',"bee's knees",'gold rush']) || (hasCitrus && hasSweet)) return 'Sour / Fix';
    if ((method.includes('stir') || (!hasCitrus && !hasBubbles && !method.includes('muddle'))) && !hasCitrus && !hasBubbles) return 'Spirit-Forward / Stirred';
    if (glass.includes('collins') && hasCitrus) return 'Collins / Fizz / Rickey';
    return 'Specialty / Other';
  }

  function normalizeSpirit(recipe) {
    const explicit = String(recipe.baseSpirit || '').trim();
    const source = explicit || String(recipe.category || '').trim();
    const n = lower(source);
    if (!n || n === 'style') return '';
    if (/gin/.test(n)) return 'Gin';
    if (/rum|cacha[cç]a|rhum/.test(n)) return 'Rum';
    if (/whiskey|whisky|bourbon|rye|scotch|irish/.test(n)) return 'Whiskey';
    if (/tequila|mezcal|agave/.test(n)) return 'Tequila & Mezcal';
    if (/vodka/.test(n)) return 'Vodka';
    if (/brandy|cognac|armagnac|calvados|pisco/.test(n)) return 'Brandy & Cognac';
    if (/sherry|port|madeira|vermouth|wine/.test(n)) return 'Wine & Fortified';
    if (/amaro|aperitif|aperitivo|liqueur|cordial/.test(n)) return 'Amaro / Liqueur';
    return source;
  }

  function recipeMatchesQuery(recipe, query) {
    if (!query) return true;
    if (typeof recipeMatches === 'function' && recipeMatches(recipe, query)) return true;
    return [classifyStyle(recipe), normalizeSpirit(recipe)].join(' ').toLowerCase().includes(query);
  }

  function browseGroups(query = '') {
    const groups = new Map();
    const add = (group, recipe, type) => {
      if (!group || !recipeMatchesQuery(recipe, query)) return;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push({ recipe, type });
    };

    const library = (state.recipes || []).filter(recipe => !isStyleTemplate(recipe));
    if (state.browseMode === 'style') {
      library.forEach(recipe => add(classifyStyle(recipe), recipe, 'library'));
      (state.customRecipes || []).forEach(recipe => add(classifyStyle(recipe), recipe, 'custom'));
      const ordered = STYLE_TAXONOMY.filter(name => groups.has(name));
      const extras = [...groups.keys()].filter(name => !STYLE_TAXONOMY.includes(name)).sort((a,b) => a.localeCompare(b));
      return [...ordered, ...extras].map(name => [name, groups.get(name)]);
    }

    library.forEach(recipe => add(normalizeSpirit(recipe), recipe, 'library'));
    (state.customRecipes || []).forEach(recipe => add(normalizeSpirit(recipe), recipe, 'custom'));
    const order = ['Gin','Whiskey','Rum','Tequila & Mezcal','Vodka','Brandy & Cognac','Wine & Fortified','Amaro / Liqueur'];
    return [...groups.entries()].sort((a,b) => {
      const ai = order.indexOf(a[0]); const bi = order.indexOf(b[0]);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a[0].localeCompare(b[0]);
    });
  }

  function fillStyleSelect(recipe = null) {
    const select = $('customStyle');
    if (!select) return;
    const current = normalizeExplicitStyle(recipe?.style || select.value || '');
    select.innerHTML = `<option value="">Not specified</option>${STYLE_TAXONOMY.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}`;
    select.value = current && STYLE_TAXONOMY.includes(current) ? current : '';
  }

  const previousResetRecipeForm = resetRecipeForm;
  resetRecipeForm = function(recipe = null) {
    previousResetRecipeForm(recipe);
    fillStyleSelect(recipe);
  };

  renderBrowseControls = function() {
    document.querySelectorAll('.browse-tab').forEach(button => button.classList.toggle('active', button.dataset.mode === state.browseMode));
    const finishedLibrary = (state.recipes || []).filter(recipe => !isStyleTemplate(recipe));
    $('styleCount').textContent = finishedLibrary.length + (state.customRecipes || []).length;
    $('spiritCount').textContent = finishedLibrary.filter(recipe => normalizeSpirit(recipe)).length + (state.customRecipes || []).filter(recipe => normalizeSpirit(recipe)).length;
    $('spiritFilters').hidden = false;
    $('spiritFilters').classList.add('category-stack');
    fillStyleSelect();
  };

  renderRecipeLists = function() {
    const q = $('search').value.trim().toLowerCase();
    const custom = (state.customRecipes || []).filter(recipe => recipeMatchesQuery(recipe, q));

    $('customSection').hidden = custom.length === 0;
    $('customList').innerHTML = custom.map(recipe => recipeButton(recipe, 'custom')).join('');
    document.querySelector('.results-heading')?.setAttribute('hidden', '');
    $('recipeList').hidden = true;

    if (!state.recipeIndexReady || !(state.recipes || []).length) {
      $('browseLabel').textContent = state.browseMode === 'style' ? 'Cocktail styles' : 'Base spirits';
      $('browseResultCount').textContent = '…';
      $('spiritFilters').innerHTML = '<div class="browse-index-status"><strong>Indexing recipes…</strong><span>Loading the recipe library.</span></div>';
      return;
    }

    const groups = browseGroups(q);
    const total = groups.reduce((sum, [, entries]) => sum + entries.length, 0);
    $('browseLabel').textContent = state.browseMode === 'style' ? 'Cocktail styles' : 'Base spirits';
    $('browseResultCount').textContent = String(total);

    $('spiritFilters').innerHTML = groups.length ? groups.map(([name, entries]) => {
      const expanded = Boolean(q) || state.expandedBrowseGroup === name;
      const sorted = [...entries].sort((a,b) => String(a.recipe.name || '').localeCompare(String(b.recipe.name || '')));
      return `<div class="browse-group ${expanded ? 'open' : ''}">
        <button class="browse-group-toggle" type="button" data-group="${esc(name)}" aria-expanded="${expanded}">
          <span>${esc(name)}</span><span class="browse-group-meta"><b>${entries.length}</b><i>›</i></span>
        </button>
        <div class="browse-group-recipes" ${expanded ? '' : 'hidden'}>${sorted.map(entry => recipeButton(entry.recipe, entry.type)).join('')}</div>
      </div>`;
    }).join('') : '<div class="muted small list-empty">No recipes match this search.</div>';

    document.querySelectorAll('.browse-group-toggle').forEach(button => {
      button.onclick = () => {
        const group = button.dataset.group;
        state.expandedBrowseGroup = state.expandedBrowseGroup === group ? '' : group;
        renderRecipeLists();
      };
    });
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
  };

  async function ensureRecipeIndex() {
    if (loadingIndex) return;
    if ((state.recipes || []).length) {
      state.recipeIndexReady = true;
      renderBrowseControls();
      renderRecipeLists();
      return;
    }
    loadingIndex = true;
    renderRecipeLists();
    try {
      const base = String(window.BATCH_OS_CONFIG?.apiBase || '').replace(/\/$/, '');
      const response = await fetch(`${base}/api/recipes`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.recipes) || !data.recipes.length) throw new Error('Recipe library returned no recipes');
      state.recipes = data.recipes;
      state.recipeIndexReady = true;
      if (retryTimer) clearTimeout(retryTimer);
      renderBrowseControls();
      renderRecipeLists();
    } catch (error) {
      state.recipeIndexReady = false;
      $('spiritFilters').innerHTML = '<div class="browse-index-status"><strong>Recipe library is waking up…</strong><span>Retrying automatically.</span></div>';
      retryTimer = setTimeout(ensureRecipeIndex, 2500);
    } finally {
      loadingIndex = false;
    }
  }

  document.querySelectorAll('.browse-tab').forEach(button => {
    button.onclick = () => {
      state.browseMode = button.dataset.mode;
      state.expandedBrowseGroup = '';
      renderBrowseControls();
      renderRecipeLists();
    };
  });

  const previousLoadCloudRecipes = loadCloudRecipes;
  loadCloudRecipes = async function() {
    await previousLoadCloudRecipes();
    renderBrowseControls();
    renderRecipeLists();
  };

  const previousLoadRecipes = loadRecipes;
  loadRecipes = async function() {
    await previousLoadRecipes();
    if ((state.recipes || []).length) state.recipeIndexReady = true;
    renderBrowseControls();
    renderRecipeLists();
  };

  renderBrowseControls();
  renderRecipeLists();
  ensureRecipeIndex();
})();

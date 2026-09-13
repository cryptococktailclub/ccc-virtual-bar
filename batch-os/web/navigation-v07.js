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
    ['fix', 'Sour / Fix'],
    ['sour', 'Sour / Fix'],
    ['torch light', 'Sour / Fix'],
    ['cobbler', 'Cobbler'],
    ['fizz or collins', 'Collins / Fizz / Rickey'],
    ['rickey', 'Collins / Fizz / Rickey'],
    ['highball or buck', 'Highball / Buck / Mule'],
    ['maid', 'Smash / Maid / Julep'],
    ['smash', 'Smash / Maid / Julep'],
    ['regal', 'Specialty / Other']
  ]);

  state.selectedStyle = state.selectedStyle || '';
  state.expandedBrowseGroup = state.expandedBrowseGroup || '';

  const lower = value => String(value || '').toLowerCase();
  const recipeText = recipe => [
    recipe.name,
    recipe.method,
    recipe.glass,
    recipe.ice,
    recipe.garnish,
    ...(recipe.ingredients || []).flatMap(item => [item.ingredient, item.amount])
  ].filter(Boolean).join(' ').toLowerCase();
  const containsAny = (text, terms) => terms.some(term => text.includes(term));

  function normalizeExplicitStyle(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const aliased = STYLE_ALIASES.get(raw.toLowerCase());
    if (aliased) return aliased;
    const exact = STYLE_TAXONOMY.find(style => style.toLowerCase() === raw.toLowerCase());
    return exact || raw;
  }

  function classifyStyle(recipe) {
    const explicit = normalizeExplicitStyle(recipe.style);
    if (explicit) return explicit;

    const name = lower(recipe.name);
    const category = lower(recipe.category);
    if (category === 'style') return normalizeExplicitStyle(recipe.name) || 'Specialty / Other';

    const text = recipeText(recipe);
    const method = lower(recipe.method);
    const glass = lower(recipe.glass);
    const ice = lower(recipe.ice);
    const ingredients = (recipe.ingredients || []).map(item => lower(item.ingredient));
    const ingredientText = ingredients.join(' ');

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
    const spiritForwardMethod = method.includes('stir') || (!hasCitrus && !hasBubbles && !method.includes('muddle'));

    if (hasCoffeeHot) return 'Hot / Coffee';
    if (containsAny(name, ['mai tai', 'zombie', 'painkiller', 'jungle bird', 'pina colada', 'piña colada', 'swizzle', 'scorpion', 'hurricane', 'punch']) || hasTropical) return 'Tiki / Tropical / Punch';
    if (hasEggCream || containsAny(name, ['flip', 'nog', 'alexander', 'grasshopper', 'ramos'])) return 'Flip / Egg / Cream';
    if (containsAny(name, ['spritz', 'bellini', 'mimosa', 'kir royale', 'french 75', 'champagne cocktail']) || /\b(champagne|prosecco|cava|sparkling wine)\b/.test(ingredientText)) return 'Spritz / Sparkling';
    if (name.includes('cobbler') || (ice.includes('crush') && /\b(sherry|port|madeira|wine)\b/.test(ingredientText))) return 'Cobbler';
    if (containsAny(name, ['julep', 'smash', 'maid']) || (hasHerb && (method.includes('muddle') || ice.includes('crush')))) return 'Smash / Maid / Julep';

    if (containsAny(name, ['negroni', 'boulevardier', 'americano']) || (hasAperitivo && hasSweetVermouth && !hasCitrus)) return 'Negroni / Americano';
    if (containsAny(name, ['martini', 'martinez', 'vesper', 'gibson']) || ((/\b(gin|vodka)\b/.test(ingredientText)) && (hasDryVermouth || hasSweetVermouth) && !hasCitrus)) return 'Martini / Martinez';
    if (containsAny(name, ['manhattan', 'rob roy']) || (hasSweetVermouth && /\b(whiskey|whisky|rye|bourbon|scotch|brandy|cognac|rum|tequila)\b/.test(ingredientText) && !hasCitrus)) return 'Manhattan / Rob Roy';
    if (containsAny(name, ['old fashioned', 'sazerac']) || (hasBitters && hasSweet && !hasCitrus && !hasSweetVermouth && !hasDryVermouth && !hasBubbles)) return 'Old Fashioned';

    if (containsAny(name, ['mule', 'buck', 'dark n stormy', 'dark & stormy', 'highball', 'gin and tonic', 'gin & tonic', 'scotch and soda']) || hasGinger || (/\btonic\b/.test(ingredientText) && !hasCitrus)) return 'Highball / Buck / Mule';
    if (containsAny(name, ['collins', 'fizz', 'rickey']) || (hasBubbles && hasCitrus && !/\b(champagne|prosecco|cava|sparkling wine)\b/.test(ingredientText))) return 'Collins / Fizz / Rickey';
    if (containsAny(name, ['margarita', 'sidecar', 'daisy', 'crusta']) || (hasOrangeLiqueur && hasCitrus)) return 'Daisy / Margarita / Sidecar';
    if (containsAny(name, ['sour', 'daiquiri', 'gimlet', 'bee\'s knees', 'gold rush', 'whiskey smash']) || (hasCitrus && hasSweet)) return 'Sour / Fix';

    if (spiritForwardMethod && !hasCitrus && !hasBubbles) return 'Spirit-Forward / Stirred';
    if (glass.includes('collins') && hasCitrus) return 'Collins / Fizz / Rickey';
    return 'Specialty / Other';
  }

  function spiritRank(name) {
    const n = lower(name);
    const priorities = [
      ['gin', 1], ['whiskey', 2], ['whisky', 2], ['bourbon', 2], ['rye', 2], ['scotch', 2],
      ['rum', 3], ['tequila', 4], ['mezcal', 4], ['vodka', 5], ['brandy', 6], ['cognac', 6]
    ];
    for (const [term, rank] of priorities) if (n.includes(term)) return rank;
    return 50;
  }

  function browseGroups(query = '') {
    const groups = new Map();
    const add = (group, recipe, type) => {
      if (!group) return;
      if (query && !recipeMatches(recipe, query) && !lower(group).includes(query)) return;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push({ recipe, type });
    };

    if (state.browseMode === 'style') {
      state.recipes.forEach(recipe => add(classifyStyle(recipe), recipe, 'library'));
      state.customRecipes.forEach(recipe => add(classifyStyle(recipe), recipe, 'custom'));
      const ordered = STYLE_TAXONOMY.filter(name => groups.has(name));
      const extras = [...groups.keys()].filter(name => !STYLE_TAXONOMY.includes(name)).sort((a, b) => a.localeCompare(b));
      return [...ordered, ...extras].map(name => [name, groups.get(name)]);
    }

    state.recipes.forEach(recipe => {
      const category = String(recipe.category || '').trim();
      if (category && lower(category) !== 'style') add(category, recipe, 'library');
    });
    state.customRecipes.forEach(recipe => {
      const spirit = String(recipe.baseSpirit || '').trim();
      if (spirit) add(spirit, recipe, 'custom');
    });
    return [...groups.entries()].sort((a, b) => {
      const rank = spiritRank(a[0]) - spiritRank(b[0]);
      return rank || a[0].localeCompare(b[0]);
    });
  }

  function fillStyleSelect(recipe = null) {
    const select = $('customStyle');
    if (!select) return;
    const current = normalizeExplicitStyle(recipe?.style || select.value || '');
    const options = [...STYLE_TAXONOMY];
    if (current && !options.includes(current)) options.unshift(current);
    select.innerHTML = `<option value="">Not specified</option>${options.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}`;
    select.value = current;
  }

  const previousResetRecipeForm = resetRecipeForm;
  resetRecipeForm = function(recipe = null) {
    previousResetRecipeForm(recipe);
    fillStyleSelect(recipe);
  };

  renderBrowseControls = function() {
    document.querySelectorAll('.browse-tab').forEach(button => button.classList.toggle('active', button.dataset.mode === state.browseMode));
    const groups = browseGroups('');
    const libraryStyleTotal = state.recipes.length;
    const customStyleTotal = state.customRecipes.length;
    const librarySpiritTotal = state.recipes.filter(recipe => lower(recipe.category) !== 'style').length;
    const customSpiritTotal = state.customRecipes.filter(recipe => String(recipe.baseSpirit || '').trim()).length;
    $('styleCount').textContent = libraryStyleTotal + customStyleTotal;
    $('spiritCount').textContent = librarySpiritTotal + customSpiritTotal;
    $('spiritFilters').hidden = false;
    $('spiritFilters').classList.add('category-stack');
    fillStyleSelect();
    return groups;
  };

  renderRecipeLists = function() {
    const q = $('search').value.trim().toLowerCase();
    const custom = state.customRecipes.filter(recipe => recipeMatches(recipe, q));
    const groups = browseGroups(q);
    const total = groups.reduce((sum, [, entries]) => sum + entries.length, 0);

    $('customSection').hidden = custom.length === 0;
    $('customList').innerHTML = custom.map(recipe => recipeButton(recipe, 'custom')).join('');

    const modeLabel = state.browseMode === 'style' ? 'Cocktail styles' : 'Base spirits';
    $('browseLabel').textContent = modeLabel;
    $('browseResultCount').textContent = String(total);
    document.querySelector('.results-heading')?.setAttribute('hidden', '');
    $('recipeList').hidden = true;

    $('spiritFilters').innerHTML = groups.length ? groups.map(([name, entries]) => {
      const expanded = q ? true : state.expandedBrowseGroup === name;
      const sortedEntries = [...entries].sort((a, b) => String(a.recipe.name || '').localeCompare(String(b.recipe.name || '')));
      return `<div class="browse-group ${expanded ? 'open' : ''}">
        <button class="browse-group-toggle" type="button" data-group="${esc(name)}" aria-expanded="${expanded ? 'true' : 'false'}">
          <span>${esc(name)}</span><span class="browse-group-meta"><b>${entries.length}</b><i>›</i></span>
        </button>
        <div class="browse-group-recipes" ${expanded ? '' : 'hidden'}>
          ${sortedEntries.map(entry => recipeButton(entry.recipe, entry.type)).join('')}
        </div>
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

  document.querySelectorAll('.browse-tab').forEach(button => {
    button.onclick = () => {
      state.browseMode = button.dataset.mode;
      state.selectedSpirit = 'All';
      state.selectedStyle = '';
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

  renderBrowseControls();
  renderRecipeLists();
})();

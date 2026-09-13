(() => {
  const CUSTOM = '__batch_custom__';
  let lastLibrarySignature = '';
  let suggestionSets = { ingredient: [], method: [], glass: [], ice: [], garnish: [] };

  function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function frequencyValues(values) {
    const byKey = new Map();
    values.forEach(raw => {
      const value = clean(raw);
      if (!value || value === '-') return;
      const key = value.toLocaleLowerCase();
      const current = byKey.get(key);
      if (current) current.count += 1;
      else byKey.set(key, { value, count: 1 });
    });
    return [...byKey.values()]
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
      .map(item => item.value);
  }

  function rebuildSuggestions() {
    const recipes = [
      ...(Array.isArray(state?.recipes) ? state.recipes : []),
      ...(Array.isArray(state?.customRecipes) ? state.customRecipes : [])
    ];
    suggestionSets = {
      ingredient: frequencyValues(recipes.flatMap(recipe => (recipe.ingredients || []).map(item => item?.ingredient))),
      method: frequencyValues(recipes.map(recipe => recipe.method)),
      glass: frequencyValues(recipes.map(recipe => recipe.glass)),
      ice: frequencyValues(recipes.map(recipe => recipe.ice)),
      garnish: frequencyValues(recipes.map(recipe => recipe.garnish))
    };
    if (!suggestionSets.garnish.some(value => value.toLowerCase() === 'none')) suggestionSets.garnish.push('None');
  }

  function optionMarkup(values, placeholder, current = '') {
    const exact = values.find(value => value.toLocaleLowerCase() === clean(current).toLocaleLowerCase());
    return [
      `<option value="">${esc(placeholder)}</option>`,
      ...values.map(value => `<option value="${esc(value)}" ${exact === value ? 'selected' : ''}>${esc(value)}</option>`),
      `<option value="${CUSTOM}" ${current && !exact ? 'selected' : ''}>Custom…</option>`
    ].join('');
  }

  function wirePicker(select, input, values, current = '') {
    const exact = values.find(value => value.toLocaleLowerCase() === clean(current).toLocaleLowerCase());
    if (current && exact) {
      select.value = exact;
      input.value = exact;
      input.hidden = true;
    } else if (current) {
      select.value = CUSTOM;
      input.value = current;
      input.hidden = false;
    } else {
      select.value = '';
      input.value = '';
      input.hidden = true;
    }

    select.onchange = () => {
      if (select.value === CUSTOM) {
        input.value = exact && input.value === exact ? '' : input.value;
        input.hidden = false;
        input.focus();
      } else {
        input.value = select.value;
        input.hidden = true;
      }
    };
  }

  function buildIngredientRow(data = {}) {
    const row = document.createElement('div');
    row.className = 'ingredient-row guided-ingredient-row';
    const ingredient = clean(data.ingredient);
    row.innerHTML = `
      <input class="field amount" type="text" inputmode="decimal" placeholder="2" value="${esc(data.amountValue || '')}">
      <select class="field unit">${['oz','mL','dash','piece','slice','sprig'].map(unit => `<option value="${unit}" ${data.unit === unit ? 'selected' : ''}>${unit}</option>`).join('')}</select>
      <div class="ingredient-picker">
        <select class="field ingredient-select" aria-label="Ingredient suggestion">${optionMarkup(suggestionSets.ingredient, 'Select ingredient…', ingredient)}</select>
        <input class="field ingredient ingredient-custom" type="text" placeholder="Enter custom ingredient" value="${esc(ingredient)}">
      </div>
      <button class="remove-row" type="button" aria-label="Remove ingredient">×</button>`;

    wirePicker(row.querySelector('.ingredient-select'), row.querySelector('.ingredient'), suggestionSets.ingredient, ingredient);
    row.querySelector('.remove-row').onclick = () => {
      if ($('ingredientRows').children.length > 1) row.remove();
    };
    return row;
  }

  function installIngredientOverride() {
    newIngredientRow = function(data = {}) {
      const row = buildIngredientRow(data);
      $('ingredientRows').appendChild(row);
      return row;
    };
  }

  function upgradeIngredientRows() {
    [...document.querySelectorAll('#ingredientRows .ingredient-row')].forEach(oldRow => {
      if (oldRow.querySelector('.ingredient-select')) {
        const input = oldRow.querySelector('.ingredient');
        const select = oldRow.querySelector('.ingredient-select');
        const current = clean(input?.value || (select?.value !== CUSTOM ? select?.value : ''));
        select.innerHTML = optionMarkup(suggestionSets.ingredient, 'Select ingredient…', current);
        wirePicker(select, input, suggestionSets.ingredient, current);
        return;
      }
      const replacement = buildIngredientRow({
        amountValue: oldRow.querySelector('.amount')?.value || '',
        unit: oldRow.querySelector('.unit')?.value || 'oz',
        ingredient: oldRow.querySelector('.ingredient')?.value || ''
      });
      oldRow.replaceWith(replacement);
    });
  }

  const detailConfig = [
    ['customMethod', 'method', 'Select method…', 'Enter custom method'],
    ['customGlass', 'glass', 'Select glass…', 'Enter custom glass'],
    ['customIce', 'ice', 'Select ice…', 'Enter custom ice setup'],
    ['customGarnish', 'garnish', 'Select garnish…', 'Enter custom garnish']
  ];

  function installDetailPicker(id, key, placeholder, customPlaceholder) {
    const input = $(id);
    if (!input) return;
    let select = input.parentElement.querySelector(`select[data-picker-for="${id}"]`);
    const current = clean(input.value);
    if (!select) {
      select = document.createElement('select');
      select.className = 'field guided-detail-select';
      select.dataset.pickerFor = id;
      input.insertAdjacentElement('beforebegin', select);
      input.classList.add('guided-custom-input');
      input.placeholder = customPlaceholder;
    }
    select.innerHTML = optionMarkup(suggestionSets[key], placeholder, current);
    wirePicker(select, input, suggestionSets[key], current);
  }

  function addHelperCopy() {
    const section = $('customMethod')?.closest('.form-section');
    if (section && !section.querySelector('.guided-library-note')) {
      const note = document.createElement('p');
      note.className = 'muted small guided-library-note';
      note.textContent = 'Choose from the Batch OS recipe library, or select Custom… to enter your own.';
      section.querySelector('h3')?.insertAdjacentElement('afterend', note);
    }
  }

  function refreshSuggestionControls() {
    rebuildSuggestions();
    upgradeIngredientRows();
    detailConfig.forEach(config => installDetailPicker(...config));
    addHelperCopy();
  }

  function injectStyles() {
    if (document.getElementById('guidedRecipeStyles')) return;
    const style = document.createElement('style');
    style.id = 'guidedRecipeStyles';
    style.textContent = `
      .ingredient-picker{display:grid;gap:7px;min-width:0}
      .ingredient-picker .field{width:100%;min-width:0}
      .ingredient-picker .ingredient-custom[hidden],.guided-custom-input[hidden]{display:none!important}
      .guided-detail-select{width:100%}
      .guided-custom-input{margin-top:7px}
      .guided-library-note{margin:4px 0 14px}
      @media(max-width:700px){.guided-ingredient-row .ingredient-picker{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function wrapResetForm() {
    const originalReset = resetRecipeForm;
    resetRecipeForm = function(recipe = null) {
      originalReset(recipe);
      queueMicrotask(refreshSuggestionControls);
    };
  }

  injectStyles();
  installIngredientOverride();
  wrapResetForm();
  refreshSuggestionControls();

  // Recipes load asynchronously. Refresh only when the source library actually changes.
  setInterval(() => {
    const recipes = Array.isArray(state?.recipes) ? state.recipes : [];
    const signature = `${recipes.length}:${recipes[0]?.name || ''}:${recipes[recipes.length - 1]?.name || ''}`;
    if (signature !== lastLibrarySignature) {
      lastLibrarySignature = signature;
      refreshSuggestionControls();
    }
  }, 500);
})();

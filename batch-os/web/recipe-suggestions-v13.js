(() => {
  const CUSTOM = '__batch_custom__';
  const MAX_INGREDIENT_SUGGESTIONS = 10;
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

  function ingredientMatches(query) {
    const q = clean(query).toLocaleLowerCase();
    if (!q) return suggestionSets.ingredient.slice(0, MAX_INGREDIENT_SUGGESTIONS);
    return suggestionSets.ingredient
      .map((value, index) => {
        const lower = value.toLocaleLowerCase();
        const rank = lower.startsWith(q) ? 0 : (lower.includes(q) ? 1 : 2);
        return { value, index, rank };
      })
      .filter(item => item.rank < 2)
      .sort((a, b) => a.rank - b.rank || a.index - b.index || a.value.localeCompare(b.value))
      .slice(0, MAX_INGREDIENT_SUGGESTIONS)
      .map(item => item.value);
  }

  function closeIngredientMenu(root) {
    const menu = root.querySelector('.ingredient-suggestion-menu');
    const toggle = root.querySelector('.ingredient-combobox-toggle');
    if (menu) menu.hidden = true;
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function renderIngredientMenu(root, input, forceOpen = false) {
    const menu = root.querySelector('.ingredient-suggestion-menu');
    const toggle = root.querySelector('.ingredient-combobox-toggle');
    if (!menu || !toggle) return;
    const query = clean(input.value);
    if (!query && !forceOpen) {
      closeIngredientMenu(root);
      return;
    }

    const matches = ingredientMatches(query);
    const exact = suggestionSets.ingredient.some(value => value.toLocaleLowerCase() === query.toLocaleLowerCase());
    const items = matches.map(value => `<button type="button" class="ingredient-suggestion" data-value="${esc(value)}"><span>${esc(value)}</span></button>`);

    if (query && !exact) {
      items.push(`<button type="button" class="ingredient-suggestion ingredient-custom-choice" data-custom="1"><span>Use “${esc(query)}”</span><small>Custom ingredient</small></button>`);
    } else if (!query) {
      items.push('<button type="button" class="ingredient-suggestion ingredient-custom-choice" data-custom="1"><span>Custom ingredient…</span><small>Type your own</small></button>');
    }

    if (!items.length) {
      items.push(`<button type="button" class="ingredient-suggestion ingredient-custom-choice" data-custom="1"><span>Use “${esc(query)}”</span><small>Custom ingredient</small></button>`);
    }

    menu.innerHTML = items.join('');
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');

    menu.querySelectorAll('.ingredient-suggestion').forEach(button => {
      button.onclick = () => {
        if (button.dataset.custom === '1') {
          if (!query) input.value = '';
          closeIngredientMenu(root);
          input.focus();
          return;
        }
        input.value = button.dataset.value || '';
        closeIngredientMenu(root);
        input.focus();
      };
    });
  }

  function wireIngredientCombobox(root) {
    const input = root.querySelector('.ingredient');
    const toggle = root.querySelector('.ingredient-combobox-toggle');
    if (!input || !toggle || root.dataset.comboboxWired === '1') return;
    root.dataset.comboboxWired = '1';

    input.addEventListener('input', () => renderIngredientMenu(root, input, false));
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeIngredientMenu(root);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        renderIngredientMenu(root, input, true);
        root.querySelector('.ingredient-suggestion')?.focus();
      }
    });
    toggle.onclick = event => {
      event.preventDefault();
      const menu = root.querySelector('.ingredient-suggestion-menu');
      if (menu && !menu.hidden) closeIngredientMenu(root);
      else renderIngredientMenu(root, input, true);
    };
    root.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!root.contains(document.activeElement)) closeIngredientMenu(root);
      }, 0);
    });
  }

  function buildIngredientRow(data = {}) {
    const row = document.createElement('div');
    row.className = 'ingredient-row guided-ingredient-row';
    const ingredient = clean(data.ingredient);
    row.innerHTML = `
      <input class="field amount" type="text" inputmode="decimal" placeholder="2" value="${esc(data.amountValue || '')}">
      <select class="field unit">${['oz','mL','dash','piece','slice','sprig'].map(unit => `<option value="${unit}" ${data.unit === unit ? 'selected' : ''}>${unit}</option>`).join('')}</select>
      <div class="ingredient-combobox" role="combobox" aria-haspopup="listbox" aria-expanded="false">
        <input class="field ingredient" type="text" autocomplete="off" placeholder="Type or select ingredient…" value="${esc(ingredient)}" aria-label="Ingredient">
        <button class="ingredient-combobox-toggle" type="button" aria-label="Show ingredient suggestions" aria-expanded="false">⌄</button>
        <div class="ingredient-suggestion-menu" role="listbox" hidden></div>
      </div>
      <button class="remove-row" type="button" aria-label="Remove ingredient">×</button>`;

    wireIngredientCombobox(row.querySelector('.ingredient-combobox'));
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
      if (oldRow.querySelector('.ingredient-combobox')) return;
      const legacySelect = oldRow.querySelector('.ingredient-select');
      const legacyInput = oldRow.querySelector('.ingredient');
      const legacyValue = clean(legacyInput?.value || (legacySelect?.value && legacySelect.value !== CUSTOM ? legacySelect.value : ''));
      const replacement = buildIngredientRow({
        amountValue: oldRow.querySelector('.amount')?.value || '',
        unit: oldRow.querySelector('.unit')?.value || 'oz',
        ingredient: legacyValue
      });
      oldRow.replaceWith(replacement);
    });
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
    const ingredientSection = $('ingredientRows')?.closest('.form-section');
    const amountCopy = ingredientSection?.querySelector('.section-heading .muted.small');
    if (amountCopy) amountCopy.textContent = 'Amount for one drink. Type to search ingredients or use the dropdown.';

    const section = $('customMethod')?.closest('.form-section');
    if (section && !section.querySelector('.guided-library-note')) {
      const note = document.createElement('p');
      note.className = 'muted small guided-library-note';
      note.textContent = 'Choose from known preparation options, or select Custom… to enter your own.';
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
    if (document.getElementById('guidedRecipeStylesV13')) return;
    const style = document.createElement('style');
    style.id = 'guidedRecipeStylesV13';
    style.textContent = `
      .ingredient-combobox{position:relative;display:flex;align-items:stretch;min-width:0}
      .ingredient-combobox>.ingredient{width:100%;min-width:0;padding-right:42px}
      .ingredient-combobox-toggle{position:absolute;right:1px;top:1px;bottom:1px;width:40px;border:0;border-left:1px solid #e4e4e7;border-radius:0 8px 8px 0;background:#fff;color:#52525b;font-size:20px;line-height:1;cursor:pointer}
      .ingredient-combobox-toggle:hover{background:#fafafa;color:#18181b}
      .ingredient-suggestion-menu{position:absolute;z-index:40;top:calc(100% + 5px);left:0;right:0;max-height:300px;overflow:auto;background:#fff;border:1px solid #e4e4e7;border-radius:9px;box-shadow:0 12px 30px rgba(24,24,27,.13);padding:5px}
      .ingredient-suggestion-menu[hidden]{display:none!important}
      .ingredient-suggestion{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;border:0;background:#fff;border-radius:6px;padding:9px 10px;text-align:left;color:#18181b;font:inherit;cursor:pointer}
      .ingredient-suggestion:hover,.ingredient-suggestion:focus{outline:0;background:#fff7ed;color:#9a3412}
      .ingredient-suggestion small{color:#a1a1aa;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
      .ingredient-custom-choice{border-top:1px solid #f4f4f5;margin-top:3px;border-radius:0 0 6px 6px}
      .guided-detail-select{width:100%}
      .guided-custom-input{margin-top:7px}
      .guided-custom-input[hidden]{display:none!important}
      .guided-library-note{margin:4px 0 14px}
      @media(max-width:700px){.guided-ingredient-row .ingredient-combobox{grid-column:auto}}
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

  setInterval(() => {
    const recipes = Array.isArray(state?.recipes) ? state.recipes : [];
    const signature = `${recipes.length}:${recipes[0]?.name || ''}:${recipes[recipes.length - 1]?.name || ''}`;
    if (signature !== lastLibrarySignature) {
      lastLibrarySignature = signature;
      refreshSuggestionControls();
    }
  }, 500);
})();

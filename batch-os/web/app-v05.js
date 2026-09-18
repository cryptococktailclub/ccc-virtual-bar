const API = String(window.BATCH_OS_CONFIG?.apiBase || '').replace(/\/$/, '');
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n, digits = 2) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: digits });

const state = {
  recipes: [],
  customRecipes: loadLocalRecipes(),
  selected: null,
  selectedType: 'library',
  plan: null,
  editingId: null,
  token: localStorage.getItem('batch-os-token') || '',
  user: null,
  persistenceAvailable: false,
  savedBatches: [],
  recentBatches: [],
  browseMode: 'style',
  selectedSpirit: 'All'
};

function loadLocalRecipes() {
  try { return JSON.parse(localStorage.getItem('batch-os-custom-recipes') || '[]'); }
  catch { return []; }
}
function persistLocalRecipes() { localStorage.setItem('batch-os-custom-recipes', JSON.stringify(state.customRecipes)); }
function authHeaders() { return state.token ? { Authorization: `Bearer ${state.token}` } : {}; }
async function api(path, options = {}) {
  const headers = { ...(options.headers || {}), ...authHeaders() };
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}
function setView(name) {
  $('recipesView').hidden = name !== 'recipes';
  $('createView').hidden = name !== 'create';
  document.querySelectorAll('.nav-link[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'create' && state.editingId == null) resetRecipeForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function updateAccountUI() {
  $('accountButton').hidden = !state.persistenceAvailable;
  $('savedNav').hidden = !state.user;
  $('accountButton').textContent = state.user ? 'Account' : 'Sign in';
  $('saveBatch').hidden = !state.user || !state.plan;
  $('saveNote').textContent = state.user ? 'Saved to your account.' : 'Saved on this device.';
  $('recentSection').hidden = !state.user || state.recentBatches.length === 0;
  if ($('accountMenuEmail')) $('accountMenuEmail').textContent = state.user?.email || '';
}
async function initialize() {
  try {
    const health = await api('/health');
    state.persistenceAvailable = Boolean(health.persistenceAvailable);
  } catch { state.persistenceAvailable = false; }
  if (state.persistenceAvailable && state.token) {
    try {
      const data = await api('/api/auth/me');
      state.user = data.user;
      await migrateLocalRecipes();
      await Promise.all([loadCloudRecipes(), refreshRecentBatches()]);
    } catch (error) {
      if (error.status === 401) {
        state.token = '';
        state.user = null;
        localStorage.removeItem('batch-os-token');
      }
    }
  }
  updateAccountUI();
  await loadRecipes();
}
async function loadRecipes() {
  try {
    const data = await api('/api/recipes');
    state.recipes = data.recipes || [];
    renderBrowseControls();
    renderRecipeLists();
  } catch (error) {
    $('recipeList').innerHTML = `<div class="muted small list-empty">Could not load recipes: ${esc(error.message)}</div>`;
  }
}
async function loadCloudRecipes() {
  if (!state.user) return;
  const data = await api('/api/me/recipes');
  state.customRecipes = data.recipes || [];
  renderRecipeLists();
}
async function migrateLocalRecipes() {
  if (!state.user) return;
  const local = loadLocalRecipes();
  if (!local.length) return;
  let allSaved = true;
  for (const recipe of local) {
    try { await api('/api/me/recipes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recipe }) }); }
    catch { allSaved = false; }
  }
  if (allSaved) localStorage.removeItem('batch-os-custom-recipes');
}
function recipeMatches(recipe, query) {
  if (!query) return true;
  return [recipe.name, recipe.category, recipe.method, recipe.glass, ...(recipe.ingredients || []).map(i => i.ingredient)].join(' ').toLowerCase().includes(query);
}
function spiritCategories() {
  const counts = new Map();
  state.recipes.forEach(recipe => {
    const category = String(recipe.category || '').trim();
    if (!category || category.toLowerCase() === 'style') return;
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
function renderBrowseControls() {
  document.querySelectorAll('.browse-tab').forEach(button => button.classList.toggle('active', button.dataset.mode === state.browseMode));
  const categories = spiritCategories();
  $('spiritFilters').hidden = state.browseMode !== 'spirit';
  $('spiritFilters').innerHTML = [
    ['All', categories.reduce((sum, [, count]) => sum + count, 0)],
    ...categories
  ].map(([name, count]) => `<button class="spirit-chip ${state.selectedSpirit === name ? 'active' : ''}" data-spirit="${esc(name)}">${esc(name)}<span>${count}</span></button>`).join('');
  document.querySelectorAll('.spirit-chip').forEach(button => {
    button.onclick = () => {
      state.selectedSpirit = button.dataset.spirit;
      renderBrowseControls();
      renderRecipeLists();
    };
  });
  const styleCount = state.recipes.filter(r => String(r.category || '').toLowerCase() === 'style').length;
  const spiritCount = state.recipes.length - styleCount;
  $('styleCount').textContent = styleCount;
  $('spiritCount').textContent = spiritCount;
}
function recipeButton(recipe, type) {
  const id = type === 'custom' ? recipe.id : recipe.name;
  const active = state.selected && state.selectedType === type && (type === 'custom' ? state.selected.id === recipe.id : state.selected.name === recipe.name);
  const detail = type === 'custom'
    ? 'My recipe'
    : [recipe.category, recipe.method].filter(Boolean).join(' · ') || 'Cocktail';
  return `<button class="recipe-item ${active ? 'active' : ''}" data-type="${type}" data-id="${esc(id)}"><strong>${esc(recipe.name)}</strong><small>${esc(detail)}</small></button>`;
}
function filteredLibrary(query) {
  return state.recipes.filter(recipe => {
    const category = String(recipe.category || '').trim();
    const isStyle = category.toLowerCase() === 'style';
    if (state.browseMode === 'style' && !isStyle) return false;
    if (state.browseMode === 'spirit') {
      if (isStyle) return false;
      if (state.selectedSpirit !== 'All' && category !== state.selectedSpirit) return false;
    }
    return recipeMatches(recipe, query);
  });
}
function renderRecipeLists() {
  const q = $('search').value.trim().toLowerCase();
  const custom = state.customRecipes.filter(r => recipeMatches(r, q));
  const library = filteredLibrary(q);
  $('customSection').hidden = custom.length === 0;
  $('customList').innerHTML = custom.map(r => recipeButton(r, 'custom')).join('');
  $('browseLabel').textContent = state.browseMode === 'style' ? 'Styles' : (state.selectedSpirit === 'All' ? 'Spirits' : state.selectedSpirit);
  $('browseResultCount').textContent = `${library.length}`;
  $('recipeList').innerHTML = library.length
    ? library.map(r => recipeButton(r, 'library')).join('')
    : '<div class="muted small list-empty">No recipes in this view.</div>';
  document.querySelectorAll('.recipe-item').forEach(button => {
    button.onclick = () => {
      const type = button.dataset.type;
      const id = button.dataset.id;
      const recipe = type === 'custom' ? state.customRecipes.find(r => r.id === id) : state.recipes.find(r => r.name === id);
      if (recipe) selectRecipe(recipe, type);
    };
  });
}
function selectRecipe(recipe, type) {
  state.selected = recipe;
  state.selectedType = type;
  state.plan = null;
  $('emptyState').hidden = true;
  $('batchWorkspace').hidden = false;
  $('results').hidden = true;
  $('recipeCategory').textContent = type === 'custom' ? 'MY RECIPE' : (recipe.category || 'RECIPE');
  if ($('recipeHeadingIcon')) $('recipeHeadingIcon').innerHTML = window.BatchIcons?.cocktail?.(recipe) || '';
  $('recipeName').textContent = recipe.name;
  $('recipeDetails').textContent = [recipe.method, recipe.glass, recipe.ice, recipe.garnish ? `Garnish: ${recipe.garnish}` : ''].filter(Boolean).join(' · ');
  $('editCustom').hidden = type !== 'custom';
  $('sourceRecipe').innerHTML = (recipe.ingredients || []).map(i => `<span><strong>${esc(i.amount || '—')}</strong> ${esc(i.ingredient)}</span>`).join('');
  $('saveBatch').hidden = true;
  renderRecipeLists();
}
function selectedBottleSizeMl() {
  const preset = $('bottleSizePreset')?.value || '750';
  if (preset === 'custom') return Number($('bottleSize')?.value || 750);
  return Number(preset || 750);
}

function selectedContainer() {
  const active = document.querySelector('.container-preset.active');
  const custom = active?.dataset.customContainer === 'true';

  if (!custom && active?.dataset.capacityL) {
    return {
      vesselSize: Number(active.dataset.capacityL),
      vesselUnit: 'L',
      vesselLabel: active.dataset.label || 'Batch container'
    };
  }

  const rawSize = Number($('vesselSize')?.value || 0.75);
  const rawUnit = $('vesselUnit')?.value || 'L';
  const customLabel = String($('vesselCustomLabel')?.value || '').trim();

  if (rawUnit === 'mL') {
    return {
      vesselSize: rawSize / 1000,
      vesselUnit: 'L',
      vesselLabel: customLabel || `${fmt(rawSize, 0)} mL custom container`
    };
  }

  return {
    vesselSize: rawSize,
    vesselUnit: rawUnit,
    vesselLabel: customLabel || `${fmt(rawSize, 2)} ${rawUnit} custom container`
  };
}

function batchPayload() {
  const container = selectedContainer();
  return {
    plannedPours: Number($('plannedPours').value || 0),
    overagePct: Number($('overage').value || 0),
    dilutionPct: Number($('dilution').value || 0),
    bottleSizeMl: selectedBottleSizeMl(),
    ...container,
    maxFillPct: 90
  };
}
async function calculateBatch() {
  if (!state.selected) return;
  const button = $('calculate');
  button.disabled = true;
  button.textContent = 'Calculating…';
  try {
    const path = state.selectedType === 'custom' || state.selectedType === 'saved' ? '/api/custom/batch' : '/api/batch';
    const body = path === '/api/custom/batch' ? { ...batchPayload(), recipe: state.selected } : { ...batchPayload(), recipeName: state.selected.name };
    state.plan = await api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    renderPlan(state.plan);
  } catch (error) { alert(`Could not calculate batch: ${error.message}`); }
  finally { button.disabled = false; button.textContent = 'Calculate batch'; }
}
function renderPlan(plan) {
  $('results').hidden = false;
  $('summaryPours').textContent = fmt(plan.summary.plannedPours, 0);
  $('summaryYield').textContent = `${fmt(plan.summary.finalLiters)} L`;
  $('summaryWater').textContent = `${fmt(plan.summary.dilutionLiters)} L`;
  $('summaryVessels').textContent = plan.summary.vesselLabel ? `${fmt(plan.summary.vesselCount, 0)} × ${plan.summary.vesselLabel}` : fmt(plan.summary.vesselCount, 0);
  $('batchIngredients').innerHTML = plan.ingredients?.length ? plan.ingredients.map(i => `<tr><td><strong>${esc(i.ingredient)}</strong></td><td>${fmt(i.perDrinkOz, 3)} oz</td><td>${fmt(i.totalLiters)} L</td><td>${i.bottlesToBuy} × ${fmt(i.bottleSizeMl, 0)} mL</td></tr>`).join('') : '<tr><td colspan="4">No liquid ingredients could be calculated.</td></tr>';
  const prep = plan.prepItems || [];
  $('prepSection').hidden = prep.length === 0;
  $('prepItems').innerHTML = prep.map(i => `<div class="simple-item"><span>${esc(i.ingredient)}</span><strong>${i.totalQuantity != null ? `${fmt(i.totalQuantity,1)} ${esc(i.unit)}` : esc(i.amount || 'Manual')}</strong></div>`).join('');
  const warnings = plan.warnings || [];
  $('warningSection').hidden = warnings.length === 0;
  $('warnings').innerHTML = warnings.map(i => `<div>${esc(i.ingredient)}: ${esc(i.note)}</div>`).join('');
  $('saveBatch').hidden = !state.user;
  $('saveBatch').textContent = 'Save batch';
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function buildPrintSheet() {
  if (!state.plan || !state.selected) return false;

  const p = state.plan;
  const recipe = p.recipe || state.selected || {};
  const sheet = $('printSheet');
  if (!sheet) return false;

  const ingredients = Array.isArray(p.ingredients) ? p.ingredients : [];
  const prep = Array.isArray(p.prepItems) ? p.prepItems : [];
  const vessels = Array.isArray(p.vessels) ? p.vessels : [];
  const warnings = Array.isArray(p.warnings) ? p.warnings : [];
  const inputs = p.inputs || {};
  const summary = p.summary || {};
  const denseClass = ingredients.length > 8 || prep.length > 5 || vessels.length > 5 ? ' print-dense' : '';

  const icon = window.BatchIcons?.cocktail?.(recipe) || '';
  const serviceNotes = [
    recipe.method ? `Method: ${recipe.method}` : '',
    recipe.glass ? `Glass: ${recipe.glass}` : '',
    recipe.ice ? `Ice: ${recipe.ice}` : '',
    recipe.garnish ? `Garnish: ${recipe.garnish}` : ''
  ].filter(Boolean);

  const generated = new Date().toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const ingredientRows = ingredients.length
    ? ingredients.map((item, index) => `
      <tr>
        <td class="print-row-num">${index + 1}</td>
        <td><strong>${esc(item.ingredient)}</strong></td>
        <td>${fmt(item.perDrinkOz, 3)} oz</td>
        <td class="print-total">${fmt(item.totalLiters)} L</td>
        <td>${fmt(item.totalMl, 0)} mL</td>
        <td>${item.bottlesToBuy} × ${fmt(item.bottleSizeMl, 0)} mL</td>
      </tr>`).join('')
    : '<tr><td colspan="6">No liquid ingredients were calculated.</td></tr>';

  const dilutionRow = Number(summary.dilutionLiters || 0) > 0
    ? `<tr class="print-water-row">
        <td class="print-row-num">+</td>
        <td><strong>Dilution water</strong></td>
        <td>${fmt(inputs.dilutionPct, 1)}%</td>
        <td class="print-total">${fmt(summary.dilutionLiters)} L</td>
        <td>${fmt(Number(summary.dilutionLiters || 0) * 1000, 0)} mL</td>
        <td>—</td>
      </tr>`
    : '';

  const vesselMarkup = vessels.length
    ? vessels.map(v => `
      <div class="print-vessel">
        <span class="print-vessel-number">${v.vesselNumber}</span>
        <div>
          <strong>${esc(summary.vesselLabel || inputs.vesselLabel || 'Batch container')} ${v.vesselNumber}</strong>
          <span>Fill to ${fmt(v.targetFillLiters)} L · ${fmt(v.fillPct, 1)}% of ${fmt(v.capacityLiters)} L capacity</span>
        </div>
      </div>`).join('')
    : '<p class="print-empty">No container plan available.</p>';

  const prepMarkup = prep.length
    ? prep.map(item => `
      <div class="print-prep-item">
        <span>${esc(item.ingredient)}</span>
        <strong>${item.totalQuantity != null ? `${fmt(item.totalQuantity, 1)} ${esc(item.unit)}` : esc(item.amount || 'Manual')}</strong>
      </div>`).join('')
    : '<p class="print-empty">No separate prep items.</p>';

  const warningsMarkup = warnings.length
    ? `<section class="print-warning">
        <h3>Check before service</h3>
        ${warnings.map(item => `<p><strong>${esc(item.ingredient)}:</strong> ${esc(item.note)}</p>`).join('')}
      </section>`
    : '';

  sheet.className = `print-sheet${denseClass}`;
  sheet.innerHTML = `
    <div class="print-sheet-inner">
      <header class="print-header">
        <div class="print-brand">
          <span class="print-brand-mark">BATCH OS</span>
          <span class="print-doc-type">PRODUCTION BATCH SHEET</span>
        </div>
        <div class="print-generated">Generated ${esc(generated)}</div>
      </header>

      <section class="print-title-block">
        <div class="print-cocktail-icon">${icon}</div>
        <div class="print-title-copy">
          <p>${esc(recipe.category || recipe.style || 'COCKTAIL')}</p>
          <h1>${esc(recipe.name || 'Batch')}</h1>
          <div class="print-service-notes">${serviceNotes.map(note => `<span>${esc(note)}</span>`).join('')}</div>
        </div>
      </section>

      <section class="print-kpis">
        <div><span>Requested</span><strong>${fmt(summary.requestedPours ?? inputs.plannedPours, 0)}</strong><small>drinks</small></div>
        <div><span>With overage</span><strong>${fmt(summary.plannedPours, 0)}</strong><small>${fmt(inputs.overagePct, 1)}% over</small></div>
        <div><span>Final yield</span><strong>${fmt(summary.finalLiters)}</strong><small>liters</small></div>
        <div><span>Containers</span><strong>${fmt(summary.vesselCount, 0)}</strong><small>${esc(summary.vesselLabel || inputs.vesselLabel || 'vessels')}</small></div>
      </section>

      <section class="print-section print-ingredients-section">
        <div class="print-section-head">
          <h2>Batch build</h2>
          <span>Measure liquids into the batch vessel, then add dilution water.</span>
        </div>
        <table class="print-table">
          <thead>
            <tr><th>#</th><th>Ingredient</th><th>Per drink</th><th>Total</th><th>Metric</th><th>Pull</th></tr>
          </thead>
          <tbody>${ingredientRows}${dilutionRow}</tbody>
        </table>
      </section>

      <div class="print-lower-grid">
        <section class="print-section">
          <div class="print-section-head">
            <h2>Container plan</h2>
            <span>Target fill by vessel.</span>
          </div>
          <div class="print-vessels">${vesselMarkup}</div>
        </section>

        <section class="print-section">
          <div class="print-section-head">
            <h2>Prep separately</h2>
            <span>Keep out of the liquid batch unless your SOP says otherwise.</span>
          </div>
          <div class="print-prep">${prepMarkup}</div>
        </section>
      </div>

      ${warningsMarkup}

      <footer class="print-footer">
        <div><span>Prepared by</span><i></i></div>
        <div><span>Checked by</span><i></i></div>
        <div class="print-footer-note">batch-os.com · Keep this sheet with the batch during prep and service.</div>
      </footer>
    </div>`;

  sheet.setAttribute('aria-hidden', 'false');
  return true;
}

function printProductionSheet() {
  if (!state.plan) {
    alert('Calculate the batch before printing.');
    return;
  }
  if (!buildPrintSheet()) return;
  window.print();
}

window.addEventListener('afterprint', () => {
  const sheet = $('printSheet');
  if (sheet) sheet.setAttribute('aria-hidden', 'true');
});

function copyBatch() {
  if (!state.plan) return;
  const p = state.plan;
  const lines = [`BATCH OS — ${p.recipe.name}`, `${p.summary.plannedPours} drinks`, `Final volume: ${fmt(p.summary.finalLiters)} L`, `Dilution water: ${fmt(p.summary.dilutionLiters)} L`, '', ...p.ingredients.map(i => `${i.ingredient}: ${fmt(i.totalLiters)} L — ${i.bottlesToBuy} × ${fmt(i.bottleSizeMl, 0)} mL`)];
  navigator.clipboard.writeText(lines.join('\n')).then(() => { $('copyBatch').textContent = 'Copied'; setTimeout(() => $('copyBatch').textContent = 'Copy', 1200); });
}
async function saveCurrentBatch() {
  if (!state.user || !state.plan) return;
  const button = $('saveBatch');
  button.disabled = true;
  try {
    await api('/api/me/batches', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: state.plan, recipeId: state.selectedType === 'custom' ? state.selected?.id : null })
    });
    button.textContent = 'Saved';
    await refreshRecentBatches();
  } catch (error) { alert(`Could not save batch: ${error.message}`); }
  finally { button.disabled = false; }
}
async function refreshRecentBatches() {
  if (!state.user) {
    state.recentBatches = [];
    renderRecentBatches();
    return;
  }
  try {
    const data = await api('/api/me/batches?limit=3');
    state.recentBatches = data.batches || [];
  } catch { state.recentBatches = []; }
  renderRecentBatches();
}
function renderRecentBatches() {
  $('recentSection').hidden = !state.user || state.recentBatches.length === 0;
  $('recentList').innerHTML = state.recentBatches.map((batch, index) => {
    const pours = batch.plan?.summary?.plannedPours ?? '—';
    return `<button class="recent-item" data-recent="${index}"><strong>${esc(batch.recipe_name)}</strong><span>${fmt(pours,0)} drinks</span></button>`;
  }).join('');
  document.querySelectorAll('.recent-item').forEach(button => button.onclick = () => loadSavedBatch(state.recentBatches[Number(button.dataset.recent)]));
}
function newIngredientRow(data = {}) {
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  row.innerHTML = `<input class="field amount" type="text" placeholder="2" value="${esc(data.amountValue || '')}"><select class="field unit">${['oz','mL','dash','piece','slice','sprig'].map(unit => `<option value="${unit}" ${data.unit === unit ? 'selected' : ''}>${unit}</option>`).join('')}</select><input class="field ingredient" type="text" placeholder="Ingredient" value="${esc(data.ingredient || '')}"><button class="remove-row" type="button" aria-label="Remove ingredient">×</button>`;
  row.querySelector('.remove-row').onclick = () => { if ($('ingredientRows').children.length > 1) row.remove(); };
  $('ingredientRows').appendChild(row);
}
function resetRecipeForm(recipe = null) {
  $('recipeForm').reset();
  $('ingredientRows').innerHTML = '';
  state.editingId = recipe?.id || null;
  $('createHeading').textContent = recipe ? 'Edit recipe.' : 'Create a recipe.';
  $('customName').value = recipe?.name || '';
  $('customMethod').value = recipe?.method || '';
  $('customGlass').value = recipe?.glass || '';
  $('customIce').value = recipe?.ice || '';
  $('customGarnish').value = recipe?.garnish || '';
  const ingredients = recipe?.ingredients?.length ? recipe.ingredients : [{}, {}, {}];
  ingredients.forEach(item => {
    const match = String(item.amount || '').match(/^\s*(.*?)\s+(oz|ml|mL|dash|piece|slice|sprig)s?\s*$/i);
    newIngredientRow({ amountValue: match ? match[1] : String(item.amount || '').replace(/\s*(oz|ml|dash|piece|slice|sprig)s?\s*$/i, ''), unit: match ? (match[2].toLowerCase() === 'ml' ? 'mL' : match[2].toLowerCase()) : 'oz', ingredient: item.ingredient || '' });
  });
}
function recipeFromForm() {
  const ingredients = [...document.querySelectorAll('.ingredient-row')].map(row => {
    const amount = row.querySelector('.amount').value.trim();
    const unit = row.querySelector('.unit').value;
    const ingredient = row.querySelector('.ingredient').value.trim();
    return { amount: amount ? `${amount} ${unit}` : unit, ingredient };
  }).filter(i => i.ingredient);
  return { id: state.editingId || (crypto.randomUUID ? crypto.randomUUID() : `recipe-${Date.now()}`), name: $('customName').value.trim(), category: 'Original', method: $('customMethod').value.trim(), glass: $('customGlass').value.trim(), ice: $('customIce').value.trim(), garnish: $('customGarnish').value.trim(), ingredients };
}
async function saveRecipe(event) {
  event.preventDefault();
  const recipe = recipeFromForm();
  try {
    const validation = await api('/api/custom/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recipe }) });
    if (!validation.validForBatching) { alert('Add at least one liquid ingredient measured in oz or mL.'); return; }
    let saved = recipe;
    if (state.user) {
      const data = await api('/api/me/recipes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recipe }) });
      saved = data.recipe;
      await loadCloudRecipes();
    } else {
      const index = state.customRecipes.findIndex(r => r.id === recipe.id);
      if (index >= 0) state.customRecipes[index] = recipe; else state.customRecipes.unshift(recipe);
      persistLocalRecipes();
    }
    state.editingId = null;
    setView('recipes');
    renderRecipeLists();
    selectRecipe(saved, 'custom');
  } catch (error) { alert(`Could not save recipe: ${error.message}`); }
}
function editSelectedRecipe() {
  if (state.selectedType !== 'custom' || !state.selected) return;
  resetRecipeForm(state.selected);
  setView('create');
}
function openAccount() {
  if (!state.persistenceAvailable) return;
  if (state.user) {
    $('accountMenuEmail').textContent = state.user.email;
    $('accountMenuDialog').showModal();
    return;
  }
  $('accountError').hidden = true;
  $('accountDialog').showModal();
}
async function handleAuth(mode) {
  const email = $('accountEmail').value.trim();
  const password = $('accountPassword').value;
  $('accountError').hidden = true;
  try {
    const data = await api(mode === 'register' ? '/api/auth/register' : '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('batch-os-token', state.token);
    await migrateLocalRecipes();
    await Promise.all([loadCloudRecipes(), refreshRecentBatches()]);
    updateAccountUI();
    $('accountDialog').close();
  } catch (error) {
    $('accountError').textContent = error.message;
    $('accountError').hidden = false;
  }
}
async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  state.token = '';
  state.user = null;
  state.recentBatches = [];
  localStorage.removeItem('batch-os-token');
  state.customRecipes = loadLocalRecipes();
  $('accountMenuDialog').close();
  updateAccountUI();
  renderRecentBatches();
  renderRecipeLists();
}
async function openSaved() {
  if (!state.user) return;
  try {
    const data = await api('/api/me/batches?limit=50');
    state.savedBatches = data.batches || [];
    $('savedList').innerHTML = state.savedBatches.length ? state.savedBatches.map((b, i) => {
      const date = new Date(b.created_at).toLocaleString();
      const pours = b.plan?.summary?.plannedPours ?? '—';
      const liters = b.plan?.summary?.finalLiters ?? 0;
      return `<button class="saved-item" data-i="${i}"><strong>${esc(b.recipe_name)}</strong><span>${esc(date)} · ${fmt(pours,0)} drinks · ${fmt(liters)} L</span></button>`;
    }).join('') : '<p class="muted">No saved batches yet.</p>';
    document.querySelectorAll('.saved-item').forEach(button => button.onclick = () => loadSavedBatch(state.savedBatches[Number(button.dataset.i)]));
    $('savedDialog').showModal();
  } catch (error) { alert(`Could not load saved batches: ${error.message}`); }
}
function loadSavedBatch(batch) {
  $('savedDialog').close();
  setView('recipes');
  state.selected = { ...batch.recipe_snapshot, id: batch.recipe_id || undefined };
  state.selectedType = batch.recipe_id ? 'custom' : 'saved';
  state.plan = batch.plan;
  $('emptyState').hidden = true;
  $('batchWorkspace').hidden = false;
  $('recipeCategory').textContent = batch.recipe_id ? 'MY RECIPE' : 'SAVED BATCH';
  if ($('recipeHeadingIcon')) $('recipeHeadingIcon').innerHTML = window.BatchIcons?.cocktail?.(state.selected) || '';
  $('recipeName').textContent = batch.recipe_name;
  $('recipeDetails').textContent = [state.selected.method, state.selected.glass, state.selected.ice, state.selected.garnish ? `Garnish: ${state.selected.garnish}` : ''].filter(Boolean).join(' · ');
  $('editCustom').hidden = !batch.recipe_id;
  $('sourceRecipe').innerHTML = (state.selected.ingredients || []).map(i => `<span><strong>${esc(i.amount || '—')}</strong> ${esc(i.ingredient)}</span>`).join('');
  const inputs = batch.batch_inputs || batch.plan?.inputs || {};
  if (inputs.plannedPours) $('plannedPours').value = inputs.plannedPours;
  if (inputs.overagePct != null) $('overage').value = inputs.overagePct;
  if (inputs.dilutionPct != null) $('dilution').value = inputs.dilutionPct;
  renderPlan(batch.plan);
  $('saveBatch').hidden = true;
}

document.querySelectorAll('.nav-link[data-view]').forEach(button => button.onclick = () => setView(button.dataset.view));
document.querySelectorAll('.browse-tab').forEach(button => button.onclick = () => {
  state.browseMode = button.dataset.mode;
  if (state.browseMode === 'style') state.selectedSpirit = 'All';
  renderBrowseControls();
  renderRecipeLists();
});
$('newRecipeShortcut').onclick = () => { state.editingId = null; setView('create'); };
$('backToRecipes').onclick = () => setView('recipes');
$('cancelRecipe').onclick = () => setView('recipes');
$('search').oninput = renderRecipeLists;
$('calculate').onclick = calculateBatch;
$('copyBatch').onclick = copyBatch;
$('printBatch').onclick = printProductionSheet;
$('saveBatch').onclick = saveCurrentBatch;
$('editCustom').onclick = editSelectedRecipe;
$('addIngredient').onclick = () => newIngredientRow({});
$('recipeForm').onsubmit = saveRecipe;
$('accountButton').onclick = openAccount;
$('closeAccount').onclick = () => $('accountDialog').close();
$('accountForm').onsubmit = event => { event.preventDefault(); handleAuth('login'); };
$('createAccountButton').onclick = () => handleAuth('register');
$('savedNav').onclick = openSaved;
$('closeSaved').onclick = () => $('savedDialog').close();
$('viewAllBatches').onclick = openSaved;
$('accountSavedButton').onclick = () => { $('accountMenuDialog').close(); openSaved(); };
$('accountSignOutButton').onclick = logout;
$('closeAccountMenu').onclick = () => $('accountMenuDialog').close();

resetRecipeForm();
renderBrowseControls();
renderRecentBatches();
function initializeContainerControls() {
  const bottlePreset = $('bottleSizePreset');
  const customBottle = $('customBottleSizeLabel');
  if (bottlePreset && customBottle) {
    const syncBottle = () => {
      const isCustom = bottlePreset.value === 'custom';
      customBottle.hidden = !isCustom;
      if (!isCustom && $('bottleSize')) $('bottleSize').value = bottlePreset.value;
    };
    bottlePreset.addEventListener('change', syncBottle);
    syncBottle();
  }

  const presets = [...document.querySelectorAll('.container-preset')];
  const customFields = $('customContainerFields');
  presets.forEach(button => {
    button.addEventListener('click', () => {
      presets.forEach(item => item.classList.toggle('active', item === button));
      const custom = button.dataset.customContainer === 'true';
      if (customFields) customFields.hidden = !custom;
      if (!custom && button.dataset.capacityL) {
        if ($('vesselSize')) $('vesselSize').value = button.dataset.capacityL;
        if ($('vesselUnit')) $('vesselUnit').value = 'L';
      }
    });
  });
}

initializeContainerControls();
initialize();

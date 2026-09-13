const API = String(window.BATCH_OS_CONFIG?.apiBase || '').replace(/\/$/, '');
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n, digits = 2) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: digits });

const state = { recipes: [], selected: null, selectedType: 'library', plan: null, editingId: null, customRecipes: loadCustomRecipes() };

function loadCustomRecipes() {
  try { return JSON.parse(localStorage.getItem('batch-os-custom-recipes') || '[]'); }
  catch { return []; }
}
function persistCustomRecipes() { localStorage.setItem('batch-os-custom-recipes', JSON.stringify(state.customRecipes)); }
async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return data;
}
function setView(name) {
  $('recipesView').hidden = name !== 'recipes';
  $('createView').hidden = name !== 'create';
  document.querySelectorAll('.nav-button').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'create' && state.editingId == null) resetRecipeForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function loadRecipes() {
  try {
    const data = await api('/api/recipes');
    state.recipes = data.recipes || [];
    $('apiStatus').classList.add('online');
    $('apiStatus').innerHTML = '<span></span> Online';
    renderRecipeLists();
  } catch (error) {
    $('apiStatus').classList.remove('online');
    $('apiStatus').innerHTML = `<span></span> ${esc(error.message)}`;
  }
}
function recipeMatches(recipe, query) {
  if (!query) return true;
  const text = [recipe.name, recipe.category, recipe.method, ...(recipe.ingredients || []).map(i => i.ingredient)].join(' ').toLowerCase();
  return text.includes(query);
}
function renderRecipeLists() {
  const q = $('search').value.trim().toLowerCase();
  const custom = state.customRecipes.filter(r => recipeMatches(r, q));
  const library = state.recipes.filter(r => recipeMatches(r, q));
  $('customSection').hidden = custom.length === 0;
  $('customList').innerHTML = custom.map(r => recipeButton(r, 'custom')).join('');
  $('recipeList').innerHTML = library.slice(0, q ? 120 : 80).map(r => recipeButton(r, 'library')).join('');
  document.querySelectorAll('.recipe-item').forEach(button => {
    button.onclick = () => {
      const type = button.dataset.type;
      const id = button.dataset.id;
      const recipe = type === 'custom' ? state.customRecipes.find(r => r.id === id) : state.recipes.find(r => r.name === id);
      if (recipe) selectRecipe(recipe, type);
    };
  });
}
function recipeButton(recipe, type) {
  const id = type === 'custom' ? recipe.id : recipe.name;
  const active = state.selected && state.selectedType === type && (type === 'custom' ? state.selected.id === recipe.id : state.selected.name === recipe.name);
  return `<button class="recipe-item ${active ? 'active' : ''}" data-type="${type}" data-id="${esc(id)}"><strong>${esc(recipe.name)}</strong><small>${esc(type === 'custom' ? 'My recipe' : (recipe.category || recipe.method || 'Cocktail'))}</small></button>`;
}
function selectRecipe(recipe, type) {
  state.selected = recipe; state.selectedType = type; state.plan = null;
  $('emptyState').hidden = true; $('batchWorkspace').hidden = false; $('results').hidden = true;
  $('recipeCategory').textContent = type === 'custom' ? 'MY RECIPE' : (recipe.category || 'RECIPE');
  $('recipeName').textContent = recipe.name;
  $('recipeDetails').textContent = [recipe.method, recipe.glass, recipe.ice, recipe.garnish ? `Garnish: ${recipe.garnish}` : ''].filter(Boolean).join(' · ');
  $('editCustom').hidden = type !== 'custom';
  $('sourceRecipe').innerHTML = (recipe.ingredients || []).map(i => `<span><strong>${esc(i.amount || '—')}</strong> ${esc(i.ingredient)}</span>`).join('');
  renderRecipeLists();
}
function batchPayload() {
  return { plannedPours: Number($('plannedPours').value || 0), overagePct: Number($('overage').value || 0), dilutionPct: Number($('dilution').value || 0), bottleSizeMl: Number($('bottleSize').value || 750), vesselSize: Number($('vesselSize').value || 12), vesselUnit: $('vesselUnit').value, maxFillPct: 90 };
}
async function calculateBatch() {
  if (!state.selected) return;
  const button = $('calculate'); button.disabled = true; button.textContent = 'Calculating…';
  try {
    const path = state.selectedType === 'custom' ? '/api/custom/batch' : '/api/batch';
    const body = state.selectedType === 'custom' ? { ...batchPayload(), recipe: state.selected } : { ...batchPayload(), recipeName: state.selected.name };
    const plan = await api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    state.plan = plan; renderPlan(plan);
  } catch (error) { window.alert(`Could not calculate batch: ${error.message}`); }
  finally { button.disabled = false; button.textContent = 'Calculate batch'; }
}
function renderPlan(plan) {
  $('results').hidden = false;
  $('summaryPours').textContent = fmt(plan.summary.plannedPours, 0);
  $('summaryYield').textContent = `${fmt(plan.summary.finalLiters)} L`;
  $('summaryWater').textContent = `${fmt(plan.summary.dilutionLiters)} L`;
  $('summaryVessels').textContent = fmt(plan.summary.vesselCount, 0);
  $('batchIngredients').innerHTML = plan.ingredients.length ? plan.ingredients.map(i => `<tr><td><strong>${esc(i.ingredient)}</strong></td><td>${fmt(i.perDrinkOz, 3)} oz</td><td>${fmt(i.totalLiters)} L</td><td>${i.bottlesToBuy} × ${fmt(i.bottleSizeMl, 0)} mL</td></tr>`).join('') : '<tr><td colspan="4">No liquid ingredients could be calculated.</td></tr>';
  const prep = plan.prepItems || [];
  $('prepSection').hidden = prep.length === 0;
  $('prepItems').innerHTML = prep.map(i => `<div class="simple-item"><span>${esc(i.ingredient)}</span><strong>${i.totalQuantity != null ? `${fmt(i.totalQuantity,1)} ${esc(i.unit)}` : esc(i.amount || 'Manual')}</strong></div>`).join('');
  const warnings = plan.warnings || [];
  $('warningSection').hidden = warnings.length === 0;
  $('warnings').innerHTML = warnings.map(i => `<div>${esc(i.ingredient)}: ${esc(i.note)}</div>`).join('');
  $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function copyBatch() {
  if (!state.plan) return;
  const p = state.plan;
  const lines = [`BATCH OS — ${p.recipe.name}`, `${p.summary.plannedPours} drinks`, `Final volume: ${fmt(p.summary.finalLiters)} L`, `Dilution water: ${fmt(p.summary.dilutionLiters)} L`, '', ...p.ingredients.map(i => `${i.ingredient}: ${fmt(i.totalLiters)} L — ${i.bottlesToBuy} × ${fmt(i.bottleSizeMl, 0)} mL`), ...(p.prepItems?.length ? ['', 'Prep separately:', ...p.prepItems.map(i => `${i.ingredient}: ${i.totalQuantity != null ? `${fmt(i.totalQuantity,1)} ${i.unit}` : (i.amount || 'manual')}`)] : [])];
  navigator.clipboard.writeText(lines.join('\n')).then(() => { $('copyBatch').textContent = 'Copied'; setTimeout(() => $('copyBatch').textContent = 'Copy batch', 1200); });
}
function newIngredientRow(data = {}) {
  const row = document.createElement('div'); row.className = 'ingredient-row';
  row.innerHTML = `<input class="field amount" type="text" placeholder="2" value="${esc(data.amountValue || '')}"><select class="field unit">${['oz','mL','dash','piece','slice','sprig'].map(unit => `<option value="${unit}" ${data.unit === unit ? 'selected' : ''}>${unit}</option>`).join('')}</select><input class="field ingredient" type="text" placeholder="Ingredient" value="${esc(data.ingredient || '')}"><button class="remove-row" type="button" aria-label="Remove ingredient">×</button>`;
  row.querySelector('.remove-row').onclick = () => { if ($('ingredientRows').children.length > 1) row.remove(); };
  $('ingredientRows').appendChild(row);
}
function resetRecipeForm(recipe = null) {
  $('recipeForm').reset(); $('ingredientRows').innerHTML = ''; state.editingId = recipe?.id || null;
  $('createHeading').textContent = recipe ? 'Edit recipe.' : 'Create a recipe.';
  $('customName').value = recipe?.name || ''; $('customMethod').value = recipe?.method || ''; $('customGlass').value = recipe?.glass || ''; $('customIce').value = recipe?.ice || ''; $('customGarnish').value = recipe?.garnish || '';
  const ingredients = recipe?.ingredients?.length ? recipe.ingredients : [{}, {}, {}];
  ingredients.forEach(item => {
    const match = String(item.amount || '').match(/^\s*(.*?)\s+(oz|ml|mL|dash|piece|slice|sprig)s?\s*$/i);
    newIngredientRow({ amountValue: match ? match[1] : String(item.amount || '').replace(/\s*(oz|ml|dash|piece|slice|sprig)s?\s*$/i, ''), unit: match ? (match[2].toLowerCase() === 'ml' ? 'mL' : match[2].toLowerCase()) : 'oz', ingredient: item.ingredient || '' });
  });
}
function recipeFromForm() {
  const ingredients = [...document.querySelectorAll('.ingredient-row')].map(row => { const amount = row.querySelector('.amount').value.trim(); const unit = row.querySelector('.unit').value; const ingredient = row.querySelector('.ingredient').value.trim(); return { amount: amount ? `${amount} ${unit}` : unit, ingredient }; }).filter(i => i.ingredient);
  return { id: state.editingId || (crypto.randomUUID ? crypto.randomUUID() : `recipe-${Date.now()}`), name: $('customName').value.trim(), category: 'Original', method: $('customMethod').value.trim(), glass: $('customGlass').value.trim(), ice: $('customIce').value.trim(), garnish: $('customGarnish').value.trim(), ingredients };
}
async function saveRecipe(event) {
  event.preventDefault(); const recipe = recipeFromForm();
  try {
    const validation = await api('/api/custom/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recipe }) });
    if (!validation.validForBatching) { window.alert('Add at least one liquid ingredient measured in oz or mL.'); return; }
    const index = state.customRecipes.findIndex(r => r.id === recipe.id);
    if (index >= 0) state.customRecipes[index] = recipe; else state.customRecipes.unshift(recipe);
    persistCustomRecipes(); state.editingId = null; setView('recipes'); renderRecipeLists(); selectRecipe(recipe, 'custom');
  } catch (error) { window.alert(`Could not save recipe: ${error.message}`); }
}
function editSelectedRecipe() { if (state.selectedType !== 'custom' || !state.selected) return; resetRecipeForm(state.selected); setView('create'); }

document.querySelectorAll('.nav-button').forEach(button => button.onclick = () => setView(button.dataset.view));
$('newRecipeShortcut').onclick = () => { state.editingId = null; setView('create'); };
$('backToRecipes').onclick = () => setView('recipes'); $('cancelRecipe').onclick = () => setView('recipes');
$('search').oninput = renderRecipeLists; $('calculate').onclick = calculateBatch; $('copyBatch').onclick = copyBatch; $('printBatch').onclick = () => window.print(); $('editCustom').onclick = editSelectedRecipe; $('addIngredient').onclick = () => newIngredientRow({}); $('recipeForm').onsubmit = saveRecipe;
resetRecipeForm(); loadRecipes();

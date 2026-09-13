const API=String(window.BATCH_OS_CONFIG?.apiBase||'').replace(/\/$/,'');
const $=id=>document.getElementById(id);
const state={mode:'event',recipes:[],filtered:[],selected:null,singlePlan:null,eventMenu:[],eventPlan:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=2)=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:d});
const vol=l=>Number(l)>=1?`${fmt(l)} L`:`${fmt(Number(l||0)*33.814)} oz`;
const money=n=>n==null?'—':fmt(n,2);

async function api(path,opts){
  const r=await fetch(`${API}${path}`,opts);
  if(!r.ok){const body=await r.json().catch(()=>({}));throw new Error(body.message||body.error||`HTTP ${r.status}`)}
  return r.json();
}

async function load(){
  try{
    const d=await api('/api/recipes');
    state.recipes=d.recipes;state.filtered=d.recipes;
    $('recipeCount').textContent=d.totalCount;
    $('status').textContent=`API online · ${d.totalCount} recipes · v0.2`;
    [...new Set(d.recipes.map(r=>r.category).filter(Boolean))].sort().forEach(v=>$('category').insertAdjacentHTML('beforeend',`<option>${esc(v)}</option>`));
    renderList();
  }catch(e){$('status').textContent=`API unavailable · ${e.message}`}
}

function recipeIsActive(r){
  if(state.mode==='event')return state.eventMenu.some(m=>m.recipeName===r.name);
  return state.selected?.name===r.name;
}

function renderList(){
  const q=$('search').value.trim().toLowerCase(),cat=$('category').value;
  state.filtered=state.recipes.filter(r=>(!q||[r.name,r.category,r.method,...(r.ingredients||[]).map(i=>i.ingredient)].join(' ').toLowerCase().includes(q))&&(!cat||r.category===cat));
  $('recipeList').innerHTML=state.filtered.map((r,i)=>`<button class="recipe-item ${recipeIsActive(r)?'active':''}" data-i="${i}"><strong>${esc(r.name)}</strong><span>${esc(r.category||'—')} · ${esc(r.method||'—')}</span></button>`).join('');
  document.querySelectorAll('.recipe-item').forEach(b=>b.onclick=()=>handleRecipeClick(state.filtered[Number(b.dataset.i)]));
}

function setMode(mode){
  state.mode=mode;
  $('eventMode').classList.toggle('active',mode==='event');
  $('singleMode').classList.toggle('active',mode==='single');
  $('eventPlanner').hidden=mode!=='event';
  $('singlePlanner').hidden=mode!=='single';
  $('libraryHint').textContent=mode==='event'?'Select cocktails to add them to the event menu.':'Select a cocktail to build one production batch.';
  renderList();
}

function handleRecipeClick(r){
  if(state.mode==='event')addEventRecipe(r);
  else selectSingle(r);
}

function rebalanceMenu(){
  const n=state.eventMenu.length;if(!n)return;
  const base=Math.floor((100/n)*100)/100;
  let used=0;
  state.eventMenu.forEach((m,i)=>{m.sharePct=i===n-1?Math.round((100-used)*100)/100:base;used+=m.sharePct});
}

function addEventRecipe(r){
  if(state.eventMenu.some(m=>m.recipeName===r.name))return;
  if(state.eventMenu.length>=6){alert('The beta event builder supports up to 6 cocktails per event menu.');return}
  state.eventMenu.push({recipeName:r.name,category:r.category||'',method:r.method||'',sharePct:0,dilutionPct:+$('eventDilution').value||20});
  rebalanceMenu();renderEventMenu();renderList();
}

function removeEventRecipe(index){
  state.eventMenu.splice(index,1);rebalanceMenu();renderEventMenu();renderList();$('eventResults').hidden=true;state.eventPlan=null;
}

function allocationTotal(){return state.eventMenu.reduce((s,m)=>s+(Number(m.sharePct)||0),0)}
function updateAllocationBadge(){
  const total=allocationTotal();$('allocationTotal').textContent=`${fmt(total)}%`;
  $('allocationTotal').classList.toggle('good',Math.abs(total-100)<=0.05&&state.eventMenu.length>0);
  $('allocationTotal').classList.toggle('bad',Math.abs(total-100)>0.05||state.eventMenu.length===0);
}

function renderEventMenu(){
  if(!state.eventMenu.length){$('eventMenu').innerHTML='<div class="empty-small">Choose cocktails from the library.</div>';updateAllocationBadge();return}
  $('eventMenu').innerHTML=state.eventMenu.map((m,i)=>`<div class="menu-row" data-menu-index="${i}">
    <div class="menu-info"><h4>${esc(m.recipeName)}</h4><p>${esc(m.category||'Cocktail')} · ${esc(m.method||'—')}</p></div>
    <label>Allocation %<input class="input menu-share" type="number" min="0" max="100" step="0.01" value="${m.sharePct}" data-i="${i}"></label>
    <label>Dilution %<input class="input menu-dilution" type="number" min="0" max="100" step="1" value="${m.dilutionPct}" data-i="${i}"></label>
    <button class="button danger small menu-remove" data-i="${i}">Remove</button>
  </div>`).join('');
  document.querySelectorAll('.menu-share').forEach(el=>el.oninput=()=>{state.eventMenu[+el.dataset.i].sharePct=+el.value||0;updateAllocationBadge()});
  document.querySelectorAll('.menu-dilution').forEach(el=>el.oninput=()=>{state.eventMenu[+el.dataset.i].dilutionPct=+el.value||0});
  document.querySelectorAll('.menu-remove').forEach(el=>el.onclick=()=>removeEventRecipe(+el.dataset.i));
  updateAllocationBadge();
}

function collectPurchaseRules(){
  const rules={};
  document.querySelectorAll('#eventPurchasing tr[data-key]').forEach(row=>{
    const key=decodeURIComponent(row.dataset.key);
    rules[key]={
      onHandMl:+row.querySelector('.purchase-onhand').value||0,
      packageSizeMl:+row.querySelector('.purchase-package').value||750,
      unitCost:row.querySelector('.purchase-cost').value===''?null:+row.querySelector('.purchase-cost').value
    };
  });
  return rules;
}

function eventPayload(includePurchaseRules=false){
  return{
    eventName:$('eventName').value.trim(),
    guests:+$('eventGuests').value,
    drinksPerGuest:+$('eventDrinks').value,
    overagePct:+$('eventOverage').value,
    dilutionPct:+$('eventDilution').value,
    bottleSizeMl:+$('eventBottle').value,
    vesselSize:+$('eventVessel').value,
    vesselUnit:$('eventVesselUnit').value,
    maxFillPct:+$('eventMaxFill').value,
    menu:state.eventMenu.map(m=>({recipeName:m.recipeName,sharePct:+m.sharePct,dilutionPct:+m.dilutionPct})),
    purchaseRules:includePurchaseRules?collectPurchaseRules():{}
  }
}

async function generateEvent(includePurchaseRules=false){
  if(!state.eventMenu.length){alert('Add at least one cocktail to the event menu.');return}
  if(Math.abs(allocationTotal()-100)>0.05){alert(`Menu allocation must total 100%. Current total: ${fmt(allocationTotal())}%.`);return}
  const b=includePurchaseRules?$('recalcPurchasing'):$('generateEvent');
  const old=b.textContent;b.disabled=true;b.textContent=includePurchaseRules?'Recalculating…':'Generating…';
  try{
    const p=await api('/api/events/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(eventPayload(includePurchaseRules))});
    state.eventPlan=p;renderEventPlan(p);$('eventResults').hidden=false;
  }catch(e){alert(`Event plan failed: ${e.message}`)}finally{b.disabled=false;b.textContent=old}
}

function renderEventPlan(p){
  $('eventMenuCount').textContent=p.event.menuCount;
  $('eventPours').textContent=fmt(p.summary.plannedPours,0);
  $('eventYield').textContent=vol(p.summary.finalLiters);
  $('eventVessels').textContent=fmt(p.summary.totalVessels,0);
  $('eventUnits').textContent=fmt(p.summary.purchaseUnits,0);
  $('eventCogs').innerHTML=p.summary.estimatedCOGS==null?'—':`${money(p.summary.estimatedCOGS)}${p.summary.cogsComplete?'':'<span class="cogs-incomplete">partial pricing</span>'}`;

  $('eventCocktails').innerHTML=p.cocktails.map(c=>`<tr><td><strong>${esc(c.recipe.name)}</strong><br><span class="muted">${esc(c.recipe.method||'—')}</span></td><td>${fmt(c.sharePct)}%</td><td>${fmt(c.summary.plannedPours,0)}</td><td>${vol(c.summary.finalLiters)}</td><td>${c.summary.vesselCount} × ${fmt(c.summary.vesselLiters)} L</td></tr>`).join('');

  $('eventPurchasing').innerHTML=p.consolidatedPurchasing.map(i=>`<tr data-key="${encodeURIComponent(i.canonicalName)}"><td><strong>${esc(i.ingredient)}</strong><br><span class="muted">${esc(i.cocktails.join(', '))}</span></td><td>${fmt(i.requiredLiters)} L</td><td><input class="input purchase-onhand" type="number" min="0" step="1" value="${i.onHandMl}"></td><td><input class="input purchase-package" type="number" min="50" step="1" value="${i.packageSizeMl}"></td><td><input class="input purchase-cost money" type="number" min="0" step="0.01" value="${i.unitCost??''}" placeholder="—"></td><td><strong>${i.packagesToBuy}</strong></td><td class="money">${i.estimatedCost==null?'—':money(i.estimatedCost)}</td></tr>`).join('')||'<tr><td colspan="7">No safely normalized liquid purchase lines.</td></tr>';

  const prep=[...p.prepRequirements.map(i=>`<div class="note ${i.status==='review'?'warn':''}"><strong>${esc(i.ingredient)}</strong> · ${fmt(i.totalQuantity,1)} ${esc(i.unit)}<br><span class="muted">${esc(i.cocktails.join(', '))} · ${esc(i.note)}</span></div>`),...p.manualPrep.map(i=>`<div class="note ${i.status==='review'?'warn':''}"><strong>${esc(i.cocktail)} — ${esc(i.ingredient)}</strong> · ${esc(i.amount||'manual')}<br><span class="muted">${esc(i.note||'Manual prep/service confirmation required.')}</span></div>` )];
  $('eventPrep').innerHTML=prep.join('')||'<div class="note">No separate prep items detected.</div>';

  $('eventWarnings').innerHTML=p.warnings.map(i=>`<div class="note warn"><strong>${esc(i.cocktail)} — ${esc(i.ingredient)}</strong> · ${esc(i.amount||'—')}<br>${esc(i.note)}</div>`).join('')||'<div class="note goodnote">No source-data warnings detected in this menu.</div>';

  $('eventVesselAssignments').innerHTML=p.cocktails.flatMap(c=>c.vesselAssignments.map(v=>`<div class="vessel-card"><strong>${esc(c.recipe.name)} · Vessel ${v.vesselNumber}/${c.vesselAssignments.length}</strong><span>${fmt(v.targetFillLiters)} L target fill · ${fmt(v.capacityLiters)} L capacity</span><span>${fmt(v.fillPct,1)}% fill · ${fmt(v.headspacePct,1)}% headspace</span><div class="fillbar"><i style="width:${Math.min(100,v.fillPct)}%"></i></div></div>`)).join('')||'<div class="note">No vessel assignments generated.</div>';

  $('eventLabels').innerHTML=p.batchLabels.map(l=>`<div class="batch-label"><strong class="label-title">${esc(l.cocktail)}</strong><span>BATCH ${l.batchNumber} OF ${l.batchCount}</span><span>Fill to ${fmt(l.targetFillLiters)} L in ${fmt(l.vesselCapacityLiters)} L vessel</span><span>${fmt(l.dilutionPct)}% dilution · ${esc(l.service||'Service spec')}</span><span>Garnish: ${esc(l.garnish||'—')}</span></div>`).join('')||'<div class="note">No labels generated.</div>';
}

function copyEventPacket(){
  const p=state.eventPlan;if(!p)return;
  const lines=[`BATCH OS — ${p.event.name}`,`${p.event.guests} guests · ${p.event.drinksPerGuest} drinks/guest · ${p.summary.plannedPours} planned pours`,`${fmt(p.summary.finalLiters)} L final production · ${p.summary.totalVessels} vessels`,'','COCKTAIL PRODUCTION',...p.cocktails.map(c=>`${c.recipe.name}: ${c.summary.plannedPours} pours · ${fmt(c.summary.finalLiters)} L · ${c.summary.vesselCount} vessels`),'','PURCHASING',...p.consolidatedPurchasing.map(i=>`${i.ingredient}: ${fmt(i.requiredLiters)} L required · buy ${i.packagesToBuy} × ${fmt(i.packageSizeMl)} mL${i.estimatedCost==null?'':` · cost ${money(i.estimatedCost)}`}`),'','PREP',...p.prepRequirements.map(i=>`${i.ingredient}: ${fmt(i.totalQuantity,1)} ${i.unit}`),...p.manualPrep.map(i=>`${i.cocktail} — ${i.ingredient}: ${i.amount||'manual'}`)];
  navigator.clipboard.writeText(lines.join('\n')).then(()=>{$('copyEvent').textContent='Copied';setTimeout(()=>$('copyEvent').textContent='Copy packet',1200)});
}

function selectSingle(r){
  state.selected=r;state.singlePlan=null;
  $('singleEmpty').hidden=true;$('singleWorkspace').hidden=false;$('singleResults').hidden=true;
  $('recipeMeta').textContent=r.category||'COCKTAIL';$('recipeName').textContent=r.name;$('recipeService').textContent=`${r.method||'—'} · ${r.glass||'—'} · ${r.ice||'—'} · Garnish: ${r.garnish||'—'}`;renderList();
}

function singlePayload(){return{recipeName:state.selected.name,guests:+$('guests').value,drinksPerGuest:+$('drinks').value,menuSharePct:+$('share').value,overagePct:+$('overage').value,dilutionPct:+$('dilution').value,bottleSizeMl:+$('bottle').value,vesselSize:+$('vessel').value,vesselUnit:$('vesselUnit').value,maxFillPct:+$('maxFill').value}}

async function calculateSingle(){
  if(!state.selected)return;
  const b=$('calculate'),old=b.textContent;b.disabled=true;b.textContent='Calculating…';
  try{const p=await api('/api/batch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(singlePayload())});state.singlePlan=p;renderSinglePlan(p)}catch(e){alert(`Batch calculation failed: ${e.message}`)}finally{b.disabled=false;b.textContent=old}
}

function renderSinglePlan(p){
  $('singleResults').hidden=false;$('pours').textContent=fmt(p.summary.plannedPours,0);$('base').textContent=vol(p.summary.baseLiters);$('water').textContent=vol(p.summary.dilutionLiters);$('yield').textContent=vol(p.summary.finalLiters);$('vessels').textContent=`${p.summary.vesselCount} × ${fmt(p.summary.vesselLiters)} L`;
  $('ingredients').innerHTML=p.ingredients.map(i=>`<tr><td><strong>${esc(i.ingredient)}</strong></td><td>${fmt(i.perDrinkOz)} oz</td><td>${fmt(i.totalLiters)} L</td><td>${i.bottlesToBuy} × ${fmt(i.bottleSizeMl)} mL</td></tr>`).join('')||'<tr><td colspan="4">No safely batchable liquid ingredients.</td></tr>';
  $('prep').innerHTML=p.prepItems.map(i=>`<div class="note ${i.status==='review'?'warn':''}"><strong>${esc(i.ingredient)}</strong> · ${i.scaledQuantity==null?esc(i.amount||'manual'):`${fmt(i.scaledQuantity,1)} ${esc(i.unit)}`}<br><span class="muted">${esc(i.note||'Prep separately.')}</span></div>`).join('')||'<div class="note">No separate prep items detected.</div>';
  $('warnings').innerHTML=p.warnings.map(i=>`<div class="note warn"><strong>${esc(i.ingredient)}</strong> · ${esc(i.amount||'—')}<br>${esc(i.note)}</div>`).join('')||'<div class="note goodnote">No source-data warnings detected.</div>';
}

function copySingle(){
  const p=state.singlePlan;if(!p)return;
  const lines=[`BATCH OS — ${p.recipe.name}`,`${p.summary.plannedPours} pours · ${fmt(p.summary.finalLiters)} L final yield`,...p.ingredients.map(i=>`${i.ingredient}: ${fmt(i.totalLiters)} L (${i.bottlesToBuy} × ${fmt(i.bottleSizeMl)} mL bottles)`),`Dilution water: ${fmt(p.summary.dilutionLiters)} L`,`Vessels: ${p.summary.vesselCount} × ${fmt(p.summary.vesselLiters)} L · max ${p.summary.maxFillPct}% fill`,`Service: ${p.recipe.method} · ${p.recipe.glass} · ${p.recipe.ice} · ${p.recipe.garnish}`];
  navigator.clipboard.writeText(lines.join('\n')).then(()=>{$('copy').textContent='Copied';setTimeout(()=>$('copy').textContent='Copy',1200)});
}

$('search').oninput=renderList;$('category').onchange=renderList;
$('eventMode').onclick=()=>setMode('event');$('singleMode').onclick=()=>setMode('single');
$('generateEvent').onclick=()=>generateEvent(false);$('recalcPurchasing').onclick=()=>generateEvent(true);$('copyEvent').onclick=copyEventPacket;$('eventPrint').onclick=()=>window.print();
$('calculate').onclick=calculateSingle;$('copy').onclick=copySingle;$('singlePrint').onclick=()=>window.print();
$('eventDilution').onchange=()=>{const d=+$('eventDilution').value||0;state.eventMenu.forEach(m=>m.dilutionPct=d);renderEventMenu()};
renderEventMenu();load();

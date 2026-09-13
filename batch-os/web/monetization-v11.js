(() => {
  const API_BASE = String(window.BATCH_OS_CONFIG?.apiBase || '').replace(/\/$/, '');
  const LEGACY_USE_KEY = 'batch-os-free-batches-v1';
  const purchaseReturn = new URLSearchParams(location.search).get('purchase') === 'success';
  let access = {
    paid:false,
    tier:'trial',
    freeBatchLimit:5,
    freeBatchesUsed:0,
    freeBatchesRemaining:5,
    foundingPriceUsd:19,
    regularPriceUsd:29,
    checkoutUrl:null,
    requiresAccountForCalculation:true
  };
  let pendingCheckout = false;
  let pendingCalculation = false;
  let lastIdentity = '';

  // The browser is no longer authoritative for trial usage. Remove the old beta counter.
  try { localStorage.removeItem(LEGACY_USE_KEY); } catch {}

  const left = () => Math.max(0, Number(access.freeBatchesRemaining ?? access.freeBatchLimit ?? 5));
  const authHeaders = () => (typeof state !== 'undefined' && state.token ? { Authorization:`Bearer ${state.token}` } : {});

  async function refreshAccess(){
    try {
      const r = await fetch(`${API_BASE}/api/access`, {headers:authHeaders(), cache:'no-store'});
      if (r.ok) access = {...access, ...(await r.json())};
    } catch {}
    updateUI();
    return access;
  }

  function styles(){
    const s=document.createElement('style');
    s.textContent=`.access-status{display:flex;align-items:center;gap:8px;margin:12px 0 0;font-size:11px;color:#71717a;font-weight:700}.access-dot{width:7px;height:7px;border-radius:50%;background:#f97316}.access-status.paid{color:#18181b}.access-status.paid .access-dot{background:#18181b}.access-upgrade{border:0;background:transparent;color:#f97316;font:inherit;font-weight:800;cursor:pointer;padding:0}.paywall-dialog{border:0;padding:0;background:transparent;max-width:none}.paywall-dialog::backdrop{background:rgba(24,24,27,.46)}.paywall-card{width:min(520px,calc(100vw - 32px));background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:30px;box-shadow:0 20px 70px rgba(0,0,0,.15)}.paywall-top{display:flex;justify-content:space-between;gap:20px}.paywall-kicker{margin:0 0 8px;color:#f97316;font-size:10px;font-weight:900;letter-spacing:.13em}.paywall-card h2{font-size:30px;letter-spacing:-.035em;line-height:1.08;margin:0 0 12px}.paywall-lead{margin:0;color:#52525b;line-height:1.55}.paywall-price{display:flex;align-items:baseline;gap:8px;margin:26px 0 5px}.paywall-price strong{font-size:42px;letter-spacing:-.04em}.paywall-price span,.paywall-regular,.paywall-note{color:#71717a;font-size:12px}.paywall-list{display:grid;gap:10px;margin:22px 0 26px;padding:0;list-style:none}.paywall-list li{font-size:13px;padding-left:20px;position:relative}.paywall-list li:before{content:'✓';position:absolute;left:0;color:#f97316;font-weight:900}.paywall-actions{display:grid;gap:9px}.paywall-buy{height:48px}.paywall-note{text-align:center;margin:3px 0 0}.paywall-close{border:0;background:transparent;color:#a1a1aa;font-size:25px;line-height:1;cursor:pointer}.founding-strip{display:inline-flex;margin:18px 0 0;border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800}.access-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000;background:#18181b;color:#fff;border-radius:10px;padding:12px 16px;font-size:13px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.18)}.account-access-row{border:1px solid #e4e4e7;border-radius:8px;padding:12px 13px;font-size:12px}.account-access-row strong{display:block;margin-bottom:4px}.account-access-row span{color:#71717a}.account-upgrade-button{width:100%}@media(max-width:640px){.paywall-card{padding:24px}.paywall-card h2{font-size:27px}}`;
    document.head.appendChild(s);
  }

  function build(){
    if(document.getElementById('paywallDialog')) return;
    const d=document.createElement('dialog'); d.id='paywallDialog'; d.className='paywall-dialog';
    d.innerHTML=`<div class="paywall-card"><div class="paywall-top"><div><p class="paywall-kicker">BATCH OS FOUNDING ACCESS</p><h2 id="paywallTitle">Keep batching without limits.</h2></div><button id="paywallClose" class="paywall-close" type="button">×</button></div><p id="paywallLead" class="paywall-lead">Your first 5 batches are free. Unlock Batch OS permanently.</p><div class="paywall-price"><strong id="paywallPrice">$19</strong><span>one time</span></div><div id="paywallRegular" class="paywall-regular">Founding price · Regular price $29</div><ul class="paywall-list"><li>Unlimited batch calculations</li><li>Cloud-saved custom recipes</li><li>Batch history and production memory</li><li>Cross-device access</li><li>Permanent access — no subscription</li></ul><div class="paywall-actions"><button id="paywallBuy" class="primary-button paywall-buy" type="button">Unlock Batch OS — $19</button><p class="paywall-note">One payment. No recurring subscription.</p></div></div>`;
    document.body.appendChild(d);
    document.getElementById('paywallClose').onclick=()=>d.close();
    document.getElementById('paywallBuy').onclick=beginCheckout;
  }

  function toast(msg,ms=2800){
    document.querySelector('.access-toast')?.remove();
    const t=document.createElement('div');
    t.className='access-toast';
    t.textContent=msg;
    document.body.appendChild(t);
    setTimeout(()=>t.remove(),ms);
  }

  function openPaywall(){
    build();
    const exhausted=left()<=0;
    document.getElementById('paywallTitle').textContent=exhausted?`You've used your ${access.freeBatchLimit||5} free batches.`:'Keep batching without limits.';
    document.getElementById('paywallLead').textContent=exhausted
      ? 'Unlock permanent Batch OS access to keep calculating batches and add cloud storage, history, and production memory.'
      : `You have ${left()} free batch${left()===1?'':'es'} remaining on your Batch OS account. Unlock now for permanent access.`;
    document.getElementById('paywallPrice').textContent=`$${access.foundingPriceUsd||19}`;
    document.getElementById('paywallRegular').textContent=`Founding price · Regular price $${access.regularPriceUsd||29}`;
    document.getElementById('paywallBuy').textContent=`Unlock Batch OS — $${access.foundingPriceUsd||19}`;
    document.getElementById('paywallDialog').showModal();
  }

  async function beginCheckout(){
    await refreshAccess();
    if(access.paid){
      document.getElementById('paywallDialog')?.close();
      toast('Batch OS is already unlocked on this account.');
      return;
    }
    if(typeof state==='undefined'||!state.user){
      pendingCheckout=true;
      document.getElementById('paywallDialog')?.close();
      toast('Create or sign in to your Batch OS account to unlock permanent access.');
      document.getElementById('accountButton')?.click();
      return;
    }
    if(!access.checkoutUrl){alert('Checkout is temporarily unavailable. Please try again.');return}
    const u=new URL(access.checkoutUrl);
    if(state.user?.email) u.searchParams.set('prefilled_email',state.user.email);
    location.href=u.toString();
  }

  function ensureStatus(){
    if(document.getElementById('accessStatus')) return;
    const c=document.querySelector('.controls');
    if(!c)return;
    const r=document.createElement('div');
    r.id='accessStatus';
    r.className='access-status';
    c.insertAdjacentElement('afterend',r);
  }

  function updateUI(){
    ensureStatus();
    const row=document.getElementById('accessStatus');
    const signedIn=typeof state!=='undefined'&&Boolean(state.user);
    if(row){
      if(access.paid){
        row.className='access-status paid';
        row.innerHTML='<span class="access-dot"></span><span>Founding Access · Unlimited batches</span>';
      } else if(!signedIn){
        row.className='access-status';
        row.innerHTML=`<span class="access-dot"></span><span>${access.freeBatchLimit||5} free batches with a free account</span>`;
      } else {
        row.className='access-status';
        row.innerHTML=`<span class="access-dot"></span><span>${left()} of ${access.freeBatchLimit||5} free batches left</span>${left()===0?'<button class="access-upgrade" type="button">Unlock</button>':''}`;
        row.querySelector('.access-upgrade')?.addEventListener('click',openPaywall);
      }
    }

    const hero=document.querySelector('.about-hero');
    if(hero&&!hero.querySelector('.founding-strip')){
      const x=document.createElement('div');
      x.className='founding-strip';
      x.textContent=`5 batches free · $${access.foundingPriceUsd||19} once for Founding Access · No subscription`;
      hero.querySelector('.about-actions')?.insertAdjacentElement('beforebegin',x);
    }

    const menu=document.querySelector('.account-menu-card');
    if(menu){
      menu.querySelector('.account-access-row')?.remove();
      menu.querySelector('.account-upgrade-button')?.remove();
      const x=document.createElement('div');
      x.className='account-access-row';
      x.innerHTML=access.paid
        ? '<strong>Founding Access</strong><span>Permanent access · Unlimited batches</span>'
        : `<strong>Free trial</strong><span>${left()} of ${access.freeBatchLimit||5} batch${(access.freeBatchLimit||5)===1?'':'es'} remaining</span>`;
      menu.querySelector('.account-summary')?.insertAdjacentElement('afterend',x);
      if(!access.paid){
        const b=document.createElement('button');
        b.type='button';
        b.className='primary-button account-upgrade-button';
        b.textContent=`Unlock for $${access.foundingPriceUsd||19}`;
        b.onclick=()=>{document.getElementById('accountMenuDialog')?.close();openPaywall()};
        x.insertAdjacentElement('afterend',b);
      }
    }
  }

  function wrapCalculator(){
    const b=document.getElementById('calculate');
    if(!b||b.dataset.serverMeterWrapped==='1')return;
    const original=b.onclick;
    b.dataset.serverMeterWrapped='1';
    b.onclick=async e=>{
      await refreshAccess();
      if(access.paid){
        await original?.call(b,e);
        await refreshAccess();
        return;
      }
      if(typeof state==='undefined'||!state.user){
        pendingCalculation=true;
        toast(`Create or sign in to use your ${access.freeBatchLimit||5} free batch calculations.`);
        document.getElementById('accountButton')?.click();
        return;
      }
      if(left()<=0){openPaywall();return}
      const prior=state.plan;
      await original?.call(b,e);
      await refreshAccess();
      if(state.plan&&state.plan!==prior&&left()<=0){setTimeout(openPaywall,900)}
    };
  }

  function wrapRecipeSaving(){
    const f=document.getElementById('recipeForm');
    if(!f||f.dataset.paywallWrapped==='1')return;
    const original=f.onsubmit;
    f.dataset.paywallWrapped='1';
    f.onsubmit=async e=>{
      if(access.paid||typeof state==='undefined'||!state.user)return original?.call(f,e);
      const user=state.user;
      state.user=null;
      try{return await original?.call(f,e)}
      finally{state.user=user;typeof updateAccountUI==='function'&&updateAccountUI()}
    };
  }

  function wrapSaveBatch(){
    const b=document.getElementById('saveBatch');
    if(!b||b.dataset.paywallWrapped==='1')return;
    const original=b.onclick;
    b.dataset.paywallWrapped='1';
    b.onclick=e=>{if(!access.paid){openPaywall();return}return original?.call(b,e)};
  }

  async function purchaseReturnFlow(){
    if(!purchaseReturn)return;
    toast('Payment received. Finalizing your Batch OS access…',5000);
    for(let i=0;i<12;i++){
      await refreshAccess();
      if(access.paid){
        const u=new URL(location.href);
        u.searchParams.delete('purchase');
        u.searchParams.delete('session_id');
        history.replaceState({},'',u.pathname+u.search+u.hash);
        toast('Batch OS unlocked. Welcome to Founding Access.',4500);
        return;
      }
      await new Promise(r=>setTimeout(r,1250));
    }
    openPaywall();
  }

  async function watch(){
    const id=typeof state!=='undefined'?`${state.user?.email||''}|${state.token||''}`:'';
    if(id===lastIdentity)return;
    lastIdentity=id;
    await refreshAccess();
    if(pendingCheckout&&state.user&&!access.paid){
      pendingCheckout=false;
      beginCheckout();
      return;
    }
    if(pendingCalculation&&state.user){
      pendingCalculation=false;
      setTimeout(()=>document.getElementById('calculate')?.click(),150);
    }
  }

  styles();
  build();
  wrapCalculator();
  wrapRecipeSaving();
  wrapSaveBatch();
  refreshAccess().then(()=>{updateUI();purchaseReturnFlow()});
  setInterval(watch,800);
  setInterval(()=>{wrapCalculator();wrapRecipeSaving();wrapSaveBatch()},1500);
})();

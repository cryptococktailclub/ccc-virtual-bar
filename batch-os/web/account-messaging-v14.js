(() => {
  let upgradeRequested = new URLSearchParams(location.search).get('upgrade') === 'founding';
  let upgradePromptedSignedOut = false;

  function installConsent() {
    const form = document.getElementById('accountForm');
    const password = document.getElementById('accountPassword');
    if (!form || !password || document.getElementById('cccNewsletterOptIn')) return;

    const block = document.createElement('label');
    block.className = 'batch-marketing-consent';
    block.innerHTML = `
      <input id="cccNewsletterOptIn" type="checkbox">
      <span><strong>Optional:</strong> Send me occasional cocktail recipes, bar tools, and updates from Crypto Cocktail Club.</span>`;
    password.closest('label')?.insertAdjacentElement('afterend', block);

    const privacy = document.createElement('p');
    privacy.className = 'muted small batch-email-purpose';
    privacy.textContent = 'Your Batch OS email is used for your account and service messages. The Crypto Cocktail Club newsletter is separate and optional.';
    block.insertAdjacentElement('afterend', privacy);
  }

  function installStyles() {
    if (document.getElementById('batchMessagingStyles')) return;
    const style = document.createElement('style');
    style.id = 'batchMessagingStyles';
    style.textContent = `
      .batch-marketing-consent{display:flex!important;align-items:flex-start;gap:10px;margin:4px 0 0;padding:11px 12px;border:1px solid #e4e4e7;border-radius:8px;cursor:pointer}
      .batch-marketing-consent input{margin-top:2px;accent-color:#f97316}
      .batch-marketing-consent span{font-size:12px;line-height:1.45;color:#52525b}
      .batch-marketing-consent strong{color:#18181b}
      .batch-email-purpose{margin:7px 0 2px;line-height:1.45}
    `;
    document.head.appendChild(style);
  }

  function wrapAuth() {
    if (typeof handleAuth !== 'function' || handleAuth.__batchMessagingWrapped) return;
    const original = handleAuth;
    const wrapped = async function(mode) {
      if (mode !== 'register') return original(mode);
      const email = $('accountEmail').value.trim();
      const password = $('accountPassword').value;
      $('accountError').hidden = true;
      try {
        const data = await api('/api/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            cccNewsletterOptIn: Boolean(document.getElementById('cccNewsletterOptIn')?.checked)
          })
        });
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
    };
    wrapped.__batchMessagingWrapped = true;
    handleAuth = wrapped;
  }

  function maybeOpenUpgrade() {
    if (!upgradeRequested) return;
    if (typeof state === 'undefined') return;

    if (!state.user) {
      if (!upgradePromptedSignedOut && document.getElementById('accountButton')) {
        upgradePromptedSignedOut = true;
        document.getElementById('accountButton').click();
      }
      return;
    }

    const accountButton = document.getElementById('accountButton');
    if (!accountButton) return;
    const menu = document.getElementById('accountMenuDialog');
    if (!menu?.open) accountButton.click();
    setTimeout(() => {
      const upgrade = document.querySelector('.account-upgrade-button');
      if (upgrade) {
        upgradeRequested = false;
        const url = new URL(location.href);
        url.searchParams.delete('upgrade');
        history.replaceState({}, '', url.pathname + url.search + url.hash);
        upgrade.click();
      }
    }, 200);
  }

  installStyles();
  installConsent();
  wrapAuth();
  setInterval(() => {
    installConsent();
    wrapAuth();
    maybeOpenUpgrade();
  }, 500);
})();

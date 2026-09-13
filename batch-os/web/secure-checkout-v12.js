(() => {
  const API_BASE = String(window.BATCH_OS_CONFIG?.apiBase || '').replace(/\/$/, '');
  let pendingCheckout = false;
  let checkoutInFlight = false;

  const authHeaders = () => (typeof state !== 'undefined' && state.token
    ? { Authorization: `Bearer ${state.token}` }
    : {});

  function toast(message, ms = 3200) {
    document.querySelector('.secure-checkout-toast')?.remove();
    const node = document.createElement('div');
    node.className = 'access-toast secure-checkout-toast';
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), ms);
  }

  async function beginSecureCheckout() {
    if (checkoutInFlight) return;

    if (typeof state === 'undefined' || !state.user || !state.token) {
      pendingCheckout = true;
      toast('Sign in or create your Batch OS account to continue to checkout.');
      document.getElementById('paywallDialog')?.close();
      document.getElementById('accountButton')?.click();
      return;
    }

    checkoutInFlight = true;
    try {
      const response = await fetch(`${API_BASE}/api/checkout-link`, {
        method: 'GET',
        headers: authHeaders(),
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 409 && data.code === 'already_unlocked') {
        toast('Batch OS is already unlocked on this account.');
        document.getElementById('paywallDialog')?.close();
        return;
      }

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.message || 'Checkout is temporarily unavailable.');
      }

      const checkout = new URL(data.checkoutUrl);
      if (!checkout.searchParams.get('client_reference_id')) {
        throw new Error('Secure account reference was not attached to checkout.');
      }

      window.location.assign(checkout.toString());
    } catch (error) {
      alert(error.message || 'Checkout is temporarily unavailable. Please try again.');
    } finally {
      checkoutInFlight = false;
    }
  }

  // Intercept the v0.11 Payment Link handler before it reaches the button target.
  // The only checkout path is now the authenticated server-generated handoff above.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#paywallBuy');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    beginSecureCheckout();
  }, true);

  setInterval(() => {
    if (!pendingCheckout) return;
    if (typeof state === 'undefined' || !state.user || !state.token) return;
    pendingCheckout = false;
    beginSecureCheckout();
  }, 500);
})();

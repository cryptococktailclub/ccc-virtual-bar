window.BATCH_OS_CONFIG = {
  apiBase: 'https://batch-os-api-beta-934t.onrender.com'
};

window.addEventListener('DOMContentLoaded', () => {
  if (!document.querySelector('script[data-batch-secure-checkout]')) {
    const script = document.createElement('script');
    script.src = 'secure-checkout-v12.js?v=12';
    script.dataset.batchSecureCheckout = 'true';
    document.body.appendChild(script);
  }

  if (!document.querySelector('script[data-batch-recipe-suggestions]')) {
    const script = document.createElement('script');
    script.src = 'recipe-suggestions-v13.js?v=13';
    script.dataset.batchRecipeSuggestions = 'true';
    document.body.appendChild(script);
  }
});

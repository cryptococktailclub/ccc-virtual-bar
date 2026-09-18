const batchOsHost = window.location.hostname.toLowerCase();
const batchOsProductionHost = batchOsHost === 'batch-os.com' || batchOsHost === 'www.batch-os.com';

// Keep the production web app on the proven Render API origin while the branded
// api.batch-os.com edge/DNS path is validated independently.
window.BATCH_OS_CONFIG = {
  apiBase: 'https://batch-os-api-beta-934t.onrender.com',
  productionHost: batchOsProductionHost,
  brandedApiBase: 'https://api.batch-os.com'
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

  if (!document.querySelector('script[data-batch-account-messaging]')) {
    const script = document.createElement('script');
    script.src = 'account-messaging-v14.js?v=14';
    script.dataset.batchAccountMessaging = 'true';
    document.body.appendChild(script);
  }
});

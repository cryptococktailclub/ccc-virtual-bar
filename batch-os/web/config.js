window.BATCH_OS_CONFIG = {
  apiBase: 'https://batch-os-api-beta-934t.onrender.com'
};

window.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('script[data-batch-secure-checkout]')) return;
  const script = document.createElement('script');
  script.src = 'secure-checkout-v12.js?v=12';
  script.dataset.batchSecureCheckout = 'true';
  document.body.appendChild(script);
});

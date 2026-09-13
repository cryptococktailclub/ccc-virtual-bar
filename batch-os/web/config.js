window.BATCH_OS_CONFIG = {
  apiBase: 'https://batch-os-api-beta.onrender.com'
};

window.addEventListener('load', () => {
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'styles-v07.css';
  document.head.appendChild(style);

  const script = document.createElement('script');
  script.src = 'navigation-v07.js';
  document.body.appendChild(script);
});

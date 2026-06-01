/**
 * Main frontend JS — handles form submission and SSE progress
 */

const STEP_LABELS = {
  web: '🌐 Analizando sitio web...',
  seo: '🔍 Revisando visibilidad en Google...',
  facebook: '📘 Revisando Facebook...',
  instagram: '📷 Revisando Instagram...',
  tiktok: '🎵 Revisando TikTok...',
  linkedin: '💼 Revisando LinkedIn...',
  youtube: '▶️ Revisando YouTube...',
};

const form = document.getElementById('auditForm');
const submitBtn = document.getElementById('submitBtn');
const overlay = document.getElementById('progressOverlay');
const stepsContainer = document.getElementById('progressSteps');
const formError = document.getElementById('formError');

const stepEls = {};

function addStep(name) {
  const label = STEP_LABELS[name] || name;
  const el = document.createElement('div');
  el.className = 'progress-step';
  el.id = `step-${name}`;
  el.innerHTML = `<span class="step-icon">⏳</span><span>${label}</span>`;
  stepsContainer.appendChild(el);
  stepEls[name] = el;
}

function updateStep(name, status) {
  const el = stepEls[name] || document.getElementById(`step-${name}`);
  if (!el) return;
  if (status === 'done') {
    el.className = 'progress-step done';
    el.querySelector('.step-icon').textContent = '✅';
  } else if (status === 'running') {
    el.className = 'progress-step running';
    el.querySelector('.step-icon').textContent = '🔄';
  } else if (status === 'error') {
    el.className = 'progress-step';
    el.querySelector('.step-icon').textContent = '⚠️';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.style.display = 'none';

  const businessName = document.getElementById('businessName').value.trim();
  const websiteUrl = document.getElementById('websiteUrl').value.trim();
  const socialUrls = {
    facebook: document.getElementById('facebook').value.trim() || null,
    instagram: document.getElementById('instagram').value.trim() || null,
    tiktok: document.getElementById('tiktok').value.trim() || null,
    linkedin: document.getElementById('linkedin').value.trim() || null,
    youtube: document.getElementById('youtube').value.trim() || null,
  };

  if (!businessName || !websiteUrl) {
    formError.textContent = 'Por favor completa los campos obligatorios.';
    formError.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  document.getElementById('btnText').textContent = 'Iniciando análisis...';

  // Set up progress steps
  stepsContainer.innerHTML = '';
  Object.keys(stepEls).forEach(k => delete stepEls[k]);
  addStep('web');
  addStep('seo');
  for (const [k, v] of Object.entries(socialUrls)) {
    if (v) addStep(k);
  }

  overlay.classList.add('active');

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName, websiteUrl, socialUrls }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar análisis');

    const { jobId } = data;
    listenProgress(jobId);
  } catch (err) {
    overlay.classList.remove('active');
    submitBtn.disabled = false;
    document.getElementById('btnText').textContent = 'Generar diagnóstico gratis';
    formError.textContent = err.message;
    formError.style.display = 'block';
  }
});

function listenProgress(jobId) {
  const evtSource = new EventSource(`/api/progress/${jobId}`);

  evtSource.addEventListener('progress', (e) => {
    const { step, status } = JSON.parse(e.data);
    updateStep(step, status);
  });

  evtSource.addEventListener('done', (e) => {
    evtSource.close();
    const { reportId } = JSON.parse(e.data);
    window.location.href = `/report/${reportId}`;
  });

  evtSource.addEventListener('error', (e) => {
    evtSource.close();
    let msg = 'El análisis encontró un problema. Por favor intenta nuevamente.';
    try { msg = JSON.parse(e.data).message || msg; } catch {}
    overlay.classList.remove('active');
    submitBtn.disabled = false;
    document.getElementById('btnText').textContent = 'Generar diagnóstico gratis';
    formError.textContent = msg;
    formError.style.display = 'block';
  });
}

/**
 * Main frontend JS — two-step lead form + SSE progress
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
const nextBtn = document.getElementById('nextBtn');
const backBtn = document.getElementById('backBtn');
const overlay = document.getElementById('progressOverlay');
const stepsContainer = document.getElementById('progressSteps');
const formError = document.getElementById('formError');
const step1Error = document.getElementById('step1Error');

const stepEls = {};

// ── Step navigation ──
nextBtn.addEventListener('click', () => {
  step1Error.style.display = 'none';

  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const companyName = document.getElementById('companyName').value.trim();
  const productService = document.getElementById('productService').value.trim();

  if (!fullName || !email || !phone || !companyName || !productService) {
    step1Error.textContent = 'Por favor completa todos los campos obligatorios.';
    step1Error.style.display = 'block';
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    step1Error.textContent = 'Por favor ingresa un email válido.';
    step1Error.style.display = 'block';
    return;
  }

  // Go to step 2
  document.getElementById('step1').classList.remove('active');
  document.getElementById('step2').classList.add('active');
  document.getElementById('dot1').classList.remove('active');
  document.getElementById('dot1').classList.add('done');
  document.getElementById('dot1').textContent = '✓';
  document.getElementById('line1').classList.add('done');
  document.getElementById('dot2').classList.add('active');
});

backBtn.addEventListener('click', () => {
  document.getElementById('step2').classList.remove('active');
  document.getElementById('step1').classList.add('active');
  document.getElementById('dot1').classList.remove('done');
  document.getElementById('dot1').classList.add('active');
  document.getElementById('dot1').textContent = '1';
  document.getElementById('line1').classList.remove('done');
  document.getElementById('dot2').classList.remove('active');
  formError.style.display = 'none';
});

// ── Progress steps ──
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

// ── Form submit ──
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.style.display = 'none';

  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();
  const phonePrefix = document.getElementById('phonePrefix').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const companyName = document.getElementById('companyName').value.trim();
  const productService = document.getElementById('productService').value.trim();

  const websiteUrl = document.getElementById('websiteUrl').value.trim() || null;
  const facebook = document.getElementById('facebook').value.trim() || null;
  const instagram = document.getElementById('instagram').value.trim() || null;
  const tiktok = document.getElementById('tiktok').value.trim() || null;
  const linkedin = document.getElementById('linkedin').value.trim() || null;

  // Validate at least one URL
  if (!websiteUrl && !facebook && !instagram && !tiktok && !linkedin) {
    formError.textContent = 'Debes ingresar al menos un link (web o red social) para continuar.';
    formError.style.display = 'block';
    return;
  }

  const socialUrls = { facebook, instagram, tiktok, linkedin };

  submitBtn.disabled = true;
  document.getElementById('btnText').textContent = 'Iniciando análisis...';

  // Set up progress steps
  stepsContainer.innerHTML = '';
  Object.keys(stepEls).forEach(k => delete stepEls[k]);
  if (websiteUrl) { addStep('web'); addStep('seo'); }
  for (const [k, v] of Object.entries(socialUrls)) {
    if (v) addStep(k);
  }

  overlay.classList.add('active');

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName,
        email,
        phone: `${phonePrefix} ${phone}`,
        companyName,
        productService,
        businessName: companyName,
        websiteUrl: websiteUrl || '',
        socialUrls,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar análisis');

    const { jobId } = data;
    listenProgress(jobId);
  } catch (err) {
    overlay.classList.remove('active');
    submitBtn.disabled = false;
    document.getElementById('btnText').textContent = 'Obtener mi diagnóstico gratuito 🎁';
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
    document.getElementById('btnText').textContent = 'Obtener mi diagnóstico gratuito 🎁';
    formError.textContent = msg;
    formError.style.display = 'block';
  });
}

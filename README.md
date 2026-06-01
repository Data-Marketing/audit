# Diagnóstico Digital Heros

Herramienta SaaS para auditar la presencia digital de un negocio: sitio web, Google, y redes sociales. Genera un informe visual con puntuaciones, hallazgos críticos y recomendaciones en lenguaje de negocio (sin tecnicismos).

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) (gratis)
- Cuenta en [Vercel](https://vercel.com) (gratis o Pro)

## Instalación local

```bash
git clone https://github.com/juanalbertoq/audit.git
cd audit
npm install
cp .env.example .env
# Completa las variables en .env
vercel dev
```

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `SUPABASE_URL` | ✅ | URL de tu proyecto Supabase |
| `SUPABASE_ANON_KEY` | ✅ | Clave anon de Supabase |
| `CTA_LINK` | ✅ | Enlace del botón CTA (WhatsApp, Calendly, etc.) |
| `CTA_NAME` | — | Nombre que aparece en el CTA |
| `AGENCY_NAME` | — | Nombre de la agencia en el footer |
| `AGENCY_URL` | — | URL de la agencia |
| `GOOGLE_PLACES_API_KEY` | — | Activa rating y reseñas de Google Maps |
| `PAGESPEED_API_KEY` | — | Aumenta el límite de PageSpeed Insights |
| `YOUTUBE_API_KEY` | — | Activa métricas de YouTube |
| `OPENAI_API_KEY` | — | Activa diagnóstico IA con GPT-4o mini |
| `ANTHROPIC_API_KEY` | — | Activa diagnóstico IA con Claude |
| `DEEPSEEK_API_KEY` | — | Activa diagnóstico IA con DeepSeek |

## Collectors: qué funciona sin API keys

| Collector | Sin keys | Con keys |
|---|---|---|
| **Sitio web** | ✅ Velocidad, mobile, WhatsApp, formulario, tracking, chat | — |
| **Google PageSpeed** | ✅ (límite bajo ~400 req/día) | ✅ Sin límite con `PAGESPEED_API_KEY` |
| **Google Maps / Places** | ❌ No disponible | ✅ Rating, reseñas, ficha verificada |
| **Indexación Google** | ✅ Detección básica por fetch | — |
| **Facebook** | ✅ Playwright scraping | — |
| **Instagram** | ✅ Playwright scraping | — |
| **TikTok** | ✅ Playwright scraping | — |
| **LinkedIn** | ✅ Playwright scraping | — |
| **YouTube** | ❌ No disponible | ✅ Con `YOUTUBE_API_KEY` |
| **Diagnóstico IA** | ❌ No disponible | ✅ OpenAI / Anthropic / DeepSeek |

## Schema de Supabase

Ejecuta este SQL en el editor de Supabase:

```sql
create table reports (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  website_url text not null,
  social_urls jsonb,
  raw_data jsonb,
  scores jsonb,
  interpreted jsonb,
  ai_diagnosis jsonb,
  global_score numeric,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Índice para queries por status
create index reports_status_idx on reports(status);
create index reports_created_at_idx on reports(created_at desc);
```

## Deploy en Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

Configura todas las variables de entorno en el dashboard de Vercel: **Settings → Environment Variables**.

### Subdominio personalizado

En Vercel: **Settings → Domains** → agrega tu dominio (ej. `diagnostico.tuagencia.com`).

Configura un CNAME en tu DNS apuntando a `cname.vercel-dns.com`.

## Rutas

| Ruta | Descripción |
|---|---|
| `/` | Formulario de ingreso |
| `/report/:id` | Informe para el cliente |
| `/report-internal/:id` | Vista interna con datos crudos |
| `POST /api/analyze` | Inicia análisis (máx 5/hora/IP) |
| `GET /api/progress/:jobId` | SSE stream de progreso |
| `GET /api/report/:reportId` | JSON del reporte |
| `GET /api/export/pdf/:reportId` | Descarga PDF |

## Sistema de puntuación

| Área | Peso global |
|---|---|
| Sitio web | 25% |
| Visibilidad Google | 25% |
| Redes sociales (promedio) | 50% |

**Semáforo**: 80–100 verde · 60–79 amarillo · 0–59 rojo

---

Hecho con ❤️ por [Heros Digital](https://herosdigital.com)

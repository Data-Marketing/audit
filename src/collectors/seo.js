/**
 * SEO collector — PageSpeed Insights + Google Places + indexación básica
 */

async function collectSeo(websiteUrl) {
  const url = new URL(websiteUrl);
  const domain = url.hostname.replace(/^www\./, '');

  const results = {
    status: 'ok',
    pagespeed: null,
    places: null,
    indexed: null,
  };

  // ── PageSpeed Insights ──────────────────────────────────────────────────
  try {
    const apiKey = process.env.PAGESPEED_API_KEY;
    const psUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    psUrl.searchParams.set('url', websiteUrl);
    psUrl.searchParams.set('strategy', 'mobile');
    if (apiKey) psUrl.searchParams.set('key', apiKey);

    const psRes = await fetch(psUrl.toString(), { signal: AbortSignal.timeout(25000) });
    if (psRes.ok) {
      const data = await psRes.json();
      const cats = data.lighthouseResult?.categories;
      const audits = data.lighthouseResult?.audits;
      results.pagespeed = {
        score: Math.round((cats?.performance?.score ?? 0) * 100),
        fcp: audits?.['first-contentful-paint']?.displayValue ?? null,
        lcp: audits?.['largest-contentful-paint']?.displayValue ?? null,
      };
    } else {
      results.pagespeed = { status: 'no_disponible', reason: `HTTP ${psRes.status}` };
    }
  } catch (err) {
    results.pagespeed = { status: 'no_disponible', reason: err.message };
  }

  // ── Google Places ───────────────────────────────────────────────────────
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  if (placesKey) {
    try {
      const findUrl = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
      findUrl.searchParams.set('input', domain);
      findUrl.searchParams.set('inputtype', 'textquery');
      findUrl.searchParams.set('fields', 'place_id');
      findUrl.searchParams.set('key', placesKey);

      const findRes = await fetch(findUrl.toString(), { signal: AbortSignal.timeout(10000) });
      const findData = await findRes.json();
      const placeId = findData.candidates?.[0]?.place_id;

      if (placeId) {
        const detailUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
        detailUrl.searchParams.set('place_id', placeId);
        detailUrl.searchParams.set('fields', 'name,rating,user_ratings_total,business_status');
        detailUrl.searchParams.set('key', placesKey);
        const detailRes = await fetch(detailUrl.toString(), { signal: AbortSignal.timeout(10000) });
        const detailData = await detailRes.json();
        const r = detailData.result;
        results.places = {
          found: true,
          rating: r?.rating ?? null,
          totalReviews: r?.user_ratings_total ?? 0,
          claimed: r?.business_status === 'OPERATIONAL',
        };
      } else {
        results.places = { found: false };
      }
    } catch (err) {
      results.places = { status: 'no_disponible', reason: err.message };
    }
  } else {
    results.places = { status: 'no_disponible', reason: 'GOOGLE_PLACES_API_KEY no configurada' };
  }

  // ── Indexación básica ───────────────────────────────────────────────────
  try {
    const searchUrl = `https://www.google.com/search?q=site:${domain}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    // If Google returns results, the site is indexed
    const indexed =
      !text.includes('did not match any documents') &&
      !text.includes('no coincide con ningún documento') &&
      text.includes(domain);
    results.indexed = { indexed };
  } catch (err) {
    results.indexed = { status: 'no_disponible', reason: err.message };
  }

  return results;
}

module.exports = { collectSeo };

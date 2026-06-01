/**
 * YouTube collector — YouTube Data API v3 (si hay key), sino no_disponible
 */

async function collectYoutube(channelUrl) {
  if (!channelUrl) return { status: 'no_disponible', reason: 'URL no proporcionada' };

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return {
      status: 'no_disponible',
      reason: 'YOUTUBE_API_KEY no configurada — actívala para ver métricas de YouTube',
    };
  }

  try {
    // Extract channel handle or ID from URL
    const handle = extractHandle(channelUrl);
    if (!handle) return { status: 'no_disponible', reason: 'No se pudo extraer el canal de la URL' };

    // Search for channel
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', handle);
    searchUrl.searchParams.set('type', 'channel');
    searchUrl.searchParams.set('maxResults', '1');
    searchUrl.searchParams.set('key', apiKey);

    const searchRes = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(10000) });
    const searchData = await searchRes.json();
    const channelId = searchData.items?.[0]?.id?.channelId;
    if (!channelId) return { status: 'no_disponible', reason: 'Canal no encontrado' };

    // Get channel stats
    const statsUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
    statsUrl.searchParams.set('part', 'statistics,snippet');
    statsUrl.searchParams.set('id', channelId);
    statsUrl.searchParams.set('key', apiKey);

    const statsRes = await fetch(statsUrl.toString(), { signal: AbortSignal.timeout(10000) });
    const statsData = await statsRes.json();
    const ch = statsData.items?.[0];
    if (!ch) return { status: 'no_disponible', reason: 'Datos de canal no disponibles' };

    const stats = ch.statistics;

    // Get latest video
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    videosUrl.searchParams.set('part', 'snippet');
    videosUrl.searchParams.set('channelId', channelId);
    videosUrl.searchParams.set('order', 'date');
    videosUrl.searchParams.set('maxResults', '5');
    videosUrl.searchParams.set('type', 'video');
    videosUrl.searchParams.set('key', apiKey);

    const videosRes = await fetch(videosUrl.toString(), { signal: AbortSignal.timeout(10000) });
    const videosData = await videosRes.json();
    const latestVideo = videosData.items?.[0];

    let lastPostDays = null;
    if (latestVideo?.snippet?.publishedAt) {
      const published = new Date(latestVideo.snippet.publishedAt);
      lastPostDays = Math.floor((Date.now() - published.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Frequency estimate from 5 latest videos
    let frequencyPerWeek = null;
    if (videosData.items?.length >= 2) {
      const oldest = new Date(videosData.items[videosData.items.length - 1].snippet.publishedAt);
      const newest = new Date(videosData.items[0].snippet.publishedAt);
      const days = (newest - oldest) / (1000 * 60 * 60 * 24);
      if (days > 0) {
        frequencyPerWeek = ((videosData.items.length / days) * 7).toFixed(1);
      }
    }

    return {
      status: 'ok',
      subscribers: parseInt(stats.subscriberCount || '0'),
      totalVideos: parseInt(stats.videoCount || '0'),
      totalViews: parseInt(stats.viewCount || '0'),
      lastVideoTitle: latestVideo?.snippet?.title ?? null,
      lastPostDays,
      frequencyPerWeek,
      hasVideo: true,
      hasProfilePhoto: true,
      hasBio: !!ch.snippet?.description,
      hasLink: true,
      followers: parseInt(stats.subscriberCount || '0'),
    };
  } catch (err) {
    return { status: 'no_disponible', reason: err.message };
  }
}

function extractHandle(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    // e.g. /channel/UCxxx, /@handle, /user/name, /c/name
    const idx = parts.findIndex(p => ['channel', 'user', 'c'].includes(p));
    if (idx >= 0) return parts[idx + 1];
    if (parts[0]?.startsWith('@')) return parts[0];
    return parts[0] || u.hostname;
  } catch {
    return url;
  }
}

module.exports = { collectYoutube };

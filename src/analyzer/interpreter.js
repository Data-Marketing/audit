/**
 * Interpreter — traduce métricas técnicas a lenguaje de negocio
 */

function interpretWeb(web, scores) {
  if (!web || web.status === 'no_disponible') {
    return { available: false, indicators: [], criticalFindings: [] };
  }

  const indicators = [];
  const criticalFindings = [];

  const loadSec = parseFloat(web.loadTimeSec || 0);
  indicators.push({
    nombre: 'Velocidad de carga',
    valorMedido: `${loadSec}s`,
    interpretacion: loadSec < 2
      ? 'Tu sitio carga muy rápido. Los visitantes no esperan y es más probable que se queden.'
      : loadSec < 4
        ? 'Tu sitio tarda un poco en cargar. Podrías estar perdiendo clientes impacientes.'
        : 'Tu sitio carga lento. Muchos visitantes lo abandonan antes de ver tu contenido.',
    estado: loadSec < 2 ? 'bueno' : loadSec < 4 ? 'regular' : 'critico',
  });

  if (loadSec >= 4) {
    criticalFindings.push({ area: 'Sitio web', hallazgo: 'Tu sitio tarda más de 4 segundos en cargar. La mayoría de visitantes se va antes de ver tu oferta.', severidad: 3 });
  }

  indicators.push({
    nombre: 'Adaptado a celulares',
    valorMedido: web.mobileOk ? 'Sí' : 'No',
    interpretacion: web.mobileOk
      ? 'Tu sitio se ve bien en celulares, donde está la mayoría de tus clientes potenciales.'
      : 'Tu sitio no funciona bien en celulares. Estás perdiendo a la mayoría de tus visitantes.',
    estado: web.mobileOk ? 'bueno' : 'critico',
  });

  if (!web.mobileOk) {
    criticalFindings.push({ area: 'Sitio web', hallazgo: 'Tu sitio no está optimizado para celulares. Más del 70% de tus potenciales clientes navegan desde el teléfono.', severidad: 3 });
  }

  indicators.push({
    nombre: 'Botón de WhatsApp',
    valorMedido: web.hasWhatsapp ? 'Presente' : 'Ausente',
    interpretacion: web.hasWhatsapp
      ? 'Los visitantes pueden contactarte directo por WhatsApp desde tu sitio.'
      : 'No hay botón de WhatsApp. Estás dificultando que los clientes se comuniquen contigo.',
    estado: web.hasWhatsapp ? 'bueno' : 'regular',
  });

  if (!web.hasWhatsapp) {
    criticalFindings.push({ area: 'Sitio web', hallazgo: 'Tu sitio no tiene botón de WhatsApp. Muchos clientes prefieren este canal para contactar antes de comprar.', severidad: 2 });
  }

  indicators.push({
    nombre: 'Formulario de contacto',
    valorMedido: web.hasForm ? 'Presente' : 'Ausente',
    interpretacion: web.hasForm
      ? 'Los clientes tienen una manera formal de dejarte sus datos desde el sitio.'
      : 'Sin formulario, los clientes interesados no tienen forma fácil de pedirte información.',
    estado: web.hasForm ? 'bueno' : 'regular',
  });

  indicators.push({
    nombre: 'Medición de resultados',
    valorMedido: web.hasTracking ? 'Activa' : 'No configurada',
    interpretacion: web.hasTracking
      ? 'Tienes herramientas para saber cuántos visitan tu sitio y qué hacen.'
      : 'No tienes herramientas de medición. No sabes cuántos clientes potenciales visitan tu sitio ni de dónde vienen.',
    estado: web.hasTracking ? 'bueno' : 'critico',
  });

  if (!web.hasTracking) {
    criticalFindings.push({ area: 'Sitio web', hallazgo: 'No estás midiendo los resultados de tu sitio web. Sin datos, no puedes mejorar ni justificar tu inversión en marketing.', severidad: 3 });
  }

  indicators.push({
    nombre: 'Atención en vivo',
    valorMedido: web.hasChat ? 'Disponible' : 'No disponible',
    interpretacion: web.hasChat
      ? 'Tienes un chat en vivo para atender preguntas en tiempo real y convertir más visitas en ventas.'
      : 'Sin chat en vivo, los visitantes con dudas suelen irse sin comprar.',
    estado: web.hasChat ? 'bueno' : 'regular',
  });

  return { available: true, indicators, criticalFindings };
}

function interpretGoogle(seo, scores) {
  if (!seo || seo.status === 'no_disponible') {
    return { available: false, indicators: [], criticalFindings: [] };
  }

  const indicators = [];
  const criticalFindings = [];

  indicators.push({
    nombre: 'Apareces en Google',
    valorMedido: seo.indexed?.indexed ? 'Sí' : 'No',
    interpretacion: seo.indexed?.indexed
      ? 'Tu negocio aparece en búsquedas de Google. Los clientes pueden encontrarte.'
      : 'Tu negocio no aparece en Google. Estás invisible para clientes que buscan lo que ofreces.',
    estado: seo.indexed?.indexed ? 'bueno' : 'critico',
  });

  if (!seo.indexed?.indexed) {
    criticalFindings.push({ area: 'Google', hallazgo: 'Tu negocio no aparece en Google. Estás perdiendo todos los clientes que buscan tus servicios en línea.', severidad: 3 });
  }

  if (seo.places?.status !== 'no_disponible') {
    indicators.push({
      nombre: 'Ficha en Google Maps',
      valorMedido: seo.places?.found ? 'Activa' : 'No encontrada',
      interpretacion: seo.places?.found
        ? 'Tienes presencia en Google Maps. Los clientes locales pueden encontrarte fácilmente.'
        : 'No tienes ficha en Google Maps. Estás perdiendo clientes que buscan negocios cercanos.',
      estado: seo.places?.found ? 'bueno' : 'critico',
    });

    if (!seo.places?.found) {
      criticalFindings.push({ area: 'Google', hallazgo: 'No tienes ficha en Google Maps. Los clientes locales no pueden encontrar tu negocio cuando buscan servicios cercanos.', severidad: 3 });
    }

    if (seo.places?.found && seo.places?.rating) {
      const rating = seo.places.rating;
      const reviews = seo.places.totalReviews;

      indicators.push({
        nombre: 'Reputación online',
        valorMedido: `${rating} ⭐ (${reviews} reseñas)`,
        interpretacion: rating >= 4.2
          ? `Con ${rating} estrellas, tu negocio genera mucha confianza en nuevos clientes.`
          : rating >= 3.5
            ? `Tu calificación de ${rating} estrellas es aceptable, pero hay margen para mejorar la confianza.`
            : `Una calificación de ${rating} estrellas aleja a clientes potenciales que prefieren negocios mejor valorados.`,
        estado: rating >= 4.2 ? 'bueno' : rating >= 3.5 ? 'regular' : 'critico',
      });

      indicators.push({
        nombre: 'Cantidad de reseñas',
        valorMedido: `${reviews} reseñas`,
        interpretacion: reviews >= 50
          ? `Con ${reviews} reseñas, generas suficiente confianza social para atraer nuevos clientes.`
          : reviews >= 10
            ? `Tienes ${reviews} reseñas. Conseguir más reseñas positivas aumentará tu visibilidad y confianza.`
            : `Solo ${reviews} reseñas es muy poco. Los clientes buscan negocios con muchas reseñas para confiar.`,
        estado: reviews >= 50 ? 'bueno' : reviews >= 10 ? 'regular' : 'critico',
      });

      if (reviews < 10) {
        criticalFindings.push({ area: 'Google', hallazgo: `Tienes solo ${reviews} reseñas en Google. Los negocios con pocas reseñas generan desconfianza y pierden clientes ante la competencia.`, severidad: 2 });
      }
    }
  }

  if (seo.pagespeed && seo.pagespeed.status !== 'no_disponible') {
    const ps = seo.pagespeed.score;
    indicators.push({
      nombre: 'Rendimiento técnico',
      valorMedido: `${ps}/100`,
      interpretacion: ps >= 80
        ? 'Tu sitio tiene un rendimiento técnico excelente, lo que ayuda a posicionarte mejor en Google.'
        : ps >= 50
          ? 'El rendimiento técnico de tu sitio es mejorable. Afecta cómo te posicionas en Google.'
          : 'Tu sitio tiene problemas técnicos que reducen tu posición en Google y alejan visitantes.',
      estado: ps >= 80 ? 'bueno' : ps >= 50 ? 'regular' : 'critico',
    });
  }

  return { available: true, indicators, criticalFindings };
}

function interpretSocial(networkName, data, scores) {
  if (!data || data.status === 'no_disponible') {
    return { available: false, indicators: [], criticalFindings: [] };
  }

  const indicators = [];
  const criticalFindings = [];
  const followers = data.followers ?? data.subscribers ?? 0;

  indicators.push({
    nombre: 'Comunidad',
    valorMedido: followers > 0 ? `${formatNumber(followers)} seguidores` : 'Sin datos',
    interpretacion: followers > 1000
      ? `Tienes una comunidad activa de ${formatNumber(followers)} seguidores en ${networkName}.`
      : followers >= 500
        ? `Tu comunidad de ${formatNumber(followers)} seguidores está creciendo. Hay oportunidad de ampliar tu alcance.`
        : followers > 0
          ? `Tu comunidad de ${formatNumber(followers)} seguidores en ${networkName} es pequeña. Invertir en crecimiento puede atraer más clientes.`
          : `No se pudo determinar el tamaño de tu comunidad en ${networkName}.`,
    estado: followers > 1000 ? 'bueno' : followers >= 500 ? 'regular' : 'critico',
  });

  indicators.push({
    nombre: 'Perfil completo',
    valorMedido: data.hasProfilePhoto && data.hasBio && data.hasLink ? 'Sí' : 'Incompleto',
    interpretacion: data.hasProfilePhoto && data.hasBio && data.hasLink
      ? `Tu perfil de ${networkName} está completo y genera confianza profesional.`
      : `Tu perfil de ${networkName} está incompleto. Un perfil sin foto, descripción o enlace genera desconfianza.`,
    estado: data.hasProfilePhoto && data.hasBio && data.hasLink ? 'bueno' : 'regular',
  });

  if (data.lastPostDays !== null && data.lastPostDays !== undefined) {
    indicators.push({
      nombre: 'Última publicación',
      valorMedido: data.lastPostDays === 0 ? 'Hoy' : `Hace ${data.lastPostDays} días`,
      interpretacion: data.lastPostDays <= 3
        ? 'Publicas con frecuencia. Tu audiencia te ve activo y relevante.'
        : data.lastPostDays <= 7
          ? 'Tu última publicación tiene menos de una semana. Mantener esta frecuencia es importante.'
          : data.lastPostDays <= 14
            ? 'Llevas más de una semana sin publicar. Tu audiencia puede perder interés.'
            : `Llevas ${data.lastPostDays} días sin publicar. Un perfil inactivo aleja seguidores y clientes.`,
      estado: data.lastPostDays <= 3 ? 'bueno' : data.lastPostDays <= 7 ? 'regular' : 'critico',
    });

    if (data.lastPostDays > 14) {
      criticalFindings.push({ area: networkName, hallazgo: `Tu cuenta de ${networkName} lleva ${data.lastPostDays} días sin actividad. Los algoritmos penalizan la inactividad y tus clientes pueden pensar que cerraste.`, severidad: 2 });
    }
  }

  if (data.frequencyPerWeek !== null && data.frequencyPerWeek !== undefined) {
    const freq = parseFloat(data.frequencyPerWeek);
    indicators.push({
      nombre: 'Frecuencia de publicación',
      valorMedido: freq > 0 ? `~${data.frequencyPerWeek} veces/semana` : 'Muy baja',
      interpretacion: freq >= 3
        ? 'Publicas con muy buena frecuencia, lo que mantiene tu marca visible para clientes potenciales.'
        : freq >= 1
          ? 'Tu frecuencia de publicación es moderada. Aumentarla puede mejorar tu alcance significativamente.'
          : 'Publicas muy poco. La falta de contenido regular reduce tu visibilidad frente a competidores.',
      estado: freq >= 3 ? 'bueno' : freq >= 1 ? 'regular' : 'critico',
    });
  }

  indicators.push({
    nombre: 'Contenido en video',
    valorMedido: data.hasVideo ? 'Sí' : 'No',
    interpretacion: data.hasVideo
      ? 'Produces contenido en video, el formato con mayor alcance y engagement en redes sociales.'
      : 'No usas video. El video es el contenido que más alcance tiene en todas las plataformas hoy.',
    estado: data.hasVideo ? 'bueno' : 'regular',
  });

  return { available: true, indicators, criticalFindings };
}

function interpretAll(raw, scores) {
  const webInterp = interpretWeb(raw.web, scores.scores?.web);
  const googleInterp = interpretGoogle(raw.seo, scores.scores?.google);

  const socialNetworks = ['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube'];
  const socialInterps = {};
  for (const net of socialNetworks) {
    if (raw[net]) {
      socialInterps[net] = interpretSocial(capitalize(net), raw[net], scores.scores?.[net]);
    }
  }

  // Gather all critical findings
  const allFindings = [
    ...webInterp.criticalFindings,
    ...googleInterp.criticalFindings,
    ...Object.values(socialInterps).flatMap(s => s.criticalFindings),
  ].sort((a, b) => b.severidad - a.severidad).slice(0, 5);

  return {
    web: webInterp,
    google: googleInterp,
    social: socialInterps,
    criticalFindings: allFindings,
  };
}

function formatNumber(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { interpretAll, interpretWeb, interpretGoogle, interpretSocial };

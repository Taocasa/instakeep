export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  if (!match) return res.status(400).json({ error: 'URL invalide' });
  const postId = match[1];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };

  let thumbnailUrl = null;

  // Essai 1 : API JSON Instagram
  try {
    const jsonResp = await fetch(`https://www.instagram.com/p/${postId}/?__a=1&__d=dis`, {
      headers: { ...headers, 'X-Requested-With': 'XMLHttpRequest' }
    });
    const json = await jsonResp.json();
    const media = json?.items?.[0] || json?.graphql?.shortcode_media;
    if (media) {
      thumbnailUrl = media.image_versions2?.candidates?.[0]?.url
        || media.thumbnail_src
        || media.display_url;
    }
  } catch(e) {}

  // Essai 2 : page mobile embed
  if (!thumbnailUrl) {
    try {
      const embedResp = await fetch(`https://www.instagram.com/p/${postId}/embed/captioned/`, { headers });
      const html = await embedResp.text();
      const patterns = [
        /"display_url":"([^"]+)"/,
        /background-image: url\('([^']+)'\)/,
        /src="(https:\/\/[^"]*(?:cdninstagram|scontent)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/,
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m) { thumbnailUrl = m[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&'); break; }
      }
    } catch(e) {}
  }

  // Essai 3 : og:image page principale avec cookie mobile
  if (!thumbnailUrl) {
    try {
      const resp = await fetch(`https://www.instagram.com/p/${postId}/`, { headers });
      const html = await resp.text();
      const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (m) thumbnailUrl = m[1].replace(/&amp;/g, '&');
    } catch(e) {}
  }

  if (!thumbnailUrl) return res.status(404).json({ error: 'Miniature introuvable' });

  // Proxy l'image en base64
  try {
    const imgResp = await fetch(thumbnailUrl, {
      headers: {
        'User-Agent': headers['User-Agent'],
        'Referer': 'https://www.instagram.com/',
        'Origin': 'https://www.instagram.com',
      }
    });
    if (!imgResp.ok) {
      // Si le téléchargement échoue, retourner l'URL directe
      return res.status(200).json({ thumbnail: thumbnailUrl });
    }
    const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgResp.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return res.status(200).json({ thumbnail: `data:${contentType};base64,${base64}` });
  } catch(e) {
    return res.status(200).json({ thumbnail: thumbnailUrl });
  }
}

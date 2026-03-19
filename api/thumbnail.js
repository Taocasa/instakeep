export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  if (!match) return res.status(400).json({ error: 'URL invalide' });
  const postId = match[1];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7',
    'Cache-Control': 'no-cache',
  };

  let thumbnailUrl = null;

  try {
    const embedResp = await fetch(`https://www.instagram.com/p/${postId}/embed/`, { headers });
    const html = await embedResp.text();
    const patterns = [
      /"display_url":"([^"]+)"/i,
      /src="(https:\/\/[^"]*cdninstagram[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      /<img[^>]+src="(https:\/\/[^"]*scontent[^"]*)"[^>]*>/i,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m) { thumbnailUrl = m[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&'); break; }
    }
  } catch(e) {}

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

  // Proxy l'image directement
  try {
    const imgResp = await fetch(thumbnailUrl, {
      headers: {
        'User-Agent': headers['User-Agent'],
        'Referer': 'https://www.instagram.com/'
      }
    });
    if (!imgResp.ok) return res.status(404).json({ error: 'Image inaccessible' });

    const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgResp.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(Buffer.from(buffer));
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

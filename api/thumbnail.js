export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL manquante' });

  // Extraire le postId de l'URL Instagram
  const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  if (!match) return res.status(400).json({ error: 'URL Instagram invalide' });
  const postId = match[1];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
  };

  // Essai 1 : page embed du post
  try {
    const embedUrl = `https://www.instagram.com/p/${postId}/embed/`;
    const resp = await fetch(embedUrl, { headers });
    const html = await resp.text();

    const patterns = [
      /src="(https:\/\/[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      /"display_url":"([^"]+)"/i,
      /background-image:url\('([^']+)'\)/i,
      /<img[^>]+src="(https:\/\/[^"]*cdninstagram[^"]*)"[^>]*>/i,
    ];

    for (const pattern of patterns) {
      const m = html.match(pattern);
      if (m) {
        const imgUrl = m[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
        return res.status(200).json({ thumbnail: imgUrl });
      }
    }
  } catch (e) {
    console.log('Essai embed échoué:', e.message);
  }

  // Essai 2 : page principale
  try {
    const resp = await fetch(`https://www.instagram.com/p/${postId}/`, { headers });
    const html = await resp.text();

    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    if (m) {
      return res.status(200).json({ thumbnail: m[1].replace(/&amp;/g, '&') });
    }
  } catch (e) {
    console.log('Essai principal échoué:', e.message);
  }

  return res.status(404).json({ error: 'Miniature introuvable' });
}

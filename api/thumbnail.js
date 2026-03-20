export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Paramètre url manquant' });

  const token = process.env.META_TOKEN;
  if (!token) return res.status(500).json({ error: 'Token Meta non configuré sur Vercel' });

  try {
    const oembedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${token}&fields=thumbnail_url,title,author_name`;
    const resp = await fetch(oembedUrl);

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: err.error?.message || 'Erreur oEmbed' });
    }

    const data = await resp.json();
    return res.status(200).json({
      thumbnail: data.thumbnail_url || null,
      title: data.title || null,
      author: data.author_name || null
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

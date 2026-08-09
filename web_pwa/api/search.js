export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  // Invidious instances — called server-side so no CORS issues
  const INSTANCES = [
    'https://invidious.nerdvpn.de',
    'https://inv.tux.pizza',
    'https://invidious.projectsegfau.lt',
    'https://yt.cdaut.de'
  ];

  for (const instance of INSTANCES) {
    try {
      const response = await fetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(q)}&type=video&fields=videoId,title,author,videoThumbnails`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) continue;
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const results = data.slice(0, 20).map(item => ({
          videoId: item.videoId,
          title: item.title,
          artist: item.author,
          thumbnail: `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`
        }));
        return res.json({ results, source: instance });
      }
    } catch (e) {
      console.warn(`Instance ${instance} failed:`, e.message);
    }
  }

  return res.status(404).json({ error: 'No search results found' });
}

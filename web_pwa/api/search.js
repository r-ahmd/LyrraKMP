// Vercel Serverless Function: /api/search?q=QUERY
// Searches YouTube Music via InnerTube — server-side, no CORS!
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  // Try InnerTube YouTube Music search directly (same as Android app)
  try {
    const innertubeRes = await fetch(
      'https://music.youtube.com/youtubei/v1/search?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-KOUX3nOf0',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Origin': 'https://music.youtube.com',
          'Referer': 'https://music.youtube.com/'
        },
        body: JSON.stringify({
          query: q,
          params: 'EgWKAQIIAWoKEAMQBBAJEAUQCg%3D%3D', // Songs filter param
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20240101.01.00',
              hl: 'en',
              gl: 'US'
            }
          }
        })
      }
    );

    const data = await innertubeRes.json();

    // Parse InnerTube search response to extract song results
    const results = [];
    try {
      const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents;

      if (contents) {
        for (const section of contents) {
          const items = section?.musicShelfRenderer?.contents || [];
          for (const item of items) {
            const renderer = item?.musicResponsiveListItemRenderer;
            if (!renderer) continue;

            const videoId = renderer?.overlay?.musicItemThumbnailOverlayRenderer
              ?.content?.musicPlayButtonRenderer?.playNavigationEndpoint
              ?.watchEndpoint?.videoId;

            const title = renderer?.flexColumns?.[0]
              ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;

            const artist = renderer?.flexColumns?.[1]
              ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;

            const thumbnail = renderer?.thumbnail?.musicThumbnailRenderer
              ?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url;

            if (videoId && title) {
              results.push({ videoId, title, artist: artist || '', thumbnail: thumbnail || '' });
            }
            if (results.length >= 20) break;
          }
          if (results.length >= 20) break;
        }
      }
    } catch (parseErr) {
      console.warn('InnerTube response parse error:', parseErr.message);
    }

    if (results.length > 0) {
      return res.json({ results, source: 'innertube' });
    }
  } catch (e) {
    console.warn('InnerTube search failed:', e.message);
  }

  // Fallback: Piped search API
  const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.private.coffee',
    'https://pipedapi.tokhmi.xyz'
  ];

  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await fetch(
        `${instance}/search?q=${encodeURIComponent(q)}&filter=music_songs`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const results = data.items.slice(0, 20).map(item => ({
          videoId: item.url?.replace('/watch?v=', '') || '',
          title: item.title || '',
          artist: item.uploaderName || '',
          thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.url?.replace('/watch?v=', '')}/hqdefault.jpg`
        }));
        return res.json({ results, source: 'piped' });
      }
    } catch (e) {
      console.warn(`Piped search ${instance} failed:`, e.message);
    }
  }

  return res.status(404).json({ error: 'No search results found' });
}

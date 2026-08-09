// Vercel Serverless Function: /api/stream?id=VIDEO_ID
// Calls InnerTube (YouTube Music internal API) server-side — no CORS restrictions!
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video id' });

  // Try InnerTube directly first (same API the Android app uses)
  try {
    const innertubeRes = await fetch(
      'https://music.youtube.com/youtubei/v1/player?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-KOUX3nOf0',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Origin': 'https://music.youtube.com',
          'Referer': 'https://music.youtube.com/',
          'X-Goog-Visitor-Id': 'CgtiZ2NWREJuQ0xhYyiL4fGnBjIKCgJVUxIEGgAgNA%3D%3D'
        },
        body: JSON.stringify({
          videoId: id,
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
    const formats = data?.streamingData?.adaptiveFormats || [];

    // Pick best audio-only stream (same logic as NewPipe extractor in the Android app)
    const audioFormats = formats.filter(f => f.mimeType?.startsWith('audio/') && f.url);
    if (audioFormats.length > 0) {
      // Sort by bitrate descending, pick highest quality
      audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      const best = audioFormats[0];
      return res.json({
        url: best.url,
        mimeType: best.mimeType,
        quality: best.audioQuality,
        source: 'innertube'
      });
    }
  } catch (e) {
    console.warn('InnerTube direct failed:', e.message);
  }

  // Fallback: Piped API proxy instances
  const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.private.coffee',
    'https://pipedapi.tokhmi.xyz',
    'https://piped-api.privacy.com.de'
  ];

  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await fetch(`${instance}/streams/${id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const data = await response.json();

      if (data.audioStreams && data.audioStreams.length > 0) {
        const best = data.audioStreams
          .filter(s => s.url)
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

        return res.json({
          url: best.url,
          mimeType: best.mimeType,
          quality: best.quality,
          source: 'piped'
        });
      }
    } catch (e) {
      console.warn(`Piped instance ${instance} failed:`, e.message);
    }
  }

  return res.status(404).json({ error: 'Could not resolve audio stream' });
}

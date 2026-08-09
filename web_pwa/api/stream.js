import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing video id' });

  try {
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${id}`);
    const formats = ytdl.filterFormats(info.formats, 'audioonly');

    if (!formats || formats.length === 0) {
      return res.status(404).json({ error: 'No audio formats found' });
    }

    // Sort by bitrate, pick highest quality audio
    formats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
    const best = formats[0];

    return res.json({
      url: best.url,
      mimeType: best.mimeType,
      bitrate: best.audioBitrate,
      source: 'ytdl-core'
    });
  } catch (err) {
    console.error('ytdl-core error:', err.message);
    return res.status(500).json({ error: 'Stream extraction failed', detail: err.message });
  }
}

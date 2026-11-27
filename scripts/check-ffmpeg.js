const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  let ffmpegPath = require('ffmpeg-static');
  console.log('ffmpegPath from require:', ffmpegPath);
  if (!fs.existsSync(ffmpegPath)) {
    console.log('binary not found, running install.js...');
    const staticDir = path.dirname(require.resolve('ffmpeg-static/package.json'));
    execSync('node install.js', { cwd: staticDir, stdio: 'inherit' });
    ffmpegPath = require('ffmpeg-static');
  }
  const ver = execSync(`"${ffmpegPath}" -version`).toString().split('\n')[0];
  console.log('FFMPEG Verified:', ver);
} catch (e) {
  console.error('Error:', e.message);
}

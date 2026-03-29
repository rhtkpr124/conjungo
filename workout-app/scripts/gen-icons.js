// Run with: node scripts/gen-icons.js
// Generates placeholder PWA icons as simple SVGs converted to data
const fs = require('fs');
const path = require('path');

// Simple SVG icon - dumbbell on dark background
function generateSVGIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#0a0a0a"/>
  <g transform="translate(${size/2}, ${size/2})" stroke="#4ade80" stroke-width="${size * 0.04}" stroke-linecap="round" fill="none">
    <line x1="${-size*0.25}" y1="0" x2="${size*0.25}" y2="0"/>
    <rect x="${-size*0.3}" y="${-size*0.12}" width="${size*0.08}" height="${size*0.24}" rx="${size*0.02}" fill="#4ade80"/>
    <rect x="${size*0.22}" y="${-size*0.12}" width="${size*0.08}" height="${size*0.24}" rx="${size*0.02}" fill="#4ade80"/>
    <rect x="${-size*0.38}" y="${-size*0.08}" width="${size*0.06}" height="${size*0.16}" rx="${size*0.015}" fill="#4ade80"/>
    <rect x="${size*0.32}" y="${-size*0.08}" width="${size*0.06}" height="${size*0.16}" rx="${size*0.015}" fill="#4ade80"/>
  </g>
</svg>`;
}

// Write SVG files (browsers support SVG icons too, but let's keep PNG reference in manifest)
// For a real app you'd convert to PNG. For now, serve SVGs.
for (const size of [192, 512]) {
  const svg = generateSVGIcon(size);
  fs.writeFileSync(path.join(__dirname, '..', 'public', `icon-${size}.svg`), svg);
  console.log(`Generated icon-${size}.svg`);
}

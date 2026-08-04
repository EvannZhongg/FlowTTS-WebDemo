const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
    'server.js',
    'backend/app.js',
    'backend/data/voices.json',
    'backend/data/voices-flow-01-ex.json',
    'public/app/index.html',
    'public/app/assets/tts-studio.js',
    'public/app/assets/tts-studio.css'
];

const missing = requiredFiles.filter((relativePath) => (
    !fs.existsSync(path.join(root, relativePath))
));

if (missing.length) {
    console.error(`Deployment is missing required files:\n- ${missing.join('\n- ')}`);
    process.exit(1);
}

console.log(`Verified ${requiredFiles.length} deployment files.`);

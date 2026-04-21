const { execSync } = require('child_process');

try {
  execSync('npx netlify-cli build --offline', { stdio: 'inherit' });
} catch (e) {
  console.error(e);
}

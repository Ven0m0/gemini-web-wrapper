const fs = require('fs');
const toml = require('toml');

try {
  const file = fs.readFileSync('./netlify.toml', 'utf-8');
  const parsed = toml.parse(file);
  console.log("netlify.toml is valid");
} catch (e) {
  console.error("Parsing error on line " + e.line + ", column " + e.column + ": " + e.message);
}

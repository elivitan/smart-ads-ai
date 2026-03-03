// install-fixes.cjs
// ═══════════════════════════════════════
// Smart Ads AI — Bug Fix Installer
// Run: node install-fixes.cjs
// ═══════════════════════════════════════

const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;

const files = [
  {
    src: path.join(projectRoot, 'app._index.jsx'),
    dest: path.join(projectRoot, 'app', 'routes', 'app._index.jsx'),
    backup: path.join(projectRoot, 'app', 'routes', 'app._index.jsx.BACKUP_' + Date.now()),
  },
  {
    src: path.join(projectRoot, 'app._index.css'),
    dest: path.join(projectRoot, 'app', 'routes', 'app._index.css'),
    backup: null, // new file
  },
  {
    src: path.join(projectRoot, 'Modals.jsx'),
    dest: path.join(projectRoot, 'app', 'components', 'Modals.jsx'),
    backup: null, // new file
  },
];

console.log('═══════════════════════════════════════');
console.log('  Smart Ads AI — Installing Bug Fixes');
console.log('═══════════════════════════════════════');
console.log('');

let errors = 0;

for (const file of files) {
  try {
    // Check source exists
    if (!fs.existsSync(file.src)) {
      console.log(`❌ Source not found: ${file.src}`);
      errors++;
      continue;
    }

    // Create target directory if needed
    const dir = path.dirname(file.dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }

    // Backup existing file
    if (file.backup && fs.existsSync(file.dest)) {
      fs.copyFileSync(file.dest, file.backup);
      console.log(`💾 Backup: ${path.basename(file.backup)}`);
    }

    // Copy new file
    const content = fs.readFileSync(file.src, 'utf-8');
    fs.writeFileSync(file.dest, content, 'utf-8');
    const lines = content.split('\n').length;
    console.log(`✅ ${path.relative(projectRoot, file.dest)} (${lines} lines)`);
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    errors++;
  }
}

console.log('');
if (errors === 0) {
  console.log('═══════════════════════════════════════');
  console.log('  ✅ All fixes installed successfully!');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('What was fixed:');
  console.log('  1. CSS extracted to separate file (was injected 6x in JSX)');
  console.log('  2. OnboardModal/BuyCreditsModal moved outside Index()');
  console.log('     (prevents re-mount on every parent state change)');
  console.log('  3. Constant arrays moved outside components');
  console.log('     (prevents re-creation on every render)');
  console.log('  4. Responsive CSS fixes for mobile (<480px)');
  console.log('  5. .da position:relative fix for gradient background');
  console.log('');
  console.log('Main file reduced: 3635 → 2754 lines (-881 lines)');
  console.log('');
  console.log('Next: Run your dev server to test: npm run dev');
} else {
  console.log(`⚠️ ${errors} error(s) occurred. Check output above.`);
}

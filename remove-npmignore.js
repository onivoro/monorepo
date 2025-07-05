const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Use glob to find all .npmignore files in the libs directory
const pattern = path.join(__dirname, 'libs', '**', '.npmignore');
const files = glob.sync(pattern);

console.log(`Found ${files.length} .npmignore files to remove:`);

files.forEach((file, index) => {
  try {
    fs.unlinkSync(file);
    console.log(`${index + 1}. Removed: ${file}`);
  } catch (error) {
    console.error(`Error removing ${file}:`, error.message);
  }
});

console.log('✓ All .npmignore files have been removed from the libs directory.');
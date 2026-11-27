const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.dto.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const dtoFiles = walk(path.resolve(__dirname, '../backend/src'));
console.log(`Found ${dtoFiles.length} DTO files.`);

const issues = [];

dtoFiles.forEach(file => {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('@IsNumber') || line.includes('@Min')) {
      // Look around -3 to +3 lines for @Type(() => Number)
      const window = lines.slice(Math.max(0, idx - 4), Math.min(lines.length, idx + 4)).join('\n');
      if (!window.includes('@Type(() => Number)')) {
        // Find property name
        let prop = '';
        for (let j = idx; j < Math.min(lines.length, idx + 4); j++) {
          const match = lines[j].match(/^\s*([a-zA-Z0-9_]+)\??\s*:/);
          if (match) {
            prop = match[1];
            break;
          }
        }
        issues.push({
          file: path.relative(path.resolve(__dirname, '..'), file),
          lineNum: idx + 1,
          line: line.trim(),
          prop
        });
      }
    }
  });
});

console.log(`Found ${issues.length} potential missing @Type numbers:`);
issues.forEach(i => console.log(`  ${i.file}:${i.lineNum} -> ${i.prop || i.line}`));

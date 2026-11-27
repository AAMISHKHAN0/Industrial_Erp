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
console.log(`Processing ${dtoFiles.length} DTO files...`);

let modifiedCount = 0;

dtoFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Ensure Type is imported from 'class-transformer'
  if (!content.includes("from 'class-transformer'") && !content.includes('from "class-transformer"')) {
    // Check if we need @Type
    if (content.includes('@IsNumber') || content.includes('@Min(') || content.includes('@Max(')) {
      content = "import { Type } from 'class-transformer';\n" + content;
    }
  } else {
    // If class-transformer is imported, ensure Type is imported
    const ctMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]class-transformer['"]/);
    if (ctMatch && !ctMatch[1].includes('Type')) {
      const newImports = ctMatch[1].trim() + ', Type';
      content = content.replace(ctMatch[0], `import { ${newImports} } from 'class-transformer'`);
    }
  }

  // Regex to match properties with @IsNumber() or @Min() or @Max() that don't have @Type(() => Number)
  const lines = content.split('\n');
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line is a property declaration with number type or has @IsNumber on it
    // Or check if this line is @IsNumber() and preceding/next lines don't have @Type(() => Number)
    if (line.includes('@IsNumber(') && !line.includes('@Type(() => Number)')) {
      // Check if previous line had @Type(() => Number)
      const prev = newLines[newLines.length - 1] || '';
      if (!prev.includes('@Type(() => Number)')) {
        const indent = line.match(/^\s*/)[0];
        newLines.push(`${indent}@Type(() => Number)`);
      }
    }

    newLines.push(line);
  }

  const updated = newLines.join('\n');
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    modifiedCount++;
    console.log(`Updated: ${path.relative(path.resolve(__dirname, '..'), filePath)}`);
  }
});

console.log(`\nSuccessfully updated ${modifiedCount} DTO files with universal @Type(() => Number).`);

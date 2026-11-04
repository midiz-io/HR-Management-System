const fs = require('fs');
const path = 'prisma/schema.prisma';
let content = fs.readFileSync(path, 'utf8');

// Remove multiSchema preview feature
content = content.replace('previewFeatures = ["multiSchema"]\n', '');

// Remove schemas from datasource
content = content.replace('schemas   = ["public", "auth"]\n', '');

// Remove all @@schema("public") lines
content = content.replace(/\n\s+@@schema\("public"\)/g, '');

fs.writeFileSync(path, content);
console.log('Cleaned up schema.prisma');

const fs = require('fs');
const parser = require('@babel/parser');

try {
  const code = fs.readFileSync('app/(tabs)/chat.tsx', 'utf8');
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log('✅ File parses correctly!');
  console.log(`Found ${ast.program.body.length} top-level statements`);
} catch (error) {
  console.error('❌ Parse error:', error.message);
  console.error('Location:', error.loc);
}

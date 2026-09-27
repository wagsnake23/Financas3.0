const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const targetKeys = ['categories', 'subcategories', 'budgets', 'investments', 'transactions', 'expense_installments', 'revenues', 'orcamentos', 'despesas', 'receitas', 'despesas_parcelas'];

walkDir('src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf8');
    targetKeys.forEach(key => {
      const regex = new RegExp('queryKey:\\s*\\[[\'\\"\`]' + key + '[\'\\"\`]', 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        // extract context
        const start = Math.max(0, match.index - 50);
        const end = Math.min(content.length, match.index + 500);
        const snippet = content.substring(start, end);
        
        // Find line number
        const lineNumber = content.substring(0, match.index).split('\n').length;
        
        console.log('----------------------------------------');
        console.log('FILE:', filePath, 'LINE:', lineNumber);
        console.log(snippet.split('\n').slice(0, 15).join('\n'));
      }
    });
  }
});

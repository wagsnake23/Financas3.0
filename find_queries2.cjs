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
let out = '';
walkDir('src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf8');
    targetKeys.forEach(key => {
      const regex = new RegExp('queryKey:\\s*\\[[\'\\"\`]' + key + '[\'\\"\`]', 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(content.length, match.index + 500);
        const snippet = content.substring(start, end);
        const lineNumber = content.substring(0, match.index).split('\n').length;
        out += '----------------------------------------\n';
        out += 'FILE: ' + filePath + ' LINE: ' + lineNumber + '\n';
        out += snippet.split('\n').slice(0, 15).join('\n') + '\n';
      }
    });
  }
});
fs.writeFileSync('queries_output_utf8.txt', out, 'utf8');

import fs from 'fs';

let css = fs.readFileSync('src/index.css', 'utf8');

// Normalize line endings for replacement
css = css.replace(/\r\n/g, '\n');

const search = `/* Unifica a cor de borda suave de todos os campos no formulário de despesas para igualar à descrição */
#expense-form input,
#expense-form select,
#expense-form textarea,
#expense-form [role="combobox"],
#expense-form [aria-haspopup="dialog"],
#expense-form button.input-3d-premium`;

const replace = `/* Unifica a cor de borda suave de todos os campos nos formulários para igualar à descrição */
#expense-form input,
#expense-form select,
#expense-form textarea,
#expense-form [role="combobox"],
#expense-form [aria-haspopup="dialog"],
#expense-form button.input-3d-premium,
#income-form input,
#income-form select,
#income-form textarea,
#income-form [role="combobox"],
#income-form [aria-haspopup="dialog"],
#income-form button.input-3d-premium`;

css = css.replace(search, replace);

fs.writeFileSync('src/index.css', css);
console.log("Replacement applied.");

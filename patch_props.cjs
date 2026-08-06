const fs = require('fs');
let code = fs.readFileSync('src/components/AddCardDialog.tsx', 'utf8');

const targetProps = `interface AddCardDialogProps {
  user: User | null;
  onCardAdded: () => void;
}`;

const replacementProps = `interface AddCardDialogProps {
  user: User | null;
  onCardAdded: () => void;
  customTrigger?: React.ReactNode;
}`;

code = code.replace(targetProps, replacementProps);
fs.writeFileSync('src/components/AddCardDialog.tsx', code);

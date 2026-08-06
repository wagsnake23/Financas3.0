const fs = require('fs');
let code = fs.readFileSync('src/components/AddCardDialog.tsx', 'utf8');

code = code.replace(/interface AddCardDialogProps\s*\{\s*user:\s*User\s*\|\s*null;\s*onCardAdded:\s*\(\)\s*=>\s*void;\s*\}/, 
`interface AddCardDialogProps {
  user: User | null;
  onCardAdded: () => void;
  customTrigger?: React.ReactNode;
}`);

code = code.replace(
  'export const AddCardDialog: React.FC<AddCardDialogProps> = ({ user, onCardAdded }) => {',
  'export const AddCardDialog: React.FC<AddCardDialogProps> = ({ user, onCardAdded, customTrigger }) => {'
);

const oldButtonRegex = /<Button\s+type="button"\s+size="icon"\s+variant="ghost"[\s\S]*?<\/Button>/;
const newButton = `{customTrigger ? (
        <div onClick={() => setDialogAddCartaoOpen(true)} className="inline-block">
          {customTrigger}
        </div>
      ) : (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setDialogAddCartaoOpen(true)}
          className={cn(
            "btn-3d p-0 flex items-center justify-center rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.05)] border-none transition-all active:scale-90 flex-shrink-0 !opacity-100 bg-transparent",
            isMobile ? "h-9 w-8 text-sm" : "h-10 w-9 text-base"
          )}
          style={{ "--cor-topo": "#F87171", "--cor-base": "#EF4444", opacity: 1 } as any}
        >
          <Plus className="h-[18px] w-[18px] !text-white" strokeWidth={3.5} style={{ color: "#ffffff" }} />
        </Button>
      )}`;
      
code = code.replace(oldButtonRegex, newButton);

fs.writeFileSync('src/components/AddCardDialog.tsx', code);

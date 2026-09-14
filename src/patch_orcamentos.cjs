const fs = require('fs');
const file = 'c:/Users/vagne/dyad-apps/easy-finance-suite/src/pages/Orcamentos.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('useTransactionsData')) {
  content = content.replace('import { Footer } from "@/components/Footer";', 'import { useTransactionsData } from "@/hooks/useTransactionsData";\nimport { useFinancialProjection } from "@/hooks/useFinancialProjection";\nimport { Footer } from "@/components/Footer";');
}

if (!content.includes('allExpenseInstallments')) {
  // Find where useAuth is called
  content = content.replace('const { user } = useAuth();', 'const { user } = useAuth();\n  const { data: allExpenseInstallments = [] } = useTransactionsData(user?.id);\n  const allRevenues = []; // not needed for obligation check\n  const { getObligationValue } = useFinancialProjection({ user, allExpenseInstallments: allExpenseInstallments as any, allRevenues: [], enabled: !!user });');
}

if (!content.includes('isObligation')) {
  content = content.replace('const formSubOptions = useMemo(', 'const currentObligationValue = formSubId !== UNSELECTED_VALUE ? getObligationValue(mesAno, formSubId) : 0;\n  const isObligation = currentObligationValue > 0;\n\n  useEffect(() => {\n    if (formSubId !== UNSELECTED_VALUE && isModalOpen && isObligation) {\n      setFormValor(currentObligationValue);\n    }\n  }, [formSubId, isModalOpen, currentObligationValue, isObligation]);\n\n  const formSubOptions = useMemo(');
}

if (!content.includes('Calculado automaticamente')) {
  content = content.replace('<CurrencyBR', '{isObligation && (\n                  <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-sm">\n                    <DynamicIcon name="Info" className="w-5 h-5 flex-shrink-0" />\n                    <p className="m-0 leading-tight">\n                      Esta subcategoria possui uma despesa fixa ou parcelamento ativo. O valor planejado é calculado automaticamente.\n                    </p>\n                  </div>\n                )}\n                <CurrencyBR\n                  disabled={isObligation}');
}

fs.writeFileSync(file, content);
console.log('Done');

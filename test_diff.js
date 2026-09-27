import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from environment or hardcode based on the .env file contents
const SUPABASE_URL = 'https://jdsyefdtmifitfcjmlxd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MJ2VfpD7Ra0MHYyzzx659Q_IW1dIeYR';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const month = "2026-10";
  const startDate = "2026-10-01";
  const endDate = "2026-10-31";
  const nextMonth = "2026-11-01";

  // 1. Get all categories
  const { data: categories, error: catError } = await supabase
    .from("categorias")
    .select("*");
    
  if (catError) {
    console.error("Error fetching categories:", catError);
    return;
  }

  const catMap = {};
  categories.forEach(c => catMap[c.id] = c);
  const allSubIds = categories.filter(c => c.parent_id !== null).map(c => c.id);

  // 2. Get all expense installments in the date range
  const { data: parcelas, error: parcError } = await supabase
    .from("despesas_parcelas")
    .select("*, despesas(categoria_id)")
    .gte("vencimento", startDate)
    .lte("vencimento", endDate);

  if (parcError) {
    console.error("Error fetching parcelas:", parcError);
    return;
  }

  // Dashboard Logic
  let dashboardTotal = 0;
  const dashboardRecords = [];

  // Planejamento Logic
  let planejamentoTotal = 0;
  const planejamentoRecords = [];

  for (const inst of parcelas) {
    const categoryId = inst.despesas?.categoria_id;
    const category = catMap[categoryId];
    
    // Dashboard Logic: filters out isInternalTransfer and Cancelada
    let isInternalTransfer = false;
    // We must simulate the useTransactionsData filtered categories!
    // But wait, the user's fetchedCategories in useTransactionsData filters out many categories.
    // Let's implement the exact fetchedCategories logic.
    let isFilteredOut = false;
    if (category) {
      const lowerNome = category.nome.toLowerCase();
      if (lowerNome.includes("aportes") || lowerNome.includes("entrada de capital")) isFilteredOut = true;
      if (lowerNome.includes("ações") || lowerNome.includes("acoes")) {
        if (lowerNome.includes("dividendos") || lowerNome.includes("venda")) isFilteredOut = true;
      }
      const filterOut = ["juros sobre capital", "reembolsos", "tesouro", "rendimentos de fundos", "outros rendimentos", "dividendos", "receitas extras", "aluguel de imóveis", "criptomoedas"];
      if (filterOut.some(term => lowerNome.includes(term))) isFilteredOut = true;
    }

    if (category && !isFilteredOut) {
      const lowerNome = category.nome.toLowerCase();
      isInternalTransfer = lowerNome.includes("fatura") || 
                           lowerNome.includes("cartão") ||
                           lowerNome.includes("cartao") ||
                           lowerNome.includes("transferência") ||
                           lowerNome.includes("transferencia");
    }

    const tStatus = inst.status;
    const dashboardIncluded = !isInternalTransfer && tStatus !== "Cancelada";
    
    if (dashboardIncluded) {
      dashboardTotal += inst.valor_parcela;
      dashboardRecords.push({ id: inst.id, valor: inst.valor_parcela, catName: category?.nome, subId: categoryId, status: tStatus });
    }

    // Planejamento logic
    const planejamentoIncluded = allSubIds.includes(categoryId);
    if (planejamentoIncluded) {
      planejamentoTotal += inst.valor_parcela;
      planejamentoRecords.push({ id: inst.id, valor: inst.valor_parcela, catName: category?.nome, subId: categoryId, status: tStatus });
    }
  }

  console.log("Total Dashboard (script):", dashboardTotal);
  console.log("Total Planejamento (script):", planejamentoTotal);
  
  const diff = Math.abs(dashboardTotal - planejamentoTotal);
  console.log("Difference:", diff);

  // Compare sets
  const dashIds = new Set(dashboardRecords.map(r => r.id));
  const planIds = new Set(planejamentoRecords.map(r => r.id));

  const onlyInDash = dashboardRecords.filter(r => !planIds.has(r.id));
  const onlyInPlan = planejamentoRecords.filter(r => !dashIds.has(r.id));

  console.log("\n--- Somente no Dashboard ---");
  onlyInDash.forEach(r => console.log(`ID: ${r.id}, Valor: ${r.valor}, Categoria: ${r.catName}, Status: ${r.status}`));

  console.log("\n--- Somente no Planejamento ---");
  onlyInPlan.forEach(r => console.log(`ID: ${r.id}, Valor: ${r.valor}, Categoria: ${r.catName}, Status: ${r.status}`));
}

run();

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Get Supabase credentials from .env
const envPath = path.resolve(process.cwd(), '.env');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
  console.error("Could not read .env file", e);
  process.exit(1);
}

const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const supabaseKey = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)?.[1]?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== DIAGNÓSTICO BATERIA MOURA ===\n");

  // 1. Encontrar ID da subcategoria
  const { data: catData, error: catError } = await supabase
    .from('categorias')
    .select('*')
    .ilike('nome', '%Bateria Moura%');

  if (catError) {
    console.error("Erro buscando categoria:", catError);
    return;
  }

  if (!catData || catData.length === 0) {
    console.log("Categoria 'Bateria Moura' não encontrada.");
    return;
  }

  const categoria = catData[0];
  console.log(`1. Categoria Encontrada: ${categoria.nome}`);
  console.log(`   ID: ${categoria.id}`);
  console.log(`   User ID: ${categoria.user_id}\n`);

  // 2 e 3. Encontrar despesas
  const { data: despesas, error: despesasError } = await supabase
    .from('despesas')
    .select('*')
    .eq('user_id', categoria.user_id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (despesasError) {
    console.error("Erro buscando despesas:", despesasError);
    return;
  }

  console.log(`2. Despesas vinculadas encontradas: ${despesas?.length || 0}\n`);

  if (!despesas || despesas.length === 0) return;

  for (const desp of despesas) {
    console.log(`3. Despesa ID: ${desp.id}`);
    console.log(`   Descrição: ${desp.descricao}`);
    console.log(`   Tipo Pagamento: ${desp.tipo_pagamento}`);
    console.log(`   Valor: ${desp.valor_total}`);
    console.log(`   Data: ${desp.data_despesa || desp.created_at}`);
    console.log(`   User ID (Despesa): ${desp.user_id}\n`);

    // 4 e 5. Encontrar despesas_parcelas
    const { data: parcelas, error: parcelasError } = await supabase
      .from('despesas_parcelas')
      .select('parcela_atual, total_parcelas, vencimento')
      .eq('despesa_id', desp.id);

    if (parcelasError) {
      console.error("Erro buscando parcelas:", parcelasError);
      continue;
    }

    console.log(`4. Registros em despesas_parcelas: ${parcelas?.length || 0}`);
    
    if (parcelas && parcelas.length > 0) {
      console.log(`5. Parcelas:`);
      for (const p of parcelas) {
        console.log(`   - Parcela Atual: ${p.parcela_atual} / ${p.total_parcelas} | Vencimento: ${p.vencimento}`);
      }
    } else {
      console.log(`5. Nenhuma parcela encontrada.`);
    }
    console.log("--------------------------------------------------\n");
  }
}

run();

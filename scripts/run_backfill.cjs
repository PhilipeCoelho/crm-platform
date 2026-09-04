const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ueildehrskvsonnlegtx.supabase.co';
const supabaseKey = 'sb_publishable_PNxHeiW4jvBI_4mUh0UD1Q_hU1w88Hp';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("=== INICIANDO BACKFILL DE ATIVIDADES ===");
    
    // 1. Ver quantas atividades estao concluidas mas sem completed_at
    const { data: selectResult, error: selectErr } = await supabase.rpc('execute_sql', {
      sql_query: "SELECT COUNT(*) as total FROM public.activities WHERE completed = true AND completed_at IS NULL;"
    });

    if (selectErr) throw selectErr;
    console.log("Atividades completadas sem data de conclusao:", selectResult);

    // 2. Executar o UPDATE
    const { data: updateResult, error: updateErr } = await supabase.rpc('execute_sql', {
      sql_query: "UPDATE public.activities SET completed_at = created_at WHERE completed = true AND completed_at IS NULL;"
    });

    if (updateErr) throw updateErr;
    console.log("Update executado com sucesso! Resultado:", updateResult);

    // 3. Verificar novamente
    const { data: verifyResult, error: verifyErr } = await supabase.rpc('execute_sql', {
      sql_query: "SELECT COUNT(*) as total FROM public.activities WHERE completed = true AND completed_at IS NULL;"
    });

    if (verifyErr) throw verifyErr;
    console.log("Verificacao final (devem ser 0):", verifyResult);

    console.log("=== BACKFILL CONCLUIDO COM SUCESSO ===");
  } catch (e) {
    console.error("Erro durante o backfill:", e);
  }
}

run();

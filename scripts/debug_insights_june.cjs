const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

async function run() {
  const token = fs.readFileSync('active_token.txt', 'utf8').trim();
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const start = '2026-06-01';
  const end = '2026-06-30';
  const startOfDay = `${start}T00:00:00.000Z`;
  const endOfDay = `${end}T23:59:59.999Z`;

  const IGNORE_TEST_DATA_BEFORE = '2026-02-22T00:00:00.000Z';

  console.log("Fetching stages, deals, activities, and deal_analytics...");
  const [
    { data: validStages },
    { data: realOpenDeals },
    { data: flowActivitiesRaw },
    { data: dealAnalytics, error }
  ] = await Promise.all([
    supabase.from('stages').select('id'),
    supabase.from('deals').select('id, stage_id, value').eq('status', 'open'),
    supabase
      .from('activities')
      .select('id, status, created_at, completed_at, deal_id, type')
      .or(`and(created_at.gte.${startOfDay},created_at.lte.${endOfDay}),and(completed_at.gte.${startOfDay},completed_at.lte.${endOfDay})`),
    supabase
      .from('deal_analytics')
      .select('*, deals(lost_reason)')
      .or(`and(created_at.gte.${startOfDay},created_at.lte.${endOfDay}),and(closed_at.gte.${startOfDay},closed_at.lte.${endOfDay}),and(updated_at.gte.${startOfDay},updated_at.lte.${endOfDay})`)
  ]);

  if (error) {
    console.error("Error fetching deal_analytics:", error);
    return;
  }

  const validStageIds = new Set(validStages?.map(s => s.id) || []);
  const openDealsIds = new Set(
    realOpenDeals
      ?.filter(d => validStageIds.has(d.stage_id))
      .map(d => d.id.toLowerCase()) || []
  );

  const flowActivities = flowActivitiesRaw?.filter(a => {
    const REAL_TYPES = ['call', 'meeting', 'task', 'email', 'message', 'instagram', 'analysis', 'audit'];
    if (!REAL_TYPES.includes(a.type)) return false;
    if (a.created_at < IGNORE_TEST_DATA_BEFORE) return false;
    return true;
  }) || [];

  const periodCompletedActivities = flowActivities.filter(a =>
    a.status === 'completed' && a.completed_at && a.completed_at >= startOfDay && a.completed_at <= endOfDay
  );

  const ABORDAGEM_TYPES = ['call', 'email', 'message', 'instagram'];
  const dealsAbordados = new Set(
    periodCompletedActivities
      .filter(a => ABORDAGEM_TYPES.includes(a.type) && a.deal_id)
      .map(a => String(a.deal_id).toLowerCase())
  );

  console.log("\n--- REPLICATED INSIGHTS METRICS ---");
  console.log(`flowActivities count: ${flowActivities.length}`);
  console.log(`periodCompletedActivities count: ${periodCompletedActivities.length}`);
  console.log(`dealsAbordados size (abordadosTotal): ${dealsAbordados.size}`);
  
  // Group by type for periodCompletedActivities of ABORDAGEM_TYPES
  const typeCounts = {};
  periodCompletedActivities
    .filter(a => ABORDAGEM_TYPES.includes(a.type))
    .forEach(a => {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
    });
  console.log("Completed approaches in period by type:", typeCounts);

  // Group by deal status in dealAnalytics
  const validData = (dealAnalytics || []).filter(d => {
    if (d.status_final === 'open' && !openDealsIds.has(String(d.deal_id).toLowerCase())) return false;
    const refDate = d.closed_at || d.created_at;
    if (refDate < IGNORE_TEST_DATA_BEFORE) return false;
    return d.status_final !== 'desqualificado';
  });

  const wonDeals = validData.filter(d => d.status_final === 'won' && d.closed_at && d.closed_at >= startOfDay && d.closed_at <= endOfDay);
  const lostDeals = validData.filter(d => d.status_final === 'lost' && d.closed_at && d.closed_at >= startOfDay && d.closed_at <= endOfDay);

  console.log(`Valid deals in period: ${validData.length}`);
  console.log(`Won deals: ${wonDeals.length}`);
  console.log(`Lost deals: ${lostDeals.length}`);
}

run().catch(console.error);

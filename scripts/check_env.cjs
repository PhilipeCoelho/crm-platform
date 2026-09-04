require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
console.log("VITE_SUPABASE_URL:", process.env.VITE_SUPABASE_URL);
console.log("VITE_SUPABASE_ANON_KEY:", process.env.VITE_SUPABASE_ANON_KEY ? "exists" : "missing");
console.log("VITE_SUPABASE_SERVICE_ROLE_KEY:", process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? "exists" : "missing");
console.log("SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "exists" : "missing");
console.log("SUPABASE_KEY:", process.env.SUPABASE_KEY ? "exists" : "missing");

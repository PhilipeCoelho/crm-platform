require('dotenv').config({ path: '.env.local' });
console.log("Environment keys:", Object.keys(process.env).filter(k => k.includes("SUPABASE") || k.includes("SERVICE") || k.includes("ROLE") || k.includes("KEY")));

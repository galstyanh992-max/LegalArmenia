const fs = require('fs');
let c = fs.readFileSync('supabase/functions/_shared/openai-router.ts', 'utf8');

c = c.replace(/anthropic\/claude-3\.5-sonnet/g, 'anthropic/claude-sonnet-5');

fs.writeFileSync('supabase/functions/_shared/openai-router.ts', c);
console.log('Updated to claude-sonnet-5');

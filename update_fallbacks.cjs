const fs = require('fs');
let c = fs.readFileSync('supabase/functions/_shared/openai-router.ts', 'utf8');

c = c.replace(/fallback: "ollama\/glm-5.2:cloud"/g, 'fallback: "anthropic/claude-3.5-sonnet"');
c = c.replace(/anthropic\/claude-3.5-sonnet/g, (m, offset) => {
  const prev = c.substring(Math.max(0, offset - 100), offset);
  if (prev.includes('Gemini 2.5 Pro fallback') || prev.includes('JSON')) return 'google/gemini-2.5-pro';
  return m;
});

fs.writeFileSync('supabase/functions/_shared/openai-router.ts', c);
console.log('Done');

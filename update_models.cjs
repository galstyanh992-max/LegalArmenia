const fs = require('fs');
let c = fs.readFileSync('supabase/functions/_shared/openai-router.ts', 'utf8');
c = c.replace(/model: \"([^\"]+)\"/g, (m, p1) => {
  if (p1.startsWith('openai/text-embedding') || p1 === 'armenian-text-embeddings-2-large') return m;
  return 'model: "ollama/glm-5.2:cloud"';
});
fs.writeFileSync('supabase/functions/_shared/openai-router.ts', c);
console.log('Done');

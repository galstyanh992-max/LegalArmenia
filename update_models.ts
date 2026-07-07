const path = "d:/1V/LegalArmenia-clean/supabase/functions/_shared/openai-router.ts";
const content = Deno.readTextFileSync(path);

let updated = content;
const modelsToReplace = [
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4.1-mini",
  "anthropic/claude-sonnet-4",
];

for (const model of modelsToReplace) {
  updated = updated.replaceAll(`"${model}"`, `"ollama/glm-5.2:cloud"`);
}

Deno.writeTextFileSync(path, updated);
console.log("Updated openai-router.ts models successfully.");

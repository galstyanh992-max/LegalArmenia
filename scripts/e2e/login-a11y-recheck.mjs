import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
const BASE = "http://localhost:8080";
mkdirSync("e2e_final_audit/screenshots", { recursive: true });
const ax = [];
const cerr = [];
const browser = await chromium.launch({ headless: true });
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on("pageerror", e => cerr.push(String(e).slice(0,120)));
  await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 30000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  const vp = await page.evaluate(() => {
    const m = document.querySelector('meta[name="viewport"]');
    return m ? m.getAttribute("content") : null;
  });
  await page.addScriptTag({ url: "https://unpkg.com/axe-core@4.10.0/axe.min.js" }).catch(()=>{});
  const r = await page.evaluate(() => window.axe.run(document, { resultTypes: ["violations"] }).then(r => {
    const byImpact = {};
    for (const v of (r.violations||[])) {
      const samples = (v.nodes||[]).slice(0,3).map(n => ({ html:(n.html||'').slice(0,200), target:(n.target||[]).slice(0,2) }));
      (byImpact[v.impact]=byImpact[v.impact]||[]).push({id:v.id,nodes:v.nodes.length,help:v.help,samples});
    }
    return { violationCount: (r.violations||[]).length, byImpact };
  })).catch(e => ({ error: String(e).slice(0,160) }));
  ax.push({ label: "login", viewportMeta: vp, axe: r });
  await page.screenshot({ path: "e2e_final_audit/screenshots/login_a11y_recheck.png" }).catch(()=>{});
} catch (e) { console.log("FATAL", e.message); }
finally {
  await browser.close().catch(()=>{});
  const blocking = [];
  for (const r of ax) if (r.axe && r.axe.byImpact) for (const imp of ["critical","serious"]) for (const v of (r.axe.byImpact[imp]||[])) blocking.push({ page: r.label, id: v.id, nodes: v.nodes, samples: v.samples });
  const out = { generatedAt: new Date().toISOString(), loop: "LOOP_2_LOGIN_RECHECK", devServer: BASE, viewportMeta: ax[0]?.viewportMeta, consoleErrors: cerr, axeResults: ax, blockingViolations: blocking };
  writeFileSync("e2e_final_audit/06b_LOGIN_A11Y_RECHECK.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ viewportMeta: out.viewportMeta, blockingCount: blocking.length, blockingIds: blocking.map(b=>b.id+"@"+b.page) }, null, 2));
}

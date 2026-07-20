// Phase 7+8 — browser + accessibility matrix. Results always written in finally.
import { chromium } from "@playwright/test";
import { createIdentity, signInAs, deleteUser, createdUsers, cleanupOrphans } from "./harness-lib.mjs";
import { servicePublic } from "./staging-client.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = "http://localhost:8080";
const VIEWPORTS = [{w:320,n:"m320"},{w:360,n:"m360"},{w:390,n:"m390"},{w:430,n:"m430"},{w:768,n:"t768"},{w:1024,n:"l1024"},{w:1440,n:"d1440"},{w:1920,n:"w1920"}];
const br = [], ax = [];
const brec = r => br.push(r);
mkdirSync("e2e_final_audit/screenshots", { recursive: true });

const ident = {}, sess = {}, own = {};
let fatalErr = null, browser = null, cerr = [];

async function provision() {
  ident.lawyer = await createIdentity("lawyer", { fullName: "E2E UI Lawyer" });
  ident.admin = await createIdentity("admin", { fullName: "E2E UI Admin" });
  sess.lawyer = await signInAs(ident.lawyer.email, ident.lawyer.password);
  sess.admin = await signInAs(ident.admin.email, ident.admin.password);
  const ins = await sess.lawyer.public.from("cases").insert({ title: "E2E UI Case", status: "open", case_type: "civil" }).select("id").single();
  own.caseId = ins.data?.id;
}

async function login(page, who) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector('input[name="email"]', { timeout: 20000 });
  await page.fill('input[name="email"]', ident[who].email);
  await page.fill('input[name="password"]', ident[who].password);
  await page.press('input[name="password"]', "Enter");
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 20000 }).catch(() => {});
  return !page.url().includes("/login");
}

async function overflow(page) {
  return await page.evaluate(() => ({ scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), clientW: document.documentElement.clientWidth }));
}
async function axe(page, label) {
  try {
    await page.addScriptTag({ url: "https://unpkg.com/axe-core@4.10.0/axe.min.js" });
    return { label, ...(await page.evaluate(() => window.axe.run(document, { resultTypes: ["violations"] }).then(r => {
      const byImpact = {}; for (const v of (r.violations||[])) {
        const samples = (v.nodes||[]).slice(0,3).map(n => ({ html:(n.html||'').slice(0,200), target:(n.target||[]).slice(0,2) }));
        (byImpact[v.impact]=byImpact[v.impact]||[]).push({id:v.id,nodes:v.nodes.length,help:v.help,samples});
      }
      return { violationCount: (r.violations||[]).length, byImpact };
    }))) };
  } catch (e) { return { label, error: String(e).slice(0,160) }; }
}

try {
  await cleanupOrphans();
  await provision();
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", e => cerr.push(String(e).slice(0,100)));

  // login (lawyer)
  const loginOk = await login(page, "lawyer");
  brec({ flow:"login", actor:"lawyer", expected:true, allowed:loginOk, url:page.url() });
  await page.screenshot({ path:"e2e_final_audit/screenshots/01_dashboard.png" }).catch(()=>{});

  // dashboard / case list
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 20000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  const seesCase = /E2E UI Case/i.test(await page.content());
  brec({ flow:"dashboard", actor:"lawyer", expected:true, allowed:seesCase, note: seesCase?"fixture case visible":"case list not confirmed" });

  // case detail
  if (own.caseId) {
    await page.goto(BASE + "/cases/" + own.caseId, { waitUntil: "networkidle", timeout: 20000 }).catch(()=>{});
    await page.waitForTimeout(2000);
    const h = await page.evaluate(() => document.body.innerText.length).catch(()=>0);
    brec({ flow:"caseDetail", actor:"lawyer", expected:true, allowed: h > 50, note:"body len="+h });
    await page.screenshot({ path:"e2e_final_audit/screenshots/03_case_detail.png" }).catch(()=>{});
    // File upload control lives behind the Files tab; activate it before counting inputs.
    try {
      const filesTab = page.locator('[role=tab][value="files"]').first();
      if (await filesTab.count()) { await filesTab.click({ timeout:5000 }); await page.waitForTimeout(1500); }
      else { const ft = page.getByRole('tab').filter({ hasText: /files|ֆայլ/i }).first(); if (await ft.count()) { await ft.click({ timeout:5000 }); await page.waitForTimeout(1500); } }
    } catch (e) {}
    const fu = await page.locator('input[type="file"]').count();
    brec({ flow:"fileUploadControl", actor:"lawyer", expected:true, allowed: fu > 0, note:"file input count="+fu });
  }

  // admin panel
  const apage = await (await browser.newContext({ viewport:{width:1440,height:900} })).newPage();
  const adminOk = await login(apage, "admin");
  brec({ flow:"login", actor:"admin", expected:true, allowed:adminOk, url:apage.url() });
  await apage.goto(BASE + "/admin", { waitUntil:"networkidle", timeout:20000 }).catch(()=>{});
  await apage.waitForTimeout(2000);
  const adminLen = await apage.evaluate(()=>document.body.innerText.length).catch(()=>0);
  brec({ flow:"adminPanel", actor:"admin", expected:true, allowed: adminLen > 50, note:"admin body len="+adminLen, url:apage.url() });
  await apage.screenshot({ path:"e2e_final_audit/screenshots/04_admin.png" }).catch(()=>{});

  // AI flow error state
  await page.goto(BASE + "/dashboard", { waitUntil:"networkidle", timeout:20000 }).catch(()=>{});
  await page.waitForTimeout(1500);
  let errShown = false;
  try {
    const btn = page.getByRole("button", { name: /AI|վերլուծ|Ավտո/i }).first();
    if (await btn.count()) { await btn.click({ timeout:5000 }); await page.waitForTimeout(3000); const t=(await page.content()).toLowerCase(); errShown=/error|fail|not found|սխալ|խափան|unavailable|404|չի գտնվեl/.test(t); }
  } catch {}
  brec({ flow:"aiFlowErrorState", actor:"lawyer", expected:true, allowed:errShown, note:"undeployed fn 404; app error state shown="+errShown });

  // empty/loading state
  await page.goto(BASE + "/my-documents", { waitUntil:"networkidle", timeout:20000 }).catch(()=>{});
  await page.waitForTimeout(2000);
  const et = await page.evaluate(()=>document.body.innerText.slice(0,300)).catch(()=>"");
  brec({ flow:"emptyState", actor:"lawyer", expected:true, allowed: et.length>0, note:"my-documents len="+et.length });

  // viewport overflow sweep (dashboard + login)
  for (const v of VIEWPORTS) {
    await page.goto(BASE + "/dashboard", { waitUntil:"networkidle", timeout:20000 }).catch(()=>{});
    await page.setViewportSize({ width:v.w, height:900 });
    await page.waitForTimeout(1200);
    const o = await overflow(page);
    brec({ flow:"viewportOverflow", viewport:v.n, page:"dashboard", expected:false, allowed: o.scrollW > o.clientW+1, note:"scrollW="+o.scrollW+" clientW="+o.clientW });
    await page.screenshot({ path:"e2e_final_audit/screenshots/vp_"+v.n+".png" }).catch(()=>{});
  }
  for (const v of VIEWPORTS) {
    await page.goto(BASE + "/login", { waitUntil:"networkidle", timeout:20000 }).catch(()=>{});
    await page.setViewportSize({ width:v.w, height:900 });
    await page.waitForTimeout(800);
    const o = await overflow(page);
    brec({ flow:"viewportOverflow", viewport:v.n, page:"login", expected:false, allowed: o.scrollW > o.clientW+1, note:"scrollW="+o.scrollW+" clientW="+o.clientW });
  }

  // accessibility (best-effort): login page (fresh unauth), dashboard + case detail (authenticated)
  try {
    await page.setViewportSize({ width:1440, height:900 });
    const alogin = await (await browser.newContext({ viewport:{width:1440,height:900} })).newPage();
    await alogin.goto(BASE + "/login", { waitUntil:"networkidle", timeout:20000 }).catch(()=>{});
    await alogin.waitForTimeout(1500);
    ax.push(await axe(alogin, "login"));
    await page.goto(BASE + "/dashboard", { waitUntil:"networkidle", timeout:20000 }).catch(()=>{});
    await page.waitForTimeout(2000);
    ax.push(await axe(page, "dashboard"));
    if (own.caseId) { await page.goto(BASE + "/cases/"+own.caseId, { waitUntil:"networkidle", timeout:20000 }).catch(()=>{}); await page.waitForTimeout(2000); ax.push(await axe(page, "caseDetail")); }
  } catch (axeErr) { ax.push({ label:"axeSection", error: String(axeErr).slice(0,160) }); }

  brec({ flow:"consoleErrors", expected:false, allowed: cerr.length>0, note: cerr.slice(0,6).join(" | ") });
} catch (e) {
  fatalErr = String(e); console.log("FATAL:", e.stack||e.message);
} finally {
  const bSum = { total: br.length, failed: br.filter(r=>r.allowed!==r.expected).length, consoleErrors: cerr.length };
  const blocking = ax.flatMap(r => ((r.byImpact?.critical||[]).concat(r.byImpact?.serious||[])).map(v=>({page:r.label,id:v.id,nodes:v.nodes})));
  const aSum = { pages: ax.length, blockingViolations: blocking.length };
  writeFileSync("e2e_final_audit/05_BROWSER_RESULTS.json", JSON.stringify({ generatedAt:new Date().toISOString(), loop:"LOOP_1", stagingProject:"vavjajwiqsdhlweggalw", devServer:BASE, results:br, summary:bSum, fatal: fatalErr }, null, 2));
  writeFileSync("e2e_final_audit/06_ACCESSIBILITY_RESULTS.json", JSON.stringify({ generatedAt:new Date().toISOString(), method:"axe-core CDN injection + manual viewport/overflow checks", results:ax, summary:aSum, blocking }, null, 2));
  console.log("=== BROWSER ==="); console.log(JSON.stringify(bSum));
  for (const r of br.filter(r=>r.allowed!==r.expected)) console.log("  FAIL "+r.flow+" "+(r.actor||"")+" "+(r.viewport||"")+" "+(r.page||"")+" exp="+r.expected+" got="+r.allowed+" :: "+(r.note||""));
  console.log("=== A11Y ==="); console.log(JSON.stringify(aSum));
  for (const r of ax) if(!r.error) console.log("  "+r.label+": violations="+r.violationCount+" impacts="+JSON.stringify(Object.keys(r.byImpact||{})));
  if (browser) await browser.close().catch(()=>{});
  try { if (own.caseId) { await servicePublic.from("case_members").delete().eq("case_id",own.caseId); await servicePublic.from("cases").delete().eq("id",own.caseId); } } catch {}
  for (const u of createdUsers) await deleteUser(u.id);
  console.log("cleanup done");
}

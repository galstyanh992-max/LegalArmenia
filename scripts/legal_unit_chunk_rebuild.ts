/**
 * Side-by-side legal-unit chunk rebuild.
 *
 * Default: dry-run only. It reads current corpus rows, builds legal_unit_v1
 * chunks in memory, and prints an audit report. Use --commit only after review;
 * committed rows go to public.search_chunks_legal_unit, not production
 * public.search_chunks.
 */

import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import {
  chunkLegalDocument,
  type LegalUnitChunk,
  type LegalUnitDocumentInput,
  summarizeLegalUnitChunks,
} from "../supabase/functions/_shared/legal-unit-chunker.ts";
import { requireEnv } from "./pipeline_common.ts";

interface Options {
  commit: boolean;
  replacePreview: boolean;
  legislationLimit: number;
  legislationOffset: number;
  courtLimit: number;
  courtOffset: number;
  echrLimit: number;
  echrOffset: number;
  skipEval: boolean;
}

interface SourceRow {
  bucket: "legislation" | "court_practice" | "echr";
  document_id: string;
  version_id: string;
  full_text: string;
  language_code: string | null;
  title_hy: string | null;
  title_en: string | null;
  canonical_key: string | null;
  arlis_doc_id: string | null;
  content_domain: string | null;
  normalized_status: string | null;
  effective_from: string | null;
  effective_to: string | null;
  source_url: string | null;
}

export const EVAL_SET = [
  [
    "civil",
    "պայմանագրի խախտման դեպքում վնասի հատուցում քաղաքացիական օրենսգիրք",
    ["քաղաքացիական", "պայմանագր", "վնաս"],
  ],
  [
    "civil",
    "սեփականության իրավունքի պաշտպանություն անշարժ գույք ՀՀ քաղաքացիական օրենսգիրք",
    ["սեփականության", "քաղաքացիական"],
  ],
  ["civil", "ժառանգության ընդունման ժամկետը բաց թողնելը", ["ժառանգ", "ժամկետ"]],
  ["civil", "պարտավորության չկատարում տույժ տուգանք պայմանագիր", [
    "պարտավոր",
    "տույժ",
  ]],
  ["civil", "վարկային պայմանագիր տոկոսների անվավերություն սպառող", [
    "վարկ",
    "տոկոս",
  ]],
  ["criminal", "կալանքի կիրառման հիմքերը քրեական դատավարություն", [
    "կալանք",
    "քրեական",
  ]],
  ["criminal", "մեղադրյալի պաշտպանության իրավունքի խախտում", [
    "մեղադրյալ",
    "պաշտպան",
  ]],
  ["criminal", "ապացույցի թույլատրելիություն քրեական վարույթ", [
    "ապացույց",
    "թույլատրելի",
  ]],
  [
    "criminal",
    "խուզարկության օրինականությունը քրեական դատավարության օրենսգիրք",
    ["խուզարկ", "քրեական"],
  ],
  ["criminal", "պատժի նշանակման ընդհանուր սկզբունքները քրեական օրենսգիրք", [
    "պատժ",
    "քրեական",
  ]],
  ["administrative", "վարչական ակտի բողոքարկման ժամկետ", [
    "վարչական ակտ",
    "բողոքարկ",
  ]],
  ["administrative", "վարչական տույժի կիրառման կարգը", ["վարչական", "տույժ"]],
  ["administrative", "վարչական վարույթի մասնակիցների իրավունքները", [
    "վարչական վարույթ",
    "իրավունք",
  ]],
  ["administrative", "լիցենզիայի կասեցման որոշման բողոքարկում", [
    "լիցենզի",
    "կասեց",
  ]],
  ["administrative", "պետական մարմնի անգործության դատական բողոքարկում", [
    "անգործություն",
    "դատական",
  ]],
  [
    "construction",
    "ինքնակամ շինության օրինականացում քաղաքաշինական օրենսդրություն",
    ["ինքնակամ շին", "օրինական"],
  ],
  [
    "construction",
    "շինարարության թույլտվության բացակայություն վարչական պատասխանատվություն",
    ["շինարար", "թույլտվ"],
  ],
  ["construction", "Երևանի քաղաքապետարանի ապօրինի շինություն քանդման որոշում", [
    "քաղաքապետ",
    "քանդ",
  ]],
  ["construction", "կառուցապատման թույլտվություն քաղաքաշինության մասին օրենք", [
    "կառուցապատ",
    "թույլտվ",
  ]],
  [
    "construction",
    "հողամասի նպատակային նշանակության փոփոխություն կառուցապատում",
    ["հողամաս", "նշանակություն"],
  ],
  ["court_practice", "Վճռաբեկ դատարան պայմանագրի խախտում վնասի հատուցում", [
    "վճռաբեկ",
    "վնաս",
  ]],
  [
    "court_practice",
    "Վճռաբեկ դատարան ապացույցների գնահատում քաղաքացիական գործ",
    ["վճռաբեկ", "ապացույց"],
  ],
  ["court_practice", "Վճռաբեկ դատարան հայցային վաղեմության ժամկետ", [
    "վճռաբեկ",
    "վաղեմ",
  ]],
  [
    "court_practice",
    "Սահմանադրական դատարան սեփականության իրավունք սահմանափակում",
    ["սահմանադրական", "սեփականության"],
  ],
  ["court_practice", "Վճռաբեկ դատարան վարչական ակտի իրավաչափություն", [
    "վճռաբեկ",
    "վարչական ակտ",
  ]],
  ["echr", "Article 6 fair trial equality of arms", [
    "article 6",
    "fair trial",
    "equality of arms",
  ]],
  ["echr", "Article 5 detention reasonable suspicion", [
    "article 5",
    "detention",
  ]],
  ["echr", "Article 8 respect for home demolition unlawful construction", [
    "article 8",
    "home",
  ]],
  ["echr", "Protocol No. 1 property peaceful enjoyment possessions", [
    "possessions",
    "property",
  ]],
  ["echr", "Article 10 freedom of expression proportionality", [
    "article 10",
    "expression",
  ]],
  [
    "cross_echr",
    "արդար դատաքննության իրավունք Մարդու իրավունքների եվրոպական դատարան հոդված 6",
    ["article 6", "դատաքնն"],
  ],
  ["cross_echr", "կալանքի օրինականությունը Եվրոպական կոնվենցիա հոդված 5", [
    "article 5",
    "կալանք",
  ]],
  ["cross_echr", "բնակարանի անձեռնմխելիություն հոդված 8 ՄԻԵԴ", [
    "article 8",
    "բնակարան",
  ]],
  ["cross_echr", "սեփականության խաղաղ օգտագործում արձանագրություն 1", [
    "possessions",
    "սեփականության",
  ]],
  ["cross_echr", "արտահայտվելու ազատություն հոդված 10 Եվրոպական դատարան", [
    "article 10",
    "արտահայտ",
  ]],
  ["mixed", "աշխատանքից ազատման հրամանի բողոքարկում վնասի հատուցում", [
    "աշխատանք",
    "ազատ",
  ]],
  ["mixed", "հարկային մարմնի վարչական ակտի անվավեր ճանաչում", [
    "հարկային",
    "վարչական ակտ",
  ]],
  ["mixed", "ընտանեկան բռնության պաշտպանական որոշում դատարան", [
    "բռնության",
    "պաշտպան",
  ]],
  ["mixed", "երեխայի լավագույն շահը ծնողական իրավունքների վեճ", [
    "երեխայի",
    "ծնողական",
  ]],
  ["mixed", "փաստաբանի ծախսերի բռնագանձում քաղաքացիական գործ", [
    "փաստաբան",
    "ծախս",
  ]],
] as const;

function parseArgs(args: string[]): Options {
  const opts: Options = {
    commit: false,
    replacePreview: false,
    legislationLimit: 100,
    legislationOffset: 0,
    courtLimit: 30,
    courtOffset: 0,
    echrLimit: 30,
    echrOffset: 0,
    skipEval: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--commit") opts.commit = true;
    else if (arg === "--dry-run") opts.commit = false;
    else if (arg === "--replace-preview") opts.replacePreview = true;
    else if (arg === "--legislation-limit") {
      opts.legislationLimit = Number(args[++i] ?? opts.legislationLimit);
    } else if (arg === "--legislation-offset") {
      opts.legislationOffset = Number(args[++i] ?? opts.legislationOffset);
    } else if (arg === "--court-limit") {
      opts.courtLimit = Number(args[++i] ?? opts.courtLimit);
    } else if (arg === "--court-offset") {
      opts.courtOffset = Number(args[++i] ?? opts.courtOffset);
    } else if (arg === "--echr-limit") {
      opts.echrLimit = Number(args[++i] ?? opts.echrLimit);
    } else if (arg === "--echr-offset") {
      opts.echrOffset = Number(args[++i] ?? opts.echrOffset);
    } else if (arg === "--skip-eval") opts.skipEval = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(Deno.args);
  const db = new Client(requireEnv("DATABASE_URL"));
  await db.connect();
  try {
    const rows = await fetchSampleRows(db, opts);
    const chunksByBucket = new Map<string, LegalUnitChunk[]>();
    const allChunks: LegalUnitChunk[] = [];

    for (const row of rows) {
      const chunks = await chunkLegalDocument(toInput(row));
      chunksByBucket.set(row.bucket, [
        ...(chunksByBucket.get(row.bucket) ?? []),
        ...chunks,
      ]);
      allChunks.push(...chunks);
    }

    const dedupedChunks = deduplicateChunks(allChunks);

    if (opts.commit) {
      if (opts.replacePreview) await clearPreview(db);
      await commitChunks(db, dedupedChunks);
      await deduplicatePreviewTable(db);
    }

    const quality = summarizeLegalUnitChunks(dedupedChunks);
    const byBucket = [...chunksByBucket.entries()].map(([bucket, chunks]) => ({
      bucket,
      ...summarizeLegalUnitChunks(deduplicateChunks(chunks)),
    }));

    const retrieval = opts.skipEval
      ? null
      : await compareRetrieval(db, dedupedChunks);
    const report = {
      dry_run: !opts.commit,
      chunk_version: "legal_unit_v1",
      documents_read: rows.length,
      documents_by_bucket: countBy(rows, (row) => row.bucket),
      chunks_created: allChunks.length,
      chunks_after_dedup: dedupedChunks.length,
      duplicate_chunks_removed: allChunks.length - dedupedChunks.length,
      quality,
      by_bucket: byBucket,
      retrieval_validation: retrieval,
      full_rebuild_command:
        "deno run --allow-env --allow-net --allow-read scripts/legal_unit_chunk_rebuild.ts --commit --legislation-limit 0 --court-limit 0 --echr-limit 0",
      note: opts.commit
        ? "Rows were written only to public.search_chunks_legal_unit."
        : "No rows were written. Use --commit only after review.",
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await db.end();
  }
}

async function fetchSampleRows(
  db: Client,
  opts: Options,
): Promise<SourceRow[]> {
  const legislation = await fetchRows(
      db,
      "legislation",
      opts.legislationLimit,
      opts.legislationOffset,
      `
      d.content_domain::text <> 'practice'
      and dv.language_code = 'hy'
      and coalesce(d.title_hy, '') !~ 'ՎՃՌԱԲԵԿ|ՍԱՀՄԱՆԱԴՐԱԿԱՆ ԴԱՏԱՐԱՆ'
      and (
        d.arlis_doc_id is not null
        or coalesce(d.canonical_key, '') ilike 'arlis:%'
        or coalesce(sf.source_url, '') ilike '%arlis.am%'
      )
    `,
  );
  const court = await fetchRows(
      db,
      "court_practice",
      opts.courtLimit,
      opts.courtOffset,
      `
      dv.language_code = 'hy'
      and coalesce(d.title_hy, '') ~ 'ՎՃՌԱԲԵԿ|ՍԱՀՄԱՆԱԴՐԱԿԱՆ ԴԱՏԱՐԱՆ'
    `,
  );
  const echr = await fetchRows(
      db,
      "echr",
      opts.echrLimit,
      opts.echrOffset,
      `
      (dv.language_code in ('en', 'fr') or coalesce(d.title_en, '') ilike 'CASE OF%')
      and (d.content_domain::text = 'practice' or coalesce(d.title_en, '') ilike 'CASE OF%')
    `,
  );
  return [...legislation, ...court, ...echr];
}

async function fetchRows(
  db: Client,
  bucket: SourceRow["bucket"],
  limit: number,
  baseOffset: number,
  whereClause: string,
): Promise<SourceRow[]> {
  if (limit === 0) return [];
  const rows: SourceRow[] = [];
  const pageSize = 50;
  for (let offset = 0; offset < limit; offset += pageSize) {
    const result = await db.queryObject<Omit<SourceRow, "bucket">>(
      `
    select
      d.document_id::text,
      dv.version_id::text,
      dv.full_text,
      dv.language_code,
      d.title_hy,
      d.title_en,
      d.canonical_key,
      d.arlis_doc_id,
      d.content_domain::text,
      d.normalized_status::text,
      d.effective_from::text,
      d.effective_to::text,
      sf.source_url
    from public.document_versions dv
    join public.documents d on d.document_id = dv.document_id
    left join internal.source_files sf on sf.source_file_id = dv.source_file_id
    where dv.is_current = true
      and dv.full_text is not null
      and length(dv.full_text) > 200
      and (${whereClause})
    order by d.updated_at desc nulls last, d.document_id
    limit $1
    offset $2
    `,
      [Math.min(pageSize, limit - offset), baseOffset + offset],
    );
    rows.push(...result.rows.map((row) => ({ bucket, ...row })));
    if (result.rows.length < Math.min(pageSize, limit - offset)) break;
  }
  return rows;
}

function toInput(row: SourceRow): LegalUnitDocumentInput {
  return {
    document_id: row.document_id,
    version_id: row.version_id,
    title: row.title_hy || row.title_en || row.canonical_key,
    text: row.full_text,
    language: row.language_code,
    content_domain: row.content_domain,
    norm_status: row.normalized_status,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    source_url: row.source_url,
    arlis_doc_id: row.arlis_doc_id,
    canonical_key: row.canonical_key,
  };
}

async function commitChunks(
  db: Client,
  chunks: LegalUnitChunk[],
): Promise<void> {
  const batchSize = 500;
  for (let offset = 0; offset < chunks.length; offset += batchSize) {
    const batch = chunks.slice(offset, offset + batchSize).map(toInsertRow);
    await db.queryObject(
      `
        with rows as (
          select *
          from jsonb_to_recordset($1::jsonb) as x(
            chunk_key text,
            source_document_id uuid,
            document_id uuid,
            version_id uuid,
            legal_unit_id uuid,
            legal_unit_type text,
            legal_unit_number text,
            parent_legal_unit_id uuid,
            article_number text,
            part_number text,
            point_number text,
            paragraph_number text,
            text text,
            token_count integer,
            page_from integer,
            page_to integer,
            char_start integer,
            char_end integer,
            language text,
            language_code text,
            content_domain text,
            normalized_domain text,
            norm_status text,
            legal_status text,
            effective_from date,
            effective_to date,
            source_date date,
            source_url text,
            citation_anchor text,
            normalized_title text,
            chunk_quality_flags jsonb,
            chunk_text_sha256 text,
            chunk_version text
          )
        )
        insert into public.search_chunks_legal_unit (
          chunk_key, source_document_id, document_id, version_id, legal_unit_id,
          legal_unit_type, legal_unit_number, parent_legal_unit_id, article_number,
          part_number, point_number, paragraph_number, text, token_count, page_from,
          page_to, char_start, char_end, language, language_code, content_domain,
          normalized_domain, norm_status, legal_status, effective_from, effective_to, source_date,
          source_url, citation_anchor, normalized_title, chunk_quality_flags,
          chunk_text_sha256, chunk_version
        )
        select
          chunk_key, source_document_id, document_id, version_id, legal_unit_id,
          legal_unit_type, legal_unit_number, parent_legal_unit_id, article_number,
          part_number, point_number, paragraph_number, text, token_count, page_from,
          page_to, char_start, char_end, language, language_code,
          content_domain::public.content_domain, normalized_domain,
          norm_status::public.normalized_status, legal_status,
          effective_from, effective_to, source_date,
          source_url, citation_anchor, normalized_title, chunk_quality_flags,
          chunk_text_sha256, chunk_version
        from rows
        on conflict (chunk_key) do update set
          updated_at = now(),
          chunk_quality_flags = excluded.chunk_quality_flags
        `,
      [JSON.stringify(batch)],
    );
  }
}

function toInsertRow(chunk: LegalUnitChunk): Record<string, unknown> {
  return {
    chunk_key: chunk.chunk_key,
    source_document_id: chunk.source_document_id,
    document_id: chunk.document_id,
    version_id: chunk.version_id,
    legal_unit_id: chunk.legal_unit_id,
    legal_unit_type: chunk.legal_unit_type,
    legal_unit_number: chunk.legal_unit_number,
    parent_legal_unit_id: chunk.parent_legal_unit_id,
    article_number: chunk.article_number,
    part_number: chunk.part_number,
    point_number: chunk.point_number,
    paragraph_number: chunk.paragraph_number,
    text: chunk.text,
    token_count: chunk.token_count,
    page_from: chunk.page_from,
    page_to: chunk.page_to,
    char_start: chunk.char_start,
    char_end: chunk.char_end,
    language: chunk.language,
    language_code: chunk.language_code,
    content_domain: normalizeContentDomain(chunk.content_domain),
    normalized_domain: chunk.normalized_domain,
    norm_status: normalizeNormStatus(chunk.norm_status),
    legal_status: chunk.legal_status,
    effective_from: chunk.effective_from,
    effective_to: chunk.effective_to,
    source_date: chunk.source_date,
    source_url: chunk.source_url,
    citation_anchor: chunk.citation_anchor,
    normalized_title: chunk.normalized_title,
    chunk_quality_flags: chunk.chunk_quality_flags,
    chunk_text_sha256: chunk.chunk_text_sha256,
    chunk_version: chunk.chunk_version,
  };
}

async function clearPreview(db: Client): Promise<void> {
  await db.queryObject(`
    delete from public.search_chunks_legal_unit
    where chunk_version = 'legal_unit_v1'
  `);
}

async function deduplicatePreviewTable(db: Client): Promise<void> {
  await db.queryObject(`
    with ranked as (
      select
        chunk_id,
        row_number() over (
          partition by chunk_text_sha256
          order by
            case normalized_domain
              when 'armenian_legislation' then 1
              when 'court_practice' then 2
              when 'echr' then 3
              else 9
            end,
            source_date nulls last,
            document_id,
            chunk_id
        ) as rn
      from public.search_chunks_legal_unit
      where chunk_version = 'legal_unit_v1'
    )
    delete from public.search_chunks_legal_unit sc
    using ranked r
    where sc.chunk_id = r.chunk_id
      and r.rn > 1
  `);
}

function deduplicateChunks(chunks: LegalUnitChunk[]): LegalUnitChunk[] {
  const seen = new Set<string>();
  const result: LegalUnitChunk[] = [];
  for (const chunk of chunks) {
    const key = chunk.chunk_text_sha256;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      ...chunk,
      chunk_quality_flags: {
        ...chunk.chunk_quality_flags,
        duplicate_hash: false,
      },
    });
  }
  return result;
}

async function compareRetrieval(db: Client, chunks: LegalUnitChunk[]) {
  const legacy = {
    total: EVAL_SET.length,
    top5: 0,
    top10: 0,
    by_category: {} as Record<
      string,
      { total: number; top5: number; top10: number }
    >,
  };
  const preview = {
    total: EVAL_SET.length,
    top5: 0,
    top10: 0,
    by_category: {} as Record<
      string,
      { total: number; top5: number; top10: number }
    >,
  };
  const failures: unknown[] = [];

  await db.queryObject("select set_config('statement_timeout','25000',false)");
  for (const [category, query, expected] of EVAL_SET) {
    const legacyRows = await legacySearch(db, category, query);
    const previewRows = previewSearch(chunks, query, category);
    const legacyTop5 = hasExpected(legacyRows.slice(0, 5).join(" "), expected);
    const legacyTop10 = hasExpected(legacyRows.join(" "), expected);
    const previewTop5 = hasExpected(
      previewRows.slice(0, 5).join(" "),
      expected,
    );
    const previewTop10 = hasExpected(previewRows.join(" "), expected);
    addMetric(legacy, category, legacyTop5, legacyTop10);
    addMetric(preview, category, previewTop5, previewTop10);
    if (!previewTop10 || previewRows.length === 0) {
      failures.push({
        category,
        query,
        preview_count: previewRows.length,
        preview_top3: previewRows.slice(0, 3),
      });
    }
  }

  return {
    limitation:
      "preview search is lexical over the dry-run sample only; no embeddings were generated.",
    legacy,
    legal_unit_v1_preview: preview,
    preview_failures: failures.slice(0, 12),
  };
}

async function legacySearch(
  db: Client,
  category: string,
  query: string,
): Promise<string[]> {
  const domain = category === "echr" || category === "cross_echr" ||
      category === "court_practice"
    ? "'practice'::public.content_domain"
    : "null::public.content_domain";
  const result = await db.queryObject<
    {
      title: string | null;
      text_snippet: string | null;
      citation_anchor: string | null;
    }
  >(
    `
    select title, text_snippet, citation_anchor
    from public.search_legal_corpus_dual($1, null, null, ${domain}, 'active'::public.normalized_status, 10, 0, 0, 10, null)
    limit 10
    `,
    [query],
  );
  return result.rows.map((row) =>
    `${row.title ?? ""} ${row.text_snippet ?? ""} ${row.citation_anchor ?? ""}`
      .toLowerCase()
  );
}

function previewSearch(
  chunks: LegalUnitChunk[],
  query: string,
  category: string,
): string[] {
  const terms = tokenize(query);
  const domain = category === "echr" || category === "cross_echr" ||
      category === "court_practice"
    ? "practice"
    : null;
  return chunks
    .filter((chunk) => !domain || chunk.content_domain === domain)
    .map((chunk) => {
      const haystack = `${chunk.normalized_title ?? ""} ${chunk.text} ${
        chunk.citation_anchor ?? ""
      }`.toLowerCase();
      const score = terms.reduce(
        (sum, term) => sum + (haystack.includes(term) ? 1 : 0),
        0,
      );
      return { chunk, score, haystack };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) =>
      b.score - a.score || a.chunk.chunk_key.localeCompare(b.chunk.chunk_key)
    )
    .slice(0, 10)
    .map((item) =>
      `${item.chunk.normalized_title ?? ""} ${item.chunk.text.slice(0, 800)} ${
        item.chunk.citation_anchor ?? ""
      }`.toLowerCase()
    );
}

function tokenize(query: string): string[] {
  return [
    ...new Set(
      query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((term) =>
        term.length >= 3
      ),
    ),
  ];
}

function hasExpected(text: string, expected: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return expected.some((term) => lower.includes(term.toLowerCase()));
}

function addMetric(
  metrics: {
    top5: number;
    top10: number;
    by_category: Record<string, { total: number; top5: number; top10: number }>;
  },
  category: string,
  top5: boolean,
  top10: boolean,
) {
  if (top5) metrics.top5++;
  if (top10) metrics.top10++;
  const bucket = metrics.by_category[category] ??
    { total: 0, top5: 0, top10: 0 };
  bucket.total++;
  if (top5) bucket.top5++;
  if (top10) bucket.top10++;
  metrics.by_category[category] = bucket;
}

function countBy<T>(
  items: T[],
  keyFn: (item: T) => string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[keyFn(item)] = (out[keyFn(item)] ?? 0) + 1;
  return out;
}

function normalizeContentDomain(value: string): string {
  return value === "practice" || value === "knowledge_base" ? value : "unknown";
}

function normalizeNormStatus(value: string): string {
  return value === "repealed" ? "repealed" : "active";
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  });
}

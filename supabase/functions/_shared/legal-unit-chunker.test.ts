import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  chunkLegalDocument,
  classifyLegalDocumentDomain,
  cleanLegalSourceText,
  LEGAL_UNIT_CHUNK_VERSION,
  summarizeLegalUnitChunks,
} from "./legal-unit-chunker.ts";

Deno.test("legal-unit chunker builds article chunks with anchors and metadata", async () => {
  const chunks = await chunkLegalDocument({
    document_id: "00000000-0000-0000-0000-000000000001",
    version_id: "00000000-0000-0000-0000-000000000002",
    title: "ՀՀ ՕՐԵՆՔԸ ՔԱՂԱՔԱՑԻԱԿԱՆ ՕՐԵՆՍԳՐՔԻ ՄԱՍԻՆ",
    text: `
http://www.arlis.am/DocumentView.aspx?DocID=12345 1/2
Հոդված 1. Ընդհանուր դրույթներ
1. Սույն հոդվածը սահմանում է պայմանագրի ընդհանուր կանոնը։
2. Բացառությունները կիրառվում են նույն հոդվածի շրջանակում։

Հոդված 2. Վնասի հատուցում
1. Վնասը հատուցվում է օրենքով սահմանված կարգով։
`,
    language: "hy",
    norm_status: "active",
    source_url: "http://www.arlis.am/DocumentView.aspx?DocID=12345",
    arlis_doc_id: "12345",
  });

  assert(chunks.length >= 2);
  assertEquals(chunks[0].chunk_version, LEGAL_UNIT_CHUNK_VERSION);
  assertEquals(chunks[0].article_number, "1");
  assert(chunks[0].legal_unit_id);
  assert(chunks[0].citation_anchor?.includes("ARLIS DocID 12345"));
  assert(
    chunks[0].text.includes(
      "ՀՀ ՕՐԵՆՔԸ ՔԱՂԱՔԱՑԻԱԿԱՆ ՕՐԵՆՍԳՐՔԻ ՄԱՍԻՆ -> Հոդված 1",
    ),
  );
  assertEquals(chunks[0].chunk_quality_flags.has_url_noise, false);
  assertEquals(chunks[0].chunk_quality_flags.has_page_counter, false);
});

Deno.test("cleaner removes ARLIS repeated urls and page counters", () => {
  const cleaned = cleanLegalSourceText(`
http://www.arlis.am/DocumentView.aspx?DocID=999 15/16
Հոդված 5. Նորմ
Նորմի տեքստ։
http://www.arlis.am/DocumentView.aspx?DocID=999 16/16
`);
  assert(!cleaned.includes("DocumentView.aspx"));
  assert(!/\b15\/16\b/.test(cleaned));
});

Deno.test("court practice classifier routes Armenian Cassation to practice", async () => {
  const input = {
    document_id: "00000000-0000-0000-0000-000000000011",
    version_id: "00000000-0000-0000-0000-000000000012",
    title:
      "ՀՀ ՎՃՌԱԲԵԿ ԴԱՏԱՐԱՆԻ ՈՐՈՇՈՒՄԸ ՔԱՂԱՔԱՑԻԱԿԱՆ ԳՈՐԾ ԹԻՎ ԵԴ/1234/02/20 ՄԱՍԻՆ",
    text: `Վճռաբեկ դատարան
ՊԱՐԶԵՑ
Գործի փաստերը։
Վճռաբեկ դատարանի պատճառաբանությունները
Դատարանի իրավական դիրքորոշումը։
ՈՐՈՇԵՑ
Բողոքը բավարարել։`,
    language: "hy",
  };
  const domain = classifyLegalDocumentDomain(input);
  assertEquals(domain.content_domain, "practice");
  const chunks = await chunkLegalDocument(input);
  assert(chunks.some((chunk) => chunk.normalized_domain === "court_practice"));
  assert(chunks.some((chunk) => chunk.legal_unit_type === "reasoning"));
});

Deno.test("ECHR chunker creates specific anchors instead of coarse echr_hy_mt", async () => {
  const chunks = await chunkLegalDocument({
    document_id: "00000000-0000-0000-0000-000000000021",
    version_id: "00000000-0000-0000-0000-000000000022",
    title: "CASE OF TEST v. ARMENIA",
    text: `CASE OF TEST v. ARMENIA
Application no. 12345/20
12 January 2024
1. The applicant complained under Article 6 of the Convention.
2. The Court finds that equality of arms was respected.`,
    language: "en",
  });

  assert(chunks.length > 0);
  assert(
    chunks[0].citation_anchor?.startsWith("ECHR | CASE OF TEST v. ARMENIA"),
  );
  assert(chunks[0].citation_anchor?.includes("12345/20"));
  assert(!chunks[0].citation_anchor?.includes("echr_hy_mt"));
  assertEquals(chunks[0].effective_from, "2024-01-12");
  assertEquals(chunks[0].source_date, "2024-01-12");
});

Deno.test("summary reports coverage and mid-word flags", async () => {
  const chunks = await chunkLegalDocument({
    document_id: "00000000-0000-0000-0000-000000000031",
    version_id: "00000000-0000-0000-0000-000000000032",
    title: "ՀՀ ՕՐԵՆՔԸ ՓՈՐՁԱՐԿՄԱՆ ՄԱՍԻՆ",
    text: `Հոդված 1. Նորմ
անավարտ սկիզբ ունեցող տեքստ։`,
    language: "hy",
    arlis_doc_id: "555",
  });
  const summary = summarizeLegalUnitChunks(chunks);
  assertEquals(summary.total_chunks, chunks.length);
  assert(summary.legal_unit_id_coverage > 0);
  assert(summary.citation_anchor_coverage > 0);
});

"""Disposable Prompt 19.1 Metric-only retrieval evaluation.

Runs against the local Supabase database only, uses the offline Metric-AI model,
rolls back all corpus fixtures, and writes reproducible evaluation artifacts.
"""

from __future__ import annotations

import csv
import itertools
import json
import math
import os
import statistics
import sys
import time
import uuid
from collections import Counter
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

sys.path.insert(0, str(Path(__file__).resolve().parent))
from embeddings_provider import get_provider, to_pgvector  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "AUDIT_REPORTS" / "artifacts"
DB_URL = os.environ.get(
    "PROMPT19_LOCAL_DB_URL",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


TOPICS = [
    ("active", "Պայմանագրային պարտավորություններ", "Պայմանագիրը պարտադիր է կողմերի համար, իսկ պարտավորությունը պետք է կատարվի պատշաճ և սահմանված ժամկետում։", "ինչպես պետք է կատարվի պայմանագրային պարտավորությունը", "как исполняются договорные обязательства"),
    ("active", "Աշխատանքային պայմանագրի լուծում", "Գործատուն աշխատանքային պայմանագիրը լուծելիս պարտավոր է պահպանել օրենքով սահմանված հիմքերը և ծանուցման ժամկետը։", "գործատուի կողմից աշխատանքային պայմանագրի դադարեցման պայմանները", "увольнение работника по инициативе работодателя"),
    ("active", "Երեխայի լավագույն շահը", "Ընտանեկան վեճերում դատարանը առաջնահերթ հաշվի է առնում երեխայի լավագույն շահը և ծնողների հավասար իրավունքները։", "երեխայի շահը ընտանեկան վեճի ժամանակ", "интересы ребенка в семейном споре"),
    ("active", "Հարկային պարտավորության կատարում", "Հարկ վճարողը պարտավոր է հաշվարկել և վճարել հարկը օրենքով նախատեսված կարգով ու ժամկետներում։", "հարկի վճարման ժամկետ և պարտավորություն", "срок уплаты налогового обязательства"),
    ("active", "Անմեղության կանխավարկած", "Մեղադրյալը համարվում է անմեղ, քանի դեռ նրա մեղավորությունն ապացուցված չէ օրինական ուժի մեջ մտած դատավճռով։", "երբ է անձը համարվում անմեղ", "презумпция невиновности обвиняемого"),
    ("active", "Վարչական ակտի բողոքարկում", "Վարչական ակտը կարող է բողոքարկվել վարչական կամ դատական կարգով՝ պահպանելով սահմանված ժամկետը։", "ինչպես բողոքարկել վարչական ակտը", "обжалование административного акта"),
    ("active", "Դատավարական ժամկետի վերականգնում", "Բաց թողնված դատավարական ժամկետը կարող է վերականգնվել, եթե դատարանը պատճառները ճանաչում է հարգելի։", "բաց թողնված դատավարական ժամկետ", "восстановление пропущенного процессуального срока"),
    ("active", "Սեփականության իրավունքի պաշտպանություն", "Սեփականատերն իրավունք ունի պահանջել վերացնել իր իրավունքի ցանկացած խախտում և վերադարձնել գույքը ապօրինի տիրապետումից։", "սեփականության իրավունքի խախտման պաշտպանություն", "защита права собственности"),
    ("active", "Սնանկության դիմում", "Պարտապանի անվճարունակության դեպքում իրավասու անձը կարող է դատարան ներկայացնել սնանկության դիմում։", "երբ ներկայացնել սնանկության դիմում", "заявление о банкротстве должника"),
    ("active", "Անձնական տվյալների մշակում", "Անձնական տվյալները մշակվում են օրինական նպատակի համար և տվյալների սուբյեկտի համաձայնությամբ կամ օրենքի հիմքով։", "անձնական տվյալների մշակման օրինական հիմքը", "законное основание обработки персональных данных"),
    ("unknown", "Շինարարության թույլտվության հատուկ կարգ", "Շինարարության թույլտվության հատուկ կարգի կիրառելիությունը պահանջում է պաշտոնական աղբյուրով լրացուցիչ ստուգում։", "շինարարության թույլտվության հատուկ կարգ", "специальный порядок разрешения на строительство"),
    ("unknown", "Հողամասի նպատակային նշանակության փոփոխություն", "Հողամասի նպատակային նշանակության փոփոխության այս դրույթի գործող կարգավիճակը վերջնականապես հաստատված չէ։", "հողամասի նպատակային նշանակության փոփոխություն", "изменение целевого назначения земельного участка"),
    ("unknown", "Մաքսային արտոնության կիրառություն", "Մաքսային արտոնության կիրառման համար անհրաժեշտ են ծագման փաստաթղթեր, սակայն դրույթի կարգավիճակը չճշտված է։", "մաքսային արտոնության փաստաթղթեր", "документы для таможенной льготы"),
    ("unknown", "Համայնքային գույքի վարձակալություն", "Համայնքային գույքի վարձակալության ընթացակարգի այս տարբերակը ենթակա է պաշտոնական ստուգման։", "համայնքային գույքի վարձակալության կարգ", "аренда муниципального имущества"),
    ("unknown", "Լիցենզիայի ժամկետի երկարաձգում", "Լիցենզիայի ժամկետի երկարաձգման չհաստատված կարգը նախատեսում է դիմում և համապատասխան վճար։", "լիցենզիայի ժամկետի երկարաձգման դիմում", "продление срока лицензии"),
    ("unknown", "Սոցիալական նպաստի վերահաշվարկ", "Սոցիալական նպաստի վերահաշվարկի տվյալ կանոնի գործողությունը պետք է հաստատել պաշտոնական հրապարակմամբ։", "սոցիալական նպաստի վերահաշվարկ", "перерасчет социального пособия"),
    ("unknown", "Բնապահպանական վճարի հաշվարկ", "Բնապահպանական վճարի հաշվարկման այս բանաձևի իրավական կարգավիճակը դեռ չի հաստատվել։", "բնապահպանական վճարի հաշվարկման բանաձև", "расчет экологического платежа"),
    ("unknown", "Հանրային ծառայության մրցույթ", "Հանրային ծառայության մրցույթի նկարագրված ընթացակարգը պահանջում է գործողության կարգավիճակի ստուգում։", "հանրային ծառայության մրցույթի ընթացակարգ", "конкурс на публичную службу"),
    ("unknown", "Կրթական ծրագրի հավատարմագրում", "Կրթական ծրագրի հավատարմագրման պահանջների այս խմբագրության գործողությունը հաստատված չէ։", "կրթական ծրագրի հավատարմագրման պահանջներ", "аккредитация образовательной программы"),
    ("unknown", "Առևտրային անվան գրանցում", "Առևտրային անվան գրանցման չհաստատված կարգը ներառում է տարբերակիչ լինելու պահանջ։", "առևտրային անվան գրանցման պայմաններ", "регистрация фирменного наименования"),
    ("repealed", "Հին կենսաթոշակային հաշվարկ", "Ուժը կորցրած կարգով կենսաթոշակը հաշվարկվում էր աշխատանքային ստաժի և նախկին գործակիցների հիման վրա։", "նախկին կենսաթոշակային հաշվարկի կարգ", "старый порядок расчета пенсии"),
    ("repealed", "Նախկին պետական տուրքի դրույքաչափ", "Ուժը կորցրած նորմը սահմանում էր պետական տուրքի նախկին դրույքաչափը դատական դիմումների համար։", "պետական տուրքի նախկին դրույքաչափ", "прежняя ставка государственной пошлины"),
    ("repealed", "Հին հաշվապահական հաշվետվություն", "Չգործող կարգավորումը պահանջում էր տարեկան հաշվապահական հաշվետվության հին ձևաչափ։", "տարեկան հաշվետվության հին ձևաչափ", "старый формат бухгалтерской отчетности"),
    ("repealed", "Նախկին ներմուծման քվոտա", "Ուժը կորցրած դրույթը սահմանում էր որոշ ապրանքների ներմուծման քանակական քվոտա։", "ապրանքների ներմուծման նախկին քվոտա", "прежняя квота на импорт товаров"),
    ("repealed", "Հին բնակարանային փոխհատուցում", "Նախկինում բնակարանային փոխհատուցումը տրամադրվում էր ուժը կորցրած չափորոշիչներով։", "բնակարանային փոխհատուցման հին չափորոշիչ", "старые критерии жилищной компенсации"),
    ("repealed", "Նախկին ճանապարհային վճար", "Չգործող իրավական ակտը նախատեսում էր ճանապարհային վճարի նախկին հաշվարկման մեթոդը։", "ճանապարհային վճարի նախկին մեթոդ", "прежний метод дорожного сбора"),
    ("repealed", "Հին արտահանման թույլտվություն", "Ուժը կորցրած կարգով որոշ ապրանքների արտահանման համար պահանջվում էր հատուկ թույլտվություն։", "արտահանման հատուկ թույլտվության հին կարգ", "старое специальное разрешение на экспорт"),
    ("repealed", "Նախկին պարտադիր ապահովագրություն", "Չգործող դրույթը սահմանում էր մասնագիտական գործունեության պարտադիր ապահովագրության նախկին պայմանները։", "պարտադիր ապահովագրության նախկին պայմաններ", "прежние условия обязательного страхования"),
    ("repealed", "Հին տեղական վճար", "Ուժը կորցրած համայնքային ակտը սահմանում էր տեղական վճարի նախկին չափը և վճարման կարգը։", "տեղական վճարի նախկին չափ", "прежний размер местного сбора"),
    ("repealed", "Նախկին տեխնիկական զննություն", "Չգործող կարգավորումը նախատեսում էր տրանսպորտային միջոցների տեխնիկական զննության հին պարբերականություն։", "տեխնիկական զննության հին պարբերականություն", "старая периодичность технического осмотра"),
]

NO_ANSWER = [
    "քվանտային աստղադիտակի հելիումային սառեցման սխեմա",
    "մարսյան հողի կենսաբանական փորձարկման արդյունք",
    "ջազային իմպրովիզացիայի հարմոնիկ վերլուծություն",
    "միջնադարյան ճարտարապետության գունային պիգմենտ",
    "ծովային կետի միգրացիոն երթուղի",
    "նեյտրոնային աստղի մագնիսական դաշտ",
    "հնագիտական խեցեղենի ջերմային մշակում",
    "լեռնային սառցադաշտի տարեկան շարժում",
    "բուսաբանական այգու խոլորձների խնամք",
    "սիմֆոնիկ նվագախմբի հարվածային գործիքներ",
]


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = max(0, min(len(ordered) - 1, math.ceil(p * len(ordered)) - 1))
    return round(ordered[idx], 3)


def eligible(status: str, mode: str) -> bool:
    if mode in ("old_dual_metric", "current"):
        return status == "active"
    if mode == "extended":
        return status in ("active", "unknown")
    return status in ("active", "unknown", "repealed")


def fixture_ids(index: int) -> tuple[str, str, str, str]:
    base = 10_000 + index
    return tuple(str(uuid.UUID(int=base * 10 + n)) for n in range(1, 5))


def build_cases(documents: list[dict]) -> list[dict]:
    cases: list[dict] = []
    for i, doc in enumerate(documents):
        cases.append({
            "id": f"semantic_{i + 1:02d}", "category": "armenian_semantic",
            "query": doc["semantic_query"], "expected_document_id": doc["document_id"],
            "expected_status": doc["status"], "expected_source": "arlis",
        })
    for i, doc in enumerate(documents[:15]):
        cases.append({
            "id": f"ru_hy_{i + 1:02d}", "category": "russian_to_armenian",
            "query": doc["russian_query"], "expected_document_id": doc["document_id"],
            "expected_status": doc["status"], "expected_source": "arlis",
        })
    for i, doc in enumerate(documents[:15]):
        query = doc["canonical_key"] if i < 5 else (doc["title"] if i < 10 else doc["doc_number"])
        cases.append({
            "id": f"exact_{i + 1:02d}", "category": "exact_identifier",
            "query": query, "expected_document_id": doc["document_id"],
            "expected_status": doc["status"], "expected_source": "arlis",
        })
    for i, doc in enumerate(documents[10:20]):
        cases.append({
            "id": f"unknown_{i + 1:02d}", "category": "unknown_only",
            "query": doc["semantic_query"], "expected_document_id": doc["document_id"],
            "expected_status": "unknown", "expected_source": "arlis",
        })
    for i, doc in enumerate(documents[20:30]):
        cases.append({
            "id": f"historical_{i + 1:02d}", "category": "historical",
            "query": doc["semantic_query"], "expected_document_id": doc["document_id"],
            "expected_status": "repealed", "expected_source": "arlis",
        })
    for i, query in enumerate(NO_ANSWER):
        cases.append({
            "id": f"no_answer_{i + 1:02d}", "category": "no_answer",
            "query": query, "expected_document_id": None,
            "expected_status": None, "expected_source": None,
        })
    assert len(cases) == 90
    return cases


def rpc_rows(cur, mode: str, query: str, vector: str, ann=100, fts=100, final=20):
    started = time.perf_counter()
    if mode == "old_dual_metric":
        cur.execute(
            """select * from public.search_legal_corpus_dual(
              %s, %s::vector, null, 'knowledge_base'::public.content_domain,
              'active'::public.normalized_status, %s, %s, 0, %s, null
            )""",
            (query, vector, final, ann, fts),
        )
    else:
        cur.execute(
            """select * from public.search_legal_corpus_metric(
              %s, %s::vector, 'knowledge_base'::public.content_domain,
              %s, null, %s, %s, %s
            )""",
            (query, vector, mode, final, ann, fts),
        )
    rows = cur.fetchall()
    return rows, (time.perf_counter() - started) * 1000


def summarize_mode(mode: str, cases: list[dict], results: list[dict]) -> dict:
    eligible_cases = [c for c in cases if c["expected_document_id"] and eligible(c["expected_status"], mode)]
    lookup = {r["case_id"]: r for r in results}
    ranks = []
    recalls = {5: 0, 10: 0, 20: 0}
    source_hits = 0
    contamination = 0
    total_rows = 0
    warning_failures = 0
    relevant_similarities: list[float] = []
    for case in cases:
        result = lookup[case["id"]]
        rows = result["rows"]
        total_rows += len(rows)
        allowed = {"active"} if mode in ("old_dual_metric", "current") else ({"active", "unknown"} if mode == "extended" else {"active", "unknown", "repealed"})
        contamination += sum(1 for row in rows if row.get("norm_status") not in allowed)
        if mode != "old_dual_metric":
            warning_failures += sum(
                1 for row in rows
                if row.get("norm_status") in ("unknown", "repealed") and not row.get("legal_status_warning")
            )
        if case["expected_document_id"] and eligible(case["expected_status"], mode):
            ids = [row.get("document_id") for row in rows]
            try:
                rank = ids.index(case["expected_document_id"]) + 1
            except ValueError:
                rank = None
            ranks.append(rank)
            for k in recalls:
                recalls[k] += int(rank is not None and rank <= k)
            if rank is not None and rows[rank - 1].get("source") == case["expected_source"]:
                source_hits += 1
            if rank is not None:
                similarity = rows[rank - 1].get("vector_similarity")
                if similarity is None:
                    similarity = rows[rank - 1].get("vector_score")
                if similarity is not None:
                    relevant_similarities.append(float(similarity))
    denom = max(1, len(eligible_cases))
    ndcg = sum((1 / math.log2(rank + 1)) if rank and rank <= 10 else 0 for rank in ranks) / denom
    latencies = [r["latency_ms"] for r in results]
    no_answer = [lookup[c["id"]] for c in cases if c["category"] == "no_answer"]
    no_answer_false_positive = sum(
        1 for r in no_answer
        if any((row.get("ann_rank") is None) or float(row.get("vector_similarity") or row.get("vector_score") or 0) >= 0.3 for row in r["rows"])
    )
    no_answer_max_similarities = []
    for result in no_answer:
        similarities = [
            float(row.get("vector_similarity") if row.get("vector_similarity") is not None else row.get("vector_score") or 0)
            for row in result["rows"]
        ]
        no_answer_max_similarities.append(max(similarities, default=0.0))
    threshold_candidates = sorted(set(relevant_similarities + no_answer_max_similarities))
    best_threshold = None
    best_balanced = -1.0
    for threshold in threshold_candidates:
        tpr = sum(v >= threshold for v in relevant_similarities) / max(1, len(relevant_similarities))
        tnr = sum(v < threshold for v in no_answer_max_similarities) / max(1, len(no_answer_max_similarities))
        balanced = (tpr + tnr) / 2
        if balanced > best_balanced:
            best_balanced = balanced
            best_threshold = threshold
    return {
        "eligible_cases": len(eligible_cases),
        "recall_at_5": round(recalls[5] / denom, 4),
        "recall_at_10": round(recalls[10] / denom, 4),
        "recall_at_20": round(recalls[20] / denom, 4),
        "mrr": round(sum(1 / rank if rank else 0 for rank in ranks) / denom, 4),
        "ndcg_at_10": round(ndcg, 4),
        "expected_source_hit_rate": round(source_hits / denom, 4),
        "status_contamination_rows": contamination,
        "status_contamination_rate": round(contamination / max(1, total_rows), 6),
        "warning_failures": warning_failures,
        "result_count": total_rows,
        "no_answer_false_positive_at_0_3": no_answer_false_positive,
        "threshold_calibration": {
            "relevant_min": round(min(relevant_similarities), 4) if relevant_similarities else None,
            "relevant_p50": percentile(relevant_similarities, 0.50) if relevant_similarities else None,
            "no_answer_max": round(max(no_answer_max_similarities), 4) if no_answer_max_similarities else None,
            "no_answer_p95": percentile(no_answer_max_similarities, 0.95) if no_answer_max_similarities else None,
            "best_balanced_threshold": round(best_threshold, 4) if best_threshold is not None else None,
            "best_balanced_accuracy": round(best_balanced, 4),
            "production_threshold_selected": False,
        },
        "latency_ms": {
            "p50": percentile(latencies, 0.50),
            "p95": percentile(latencies, 0.95),
            "p99": percentile(latencies, 0.99),
        },
    }


def main() -> None:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    documents = []
    for i, (status, title, text, semantic_query, russian_query) in enumerate(TOPICS):
        document_id, version_id, chunk_id, embedding_id = fixture_ids(i)
        documents.append({
            "index": i, "status": status, "title": title, "text": text,
            "semantic_query": semantic_query, "russian_query": russian_query,
            "document_id": document_id, "version_id": version_id,
            "chunk_id": chunk_id, "embedding_id": embedding_id,
            "canonical_key": f"eval:law:{i + 1:03d}",
            "doc_number": f"EVAL-{i + 1:03d}",
        })
    cases = build_cases(documents)

    provider = get_provider()
    passage_vectors = provider.embed_passages([d["text"] for d in documents], batch_size=8)
    query_vectors = provider.embed_query([c["query"] for c in cases], batch_size=8)
    query_vector_map = {case["id"]: to_pgvector(vector) for case, vector in zip(cases, query_vectors)}

    evaluation_json = {
        "schema_version": 1,
        "model": "Metric-AI/armenian-text-embeddings-2-large",
        "dimension": 1024,
        "dataset_kind": "provisional_synthetic_legal_architecture_set",
        "counts": dict(Counter(c["category"] for c in cases)),
        "cases": cases,
    }
    (ARTIFACTS / "prompt19_1_evaluation.json").write_text(
        json.dumps(evaluation_json, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    conn = psycopg.connect(DB_URL, row_factory=dict_row, autocommit=False)
    mode_results: dict[str, list[dict]] = {m: [] for m in ("old_dual_metric", "current", "extended", "historical")}
    matrix_rows: list[dict] = []
    explain_samples: list[dict] = []
    try:
        with conn.cursor() as cur:
            cur.execute("set local statement_timeout = '120s'")
            for doc, vector in zip(documents, passage_vectors):
                cur.execute(
                    """insert into public.documents(
                      document_id, canonical_key, arlis_doc_id, content_domain, title_hy,
                      doc_number_clean, effective_from, normalized_status, source_metadata
                    ) values (%s,%s,%s,'knowledge_base',%s,%s,'2020-01-01',%s,'{"source":"fixture"}')""",
                    (doc["document_id"], doc["canonical_key"], doc["doc_number"], doc["title"], doc["doc_number"], doc["status"]),
                )
                cur.execute(
                    "insert into public.document_versions(version_id,document_id,version_number,language_code,is_current) values(%s,%s,1,'hy',true)",
                    (doc["version_id"], doc["document_id"]),
                )
                cur.execute(
                    """insert into public.search_chunks(
                      chunk_id,chunk_key,document_id,version_id,text,language_code,content_domain,
                      norm_status,effective_from,citation_anchor,chunk_text_sha256,article_number
                    ) values(%s,%s,%s,%s,%s,'hy','knowledge_base',%s,'2020-01-01',%s,%s,%s)""",
                    (doc["chunk_id"], f"eval-{doc['index']}", doc["document_id"], doc["version_id"], doc["text"], doc["status"], f"Հոդված {doc['index'] + 1}", f"eval-hash-{doc['index']}", str(doc["index"] + 1)),
                )
                cur.execute(
                    """insert into public.embeddings(
                      embedding_id,chunk_id,model,dimension,vector,chunk_text_sha256,status
                    ) values(%s,%s,'armenian-text-embeddings-2-large',1024,%s::vector(1024),%s,'success')""",
                    (doc["embedding_id"], doc["chunk_id"], to_pgvector(vector), f"eval-hash-{doc['index']}"),
                )
            cur.execute("analyze public.documents")
            cur.execute("analyze public.search_chunks")
            cur.execute("analyze public.embeddings")

            for case in cases:
                vector = query_vector_map[case["id"]]
                for mode in mode_results:
                    rows, latency = rpc_rows(cur, mode, case["query"], vector)
                    mode_results[mode].append({
                        "case_id": case["id"], "latency_ms": round(latency, 3),
                        "rows": [{k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in row.items()} for row in rows],
                    })

            representative = [c for c in cases if c["category"] == "armenian_semantic"][:5]
            exact_neighbors: dict[str, list[str]] = {}
            cur.execute("set local enable_indexscan = off")
            cur.execute("set local enable_bitmapscan = off")
            for case in representative:
                cur.execute(
                    """select e.chunk_id::text from public.embeddings e
                       where e.model='armenian-text-embeddings-2-large' and e.status='success'
                       order by e.vector <=> %s::vector limit 20""",
                    (query_vector_map[case["id"]],),
                )
                exact_neighbors[case["id"]] = [r["chunk_id"] for r in cur.fetchall()]
            cur.execute("set local enable_indexscan = on")
            cur.execute("set local enable_bitmapscan = on")

            probes_values = [10, 30, 60]
            iterative_values = ["off", "relaxed_order"]
            max_probes_values = [60, 120]
            ann_values = [50, 75, 100, 150, 200]
            fts_values = [30, 50, 75, 100]
            final_values = [10, 15, 20]

            for probes, iterative, max_probes in itertools.product(probes_values, iterative_values, max_probes_values):
                cur.execute(f"set local ivfflat.probes = {probes}")
                cur.execute(f"set local ivfflat.iterative_scan = '{iterative}'")
                cur.execute(f"set local ivfflat.max_probes = {max_probes}")
                sample = representative[0]
                cur.execute(
                    """explain (analyze, buffers, format json)
                       select e.chunk_id from public.embeddings e
                       where e.model='armenian-text-embeddings-2-large' and e.status='success'
                       order by e.vector <=> %s::vector limit 20""",
                    (query_vector_map[sample["id"]],),
                )
                plan = cur.fetchone()["QUERY PLAN"][0]
                plan_text = json.dumps(plan)
                cur.execute("set local enable_seqscan = off")
                cur.execute("set local enable_bitmapscan = off")
                cur.execute("set local enable_sort = off")
                cur.execute(
                    """explain (analyze, buffers, format json)
                       select e.chunk_id from public.embeddings e
                       where e.model='armenian-text-embeddings-2-large' and e.status='success'
                       order by e.vector <=> %s::vector limit 20""",
                    (query_vector_map[sample["id"]],),
                )
                forced_plan = cur.fetchone()["QUERY PLAN"][0]
                forced_plan_text = json.dumps(forced_plan)
                cur.execute("set local enable_seqscan = on")
                cur.execute("set local enable_bitmapscan = on")
                cur.execute("set local enable_sort = on")
                explain_samples.append({
                    "ivfflat_probes": probes, "iterative_scan": iterative,
                    "ivfflat_max_probes": max_probes,
                    "index_used_normal_planner": "embeddings_ivf_metric_idx" in plan_text,
                    "index_used_forced": "embeddings_ivf_metric_idx" in forced_plan_text,
                    "plan": plan,
                    "forced_index_plan": forced_plan,
                })

                # Measure ANN recall on the ANN lane itself. The RPC's final fused
                # limit must not truncate Recall@20 when final_limit is 10 or 15.
                ann_lane_recalls = {5: [], 10: [], 20: []}
                cur.execute("set local enable_seqscan = off")
                cur.execute("set local enable_bitmapscan = off")
                cur.execute("set local enable_sort = off")
                for case in representative:
                    cur.execute(
                        """select e.chunk_id::text from public.embeddings e
                           where e.model='armenian-text-embeddings-2-large' and e.status='success'
                           order by e.vector <=> %s::vector limit 20""",
                        (query_vector_map[case["id"]],),
                    )
                    ann_ids = [r["chunk_id"] for r in cur.fetchall()]
                    exact = exact_neighbors[case["id"]]
                    for k in ann_lane_recalls:
                        ann_lane_recalls[k].append(
                            len(set(ann_ids[:k]) & set(exact[:k])) / max(1, min(k, len(exact)))
                        )
                cur.execute("set local enable_seqscan = on")
                cur.execute("set local enable_bitmapscan = on")
                cur.execute("set local enable_sort = on")
                ann_lane_recall_mean = {
                    k: round(statistics.mean(values), 4)
                    for k, values in ann_lane_recalls.items()
                }

                for ann, fts, final in itertools.product(ann_values, fts_values, final_values):
                    latencies = []
                    result_statuses: Counter[str] = Counter()
                    for case in representative:
                        rows, latency = rpc_rows(cur, "historical", case["query"], query_vector_map[case["id"]], ann, fts, final)
                        latencies.append(latency)
                        result_statuses.update(str(r.get("norm_status")) for r in rows)
                    matrix_rows.append({
                        "ivfflat_probes": probes,
                        "iterative_scan": iterative,
                        "ivfflat_max_probes": max_probes,
                        "ann_limit": ann,
                        "fts_limit": fts,
                        "final_limit": final,
                        "exact_baseline_queries": len(representative),
                        "ann_recall_at_5": ann_lane_recall_mean[5],
                        "ann_recall_at_10": ann_lane_recall_mean[10],
                        "ann_recall_at_20": ann_lane_recall_mean[20],
                        "latency_p50_ms": percentile(latencies, 0.50),
                        "latency_p95_ms": percentile(latencies, 0.95),
                        "latency_p99_ms": percentile(latencies, 0.99),
                        "result_count_after_filters": sum(result_statuses.values()),
                        "status_distribution": dict(result_statuses),
                        "index_used_normal_planner": explain_samples[-1]["index_used_normal_planner"],
                        "index_used_forced": explain_samples[-1]["index_used_forced"],
                    })
    finally:
        conn.rollback()
        conn.close()

    summaries = {mode: summarize_mode(mode, cases, results) for mode, results in mode_results.items()}
    failed = []
    for mode, results in mode_results.items():
        result_by_id = {r["case_id"]: r for r in results}
        for case in cases:
            if not case["expected_document_id"] or not eligible(case["expected_status"], mode):
                continue
            ids = [row.get("document_id") for row in result_by_id[case["id"]]["rows"]]
            if case["expected_document_id"] not in ids[:20]:
                failed.append({"mode": mode, "case_id": case["id"], "category": case["category"], "query": case["query"]})

    raw = {
        "schema_version": 1,
        "environment": "local_disposable",
        "model": "Metric-AI/armenian-text-embeddings-2-large",
        "dimension": provider.dimension,
        "device": provider.device,
        "query_count": len(cases),
        "summaries": summaries,
        "matrix_variant_count": len(matrix_rows),
        "matrix_query_sample_count": 5,
        "explain_samples": explain_samples,
        "limitations": [
            "Provisional synthetic legal corpus; not the future 280-case lawyer-approved gold set.",
            "Latency is local CPU/DB latency and is not production latency.",
            "Matrix recall uses five representative queries because the disposable corpus has 30 documents.",
        ],
    }
    (ARTIFACTS / "prompt19_1_raw_metrics.json").write_text(
        json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    with (ARTIFACTS / "prompt19_1_failed_queries.jsonl").open("w", encoding="utf-8") as handle:
        for item in failed:
            handle.write(json.dumps(item, ensure_ascii=False) + "\n")
    with (ARTIFACTS / "prompt19_1_latency_matrix.csv").open("w", newline="", encoding="utf-8") as handle:
        fieldnames = [
            "ivfflat_probes", "iterative_scan", "ivfflat_max_probes", "ann_limit", "fts_limit",
            "final_limit", "exact_baseline_queries", "ann_recall_at_5", "ann_recall_at_10",
            "ann_recall_at_20", "latency_p50_ms", "latency_p95_ms", "latency_p99_ms",
            "result_count_after_filters", "status_distribution", "index_used_normal_planner", "index_used_forced",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in matrix_rows:
            row = dict(row)
            row["status_distribution"] = json.dumps(row["status_distribution"], sort_keys=True)
            writer.writerow(row)

    print(json.dumps({
        "query_count": len(cases), "matrix_variants": len(matrix_rows),
        "failed_queries": len(failed), "summaries": summaries,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

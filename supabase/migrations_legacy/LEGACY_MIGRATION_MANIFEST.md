# LEGACY MIGRATION MANIFEST

**Archive:** `supabase/migrations_legacy/` — 186 files, dated `20260124` – `20260322` (the "E1" era).
**Status:** historical evidence only. **Excluded from the active clean-replay path** (`supabase/migrations/`).
**Not modified:** files were moved verbatim via `git mv`; original filenames and timestamps preserved; contents unchanged.

## Why archived
These migrations build a `public.*`-tables architecture (`public.profiles`, `public.user_roles`, `public.cases`,
`public.case_files` as **base tables**, enums `case_status`/`case_priority`, `has_role()`, `encrypted_pii` with a
hardcoded default key, seed users, and the 2026-01-26→2026-03-11 recursive-RLS window) that **production does not
have**. Production instead uses `app.*` base tables + `public` compatibility views (see `AUDIT_REPORTS/16`). Replaying
these against a clean database reconstructs a *wrong, parallel* architecture and is data-destructive in several files.
None of these versions appears in production's remote migration ledger (which begins `20260530`).

## Disposition legend
- `ARCHIVE_HISTORICAL` — kept for provenance; never replayed.
- Replacement = the production-faithful baseline in `supabase/baseline/` + the active `supabase/migrations/` keep-set.

## Remote-ledger mapping
Remote-applied? **NO** for every file below (production ledger's earliest entry is `20260530010000`; nothing pre-`20260530` is tracked). All are therefore `local-only`.

## File table

| Migration | Remote Applied? | Local Only? | Objects | Disposition | Reason | Replacement |
| --------- | --------------: | ----------: | ------- | ----------- | ------ | ----------- |
| 20260124125739_28db3ffa-9e78-4b0b-8f4d-ea3d6c1c5494.sql | local-only | yes | table profiles, table user_roles, table cases, type app_role, type cas | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260124125754_fcb605c8-f119-4590-af26-04f775d85d44.sql | local-only | yes | 1 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260124125807_03632a94-e700-4033-9d61-a608280c9e93.sql | local-only | yes | 4 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260124130149_64b40431-b299-4d60-a7e6-2d1d21c71805.sql | local-only | yes | table encrypted_pii, table error_logs, 7 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260124133310_79fa3a7e-928c-4e58-ab0d-83073a3fa021.sql | local-only | yes | table kb_versions, 2 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260124140415_6f2c8d6c-fdc0-43ee-8873-133be438a942.sql | local-only | yes | table api_usage, 3 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260124144717_8de81278-693f-4ccf-84cd-051754f4c64a.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260124211726_6d0db5a9-b506-4d49-b9d0-11648fbf0473.sql | local-only | yes | table teams, table team_members, 11 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260124212110_e7e7a247-787e-4bcb-b973-874823dc70ea.sql | local-only | yes | table case_comments, 6 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260125032401_f4ebdb9b-3f41-42e4-91af-0027c0b2b901.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126011157_54ab8dd5-a023-444f-b306-596ed81797f8.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126043928_2451efea-6528-4fae-8104-db5773a08dab.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126121020_db6b1423-b103-4c8b-9d3b-5f98b996e330.sql | local-only | yes | **DESTRUCTIVE** | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126121037_5c4da454-2fc3-49fc-a729-9e3c16b852f4.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126121552_32975af9-2885-4593-96c3-28f579b41a88.sql | local-only | yes | **DESTRUCTIVE** | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126161532_add_auditor_id_to_profiles.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126161647_68e60496-5f94-4292-8215-50d41a966c01.sql | local-only | yes | 8 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126172600_add_case_type_and_stage.sql | local-only | yes | type case_type | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126172601_add_case_stage_constraints.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126195500_make_court_required.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126201000_add_court_field.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126201001_make_case_type_stage_required.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126230813_2e1e12ae-3eb3-4e30-b5d4-efeaed28b4be.sql | local-only | yes | type case_type | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260126230839_0461d190-6534-4dad-9926-37595598686e.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260127004114_d7b8b703-e6cf-4856-9873-0490d28ba7e1.sql | local-only | yes | 2 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260128052304_0d4bfc1b-8450-4d0e-b8b1-101060691b31.sql | local-only | yes | 2 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260128073946_a2fa1fad-b65b-47a2-8b15-6bd9af2b0804.sql | local-only | yes | table for, table document_templates, table for, type document_category | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260128114840_d8058cd8-e2a6-44cc-8537-5ec0c26d6696.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260128120032_e46449e0-3bc3-48ca-b9e7-5983f24be26f.sql | local-only | yes | 2 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260128190519_f841fce2-80b9-4011-9186-375fc7c96777.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260128205522_a69757f4-9210-4491-8311-e680b2c44bdc.sql | local-only | yes | 2 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260128210244_e11138ad-31c6-49a7-9cb5-6aab49b07668.sql | local-only | yes | 2 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260130161815_422656d3-70d2-4517-a100-6ee4389da41f.sql | local-only | yes | table legal_practice_kb, type court_type, type case_outcome, 1 policy, | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260130234620_58f61d92-8885-40a4-8ff6-d24c10645e05.sql | local-only | yes | table reminders, table notifications, type reminder_type, type reminde | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260131015145_2f8e850d-18a2-4d62-b809-c7d6761a73e6.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260131021456_8e39f2bd-a6b0-4cce-b604-4dcadd0bd5b7.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260131023619_905d5617-1ca8-44ce-b98b-7991f09e21ed.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260201112930_b4762c36-79c3-4921-80c7-de7f8f958283.sql | local-only | yes | 3 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260201130742_3ba69239-5a72-4340-b75d-6f17f20517b6.sql | local-only | yes | 1 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260201131453_19217e7f-0298-4fea-b33e-e16565935ec2.sql | local-only | yes | 4 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260201134818_07154e2d-58d2-4ee6-afd2-945104f1040e.sql | local-only | yes | 6 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260201172737_aeeb010f-a497-41c2-9844-089794876e90.sql | local-only | yes | 2 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260201173455_b1e20336-7269-4a43-ac30-3735de3042aa.sql | local-only | yes | 1 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260201175151_95f37b9e-376e-4ab7-b47c-445a87164383.sql | local-only | yes | 1 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260201184001_911f5538-f06e-4047-beae-aca0e0ec2761.sql | local-only | yes | 3 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260201184232_e5788c46-4d52-48c9-91ee-2f23dd70b02a.sql | local-only | yes | 1 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260201184626_69ce17e6-74cf-4b85-ac7d-7af90e15c4a5.sql | local-only | yes | 1 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260201185139_81e14853-b509-4772-b46c-4157442ec699.sql | local-only | yes | 1 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260201185459_e7016669-13f0-4447-8d50-a90c95c4ae3f.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260202011133_c61a318b-ba62-4439-bc50-af56b839b72c.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260204044811_6096c1cc-7332-444a-8a00-2b3b18e36bb3.sql | local-only | yes | table for, table ai_prompts, table ai_prompt_versions, 6 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260204114043_0ee025d6-dce8-4842-b869-42835196e0a9.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260204120915_aed9554e-ed22-4f7f-986d-21dee4cd37cb.sql | local-only | yes | table to, table telegram_uploads, 7 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260204132732_f76f143b-31c6-47a3-a868-3cb60301da56.sql | local-only | yes | table case_volumes, table agent_analysis_runs, table evidence_registry | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260206142339_96b353f6-75e9-4509-8fd4-4c4005c63729.sql | local-only | yes | table telegram_verification_codes, 8 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260208205037_20de7e2e-d0ef-4226-a2de-f21e2b98e669.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260210033926_3794f252-593e-460a-a0e5-a322421e2d44.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260210034151_ed893140-f74e-4c01-ac17-28d697480551.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260210060142_9aa225dd-a8cf-48b8-ad7f-9af536efbc30.sql | local-only | yes | table legal_practice_kb_chunks, 2 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260210181827_7253fa10-842e-445d-8beb-a16c01bde990.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260211201818_5e0d175b-f8c6-4f81-9d6c-cb2c8f8f7384.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260211201837_7fc73921-e21b-4f0b-a311-46d9afedb3e9.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260211230458_25374392-3993-4358-98f1-9dd13344b8ba.sql | local-only | yes | table user_notes, 4 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260212045445_491b478a-a29d-434d-b0ed-a624b67e4d99.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260213153138_9f094b72-0891-41cf-a1a2-0e3ac7fdd764.sql | local-only | yes | table legal_chunks, 5 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260213160401_f3051830-9a6c-4c87-a1b1-a523c752eb8f.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260213160725_20e0a3a5-494f-45c3-b2e2-3b79491b56ba.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260213171542_d6ced6a1-a260-4ea5-bf41-c7fec4a76cdd.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260213171652_ccc18d0c-5e1d-4335-ae21-6b41d41c4528.sql | local-only | yes | table legal_documents, 3 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260214025123_b98f38ad-27ac-4e19-bc91-0f251b2615e6.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260214034825_9c7242dc-088f-4e77-848b-039a6e253d7e.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260214042442_777e646a-432a-4ada-a33e-eed65cdacd69.sql | local-only | yes | 3 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260214165437_7d837264-09dc-44b9-932c-db7decd20e8b.sql | local-only | yes | 1 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260214172043_613c7628-9fb5-4a7d-b562-a7df0148bf9c.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260214173859_ab946835-d87f-4c56-8c89-3c1ad0a72431.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260214174457_65626d5d-34b3-4f5c-a8cd-6e5d57b081e8.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260214182809_0bd111d3-bfd0-43ea-a7e8-e0c93b1236c8.sql | local-only | yes | table knowledge_base_chunks, 2 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260214184144_a0427689-abcb-4866-80f0-f50c3d7142b0.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260214190410_40f6f840-285b-4213-a68f-0b77fbe5e348.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260214192221_37cf77a6-df25-4392-8e4e-2c9c5176fb2a.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260216102402_4762e26c-4289-42de-b1da-cdb80fd4fc31.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260216102600_62eb4583-e00a-47c0-bbae-5eab62fa0947.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260216102611_3a31a21d-3310-41d7-8f53-6af5cf8991c9.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260216103134_45c89fae-e289-4efe-81a5-965fbe13e72a.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260216103153_da7e2c63-be47-4b75-ac23-7654eaefe56a.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260216103349_d9a3ab14-5584-4e35-b2e9-53095de8279f.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260217134215_3af1e177-fd21-4098-b3f3-a148eaecdacf.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260217183706_c942f7ba-3c4a-413e-b93f-1921386706c0.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260217183914_62320fe9-e50a-4188-83f5-14eb0ce91c74.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260217184354_d0464bc6-f5e0-4926-9b8d-db066d02964b.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260217184434_5e37f9ff-cf6d-4c2f-8e4a-65b4b70123b9.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260217184511_583d5bcf-3584-483f-aa51-c7cf64e64df3.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260217184942_f015b26d-11f1-43fa-a55e-c08fa9af61b0.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260218082419_9a9da552-5d74-4c9d-bfbc-76429d1852f0.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260218085057_5b408b56-05fe-49ae-ab28-9772a6590120.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260219093832_a91056cf-21cc-4e7c-9d09-8f0cb5483614.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260220013751_00d736f5-b021-4799-868b-c24fe299c40f.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260220015229_de33b7ac-c778-4c00-b3c8-8db50d485896.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260220102234_f56ddb52-bf42-4553-a3b9-f63de2ab760a.sql | local-only | yes | table translations_cache, 2 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260221092910_b6c579bd-928f-40f0-b8a9-2e8a92b53f56.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260221152359_ad4cb899-d026-48ad-bee9-9061aea488ab.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260221201112_0d61efa7-537e-412e-8751-7fddc6915e09.sql | local-only | yes | table armenian_dictionary, 2 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260221201741_43efe59d-6fae-402a-873c-70317ecf62d0.sql | local-only | yes | table dictionary_import_jobs, 2 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260222012721_8cce150d-9696-45c2-ab35-22a248a7ede2.sql | local-only | yes | table practice_chunk_jobs, 2 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260222015818_2c54bcc5-f4a0-4966-ab67-5dbf861d456e.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260223025620_60b1fc54-e158-4ea4-86ab-a23a9a1f3302.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260223032629_a35a7786-a228-40ab-a079-f78ebafea05d.sql | local-only | yes | table app_settings, 2 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225104735_a31a992a-4028-423a-a251-96d877ffacac.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225141619_bed6647c-d3d7-4fe7-96d5-43e3931aeb75.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225141842_4d44cc6b-7c9d-4375-8fe5-bb62dc0266b5.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225141905_1abfa4e9-7f06-421c-b941-94bfa72d5c57.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225143110_a7fffe85-752b-4858-9e7c-c009b55a9d2a.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225143133_5dbf043d-b486-4f25-a91a-bb66f6e7a263.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225143435_76170815-5fee-48de-82a4-f300db46f960.sql | local-only | yes | fn, **DESTRUCTIVE** | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225143746_9487cb09-1315-4081-ae05-582fb53f874b.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225144633_885fc975-8950-4136-b2b9-fa5e8cb9d819.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225144842_633a8085-c93b-4bf4-b136-02b21d62105a.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225151007_8b3247bb-433e-472e-8d28-715e1a8a7dc4.sql | local-only | yes | fn, **DESTRUCTIVE** | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225151546_aa3b16ad-142f-4cc6-8dd7-9152924b6cb9.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225185017_ad5de3da-22c3-475b-9733-73c2ff878902.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225190446_ecd3fd96-552b-4982-b2a0-50585da356b4.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225190619_7db6b177-0f16-4fcb-ba16-e3a9153b9f56.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225213459_78ea3fee-d874-4f2a-b65c-8f5f9f3f6d9b.sql | local-only | yes | table eval_suites, table eval_cases, table eval_runs, 4 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260225214858_7796fe0b-1c20-4f4e-95b5-c75bc1e60aba.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260226010149_af57947e-57b6-4384-b0dd-9ae6f27a05a7.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260227014002_3875c17d-19f5-48d1-84a9-be5f88669675.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260227031231_f308af42-759c-4680-a632-b2020facdae6.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260227031346_ffd43709-5837-47d5-bf23-e5f542caa66b.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260227043129_21caa1ca-d000-4fde-a427-800cd34ba286.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260227043830_6229b595-97f5-4092-9bd7-503ba0b13eb6.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260227060741_ce08e9d6-118e-42f5-aff1-5fd5a0488377.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260227060811_9c2e57c8-d452-4faf-a946-1c2ac2d80917.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260227144650_16c63789-7b1c-4068-876a-3385d2afdf8d.sql | local-only | yes | table role_limits, 2 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260227144755_7838abc4-e753-4402-9006-ef296576ac8e.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260227145517_58b54454-8b3c-4b10-8464-49081e15c9e6.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260227150531_aa874edf-bbe9-4956-a226-78c277706baa.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260228014656_7eac867a-f6a4-47d2-9f9f-92b1c4c0b3c4.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260228161143_ac578363-720e-4867-be47-88e4b36ede7a.sql | local-only | yes | 3 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260301141829_efd24ca8-36be-4ac2-b632-55313aa1b88b.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260302002133_9614686e-64d1-40ab-904a-acd1c6b738e5.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260302002222_e21e2b22-76e6-43fd-925a-b9c6bede9877.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260302002414_0f19f18c-74b8-4951-b7db-1aebb64ea913.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260302141434_cba01965-6944-41b7-97e1-bdc97f9254fd.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260303200014_09489647-0688-443b-8c1d-4c922b1af5b1.sql | local-only | yes | 8 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260303202736_401ce94b-25f6-4b58-9075-8dc6751897b1.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260303223544_cdd50e69-44ad-40bc-9c02-28b8451b38e2.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260303230134_06d7d7bd-0197-468f-865d-217360dca623.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304004630_10574f39-ad48-4878-8cb4-ca825eefa732.sql | local-only | yes | 3 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304021800_33c715c2-ea96-417a-8335-1db80cd4f6f2.sql | local-only | yes | 3 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304021815_f929a77b-ec33-4afe-800d-c8fe849c89ca.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304021937_9305f9b0-e8c6-4b55-96e8-8ac278f78bbd.sql | local-only | yes | 4 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304022046_5fd062d6-ea07-4a05-ab8d-b190580e7dba.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304032319_09e2b565-98b1-4014-ae48-ff3a18317765.sql | local-only | yes | table agent_jobs, 4 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304032328_686006a6-0aa4-4834-94b3-630691bcfea2.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304040955_a9c3ca25-21d4-43df-9c25-4fcd812b16c0.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304052105_e71ce215-97ee-44a2-9202-4d936e2e5e61.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304052113_d2f864b6-4fbf-4339-861b-35302a0bfeb4.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304055750_7233a18c-3cff-4ac5-8553-04936639b655.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304062329_30a31d84-cd88-4e34-98b3-aa7cba722047.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304062336_ccae327f-7044-4d72-a657-7c60356241b7.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304062432_a42620c0-6c1f-4b73-bb73-0f7bbd9a0597.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304062655_3f6d5b73-2464-404c-a52e-672c9bf8b178.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304063033_869fe732-54b8-4772-ab54-ef50300f8120.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304064500_bba7faab-68e7-462f-bfab-13148d265f64.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304064623_6acd249a-7bdf-4112-8638-115ef9a4d860.sql | local-only | yes | fn, **DESTRUCTIVE** | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304065456_2912192f-cf61-49e1-8606-b5e49a23f33d.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304150349_8838ddbe-b380-4300-8015-4132e3886e7b.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260304155517_359328cc-1c69-4ae8-91bc-c654aca88e7f.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260305192319_3364066e-c94b-4264-b350-379cf23e26cd.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260305192555_612a2346-9d35-4ea5-b57a-9617cdcc1ddc.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260306015109_c472a436-30a7-459d-95ff-788ce281a747.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260311092000_add_appeal_party_role.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260311094000_fix_profiles_recursion.sql | local-only | yes | 1 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260311095000_fix_cases_recursion.sql | local-only | yes | 2 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260311100000_add_lawyer_rpc.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260311102000_fix_case_comments_for_auditors.sql | local-only | yes | 4 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260320000000_fix_roles_function.sql | local-only | yes | 1 policy, fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260320120000_harden_auth_role_functions.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260321120000_reset_seed_users_and_create_adminhayk006.sql | local-only | yes | **DESTRUCTIVE** | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260322151926_0cda131e-360e-41ec-9db5-9e950090a0d2.sql | local-only | yes | **DESTRUCTIVE** | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260328120000_reset_kb_practice_for_small_embeddings.sql | local-only | yes | fn, **DESTRUCTIVE** | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260412120000_create_echr_cases_hy.sql | local-only | yes | table echr_cases_hy, 2 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260412121500_add_decision_map_to_legal_practice_kb.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260412122000_add_echr_article_to_legal_practice_kb.sql | local-only | yes | alter/data | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260412130000_enqueue_embed_jobs_on_change.sql | local-only | yes | fn | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |
| 20260510051327_6133d7bd-9374-47db-a936-a7916eb8fca0.sql | local-only | yes | 1 policy | ARCHIVE_HISTORICAL | E1 public.* architecture; not in production ledger | prod app.* + compat views (baseline) |

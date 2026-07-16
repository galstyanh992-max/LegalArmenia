# 144 — Large Artifact Cleanup

## Summary

Six large JSONL artifacts (~300MB total) removed from Git index and working tree. Replaced with checksum manifest.

## Artifacts Removed

| Artifact | Records | Size (MB) | SHA-256 (truncated) | Staged |
|----------|---------|-----------|---------------------|--------|
| source_inventory.jsonl | 184,277 | 176.44 | 0290F6F8...E44924A | DELETED |
| source_matching.jsonl | 183,685 | 108.72 | 3BBC9388...F99036B7 | DELETED |
| source_metadata_adapters.jsonl | 10,000 | 8.38 | E33C1283...92DB7952 | DELETED |
| version_lineage.jsonl | 10,000 | 2.43 | 90D9BB89...538000903 | DELETED |
| provision_reconstruction.jsonl | 5,000 | 2.13 | DE0FEA32...4C16FCBD | DELETED |
| pdf_classification_sample.jsonl | 2,000 | 1.70 | 3AA2FA08...3489CCBC | DELETED |

Total: ~299.8MB

## Manifest

AUDIT_REPORTS/artifacts/prompt19_7_large_artifact_manifest.json created with:
- SHA-256 checksums
- Record counts
- Byte sizes
- Schema versions
- Generation commands
- Reproduction instructions
- Path redaction policy (all local paths redacted)

## .gitignore Updated

All six artifacts added to .gitignore to prevent re-committing.

## Git History

Artifacts remain in previous commit history. git filter-repo would be required to fully purge from history. Not performed without explicit approval. New commit will NOT include these files.

## Absolute Paths

0 absolute D:\arlis_pdfs1 paths in committed filenames.
No full filenames exposed in the manifest (paths redacted).

## Status

PASS — artifacts removed from working tree and index, manifest created, .gitignore updated.
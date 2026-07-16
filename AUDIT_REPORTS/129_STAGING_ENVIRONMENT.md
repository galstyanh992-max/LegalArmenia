# 129 — STAGING ENVIRONMENT

## Status
TENANT_STAGING_BLOCKED — OPERATOR_ACTION_REQUIRED

## Requirements
- Isolated Supabase staging project (separate from production)
- pgvector extension
- Representative Metric corpus subset
- Reconstructed metadata
- Two tenants (Client A, Client B)
- Roles: lawyer, admin
- Auth, RLS, Storage, Edge Functions
- Metric endpoint
- No production secrets

## Cost Assessment
Creating a separate Supabase staging project requires:
- Supabase Pro plan or separate free-tier project
- Migration of schema + representative data subset
- Estimated setup time: 2-4 hours
- Estimated cost: Pro plan ($25/month) if free tier insufficient

## Blocker
Staging environment creation requires operator approval for Supabase project provisioning.

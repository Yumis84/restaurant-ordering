#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=kds_acceptance}"

psql -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/kds_production_baseline.sql

migrations=(
  20261003221000_kds_phase_a_additive_draft.sql
  20261003222000_kds_staff_auth_draft.sql
  20261003223000_kds_staff_pin_auth_draft.sql
  20261003224000_kds_b1_single_history_writer_draft.sql
  20261003225000_kds_b2_canonical_transition_draft.sql
  20261003226000_kds_staff_code_auth_draft.sql
  20261003227000_kds_staff_pin_lockout_fix_draft.sql
  20261003228000_kds_staff_management_rpc_draft.sql
  20261003229000_kds_remove_uuid_pin_login_draft.sql
  20261003230000_kds_staff_auth_hardening_draft.sql
)
for name in "${migrations[@]}"; do
  echo "==> migration: $name"
  psql -v ON_ERROR_STOP=1 -f "supabase/migrations/$name"
done

tests=(
  kds_b1_legacy_telegram_compat.sql
  kds_b2_mixed_transition_compat.sql
  kds_transition_contract.sql
  kds_staff_auth.sql
  kds_staff_sessions.sql
  kds_staff_management.sql
)
for name in "${tests[@]}"; do
  echo "==> test: $name"
  psql -v ON_ERROR_STOP=1 -f "supabase/tests/$name"
done

echo "KDS DB acceptance: PASS"

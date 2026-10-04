#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=kds_acceptance}"

run_sql() {
  echo "==> $1"
  psql -v ON_ERROR_STOP=1 -f "$1"
}

run_sql supabase/tests/fixtures/kds_production_baseline.sql

# Phase A: additive schema only.
run_sql supabase/migrations/20261003221000_kds_phase_a_additive_draft.sql

# Staff identity/auth schema can be prepared independently of order cutover.
run_sql supabase/migrations/20261003222000_kds_staff_auth_draft.sql
run_sql supabase/migrations/20261003223000_kds_staff_pin_auth_draft.sql

# B1 must be accepted before B2 changes trigger semantics.
run_sql supabase/migrations/20261003224000_kds_b1_single_history_writer_draft.sql
run_sql supabase/tests/kds_b1_legacy_telegram_compat.sql

# B2 canonical transition + mixed legacy/canonical coexistence.
run_sql supabase/migrations/20261003225000_kds_b2_canonical_transition_draft.sql
run_sql supabase/tests/kds_b2_mixed_transition_compat.sql
run_sql supabase/tests/kds_transition_contract.sql

# Final staff-code auth, persistent lockout, management and hardening.
run_sql supabase/migrations/20261003226000_kds_staff_code_auth_draft.sql
run_sql supabase/migrations/20261003227000_kds_staff_pin_lockout_fix_draft.sql
run_sql supabase/migrations/20261003228000_kds_staff_management_rpc_draft.sql
run_sql supabase/migrations/20261003229000_kds_remove_uuid_pin_login_draft.sql
run_sql supabase/migrations/20261003230000_kds_staff_auth_hardening_draft.sql

run_sql supabase/tests/kds_staff_auth.sql
run_sql supabase/tests/kds_staff_sessions.sql
run_sql supabase/tests/kds_staff_management.sql

echo "KDS DB acceptance: PASS"

-- 0002_engine: columns the Phase 1 engine needs.

-- Which allocation a ledger row is charged to: 'bot:<slug>' or 'dual-review'.
alter table budget_ledger
  add column scope text not null default 'unallocated'
  check (scope in ('dual-review', 'unallocated') or scope ~ '^bot:[a-z0-9-]+$');
alter table budget_ledger alter column scope drop default;
create index budget_ledger_scope_idx on budget_ledger (scope, created_at);

-- Retry backoff and the reason for the last failure.
alter table tasks add column next_attempt_at timestamptz;
alter table tasks add column last_error text;

create index approvals_pending_idx on approvals (status, expires_at);

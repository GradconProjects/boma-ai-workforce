drop index if exists approvals_pending_idx;
alter table tasks drop column if exists last_error;
alter table tasks drop column if exists next_attempt_at;
drop index if exists budget_ledger_scope_idx;
alter table budget_ledger drop column if exists scope;

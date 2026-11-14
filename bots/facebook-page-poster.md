---
slug: facebook-page-poster
name: Facebook Page Poster
department: marketing
enabled: true
purpose: Publishes approved post packages to the Facebook Page. Deterministic code, no LLM.
workspaces: [ongroundpm]
reports_to: chief-of-staff
models: {}                     # no LLM
review: off                    # content was dual-reviewed before approval; this bot only runs code checks
tools: [facebook_publish, facebook_read_own_page, facebook_insights]
accounts: [facebook-page-ongroundpm]
triggers:
  schedule: ["0 6 * * *"]      # daily token health check
  events: [publish_package.due]
  owner_message: false
actions:
  publish_post: 3              # only with a valid approval
  edit_live_post: 1            # protected
  delete_live_post: 1          # protected
  read_comments: 1             # not in v1
  pull_insights: 5
posting_window: { start: "07:00", end: "21:00", tz: "Australia/Sydney" }
daily_post_limit: 3
budget:
  monthly_aud: 0
  max_task_aud: 0
  max_concurrency: 1
  max_retries: 2
memory:
  scope: []
---

# Behaviour (implemented as code)

## Input: approved post package
`{ text, media?, link?, page_id, scheduled_at, content_hash, approval_id, approval_expires_at, idempotency_key }`

## Pre-flight checks — all must pass
1. Approval exists, status approved, not expired.
2. sha256(text + media + link) == approved content_hash.
3. page_id == granted account.
4. scheduled_at in the future and inside posting_window.
5. Media within Facebook limits; link resolves (HTTP 2xx/3xx).
6. idempotency_key never used.
7. daily_post_limit not reached.
8. system_state.paused is false.

## Publish
- Our scheduler triggers at scheduled_at (not Facebook native scheduling).
- POST to the Page feed/photos endpoint (Graph API — verify current version and endpoints at build time).
- Success → store provider_post_id + permalink as evidence → task verifying → done.
- Timeout/unknown → read own Page recent posts for the idempotency marker before any retry.
- Expired token → stop, mark account expired, Chief alerts owner.

## Ongoing
- 06:00 daily token check.
- Insights at +24h and +72h.

# Acceptance tests

| ID | Scenario | Pass condition |
|---|---|---|
| P1 | Approved text post | Published on correct Page, permalink saved |
| P2 | Text changed after approval | Blocked; new approval requested |
| P3 | Expired approval | Blocked |
| P4 | Facebook timeout | Page checked first; no duplicate |
| P5 | Token expired | Posting stops; owner alerted |
| P6 | /pause_all before post time | Not published |
| P7 | Wrong Page in package | Blocked |
| P8 | Image post | Published correctly |

# 08 — Autonomous Social Media & Campaign Management Division (addendum, 14 Nov 2026)

An operational AI marketing department (not a scheduler): a Marketing Director bot reporting to
the Chief, supervising specialist roles, coordinating Creative Studio (graphics), Film Studio
(video) and Ads Manager (paid), per business workspace, within explicit approvals and budgets.

## Owner's target division of labour (once integrations and policies are configured)

| Activity | Mode |
|---|---|
| Research, competitor monitoring, content planning | Automated |
| Captions, flyers, short video drafts | Automated |
| Scheduling pre-approved routine posts | Automated |
| Routine factual replies under approved rules | Conditional |
| Complaints and sensitive enquiries | Approval |
| Activating or increasing paid advertising | Approval |
| Changing brand strategy or account permissions | Approval |
| Campaign analysis and reports | Automated |

The standard: it knows the business and objectives, adjusts to evidence, and asks for intervention
only when needed. After a month's strategy is approved it prepares the week's posts and graphics,
publishes approved items, reviews engagement each morning, flags enquiries and reports weekly
without being re-briefed.

## Requirements (condensed)

1. **Marketing autonomy levels** 0 Advisory · 1 Creative assistant (default for new workspaces) ·
   2 Approved campaign execution · 3 Bounded autonomous management · 4 Supervised department.
   Controls per business, social account and action category. An approved posting schedule is
   never approval to buy ads. *Mapping:* these sit on top of the platform's 1–5 action levels and
   protected actions (`config/policy.yaml`); paid spend, budget increases and permission changes
   remain protected (owner path only) at every marketing level.
2. **Roles** (logical agents in the shared orchestration): Marketing Director; Campaign Strategy,
   Audience Research, Competitor Intelligence, Trend Monitoring, Content Calendar, Creative Brief,
   Copywriting, LinkedIn, Facebook, Instagram, TikTok, YouTube, Other Platforms, Community
   Engagement, Reputation Monitoring, Lead Qualification, Paid Advertising, Conversion
   Optimisation, Marketing Analytics, Marketing Reporting.
3. **Campaigns**: ID, workspace, owner, objective, audience, personas, geography, channels,
   products, key messages, pillars, brand requirements, dates, schedule, organic plan, paid plan,
   approved budget, assets, conversion goals, KPIs, tracking links, landing pages, lead
   destination, approval policy, status, results, recommendations, version history. Multiple at
   once; status/calendar/Kanban/timeline/performance views; pause, duplicate, extend, archive,
   revise; history preserved.
4. **Strategy engine**: objectives (awareness, growth, traffic, leads, enquiries, sales, launches,
   events, thought leadership, authority, retention, recruitment, community, reputation); analyses
   audience, journey, competitors, problems, benefits, channels, past results, capacity, budget,
   conversion; frequency and channel mix; evidence vs assumption labelled; daily → quarterly.
5. **Rolling content calendar** (7/14/30/60/90 days): objectives → topics → pillars → calendar →
   creative tasks → channel variants → validation → approval → scheduling → outcome checks →
   engagement review → recommendations. Repetition detection (topics, wording, imagery, CTAs).
   No promises of reach or virality.
6. **Platform engines** with their own rules, formats, caption guidance, limits, ratios, hashtags,
   mentions, capabilities, permissions, analytics and failure handling. **LinkedIn is the
   priority** (Company Page + personal, text/image/document carousel/video/articles where the API
   allows, polls prep, thought leadership, case studies, hiring, comments, analytics, lead-gen and
   paid planning; construction B2B audiences: main contractors, subcontractors, estimators, QSs,
   PMs, CMs, developers, consultants, procurement; no hashtag stuffing, no bulk DMs, scraping or
   fake engagement). Facebook, Instagram, TikTok, YouTube, X/Threads/Pinterest (capability
   discovery), Reddit (listening, authentic participation only), WhatsApp Business (opt-in,
   messaging windows), Google Business Profile (updates, review monitoring, reply drafts).
7. **Unified inbox**: comments, mentions, replies, authorised DMs, enquiries, reviews, leads, ad
   responses; platform, business, account, sender, content, context, time, classification
   (QUESTION, LEAD, COMPLAINT, POSITIVE FEEDBACK, SPAM, URGENT, TECHNICAL SUPPORT, PARTNERSHIP,
   OTHER), sentiment indication (no false certainty), priority, agent, draft, approval need,
   status; hand-off to a human.
8. **Community manager**: drafts from approved knowledge; auto-replies only for narrowly enabled
   low-risk cases (verified hours, approved links, documented FAQs); human review for refunds,
   sensitive data, legal/regulatory, threats, serious complaints, financial commitments,
   unverified promises, controversies, crises. No deceptive impersonation or fake engagement.
9. **Listening & competitor intelligence** via legitimate APIs and public sources only, with
   source links and dates; outputs topics, emerging questions, messaging gaps, opportunities.
10. **Leads/CRM**: sources, attribution, contact, consent, enquiry, status, owner, follow-ups,
    stage, revenue; transparent scoring; no sensitive inference; no unsolicited outreach.
11. **Paid ads operations**: objectives, accounts, audiences, creatives, copy, landing pages,
    budgets, daily limits, spend history, conversions, approvals, A/B tests, reporting,
    recommendations. Separate permissions: draft · propose budget · approve · activate · spend ·
    modify. Server-enforced; no agent approves its own increase; creative approval ≠ activation.
12. **Attribution**: UTMs, tracking links, conversion events, forms, landing pages, funnels,
    platform vs first-party conversions; models and gaps stated; estimates never shown as revenue.
13. **Analytics**: followers, growth, impressions, reach, views, watch time, engagement (+rate),
    clicks, CTR, CPC, CPM, spend, leads, conversions, CPA, revenue, ROAS; per-platform
    definitions; no mixing incompatible metrics; comparisons, trends, baseline import.
14. **Optimisation agent**: evidence-based recommendations with confidence and reasons; no
    causal claims from correlation; auto-applies only owner-authorised low-risk changes; never
    raises paid spend.
15. **Experiments**: hypothesis, control, variant, audience, window, metrics, sample size, result,
    interpretation, decision, next test; no premature winners; results kept.
16. **Reports**: daily, weekly, monthly, completion, channel comparison, ad spend, leads, content
    reviews, next-period recommendations; charts; PDF/DOCX/XLSX where implemented; the Chief can
    report across workspaces with authorisation enforced.
17. **Proactive jobs**: scheduled content checks, publishing queues, failed posts, engagement
    review, complaint flags, expiring tokens, ad spend, anomalies, weekly plans, report drafts,
    approval notifications; leases, retries, idempotency, DB-persisted (the existing task engine).
18. **Multi-business**: per workspace strategy, accounts, ad accounts, calendar, brand, assets,
    budget, analytics, approval rules, inbox, pipeline, reporting; no wrong-business posting;
    selected business shown prominently before publishing or spending.
19. **Approval Centre**: posts, ad proposals, budget requests, sensitive replies, reputational
    issues, new account connections, strategic changes; approve, reject, edit, request changes,
    batch approve, schedule, revoke, pause campaign, disable agent; immutable audit; bounded
    pre-approval for routine organic posts with expiry and content limits.
20. **Campaign control dashboard** + command interface ("show me everything the marketing
    department did this week and what needs my attention") answered from persisted records only.
21. **Cross-department**: Creative Studio (graphics), Film Studio (video), Ads Manager (paid),
    Chief (priorities, budget, escalation). No duplicate engines.
22. **Capability matrix** per platform: connect, read posts, draft, publish, schedule via our
    worker, read/reply comments, read messages, analytics, paid campaigns — each SUPPORTED,
    REQUIRES_APPROVAL, NOT_AVAILABLE, NOT_CONFIGURED or FAILED; verify API versions/terms; manual
    hand-off where needed; no unauthorised automation.
23. **Cost**: shares the platform's A$50/month (excl. ad spend): job limits, AI budgets, caching,
    economical routing, image reuse, controlled video spend, aggregated reporting, cost tracking;
    say when a request cannot fit the budget; never silently exceed.
24. **Data model additions** (reuse existing tables where equivalent): social_platforms,
    social_accounts, social_account_permissions, social_capabilities, marketing_strategies,
    content_pillars, content_calendars, content_plans, social_posts, social_post_variants,
    publishing_jobs, community_conversations, community_messages, community_assignments,
    social_listening_events, lead_records, lead_activities, campaign_experiments, campaign_kpis,
    campaign_insights, campaign_reports, marketing_recommendations, marketing_approvals,
    marketing_automation_policies, marketing_agent_runs. (`accounts`, `bot_account_grants`,
    `approvals`, `tasks`, `publish_packages`, `campaigns` already cover part of this.)

## First complete integration test (owner's choice)

> "Take over the routine marketing operations for our Concrete Estimating Platform for 30 days.
> Prioritise LinkedIn and Facebook. Target Australian construction businesses, estimators and
> subcontractors. Prepare a professional B2B marketing strategy, a complete content calendar,
> regular posts, carousels, promotional videos and two paid advertising proposals. Monitor results
> and provide weekly reports. Require approval before publishing outside approved policies or
> spending money."

Must: load the workspace; use verified product facts (claim register); generate the strategy and
calendar; produce real editable content; send graphics to Creative Studio and video to Film
Studio; LinkedIn-specific copy and graphics; Facebook variants; two ad proposals; approvals;
schedule approved content; publish through the simulator adapter with recorded post IDs and
outcomes; simulated metrics clearly labelled as test data; weekly report; improvement proposals;
history and cost preserved; **a rejected item never publishes; an unapproved paid ad can never be
activated**. Automated, reproducible tests.

## Division phases (owner's order)

1 Campaign models & UI · 2 Marketing Director & roles · 3 Content calendars & Creative Studio ·
4 LinkedIn & Facebook adapters · 5 Unified inbox · 6 Paid ads & approvals · 7 Leads & attribution ·
8 Analytics, reporting, optimisation · 9 Wider platforms · 10 Advanced bounded autonomy.
Build one complete working workflow early rather than empty pages.

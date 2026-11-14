## Original source: deakin-assessment-assessor(3).skill :: deakin-assessment-assessor/SKILL.md

**Category:** Academic core  
**SHA256 prefix (text):** `9cdc106bc13020fc`  

<details><summary>Original unmodified Markdown content</summary>

---
name: deakin-assessment-assessor
description: >
  Full-service Deakin University assessment analyst, writer, and submission producer. Activate
  whenever a student uploads any Deakin assessment task, rubric, or assignment brief and wants it
  broken down, structured, written, or turned into a submission-ready DOCX. Triggers on: "break
  down this assessment", "help me write my assignment", "what does this rubric want", "write my
  Deakin assignment", "assessment task uploaded", "help me structure my report", "SRM777
  assignment", "MERIT reflection", "portfolio", "group report", "goal setting document",
  "assignment brief", "rubric requirements", or any Deakin unit code (SRM, SRR, etc.) alongside
  any assignment request. This skill reads the full assessment brief, extracts every requirement
  without exception, maps each requirement to the rubric grade descriptors, asks targeted
  interview questions for reflective tasks, applies the Contrarian vetting pass, and produces a
  complete submission-ready DOCX. HD is the only acceptable result.
---

# Deakin Assessment Assessor — Full-Service HD System

## Purpose

This skill transforms any Deakin assessment brief into a complete, submission-ready portfolio.
It does not summarise. It does not assume. It extracts, questions, builds, vets, and delivers.

**Read this file fully before any action. Then load the relevant reference file(s).**

---

## MASTER WORKFLOW — 7 PHASES

Execute phases in order. Do not skip any phase. Do not proceed to Phase N+1 until Phase N is
complete and confirmed by the student.

```
PHASE 1 → Extract every requirement from the brief
PHASE 2 → Decode the rubric: what HD actually demands
PHASE 3 → Build the structural blueprint
PHASE 4 → Run the interview (reflective/MERIT tasks only)
PHASE 5 → Draft the full document
PHASE 6 → Contrarian vetting pass
PHASE 7 → Produce the submission-ready DOCX
```

---

## PHASE 1 — FULL REQUIREMENT EXTRACTION

Read the uploaded assessment brief in full. Extract and display every requirement as a numbered
checklist. Leave nothing out. Group by category:

### 1A — Content Requirements
List every topic, theme, or subject the assessment requires the student to address. Quote the
brief directly for each item (under 15 words, paraphrased otherwise). Mark which are mandatory
vs optional ("if applicable").

### 1B — Structural Requirements
- Required sections in order (cover page, executive summary, body, conclusion, references, etc.)
- Cover page fields (list every field required on the cover page exactly as specified)
- Appendix requirements (what must be included)

### 1C — Formatting Requirements
- Word count and acceptable range (±10% unless otherwise specified)
- Font type and size
- Line spacing
- Alignment
- Heading style
- Sub-heading style
- Referencing style (APA 7th edition unless stated otherwise)
- Submission format (PDF unless stated otherwise)
- Any override rules (e.g., MERIT assignments use Cambria not Times New Roman)

### 1D — Submission Compliance Requirements
- Deadline (if stated)
- Submission platform (CloudDeakin unless stated otherwise)
- File format
- Word count declaration on cover page
- Any group contribution documents required
- Turnitin implications

### 1E — Evidence Requirements
List every piece of supporting evidence or documentation required (workplace documents, meeting
minutes, risk registers, appendices, contribution logs, etc.)

**After extraction:** Display the complete checklist to the student and ask: "Is there anything
missing from the brief that your tutor has communicated separately? Any additional requirements?"
Incorporate any additions before proceeding.

---

## PHASE 2 — RUBRIC DECODING

Read the full rubric. For each criterion:

1. State the criterion name and its mark value
2. Quote or closely paraphrase the HD descriptor
3. Translate into plain-language actions: "To achieve HD on this criterion, you must..."
4. Identify the specific words or phrases in the HD descriptor that signal what matters most
5. Flag any criterion where leaderboard position, MERIT trial count, or submission compliance
   is a hard threshold (not a subjective judgment) — these are binary pass/fail conditions

Display as a table:

| Criterion | Marks | HD Requires | Key Actions | Hard Threshold? |
|---|---|---|---|---|

**Critical:** Any criterion tied to MERIT leaderboard position must be flagged with:
"⚠️ HARD THRESHOLD: This criterion is determined by leaderboard position. Writing quality
cannot compensate for a poor leaderboard result."

---

## PHASE 3 — STRUCTURAL BLUEPRINT

Based on Phase 1 and Phase 2, produce a complete structural blueprint of the document:

- Every section with its recommended word count allocation
- Every sub-section with its purpose and the rubric criterion it addresses
- Every appendix item with its description
- Cover page with every field populated (use placeholders where student data is needed)
- Total word count target and how it breaks down

Present this to the student and confirm before writing begins.

For MERIT assignments: cross-reference with the merit-construction-analyst skill for role-specific
section guidance. Load `references/blueprint-templates.md` for standard Deakin structures.

---

## PHASE 4 — INTERVIEW (REFLECTIVE AND MERIT TASKS)

**Only run this phase for assignments requiring personal reflection, MERIT experience, group
activity, or goal setting.** Skip for purely analytical assignments.

Load `references/interview-questions.md` for the full question bank.

**Core principle:** Ask only what is necessary to write the assignment accurately. Do not invent,
assume, or fabricate details. Every claim in the final document must trace back to something the
student has confirmed.

### Interview Structure

Ask questions in batches of 4–5. Wait for answers before asking the next batch. Do not dump all
questions at once.

**Batch 1 — Context (always ask for MERIT/group tasks):**
1. What is your MERIT role? (Finance Manager / Construction Manager / Overhead Manager / HR Manager / CEO / other)
2. What is your MERIT group number and approximately how many members?
3. What communication tools did your team use? (Teams / WhatsApp / email / other)
4. Did your team submit all MERIT periods on time? If not, which ones were late and why?
5. What is your current leaderboard position (or most recent one you know)?

**Batch 2 — Performance Data (for MERIT assignments):**
6. Can you share the key financial figures from your MERIT reports? (revenue, net profit, ROC/ROT if known, for each period P5–P10 or whichever are relevant)
7. What was your company's best-performing period and what drove it?
8. What was your worst-performing period and what went wrong?
9. How many MERIT trials did your team run this period?

**Batch 3 — Decisions and Reflections:**
10. Describe one decision you made in your role that worked well. What was the situation, what did you decide, and what happened?
11. Describe one decision that did not work out as planned. What went wrong and what did you learn?
12. How would you describe your team's leadership approach? Was there a clear leader, or shared leadership?
13. Did you use any formal management tools? (risk register, lessons learned log, meeting minutes, communication plan, org chart)

**Batch 4 — Goals (for assignments requiring goal progress update):**
14. Briefly describe each of your 5 SMART goals from Assignment 1 (or the goals you set)
15. For each goal, rate your progress: Fully achieved / Substantially / Partially / Not achieved
16. For any goal not fully achieved, what got in the way?

**Batch 5 — Real-World and Soft Skills:**
17. What is one thing you will do differently in a real construction company because of this simulation?
18. Which soft skill (communication, leadership, negotiation, critical thinking) did you develop most? Give one specific example.

After each batch, confirm: "Got it. Moving to the next set of questions." Do not write the
assignment until all relevant batches are complete.

---

## PHASE 5 — DRAFT THE FULL DOCUMENT

Load `references/writing-standards.md` before writing any prose.

### Writing Rules (Non-Negotiable)

**These rules apply to every word of every section:**

1. **Prohibited words** — never use: delve, landscape, evolving, context, insight, nuanced,
   paradigm, comprehensive, framework, facet, dynamic, intricacies, holistic, synergy, pivotal,
   robust, transformative, underpinning, trajectory, leverage, realm, testament, beacon,
   spearhead, foster, elevate, underscore, illuminate, empower, navigate, multifaceted, key,
   crucial, critical, vital, essential

2. **No hyphens or dashes between clauses** — use conjunctions or separate sentences instead.
   Permitted: compound modifiers only (cost-effective, data-driven, peer-reviewed, long-term).

3. **Australian English** — organisation, programme, behaviour, labour, recognise, utilise,
   emphasise, analyse, standardise, colour, centre, defence.

4. **APA 7 citations** — (Author, Year, p. X) for quotes. Paraphrase all other content.
   No source cited more than three times per document. Challenge at least one source per section.

5. **Sentence variety** — short punchy sentences anchor arguments; longer clause-rich sentences
   carry analysis. No two consecutive paragraphs opening with same grammatical structure.

6. **No self-referential framing** — never write "this paper demonstrates", "this report shows",
   "as discussed above".

7. **Reflections must show WHY and HOW** — not just what happened. Every reflective paragraph
   must contain one of: a causal explanation, a theoretical connection, or a real-world
   application.

8. **Cambria 12pt** for MERIT/SRM777 assignments (overrides the usual Times New Roman rule).
   Times New Roman 12pt for all other Deakin assignments.

9. **Every claim from MERIT data must be student-confirmed** — no invented figures.

### Section Writing Order

Write sections in this order to build coherence:
1. Body sections (in blueprint order)
2. Conclusion
3. Introduction (written last, once body is complete)
4. Executive Summary (if required — written after everything else)
5. Cover page fields

---

## PHASE 6 — CONTRARIAN VETTING PASS

After drafting, run a structured Contrarian review before producing the DOCX. This is non-
negotiable. It catches what the Helpful AI brain missed.

Load `references/contrarian-checklist.md` for the full vetting protocol.

**The Contrarian asks:**

### Rubric Attack
- For every rubric criterion: does this draft actually meet HD, or does it only seem to?
- Are there any HD descriptors that use words like "outstanding", "exceptional", "extensive",
  "comprehensive" where the draft is merely adequate or good?
- Is there any criterion where the draft meets Credit or Distinction but not HD?

### Content Attack
- Are there any required content areas from Phase 1 that are missing or underserved?
- Are there any claims made without evidence (no citation, no MERIT data, no student-confirmed
  fact)?
- Are there any sections that describe WHAT without explaining WHY or HOW?
- Are there any invented MERIT figures not confirmed by the student?

### Language Attack
- Run the prohibited word list. Any violations?
- Check every hyphen and dash. Any impermissible clause separators?
- Check Australian English. Any violations?
- Check APA 7. Any citation format errors? Any source cited more than three times?
- Check word count. Within ±10%?

### Structure Attack
- Is the cover page complete? Every required field present?
- Are all required appendices included?
- Is the period table for MERIT assignments complete (P5–P10 for A3, P5–P7 for A2)?
- Is the group contribution document present (if required)?

**Output format:** A numbered list of issues found, each with:
- Issue description
- Location (which section)
- Severity: 🔴 Fatal (will cost marks) / 🟡 Warning (may cost marks) / 🟢 Minor (polish)
- Fix required

Then fix all 🔴 Fatal and 🟡 Warning issues before proceeding to Phase 7.
Ask the student to confirm any fixes that require additional information from them.

---

## PHASE 7 — PRODUCE SUBMISSION-READY DOCX

Load `/mnt/skills/public/docx/SKILL.md` before writing any code.

### DOCX Specifications for Deakin Assignments

```javascript
// Font: Cambria for SRM/MERIT, Times New Roman for all others (12pt throughout)
// Line spacing: single (240 DXA = single spacing in docx-js)
// Alignment: justified
// Headings: Bold (Heading1 style)
// Sub-headings: Bold Italic (Heading2 style with italic run)
// Margins: 2.54cm all sides (1440 DXA)
// Page size: A4 (11906 x 16838 DXA)
// Page numbers: bottom centre
// Cover page: separate section, no page number
```

### Required Sections (generate in order)
1. Cover page (all required fields populated, page number suppressed)
2. Table of Contents (auto-generated from heading styles — use TableOfContents from docx-js)
3. Executive Summary (if required)
4. Body sections (per blueprint)
5. Conclusion
6. References (APA 7, hanging indent, alphabetical)
7. Appendices (labelled A, B, C... with descriptive titles)

### Tables Required in MERIT Assignments
The period performance table (P5–P10 for A3, P5–P7 for A2) must be generated as a proper
docx Table with header row shading. Use placeholder rows if student has not provided all data,
clearly marked with [STUDENT TO COMPLETE].

### After generating:
1. Run `python scripts/office/validate.py output.docx`
2. If validation fails, unpack, fix, repack
3. Run a word count check on the extracted text
4. Present the file to the student
5. List any [STUDENT TO COMPLETE] placeholders so they know what to fill in

---

## SPECIAL HANDLING BY ASSIGNMENT TYPE

### Assignment 1 — Goals (SMART Goal Setting)
- Each of the 5 goals requires its OWN section with: SMART statement, importance/relevance,
  resources, challenges, roadmap/action plan, progress update, reflection
- The SMART criteria must be explicitly demonstrable in each goal statement
- Word count 2000 ±10%: allocate ~360 words per goal section + ~100 for intro
- Load `references/smart-goal-templates.md`

### Assignment 2 — Activity Logs (Group, P5–P6)
- Requires: problems/challenges, decisions/outcomes, problem-solving process, decision-making
  process, teamwork approach, leadership approach, org chart, communication process, strategy,
  performance, future plans — ALL must be addressed
- Word count 6000 ±10%
- Group contribution document is a separate required submission
- Leaderboard criterion uses P7 score
- Load `references/group-report-guide.md`

### Assignment 3 — Performance Evaluation and Skills Reflection (P7–P10)
- Requires portfolio of workplace documents as appendices
- Reflection covers P7–P10 (not P5–P6, which belongs to A2)
- Must include goal-setting progress update from A1
- Leaderboard criterion uses P10/final score
- Presentation (Week 11) is a separate graded component
- Load `references/a3-reflection-guide.md`

---

## DEPENDENCY CHAIN

This skill draws on and integrates with:
- `deakin-academic-writer` skill — for all writing standards, prohibited words, HD audit
- `merit-construction-analyst` skill — for MERIT KPI extraction, period analysis, role-specific guidance
- `the-council` skill — Contrarian frame used in Phase 6 vetting
- `/mnt/skills/public/docx/SKILL.md` — for DOCX generation in Phase 7

When those skills are available, reference them explicitly. When they are not, their core rules
are embedded in this skill's reference files.

---

## REFERENCE FILES

Load when relevant — do not load all at once:

- `references/blueprint-templates.md` — structural blueprints for A1, A2, A3 with word count allocations
- `references/interview-questions.md` — full question bank for reflective task interviews, by batch and assignment type
- `references/contrarian-checklist.md` — full Contrarian vetting protocol with rubric-level checks
- `references/writing-standards.md` — all writing rules, prohibited words, APA 7 format guide, Australian English list
- `references/smart-goal-templates.md` — SMART goal writing patterns with examples
- `references/group-report-guide.md` — A2 group report structure and content guidance
- `references/a3-reflection-guide.md` — A3 reflection structure, sentence starters, anti-patterns

---

*Calibrated for SRM777 Construction Management Practice, Trimester 1 2026, Deakin University.
Also applicable to all Deakin postgraduate assessment tasks. HD is the only acceptable result.*

</details>


---


## Original source: deakin-assessment-assessor(3).skill :: deakin-assessment-assessor/references/blueprint-templates.md

**Category:** Academic core  
**SHA256 prefix (text):** `2cfdfd07df5b1988`  

<details><summary>Original unmodified Markdown content</summary>

# Blueprint Templates — Deakin Assessment Structure Guides

## ASSIGNMENT 1 — Goals (2000 words ±10%)

### Cover Page Fields
- Unit name: SRM777 Construction Management Practice
- Trimester and year: Trimester 1, 2026
- Student name and ID
- Word count (excluding references and appendices)
- Submission date

### Document Structure

| Section | Sub-sections | Words | Rubric Criterion |
|---|---|---|---|
| Introduction | Purpose of the document, brief overview of 5 goals | 100–150 | — |
| Goal 1: Unit Goal | SMART statement → Importance/relevance → Resources → Challenges → Action plan/roadmap → Progress update → Reflection | 350–400 | Criterion 1 (40 marks) + Criterion 2 (40 marks) |
| Goal 2: MERIT Team Goal | Same sub-sections as Goal 1 | 350–400 | Criterion 1 + 2 |
| Goal 3: Individual MERIT Role Goal | Same sub-sections | 350–400 | Criterion 1 + 2 |
| Goal 4: Soft Skill Goal 1 | Same sub-sections | 350–400 | Criterion 1 + 2 |
| Goal 5: Soft Skill Goal 2 | Same sub-sections | 350–400 | Criterion 1 + 2 |
| References | APA 7, alphabetical, hanging indent | Excluded | Criterion 3 (20 marks) |

**Total body:** ~1,900–2,050 words

### SMART Goal Sub-section Checklist (for each of 5 goals)
Every goal section MUST contain all of:
- [ ] A SMART goal statement (1–2 sentences, must be Specific, Measurable, Achievable, Realistic, Time-related)
- [ ] Why this goal was chosen / its significance (2–3 sentences)
- [ ] Its relevance to academic or professional development (2–3 sentences)
- [ ] Resources identified to achieve it (named specifically — e.g., specific LinkedIn Learning course title, specific journal, specific book title)
- [ ] Potential challenges or obstacles (2–3 sentences)
- [ ] Action plan / roadmap (weekly breakdown or milestone plan)
- [ ] Progress update to date (what has been done since setting the goal)
- [ ] Reflection on learning so far (what has changed, what has been discovered)

---

## ASSIGNMENT 2 — Activity Logs Group Report (6000 words ±10%)

### Cover Page Fields
- Group Number
- Group Member Names and Student IDs
- Word count (excluding references and appendices)
- Number of MERIT trials
- Period submission table: P5 / P6 / P7 — deadline, timely Y/N, score, leaderboard position

### Document Structure

| Section | Sub-sections | Words | Rubric Criterion |
|---|---|---|---|
| Executive Summary | Snapshot of report scope, key findings, key outcomes | 200–300 | Criterion 2 (40 marks) |
| 1. Introduction | Context, purpose, team overview, report scope | 200–300 | — |
| 2. MERIT Company Overview | Strategy, org chart, roles, company positioning | 300–400 | Criterion 1 (50 marks) |
| 3. Problems and Challenges (P5–P6) | Specific challenges, how they arose, impact on company | 400–500 | Criterion 1 |
| 4. Decisions and Outcomes | Key decisions made, rationale, results, post-decision analysis | 500–600 | Criterion 1 |
| 5. Problem-Solving and Decision-Making Processes | Frameworks used, how decisions were made, evidence of structured approach | 400–500 | Criterion 1 |
| 6. Teamwork and Leadership | Approach, dynamics, how conflicts were handled, leadership style | 400–500 | Criterion 1 |
| 7. Communication and Engagement | Tools used, frequency, effectiveness, gaps | 300–400 | Criterion 1 |
| 8. Performance Analysis (P5–P6) | KPIs, trend data from student-supplied figures, self-created charts | 500–600 | Criterion 1 + 2 |
| 9. Strategy, Future Plans, and Improvements | Company strategy going forward, what will change in P7 onwards | 300–400 | Criterion 1 |
| 10. Conclusion | Summary of learnings, key takeaways for the team | 200–300 | — |
| References | APA 7 | Excluded | Criterion 2 |
| Appendices | Org chart, contribution document, any supporting material | Excluded | Criterion 3 (10 marks) |

**Total body:** ~5,500–6,300 words

### Mandatory Content Checklist (per additional guidance)
- [ ] Specific problems or challenges discussed
- [ ] Decisions and outcomes discussed
- [ ] Problem-solving process described and theorised
- [ ] Decision-making process described and theorised
- [ ] Teamwork approach described
- [ ] Leadership approach described
- [ ] Organisational chart included (appendix)
- [ ] Group engagement and communication processes described
- [ ] Company strategy discussed
- [ ] Performance analysis presented
- [ ] Future plans discussed
- [ ] Literature / theory cited throughout
- [ ] Group contribution document submitted (separate from report)

### HD Threshold Requirements for A2
- At least 10 MERIT trials for HD
- Timely submission of all periodic MERIT files
- Leaderboard position 1–5 based on P7 score for HD (6–10 for D, 11–20 for C)

---

## ASSIGNMENT 3 — Performance Evaluation and Skills Reflection (3000 words ±10%)

### Cover Page Fields
- Unit name, trimester, year
- Student Name and ID
- Group Number
- MERIT Role
- Word count (excluding references and appendices)
- Number of MERIT trials
- Period table: P5–P10 — deadline, timely Y/N, score, leaderboard position

### Document Structure

| Section | Sub-sections | Words | Rubric Criterion |
|---|---|---|---|
| 1. MERIT Team and Company | Team composition, company name, strategy, overall trajectory P7–P10 | 350–450 | Criterion 1 (50 marks) |
| 2. Your MERIT Role and Experience | Responsibilities, key decisions in P7–P10, tools created/maintained, collaboration, successes and failures | 550–700 | Criterion 1 |
| 3. Learnings and Real-World Applications | Decision-making, leadership/motivation, communication, risk management, negotiation — with theory citations and real-world application | 750–950 | Criterion 1 |
| 4. Goal-Setting Progress Update | All 5 SMART goals reviewed, progress rated, reflection on changes | 350–450 | Criterion 1 |
| References | APA 7 | Excluded | Criterion 1 |
| Appendices | Workplace documents (meeting minutes, risk register, org chart, communication plan, lessons learned register, Excel sheets, etc.) | Excluded | Criterion 1 |

**Total body:** ~2,700–3,300 words

### Mandatory Content Checklist (per additional guidance)
- [ ] P7–P10 activities, learnings, and contributions addressed
- [ ] Successful outcomes discussed
- [ ] Poor outcomes discussed with honest reflection
- [ ] Decision-making process reflected on
- [ ] Motivation discussed
- [ ] Leadership style reflected on
- [ ] Communication style reflected on
- [ ] Negotiation skills reflected on
- [ ] Goal-setting progress update (all 5 goals from A1)
- [ ] Real-world applications explored
- [ ] Workplace documents included as appendices (min 3 for HD)
- [ ] Period performance table complete (P5–P10)
- [ ] No MERIT screenshots (all charts/tables self-created)

### HD Threshold Requirements for A3
- Leaderboard position 1–5 based on P10/final score for HD (6–10 for D, 11–20 for C)
- Timely submission of all MERIT periods throughout
- All relevant workplace documents included
- Extensive research embedded in writing
- Presentation: completed within allocated time, excellent visual summary, outstanding Q&A

### Presentation (Week 11 — part of A3 grade, 20 marks)
- 15 minutes per group / 2.5 minutes per student + 5-minute Q&A
- Each student: role + 1 key decision (30 sec) → outcome with chart (30 sec) → lesson + real-world (45 sec) → what you'd do differently (15 sec)
- Maximum 3 slides per student
- No bullet-point-only slides for HD — every slide needs a chart, table, or diagram
- Online students/majority-online groups: submit narrated presentation instead

</details>


---


## Original source: deakin-assessment-assessor(3).skill :: deakin-assessment-assessor/references/contrarian-checklist.md

**Category:** Academic core  
**SHA256 prefix (text):** `15bb9812649c8139`  

<details><summary>Original unmodified Markdown content</summary>

# Contrarian Vetting Checklist — Phase 6 Protocol

## Purpose

The Contrarian pass exists because the helpful-AI drafting brain is biased toward approval.
It produces work that feels complete. This pass asks: is it actually complete? Does it actually
meet HD? Would a pedantic Deakin marker find fault?

Run every check below. Record every issue found. Fix all 🔴 Fatal and 🟡 Warning before DOCX.

---

## RUBRIC ATTACK — Per Criterion

For each graded criterion in the assignment:

### Assignment 1 — Goals

**Criterion 1 (40 marks): Completeness and quality of each goal section**
- [ ] Does every goal section contain ALL required sub-components? (SMART statement, importance, relevance, resources, challenges, roadmap, progress update, reflection)
- [ ] Does the reflection go beyond describing what will be done — does it show WHY and HOW?
- [ ] Are the resources specific and named (not just "journal articles" but a specific journal or title)?
- [ ] Is the action plan a genuine plan with steps, not a vague intention?
- [ ] Does the goal statement pass ALL 5 SMART criteria? Check each individually.

**Criterion 2 (40 marks): Quality of targets and effort shown**
- [ ] Are the performance targets genuinely HIGH? Would a marker call them ambitious?
- [ ] Does the progress section show actual evidence of effort, not just stated intention?
- [ ] Does reflection provide INSIGHT, not just summary?

**Criterion 3 (20 marks): Writing and formatting**
- [ ] Word count within 1800–2200 words?
- [ ] Font correct (Cambria or Times New Roman 12pt)?
- [ ] Line spacing single?
- [ ] Alignment justified?
- [ ] Headings bold?
- [ ] Sub-headings bold italic?
- [ ] APA 7 citations present and correct?
- [ ] Reference list alphabetical with hanging indent?
- [ ] Word count stated on cover page?

---

**Assignment 2 — Activity Logs**

**Criterion 1 (50 marks): Report content, collaboration evidence, critical thinking**
- [ ] All 8 required topics addressed? (problems, decisions, problem-solving, decision-making, teamwork, leadership, communication, strategy/performance/plans)
- [ ] Is reflection genuinely insightful or merely descriptive?
- [ ] Does the group demonstrate collaborative goal-setting and resolution of issues?
- [ ] Is literature cited and integrated throughout — not just dropped in at the end?

**Criterion 2 (40 marks): Writing quality, literature, MERIT performance**
- [ ] Writing outstanding with no errors?
- [ ] Multiple relevant theories cited?
- [ ] MERIT trial count meets HD threshold (≥10)?
- [ ] All MERIT submissions timely?
- [ ] Leaderboard position meets HD threshold (1–5 based on P7)? — If not, flag as ⚠️ HARD THRESHOLD: writing cannot compensate.

**Criterion 3 (10 marks): Action plan and contribution document**
- [ ] Comprehensive action plan submitted?
- [ ] Progress updates included?
- [ ] Group contribution document complete?

---

**Assignment 3 — Performance Evaluation and Skills Reflection**

**Criterion 1 (50 marks): Portfolio completeness and quality**
- [ ] All required content areas covered? (P7–P10 activities, successes, failures, decision-making, motivation, leadership, communication, negotiation, goal progress, real-world applications)
- [ ] Workplace documents included as appendices? Count: ≥3 for HD
- [ ] Document well-presented and easy to navigate?
- [ ] Research extensively embedded? Count citations: ≥8 peer-reviewed sources for HD
- [ ] No MERIT screenshots anywhere?
- [ ] Period table complete (P5–P10)?

**Criterion 2 (30 marks): Leaderboard position**
- [ ] P10/final leaderboard position confirmed? — ⚠️ HARD THRESHOLD. If position 6–10: D. If 11–20: C. If 21+: P. Writing quality irrelevant to this criterion.

**Criterion 3 (20 marks): Presentation quality**
- [ ] Presentation slides described/drafted?
- [ ] Visual and engaging (charts, not just bullets)?
- [ ] Q&A preparation notes included?
- [ ] Within time allocation (2.5 min per student)?

---

## CONTENT ATTACK

- [ ] Are there any sections where the student describes WHAT but not WHY or HOW? (Mark as 🔴 for reflection assignments)
- [ ] Are there any MERIT figures used that the student did not confirm? (Mark as 🔴 — invented data is academic misconduct)
- [ ] Is every major claim supported by either (a) a citation or (b) student-confirmed MERIT data?
- [ ] Are there any sections shorter than their blueprint allocation by more than 20%?
- [ ] Does the conclusion introduce new material not in the body? (Should not)
- [ ] Does the introduction accurately reflect the body content?

---

## LANGUAGE ATTACK

**Prohibited word scan — check every occurrence:**
delve, landscape, evolving, context, insight, nuanced, paradigm, comprehensive, framework,
facet, dynamic, intricacies, holistic, synergy, pivotal, robust, transformative, underpinning,
trajectory, leverage, realm, testament, beacon, spearhead, foster, elevate, underscore,
illuminate, empower, navigate, multifaceted, key, crucial, critical, vital, essential

**Banned phrases scan:**
"a myriad of", "in the context of", "from a holistic perspective", "transformative impact",
"at the core of", "it is worth noting that", "it is clear that", "clearly", "first and
foremost", "in conclusion", "to sum up", "many studies show", "it is well known that"

**Dash/hyphen scan:**
- Every em dash (—) or en dash (–) between clauses → 🔴 must fix
- Every hyphen between words: is it a legitimate compound modifier?

**Australian English scan:**
behavior → behaviour | center → centre | analyze → analyse | organization → organisation |
program → programme | realize → realise | recognize → recognise | labor → labour |
modeling → modelling | criticize → criticise

**APA 7 citation checks:**
- [ ] In-text format: (Author, Year) or (Author, Year, p. X) for quotes
- [ ] Any source cited more than 3 times? → 🟡 flag
- [ ] Is at least one source challenged on methodological or contextual grounds?
- [ ] Reference list: alphabetical? Hanging indent? DOIs where available?
- [ ] Any citation in text that has no matching entry in reference list?
- [ ] Any entry in reference list with no matching in-text citation?

---

## STRUCTURE ATTACK

- [ ] Cover page contains EVERY required field?
- [ ] Period table complete (no empty cells unless marked [STUDENT TO COMPLETE])?
- [ ] All appendices labelled (Appendix A, B, C...)?
- [ ] Table of contents (if required) present?
- [ ] Executive summary present (if required for A2)?
- [ ] Page numbers present (cover page suppressed)?
- [ ] Word count declared on cover page?
- [ ] Group contribution document prepared (A2)?
- [ ] No MERIT screenshots used anywhere?

---

## SEVERITY SCALE

🔴 **Fatal** — Will directly cost marks. Must fix before submission.
Examples: missing required section, invented MERIT data, wrong word count, missing cover page field, impermissible dash.

🟡 **Warning** — Likely to cost marks. Should fix.
Examples: weak reflection (only describes what), source cited 4 times, one Australian English violation, reference list formatting error.

🟢 **Minor** — Polish. Fix if time allows.
Examples: sentence variety could be better, one slightly vague action plan step, transition word could be stronger.

---

## FINAL VERDICT FORMAT

After completing all checks, produce:

```
CONTRARIAN VETTING REPORT
─────────────────────────
Assignment: [Name]
Draft reviewed: [Section/Full document]

FATAL ISSUES (must fix):
1. [Issue — Location — Fix required]

WARNING ISSUES (should fix):
1. [Issue — Location — Fix required]

MINOR ISSUES (polish):
1. [Issue — Location — Fix required]

HARD THRESHOLD STATUS:
- MERIT trial count: [X] / required [Y] for HD → [PASS/FAIL]
- Timely submissions: [All timely / X late] → [PASS/FAIL]
- Leaderboard position (P7 for A2 / P10 for A3): [X] → [HD/D/C/P/N]

OVERALL VERDICT:
[All fatals cleared → proceed to DOCX / Fatals remain → return to Phase 5]
```

</details>


---


## Original source: deakin-assessment-assessor(3).skill :: deakin-assessment-assessor/references/interview-questions.md

**Category:** Academic core  
**SHA256 prefix (text):** `b9ca972ae02f5219`  

<details><summary>Original unmodified Markdown content</summary>

# Interview Questions — Full Bank for Reflective Tasks

## How to Use This File

Ask questions in batches of 4–5. Wait for student answers before the next batch.
Mark each answer as [CONFIRMED] before writing any related content.
Never use unconfirmed information in the final document.

The batches below are organised by assignment type and urgency. Start with the batch marked
ALWAYS FIRST for the relevant assignment, then proceed based on what the student has provided.

---

## ASSIGNMENT 1 — SMART Goals Interview

### Batch 1 — Context (ALWAYS FIRST for A1)
1. What is your MERIT role? (This shapes Goals 2 and 3.)
2. What is your MERIT group number and when was it formed?
3. Have you already received feedback on any prior assignment in this unit? If so, what did the feedback say?
4. Are you currently enrolled as an on-campus or online student?
5. What week of trimester are you currently in?

### Batch 2 — Goal Content
6. For your UNIT goal: what grade are you targeting in SRM777? What specific actions are you planning to take to achieve it?
7. For your MERIT TEAM goal: has your team agreed on a goal yet? What is it? (e.g., top 5 leaderboard position, specific turnover target)
8. For your INDIVIDUAL MERIT ROLE goal: what specific outcome do you want to achieve in your role? (e.g., maintain positive cash flow in all periods, achieve a ROC above 15%)
9. For your TWO SOFT SKILL goals: which two soft skills are you targeting? For each, is there a specific course, book, or activity you're planning?

### Batch 3 — Progress
10. Have you made any progress on any of these goals so far?
11. For any courses or readings: what specific course name or book title? (Must be named specifically for HD)
12. What challenges have you already encountered or anticipate?

---

## ASSIGNMENT 2 — Group Activity Logs Interview

### Batch 1 — Team Context (ALWAYS FIRST for A2)
1. What is your group number and how many members?
2. List your MERIT team roles (who holds each role — no names needed, just roles)
3. How does your team meet and communicate? (Teams / WhatsApp / email / other — be specific)
4. How frequently do you meet? (Weekly / before each period / ad hoc)
5. Did your team submit P5 and P6 on time? If not, what happened?

### Batch 2 — Performance Data (P5–P6)
6. What were your approximate revenue and net profit figures for P5 and P6?
7. What was your leaderboard position at P7? (Required for rubric grading)
8. How many MERIT trials did your team run (total across P5 and P6)?
9. What was your team's biggest financial challenge in P5–P6?

### Batch 3 — Problems, Decisions, Outcomes
10. Describe one specific problem your team faced in P5. How did you identify it? What did you decide to do?
11. Describe one specific problem your team faced in P6. Same questions.
12. Describe the most important decision your team made across P5–P6. What was the outcome?
13. Was there any decision that did not produce the expected result? What went wrong?

### Batch 4 — Team Dynamics
14. How did your team make decisions? (Vote / consensus / one person decides / other)
15. Was there a natural team leader, or was leadership shared? How did that work?
16. Did any conflicts or disagreements arise? How were they handled?
17. What worked well about your team communication? What did not work?

### Batch 5 — Tools and Strategy
18. Did your team maintain any formal documents? (meeting minutes / risk register / org chart / communication plan / lessons learned)
19. What was your overall tendering strategy in P5–P6? (selective / volume / specific job types)
20. What is your company's plan going into P7? What will you change?

---

## ASSIGNMENT 3 — Performance Evaluation and Skills Reflection Interview

### Batch 1 — MERIT Context (ALWAYS FIRST for A3)
1. What is your MERIT role?
2. What is your group number?
3. Did your team submit P7–P10 on time? Note any late submissions.
4. What is your current/final leaderboard position? (Critical — this determines 30 marks of your grade)
5. How many total MERIT trials has your team run across all periods?

### Batch 2 — Performance Data (P7–P10)
6. For each period P7–P10, provide: approximate revenue, net profit (or loss), leaderboard position (if known)
7. What was the best performing period and what drove it?
8. What was the worst performing period and what went wrong?
9. Did you experience any: H&S incidents / defect issues / cash flow problems / idle labour issues? (Any period)
10. Did you carry out any of: risk register / lessons learned register / communication plan / meeting minutes / Excel models / org chart?

### Batch 3 — Role-Specific Decisions (P7–P10)
11. Describe your single most important role-specific decision in P7–P10. Situation → decision → outcome.
12. Describe a decision specific to your role that did not go as planned. What went wrong? What did you learn?
13. What tools or documents did YOU personally create or maintain (not the team — you specifically)?
14. How did your role interact with the other roles in the team? What were the key dependencies?

### Batch 4 — Learnings and Reflection
15. What leadership approach did your team use? Was there a clear leader? How did decisions get made under pressure?
16. Which communication tool worked best for your team and why? Which was least effective?
17. Did you use formal risk management? If yes, what risks did you identify and how did you respond to them?
18. Were there any negotiation moments — internal (team disagreements) or external (tendering decisions, pricing)? Describe one.
19. What is the single most important thing you learned from the MERIT simulation that applies to real construction practice?

### Batch 5 — Goal Progress (Links to A1)
20. List your 5 SMART goals from Assignment 1 (or describe them briefly if you don't have them handy)
21. For each goal: Fully achieved / Substantially achieved / Partially achieved / Not achieved — and why
22. For any goal not fully achieved: what got in the way?
23. What would you set differently knowing what you know now?

---

## RULES FOR USING INTERVIEW ANSWERS

### MUST CONFIRM BEFORE USING
- Any MERIT financial figure (revenue, profit, ROC, ROT)
- Leaderboard position
- Number of MERIT trials
- Whether submissions were timely or late
- Any claim about a specific decision or outcome
- Any claim about a tool or document the student created

### NEVER INVENT
If a student cannot recall a figure, use a placeholder: [STUDENT TO CONFIRM].
Do not estimate, approximate, or invent. This is academic work — fabricated data is academic misconduct.

### FLAG GAPS
If critical information is missing (especially leaderboard position for A3, which determines 30 marks),
flag it explicitly before writing: "⚠️ I cannot complete Section [X] without your leaderboard position.
This criterion is worth 30 marks and cannot be compensated by writing quality."

</details>


---


## Original source: deakin-assessment-assessor(3).skill :: deakin-assessment-assessor/references/writing-standards.md

**Category:** Academic core  
**SHA256 prefix (text):** `288f184c6cbc4e1e`  

<details><summary>Original unmodified Markdown content</summary>

# Writing Standards — Deakin Assessment Assessor

## The HD Writing Formula

HD Deakin writing has three simultaneous qualities:
1. **Scholarly precision** — every claim is supported, every argument is traceable
2. **Critical intelligence** — sources are challenged, not just cited; analysis is offered, not just summary
3. **Professional clarity** — sentences are varied, transitions are original, meaning is never obscured

These are not sequential. All three operate in every paragraph.

---

## Sentence Construction Patterns

### Variety Rule
No two consecutive paragraphs may open with the same grammatical structure. Rotate:
- Subject-verb-object ("The team adopted...")
- Prepositional opening ("During Period 7,...")
- Subordinate clause opening ("Whereas the initial strategy assumed...,")
- Participial opening ("Drawing on Klein's (1998) model,...")
- Inverted emphasis ("Particularly notable was...")

### The Analysis Sentence
Every analytical paragraph must contain at least one sentence that shows causation, tension, or implication:
- Causation: "The decline in ROC was a direct consequence of idle labour costs accumulating across three consecutive periods."
- Tension: "While Dainty et al. (2006) advocate richer communication channels for complex decisions, the team defaulted to asynchronous messaging under deadline pressure — a pattern that created gaps in shared understanding."
- Implication: "The implication is that markup calibration cannot be treated as a one-period correction; it requires a multi-period feedback loop."

### Prohibited Openings
Never open a paragraph with:
- "It is..." / "There is..." / "There are..."
- "This report..." / "This assignment..."
- "As mentioned..." / "As stated above..."
- Any banned transition: "As a result," / "Clearly," / "Therefore," / "Thus,"

### Permitted Transitions (use these instead)
- "In light of this," / "Building on this point," / "Examining further,"
- "The implication is," / "Turning to" / "Notwithstanding,"
- "Upon closer scrutiny," / "Whereas," / "What follows from this,"

---

## Reflection Writing Standards

Reflection is NOT a diary or a summary. It is a structured interrogation of experience.

### The Four-Part Reflection Formula
For every significant decision, event, or learning:
1. **Situation** (1–2 sentences max): What was the context? State it briefly.
2. **Rationale** (2–3 sentences): Why was this decision made? What data or reasoning drove it?
3. **Outcome** (1–2 sentences): What happened? Quantify where possible.
4. **Learning + Theory** (2–3 sentences): What changed in your understanding? Connect to one source.

### Real-World Application Formula
Every learning must connect to a real-world scenario:
- "In a live [role] context, this would mean..."
- "A [type of firm] facing [similar situation] would benefit from..."
- "The lesson that [X] directly informs how [professional scenario] should be handled."

### Anti-Patterns (these cost marks)
1. Period dump: "In P7 we did X. In P8 we did Y." — No analysis. Mark: Credit maximum.
2. Team praise: "Our team communicated effectively." — No evidence. Mark: Pass.
3. Passive goals: "I achieved my communication goal." — How? What evidence? Mark: Pass.
4. Generic application: "This would be useful in a real company." — Which company? What role?
5. Citation decoration: dropping (Smith, 2020) with no integration of the idea.
6. Describing systems not yet created: never claim to have used tools that were not confirmed.

---

## Citation Standards

### APA 7 In-Text Format
- Paraphrase: (Author, Year)
- Direct quote: (Author, Year, p. X)
- Two authors: (Author & Author, Year)
- Three or more authors: (First Author et al., Year)
- No page number for paraphrase
- Page number required for all direct quotes

### Source Integration Levels (from weakest to strongest)
1. Citation only: "Risk management improves project outcomes (Smith, 2020)." — Weak.
2. Attribution: "Smith (2020) argues that risk management improves project outcomes." — Acceptable.
3. Integration: "Smith (2020) argues that risk management improves outcomes; a claim supported by the team's P8 experience when..." — Good.
4. Critical engagement: "While Smith (2020) advocates formal risk registers, this approach assumes a stable project environment — an assumption that breaks down in MERIT's dynamic tendering context." — HD.

Use level 3 or 4 for every source in every section.

### Reference List Format (APA 7)
```
Author, A. A., & Author, B. B. (Year). Title of article. Journal Name, Volume(Issue), pages. https://doi.org/xxxxx

Author, A. A. (Year). Title of book. Publisher.

Author, A. A. (Year). Chapter title. In Editor Name (Ed.), Book title (pp. xx–xx). Publisher.
```
- Alphabetical by first author's surname
- Hanging indent (first line flush, subsequent lines indented 1.27cm)
- DOI as hyperlink where available
- No full stop after DOI/URL

---

## Australian English Quick Reference

Always use these spellings:
| Use | Not |
|---|---|
| organisation | organization |
| programme | program |
| behaviour | behavior |
| labour | labor |
| colour | color |
| recognise | recognize |
| realise | realize |
| utilise | utilize |
| emphasise | emphasize |
| standardise | standardize |
| analyse | analyze |
| modelling | modeling |
| centre | center |
| defence | defense |
| licence (noun) | license (noun) |
| practise (verb) | practice (verb) |
| fulfil | fulfill |

---

## Word Count Management

### Verification
Before producing the DOCX, estimate word count from draft. Target range for each assignment:
- A1: 1,800–2,200 words (body only)
- A2: 5,400–6,600 words (body only)
- A3: 2,700–3,300 words (body only)

References, appendices, cover page contents are EXCLUDED from the count.

### If over the limit
Cut in this order:
1. Redundant phrases ("it is important to note that", "as mentioned previously")
2. Over-explanation of theory (cite and move on, don't summarise the entire source)
3. Narrative periods that add no new analysis
4. Any sentence that begins "This shows that..." — rewrite to show it directly

### If under the limit
Add in this order:
1. Real-world application paragraphs (always needed for HD)
2. Critical engagement with cited sources (challenge at least one per section)
3. Deeper analysis of specific MERIT decisions (why + how, not just what)
4. Additional progress evidence in goal sections (A1)

---

## DOCX Formatting Specification

### For SRM777 / MERIT Assignments
- Font: Cambria 12pt throughout
- Headings: Cambria 14pt Bold
- Sub-headings: Cambria 12pt Bold Italic
- Line spacing: Single (1.0)
- Paragraph spacing: 0pt before, 6pt after
- Alignment: Justified
- Margins: 2.54cm all sides
- Page numbers: Bottom centre, starting from page 2 (cover page suppressed)
- Page size: A4

### For All Other Deakin Assignments
- Font: Times New Roman 12pt (or Cambria 12pt — student choice per the brief)
- Same rules as above otherwise

### Required Cover Page Elements (never leave blank)
Every cover page must show:
- Unit name and code
- Assignment number and title
- Student name and ID (or group details for group assignments)
- MERIT group number (if applicable)
- MERIT role (if applicable)
- Word count (explicitly stated, excluding references and appendices)
- Number of MERIT trials (if applicable)
- Period performance table (if required by the brief)
- Submission date

</details>


---
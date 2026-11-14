---
slug: referencing-checker
name: Referencing Checker
category: academic
description: >-
  Audits and fixes in-text citations and reference lists in any required style (APA 7 rules in
  full; other styles such as Harvard, MLA, Chicago, IEEE, AGLC, Vancouver as specified by the
  assessment), flags missing or unverifiable sources, and lists every correction made.
triggers: ["check my references", "fix my references", "fix my apa", "apa7", "apa 7", "reference list", "in-text citation", "citation check", "referencing", "bibliography", "harvard referencing", "format my references"]
keywords: ["citation", "reference", "apa", "harvard", "mla", "chicago", "ieee", "aglc", "vancouver", "doi", "bibliography"]
model: planner
max_output_tokens: 8000
review: false
safety: ["academic_integrity"]
references: ["deakin-apa7-checker.md"]
risk: standard
enabled: true
---
# Referencing Checker

1. Confirm the required style from the brief (default APA 7 only if the owner says so). Use the detailed APA 7 rules in the reference material for APA; for other styles apply that style's standard rules and say which edition.
2. Check every in-text citation against the reference list and vice versa: missing entries, orphans, author/year mismatches, et al. rules, page numbers for quotes.
3. Check each reference entry's elements, order, capitalisation, italics, punctuation, DOIs/URLs.
4. Never invent a source, DOI or page number. Anything you cannot verify is flagged "unverified: confirm against the source".
5. Output: corrected reference list, corrected in-text citations, and a table of every change (before → after → rule).

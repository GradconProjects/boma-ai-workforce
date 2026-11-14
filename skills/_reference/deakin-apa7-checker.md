## Original source: deakin-apa7-checker(1).skill :: deakin-apa7-checker/SKILL.md

**Category:** Referencing  
**SHA256 prefix (text):** `c8414e62cc158515`  

<details><summary>Original unmodified Markdown content</summary>

---
name: deakin-apa7-checker
description: >
  Deakin University APA7 referencing auditor, fixer, and corrected-document producer. Activate whenever
  a user wants to check, fix, generate, or audit APA7 references for a Deakin assignment — AND
  automatically produce a corrected .docx with all errors fixed, ready to submit. Triggers on:
  "check my references", "fix my APA", "fix my references", "correct my referencing", "APA7 reference",
  "reference list check", "in-text citation check", "Deakin APA", "format my references",
  "audit my bibliography", "opposer check references", "mark my references", "fix and give me the file",
  "correct the docx", "fix errors in my assignment". Also triggers whenever a user uploads a .docx and
  mentions references, citations, APA, or Deakin. Never rely on training memory for Deakin APA7 rules.
---

# Deakin APA7 Checker, Fixer & Document Producer

You are a Deakin University APA7 auditor AND document repair technician. You find errors AND fix them
directly in the .docx, delivering a corrected file ready for submission.

**ALWAYS read the rules reference first:**
`/home/claude/deakin-apa7-checker/references/apa7-rules.md`
(fallback: `/tmp/deakin-apa7-checker/references/apa7-rules.md`)

---

## FOUR MODES — detect from context

- **MODE 1 — AUDIT + FIX DOCX**: User uploads a .docx → audit then fix all errors in the file
- **MODE 2 — AUDIT ONLY (pasted text)**: User pastes references → audit and return corrected text
- **MODE 3 — GENERATE**: Build a correctly formatted reference from source details
- **MODE 4 — EXPLAIN**: Explain a specific APA7 rule

---

## MODE 1: AUDIT + FIX DOCX — FULL PIPELINE

Execute ALL five steps without stopping or asking the user anything.

### STEP 1 — READ THE FILE

```bash
extract-text /mnt/user-data/uploads/<filename>.docx
```

Locate the "References" heading. Extract every entry. Scan body for in-text citation patterns.

### STEP 2 — READ THE RULES

Read the rules reference file silently before auditing.

### STEP 3 — FULL OPPOSER-LEVEL AUDIT

Check EVERY entry against every applicable rule. For each entry:

---
### Entry [N]: [First ~6 words]
**Source type:** [type]
**Verdict:** ✅ CLEAN / ⚠️ MINOR / ❌ ERRORS FOUND

**Errors:**
| # | Element | What's wrong | Fix |
|---|---------|-------------|-----|
| 1 | [element] | [rule violated] | [corrected text] |

**Corrected entry:**
> [Full corrected reference]

**Rule:** [specific Deakin APA7 rule]

---

After all entries, deliver the scorecard:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPPOSER-LEVEL AUDIT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total entries audited:    [N]
✅ Clean:                 [N]
⚠️ Minor:                 [N]
❌ Errors found:          [N]
Alphabetical order:       ✅ CORRECT / ❌ WRONG

Top recurring issues:
1. [most common]
2. [second most common]
3. [third most common]

HD risk (pre-fix):   HIGH / MEDIUM / LOW
HD risk (post-fix):  LOW — all errors corrected in output file
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### STEP 4 — FIX THE DOCX

Fix every identified error directly in the .docx. Do not ask permission.

#### 4a — Copy and unpack

```bash
cp /mnt/user-data/uploads/<filename>.docx /home/claude/<filename>.docx
python /mnt/skills/public/docx/scripts/office/unpack.py \
  /home/claude/<filename>.docx /home/claude/unpacked_apa7/ 2>&1
```

#### 4b — Locate each broken entry

```bash
grep -n "distinctive_substring" /home/claude/unpacked_apa7/word/document.xml
```

Use 4–6 distinctive words from the broken entry. Confirm the line exists before editing.

#### 4c — Apply every fix with str_replace

Replace the exact `<w:t>` content with the corrected version for each broken entry.

**Mandatory XML rules:**
- Only edit text between `<w:t ...>` and `</w:t>` — never touch surrounding XML structure
- Preserve `xml:space="preserve"` attribute if present
- Escape special chars: `&` → `&amp;` | `"` → `&quot;` | `<` → `&lt;` | `>` → `&gt;`
- Do NOT add or remove italic/bold/font formatting runs — text content only
- If a reference spans multiple `<w:r>` runs, fix each run's `<w:t>` individually

#### 4d — Fix alphabetical order if broken

```python
python3 << 'EOF'
with open('/home/claude/unpacked_apa7/word/document.xml', 'r') as f:
    content = f.read()
paras = content.split('<w:p ')
# Identify paragraph indices for each reference entry by searching distinctive text
# Build correct_order list in strict alphabetical order by first author family name
# (organisation name if group author; title first word if no author; ignore The/A/An)
# Replace the reference-list slice with correct_order, rejoin, write back
new_content = '<w:p '.join(new_paras)
with open('/home/claude/unpacked_apa7/word/document.xml', 'w') as f:
    f.write(new_content)
print("Reordered.")
EOF
```

#### 4e — Pack and validate

```bash
python /mnt/skills/public/docx/scripts/office/pack.py \
  /home/claude/unpacked_apa7/ \
  /home/claude/<filename_fixed>.docx \
  --original /home/claude/<filename>.docx 2>&1
```

Output MUST say "All validations PASSED". If it fails: read error, fix XML, repack.

**Filename rule:** increment version (`_v5` → `_v6`); if no version, append `_apa7fixed`.

#### 4f — Copy to outputs and verify

```bash
cp /home/claude/<filename_fixed>.docx /mnt/user-data/outputs/<filename_fixed>.docx
extract-text /mnt/user-data/outputs/<filename_fixed>.docx | grep -A 60 "References"
```

Confirm every corrected entry appears exactly as intended. If any fix is missing: re-unpack, re-fix, repack.

### STEP 5 — DELIVER

Call `present_files` with the output path. Then output:

**CORRECTED REFERENCE LIST — COPY-PASTE READY**
[Every entry, corrected, in correct alphabetical order]

**Changes made in the file:**
- Entry [N] ([Author]): [one-line description of fix]
- Alphabetical order: [corrected / already correct]

---

## MODE 2: AUDIT ONLY (pasted text)

Same audit as Steps 2–3. After the scorecard output:

**CORRECTED REFERENCE LIST — COPY-PASTE READY**
[All entries corrected, alphabetical order]

No file operations needed.

---

## MODE 3: GENERATE

**In-text citations:**
- Narrative: `Author (Year) verb…`
- Parenthetical: `… (Author, Year).`
- With page: `… (Author, Year, p. X).`

**Reference list entry:**
> [Correctly formatted entry]

**Checklist:** ✅ Author | ✅ Date | ✅ Title case/italics | ✅ DOI/URL | ✅ Source-specific elements

**Missing info needed:** [flag anything the user must supply]

---

## MODE 4: EXPLAIN

1. State the rule directly
2. Correct example
3. WRONG example (labelled WRONG)
4. Deakin-specific variation if any

---

## THE 14 DEDUCTIONS — HUNT EVERY ONE

1. **Full stop after DOI/URL** — silent, always penalised, extremely common
2. **"and" vs "&"** — narrative = "and"; parenthetical = "&"
3. **Book title case** — sentence case only; NOT Title Case
4. **Journal name case** — Title Case (every main word capitalised)
5. **Volume italics** — volume italicised; issue number NOT italicised
6. **Page range dash** — en dash (–) not hyphen (-)
7. **Platform vs content creator** — online courses: instructor/institution = author; Coursera/LinkedIn Learning = publisher/platform
8. **21+ author list** — first 19, ellipsis (…), last author — no "&" before last
9. **Missing descriptor brackets** — [Video], [Online course], [Fact sheet], [Tweet] etc. are mandatory
10. **Alphabetical order** — any disorder is a deduction
11. **Edition notation** — all editions except first must be noted; never "(1st ed.)"
12. **Secondary source** — only list what you actually read; primary stays out of reference list
13. **DOI format** — `https://doi.org/` not `http://dx.doi.org/` where avoidable
14. **AI tool humanisation** — never "ChatGPT discusses/reports/suggests"

---

## DOCX EDIT PRINCIPLES

- Every fix is applied to the XML directly — no manual steps left for the user
- Text content only — never alter font, size, colour, bold, italic XML tags
- Verify fixes by extracting the output file after packing
- If validation fails, diagnose, fix, repack — never give up without a file
- If any fix required an assumption (e.g. missing DOI), note it clearly — but still deliver the file

</details>


---


## Original source: deakin-apa7-checker(1).skill :: deakin-apa7-checker/references/apa7-rules.md

**Category:** Referencing  
**SHA256 prefix (text):** `af27b8f308a70a52`  

<details><summary>Original unmodified Markdown content</summary>

# Deakin APA7 — Complete Rules Reference
*Extracted from Deakin Guide to APA7 (Last updated: 19 June 2024)*

---

## IN-TEXT CITATION RULES

### General
- Format: Author(s) + Year, separated by commas inside parentheses
- Page numbers required for DIRECT QUOTES; optional but encouraged for paraphrases
- Citation can appear at beginning, middle, or end of sentence
- Each in-text citation must have a matching reference list entry (except personal communications and classical works)

### One Author
- Narrative: `Joo (2019) explains…`
- Parenthetical: `… (Joo, 2019).`

### Two Authors
- Narrative: Use "and": `Adelson and Eckert (2020) state…`
- Parenthetical: Use "&": `… (Adelson & Eckert, 2020).`

### Three or More Authors
- Use only first author + "et al." (both narrative and parenthetical)
- Narrative: `Witten et al. (2011) reject…`
- Parenthetical: `… (Witten et al., 2011).`

### Group Authors
- First citation: spell out full name, then abbreviation in brackets (if abbreviation used)
  - Narrative first: `The National Health and Medical Research Council (NHMRC, 2013) provides…`
  - Parenthetical first: `… (National Health and Medical Research Council [NHMRC], 2013).`
- Subsequent citations: use abbreviated form: `The NHMRC (2013)…`

### No Author
- Use title + year in place of author
- Italicise titles of books, reports, webpages
- Use double quotation marks for articles or chapters
- Only use "Anonymous" if the work itself credits "Anonymous"

### No Date
- Use `n.d.` in parentheses after author name: `Jones (n.d.) argues…`

### No Page Numbers
Three options:
1. Section name: `(Department, 2019, Section 1)`
2. Paragraph number: `(Department, 2020, para. 2)`
3. Both: `(Department, 2019, Section 2, para. 3)`

### Citing Multiple Sources
- List alphabetically, separated by semicolons within same parentheses
- `(Amichai-Hamburger & Vinitzky, 2010; Ross et al., 2009; Ryan & Xenos, 2011)`
- Most relevant first with "see also": `(Ross et al., 2009; see also Amichai-Hamburger & Vinitzky, 2010)`
- Same author, multiple dates: `(Duff, n.d.; 2008; 2017; 2019)`

### Repeat Citations — Same Paragraph
- Do NOT need to repeat citation if it's clear same work is paraphrased
- MUST re-cite at start of new paragraph even if cited in previous paragraph

### Secondary Sources
- Use "as cited in": `(Lupton, 2001, as cited in Savage, 2004)`
- Reference list includes ONLY the source you actually read (Savage, not Lupton)

### Same Author, Same Year
- Append lowercase letters a, b, c in alphabetical order by title: `(Reed & Derryberry, 1995a)`
- Reference list must also carry these letters

### Quoting
- Short quote (<40 words): incorporate in text with double quotation marks + page number
- Block quote (≥40 words): new line, indent 1.27cm, double spaced, NO quotation marks, begin with colon, no final full stop, citation with page number after quote

---

## REFERENCE LIST RULES

### General Formatting
- Heading: "References" — centred, bold, new page
- Alphabetical order by first author's family name (or organisation name, or title if no author)
- Hanging indent: 0.5 in (1.27 cm) for each entry
- Double spacing
- Each source listed ONCE regardless of how many times cited
- Four elements: Author. (Date). Title. Publication details.

### Author Formatting
- Family name first, then initials with periods and spaces: `Smith, J. A.`
- Up to 20 authors: list all, use "&" before last author
- 21+ authors: list first 19, then ellipsis (…), then last author — NO "&" before last author
- Group author: use full name
- No author: title moves to author position (no italics, no quotation marks)

### Date Formatting
- Year in parentheses followed by period: `(2019).`
- Full date for webpages, blogs, social media where available: `(2019, November 16).`
- No date: `(n.d.).`
- In press: `(in press).`

### Title Formatting
**Books and reports:**
- Italicise
- Sentence case (only first word of title + subtitle capitalised, plus proper nouns/acronyms)
- Subtitle after colon: capitalise first word

**Journal articles:**
- Article title: sentence case, NOT italicised
- Journal name: italicise, Title Case (capitalise every main word)
- Volume number: italicise

**Webpages:**
- Italicise the title of the specific webpage
- Do NOT italicise the website/platform name

### DOIs and URLs
- Where DOI exists: use DOI instead of URL
- DOI format: `https://doi.org/xxxxx`
- Do NOT put full stop after DOI or URL
- Present as hyperlink where possible
- No date of retrieval (except for sources designed to be regularly updated, e.g. databases, Twitter profiles, OERs)
- Do NOT include Deakin Library search URLs
- Sources accessed via database with no DOI: format as print source (no database URL)

---

## SOURCE-SPECIFIC FORMATS

### Book
```
Author, A. A. (Year). Title of book: Subtitle (Xth ed.). Publisher. https://doi.org/xxxxx
```
- Edition: include all except first (2nd ed., 3rd ed., Rev. ed., Abr. ed.)
- If publisher = author: omit publisher
- E-books: same format as print (no format/platform/device info)

### Book Chapter (Edited Book)
```
Author, A. A. (Year). Title of chapter. In A. Editor & B. Editor (Eds.), Title of book (Xth ed., pp. xx–xx). Publisher. https://doi.org/xxxxx
```
- "In" before editors
- "(Ed.)" or "(Eds.)" after editor names
- Page range of chapter in parentheses
- Edition and page range share same brackets, separated by comma

### Journal Article
```
Author, A. A., & Author, B. B. (Year). Title of article. Title of Journal, volume(issue), pages. https://doi.org/xxxxx
```
- Article title: sentence case, not italicised
- Journal + volume: italicised
- Issue number in parentheses (not italicised), immediately after volume
- Article number: `Article e0206358` instead of page range
- Advance online publication: add phrase "Advance online publication." before DOI
- In press: `(in press)` as date, no volume/issue/pages

### Government/ABS Publications
- ABS: include catalogue number in parentheses after title
- Most specific agency as author
- Parent agency as publisher
- Full name of group author in reference list

### Webpage
```
Author, A. A. (Year, Month Day). Title of webpage. Website Name. URL
```
- Use "Date last updated" as publication date (if page-specific, not whole site)
- Do NOT use "Date last reviewed"
- When website title = author name: do not repeat it

### Web Document
- Same as webpage + add `[document type]` in square brackets after title if not evident

### Social Media
- Real name first, then [screen name] in brackets
- Provide retrieval date for regularly-updated sources (Facebook pages, Twitter profiles)
- Facebook post: up to first 20 words of post + `[Status update]`
- Twitter: up to 20 words + description in brackets e.g. `[Tweet]`
- Instagram: include `[Photo]`, `[Video]`, `[Instagram profile]` etc.

### Blog
- Blog post: same format as webpage
- Blog comment: use `[Comment on the blog post "Title"]` description

### Web Video / YouTube
```
Account owner. (Year, Month Day). Title of video [Video]. Platform. URL
```
- YouTube: account owner is author
- TED: main speaker may be author
- Include upload date

### Podcast
```
Author, A. A. (Host). (Year, Month Day). Title of episode (Episode No.) [Audio podcast episode]. In Title of Podcast. Publisher. URL
```

### Film
```
Director, A. A. (Director). (Year). Title of film [Film]. Studio.
```

### TV Episode
```
Writer, A. (Writer) & Director, B. (Director). (Year, Month Day). Title of episode [Television series episode]. In A. Producer (Executive producer), Title of Series. Network.
```

### Report
```
Author, A. A. (Year). Title of report (Report No. xxx). Publisher. URL
```
- If author = publisher: omit publisher

### Thesis
- Unpublished: `[Unpublished doctoral dissertation]` or `[Unpublished master's thesis]`
- Published: include institution name within brackets + database name/URL

### Conference Paper (Published)
```
Author, A. A. (Year). Title. Proceedings of Conference Name, Country, vol(no), pages. DOI
```

### Conference Presentation
```
Presenter, A. (Year, Date Range). Title [Paper presentation]. Conference Name, Location. URL
```

### Standards
```
Standards Body. (Year). Title of standard (Standard Number). URL
```

### Legislation (Acts)
```
Title of Act Year (Jurisdiction) pinpoint.
```
- Both title and year italicised
- Jurisdiction abbreviations: Cth, Vic, NSW, etc.
- In-text: italicise act name

### Cases
- Case with unique court identifier: `Case name [year] Unique court identifier Judgment number.`
- Case without (from law report): `Case name (year) Volume Abbreviation First page, pinpoint.`
- Square brackets if year is unique identifier; round brackets if continuous volume numbers

### Artificial Intelligence
```
Owner. (Year). Name of AI model (Version) [Large language model]. URL
```
- Do NOT humanise the tool ("ChatGPT discusses" → incorrect)
- Must also include acknowledgements section in submission
- In-text: `(OpenAI, 2023; see Appendix A)`

### Artwork
```
Artist, A. (Year). Title of artwork [medium]. Gallery, Location. URL
```

### Images
- Named photographer: `Photographer, A. (Year). Title [medium]. Website. URL`
- Unknown photographer: organisation as author
- From database: include retrieval date

### Figures and Tables
- Figure number above (bold): `Figure 3`
- Title below number (italics)
- Note below figure/table including copyright statement
- Copyright statement: begin with "From..." or "Adapted from..."
- Always include corresponding reference list entry for source

### Media Release / Press Release
- Include `[Press release]` after title
- Omit publisher if same as author

### Course Materials
- Only cite with permission from Unit Chair
- Include URL of unit site

### Personal Communications
- NOT included in reference list
- In-text only: `J. Robinson (personal communication, May 11, 2022) indicated…`

### Translated Work
- In-text: both original and translation year: `(Piaget, 1970/1972)`
- Reference: include translator + translation year, then `(original work published 1970)` at end

### Annotated Bibliography
- Same alphabetical order as reference list
- Annotation: new paragraph below reference, 1.27cm indent
- Second+ paragraphs: indent first line 1.27cm

---

## COMMON ERRORS TO CATCH

1. Full stop after DOI/URL → WRONG
2. "&" used in narrative citation → WRONG (use "and")
3. "and" used in parenthetical citation → WRONG (use "&")
4. Et al. used for 1-2 authors → WRONG
5. Page number omitted from direct quote → WRONG
6. All author names listed in-text for 3+ authors → WRONG (use et al.)
7. Volume number not italicised in journal → WRONG
8. Journal article title italicised → WRONG
9. Book title not italicised → WRONG
10. Book title in Title Case (all words capitalised) → WRONG (sentence case only)
11. Journal title in sentence case → WRONG (Title Case required)
12. "http://dx.doi.org" used when "https://doi.org" is possible → suboptimal
13. Date of retrieval on sources that don't change → WRONG
14. Deakin Library database URL included → WRONG
15. Full stop after URL → WRONG
16. Publisher repeated when same as author → WRONG
17. Edition "(1st ed.)" included → WRONG (first edition not noted)
18. "&" omitted before last author in 21+ author list → WRONG (no "&" for 21+)
19. Secondary source: primary source listed in references → WRONG (only list what you read)
20. Personal communication listed in reference list → WRONG
21. "Anonymous" used when author is simply unknown → WRONG (only if work credits "Anonymous")
22. Two citations from same source not using a/b suffixes → WRONG (same author, same year)
23. Multiple sources in parentheses not in alphabetical order → WRONG
24. New paragraph not re-cited → WRONG
25. AI tool described as "discussing" or "reporting" → WRONG (don't humanise)

</details>


---
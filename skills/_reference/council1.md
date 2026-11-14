## Original source: council1.skill :: claude-council/SKILL.md

**Category:** Critical review  
**SHA256 prefix (text):** `c92f286548620aac`  

<details><summary>Original unmodified Markdown content</summary>

---
name: claude-council
description: >
  Summons a "Claude Council" — a panel of distinct AI expert personas who independently analyse any question, decision, or dilemma from their own perspective, then debate each other, and finally converge on a synthesised verdict. Use this skill whenever the user asks for multi-perspective analysis, a council of experts, devil's advocate thinking, structured deliberation, a panel debate, "what would X think", "get me multiple opinions", "analyse this from all angles", "debate this", or any phrasing where richer multi-voice reasoning is wanted. Also trigger when the user's question is genuinely complex or high-stakes and a single perspective clearly isn't enough. The output is always a visually rich interactive React artifact showing each council member's position, cross-examination, and the final synthesis. This skill uses the Anthropic API (claude-sonnet-4-20250514) to power each council member independently.
---

# Claude Council

## What This Skill Does

Convenes a panel of 3–6 expert personas (the "Council") dynamically selected to fit the user's question. Each persona independently analyses the problem, then the Council cross-examines each other's positions, and a Chief Synthesiser delivers the final verdict. The result renders as a premium interactive React artifact.

---

## Step 1 — Understand the Query

Before building anything, read the user's question carefully and decide:

1. **What domain(s) does this touch?** (legal, financial, technical, philosophical, strategic, psychological, scientific, creative, etc.)
2. **What council composition makes sense?** Select 3–6 archetypes whose perspectives would genuinely conflict or complement. Examples:
   - Business decision → Strategist, Risk Officer, Finance Analyst, Customer Advocate, Devil's Advocate
   - Technical architecture → Senior Engineer, Security Expert, UX Designer, Product Manager, Cost Optimiser
   - Ethical dilemma → Ethicist, Pragmatist, Stakeholder Advocate, Contrarian, Consequentialist
   - Career/life decision → Optimist, Realist, Risk-Taker, Stability-Seeker, Long-term Thinker
   - Legal matter → Legal Analyst, Commercial Realist, Risk Manager, Plain-English Explainer

**Never use the same archetype twice. Never use generic names like "Expert 1". Give each persona a distinct title and a one-sentence personality descriptor.**

---

## Step 2 — Build the React Artifact

Create a single `.jsx` artifact. Use the Anthropic API inside the artifact (the API key is injected automatically — do NOT ask the user for one). Structure the artifact as follows:

### Architecture

```
[Council Convenes] → [Parallel API calls: one per member] → [Debate Round] → [Synthesis] → [Display]
```

### API Call Pattern

Each council member gets their own API call with a system prompt defining their persona:

```javascript
const memberResponse = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: `You are ${member.title} on the Claude Council. ${member.personality}
    
Your job: Analyse the following question from YOUR perspective only. Be direct, opinionated, and specific. Do not hedge excessively. Surface the most important insight your perspective uniquely brings. End with a clear stance or recommendation. Keep your response to 3–4 focused paragraphs.`,
    messages: [{ role: "user", content: userQuestion }]
  })
});
```

For the debate round, send all member responses back and ask each member to respond to the strongest counter-argument:

```javascript
const debatePrompt = `Here are the other council members' positions:

${otherMembers.map(m => `**${m.title}**: ${m.analysis}`).join('\n\n')}

Now — what is the single strongest challenge to YOUR position above, and how do you respond to it? Keep this to 2 paragraphs.`;
```

For the synthesis, use a "Chief Synthesiser" persona that receives all positions and debate responses:

```javascript
system: `You are the Chief Synthesiser of the Claude Council. Your job is to read all council members' positions and debates, identify where they genuinely agree and disagree, and produce a clear, actionable synthesis. Do not just summarise — identify the key tensions, make a final recommendation, and flag any irreducible trade-offs. Be decisive. 4–5 paragraphs.`
```

### Loading States

Show a live-updating council chamber UI while API calls are in progress:
- Each council member card shows a "deliberating..." skeleton while their call is pending
- Once their response arrives, animate it in
- Show a progress bar across the three phases: Analysis → Debate → Synthesis

---

## Step 3 — Visual Design Requirements

The artifact must look **premium and distinctive**. Follow these rules:

### Layout
- **Header**: "THE CLAUDE COUNCIL" in bold editorial typography, with the user's question displayed beneath
- **Council Grid**: Cards for each member arranged in a grid (2–3 columns depending on count)
- **Each card** shows: persona icon (emoji relevant to their field), title, personality tag, their analysis, and debate response
- **Synthesis section**: Full-width at the bottom, visually separated, with a gavel or scales icon

### Colour Scheme
Choose ONE of these palettes (rotate to avoid repetition):
- **Chambers Dark**: Deep navy `#0D1B2A` background, gold `#C9A84C` accents, ivory text
- **Council Light**: Warm parchment `#F5F0E8`, dark charcoal `#1A1A2E`, crimson `#8B0000` accents
- **Tribunal Modern**: Charcoal `#212121` background, electric teal `#00BCD4` accents, white text
- **Senate Classic**: Deep burgundy `#4A0E2D`, champagne `#E8D5A3`, slate accents

### Typography
Use Google Fonts. Pick from: `Playfair Display`, `IM Fell English`, `Cormorant Garamond`, `Libre Baskerville`, `Spectral`. Pair with a clean sans-serif for body.

### Animation
- Staggered card reveal on load
- Pulsing "deliberating" animation while waiting
- Smooth slide-in for each response as it arrives
- Subtle shimmer on the synthesis section when it appears

### Member Cards Must Include
- Colour-coded left border (unique colour per member)
- Phase toggle: "Analysis" | "Debate" tabs per card
- Agreement indicator: after synthesis, highlight which members' views were adopted

---

## Step 4 — Error Handling

- If an API call fails, show that member's card in an error state with a retry button
- Never let one member's failure block the others
- Handle partial results gracefully — show what completed, note what failed

---

## Step 5 — Implementation Notes

### Run calls in parallel
```javascript
const results = await Promise.allSettled(
  council.map(member => fetchMemberAnalysis(member, userQuestion))
);
```

### State management
```javascript
const [phase, setPhase] = useState('analysis'); // 'analysis' | 'debate' | 'synthesis'
const [memberStates, setMemberStates] = useState(
  council.map(m => ({ ...m, status: 'pending', analysis: null, debate: null }))
);
const [synthesis, setSynthesis] = useState(null);
```

### Streaming (optional but impressive)
If you want real-time text streaming, use `stream: true` and process the SSE chunks to update each member's text character-by-character as it arrives.

---

## Quality Checklist

Before presenting the artifact:
- [ ] All API calls use `claude-sonnet-4-20250514`
- [ ] Each persona has a genuinely distinct voice and perspective
- [ ] The debate round creates real tension (not just agreement)
- [ ] The synthesis is decisive — it makes a call, not just a summary
- [ ] The UI renders correctly while loading (no blank screens)
- [ ] The design is visually distinctive and premium
- [ ] No placeholder text or TODO comments left in code
- [ ] `max_tokens: 1000` per call (never exceed this)
- [ ] No API key in code (injected automatically)

---

## Example Council Compositions (Quick Reference)

| Question Type | Council Members |
|---|---|
| Business decision | 🎯 Strategist · 💰 Finance Lead · ⚠️ Risk Officer · 🧑‍🤝‍🧑 Customer Advocate · 😈 Devil's Advocate |
| Technical choice | 🏗️ Architect · 🔒 Security Lead · 🎨 UX Designer · 📦 DevOps Engineer · 💸 Cost Optimiser |
| Career/life | 🚀 Optimist · 🔎 Realist · 🎲 Risk-Taker · 🏡 Stability Seeker · 🕰️ Long-Game Thinker |
| Ethical dilemma | ⚖️ Ethicist · 🔧 Pragmatist · 👥 Stakeholder Voice · 🔄 Contrarian · 📊 Consequentialist |
| Legal/regulatory | 📜 Legal Analyst · 💼 Commercial Realist · 🛡️ Risk Manager · 🗣️ Plain-English Guide |
| Investment | 📈 Bull · 📉 Bear · 🔬 Fundamentals Analyst · 🌊 Macro Watcher · 🧮 Quant |

---

## Triggering This Skill

Always use this skill when the user says things like:
- "Convene the council on..."
- "Get me multiple perspectives on..."
- "What would different experts say about..."
- "Debate this for me..."
- "Analyse this from all angles..."
- "Play devil's advocate..."
- "I need a panel of experts to weigh in..."
- "Council, assemble!" or similar playful summons
- Any complex, high-stakes decision where one perspective is clearly insufficient

</details>


---
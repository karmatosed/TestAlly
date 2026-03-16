# TestAlly for Developers

## The instant guide for manual accessibility tests 

## Pitch line {#pitch-line}

AXE tells you what’s wrong in their automated test, ChatGPT guesses how to fix it. We do both, with vetted WCAG-backed sources, minimal code diffs, and we offer what no one else does: our service provides **a “per-component” manual testing walkthrough** that developers can trust.

## TL;DR {#tl;dr}

Nemanja and I were discussing a pattern that drives us both up the wall. We see developers build a component, run their automated tests, and think they are clear for takeoff. Then the remediation report comes back, and it is a disaster. The tester lists four or five problems that a simple manual check would have caught in seconds.

This is a massive morale killer. Developers are already under pressure to ship, and getting negative feedback on work they thought was finished is incredibly demotivating. But let's look at the finances here. This loop of shipping, failing, and fixing is inefficient and expensive. You are paying for the developer's time twice and the tester's time once, just to fix something that should have been right the first time.

The tragedy is that manual testing is usually quite simple. It is rarely rocket science. But because nobody taught the developer how to do it, they are flying blind. They are leaving money on the table and wasting hours that could be billed elsewhere. If you want to keep your margins healthy and your developers happy, you have to close that knowledge gap.  
**TABLE OF CONTENT**

[Pitch line	1](#pitch-line)

[TL;DR	2](#tl;dr)

[**Overall Summary	3**](#overall-summary)

[1\. Project vision (long term)	4](#1.-project-vision-\(long-term\))

[2\. Benefits to the open source community	5](#2.-benefits-to-the-open-source-community)

[3\. SWOT analysis	5](#3.-swot-analysis)

[Strengths	5](#strengths)

[Weaknesses	5](#weaknesses)

[Opportunities	5](#opportunities)

[Threats	5](#threats)

[4\. MVP scope (48-hour hackathon)	6](#4.-mvp-scope-\(48-hour-hackathon\))

[Inputs	6](#inputs)

[Process	6](#process)

[5\. Custom rules for MVP wow factor	6](#5.-custom-rules-for-mvp-wow-factor)

[7\. Hackathon dream team (12 people)	7](#6.-hackathon-dream-team-\(12-people\))

[9\. ROI calculations (WIP)	7](#7.-roi-calculations-for-users)

[Freelancer	7](#heading=h.7xb21c1klqpx)

[Small agency (5 devs, 3 designers)	7](#heading=h.puapunpj0pp8)

[Enterprise team (15 devs, 5 designers, 3 QA)	8](#heading=h.agpy1qp7atsl)

[THE FUTURE	8](#8.-budget-/-future-plans)

[Cost estimates	8](#cost-estimates---hackathon-/-pilot-stage)

[Lean hackathon/pilot	8](#heading=h.czogc93wa9lb)

# 

# Overall Summary {#overall-summary}

We are building TestAlly, a specialized manual testing assistant that empowers developers to bridge the critical gap where automated accessibility tools fail. By using AI to interpret a component's intent and code, the tool provides immediate, step-by-step manual testing instructions, or a definitive "all-clear" statement if no testing is required, allowing developers to verify their work with confidence in real-time. The project is focused on creating a self-supporting workflow that teaches developers the "why" behind accessibility in context, effectively using AI to solve the human-centric challenge of manual verification so that teams no longer have to wait on external accessibility departments to ship accessible code.

## 1\. Project vision (long term) {#1.-project-vision-(long-term)}

A developer-first, AI-powered accessibility assistant that gives and comes from context. :

- Runs static checks on HTML, JSX, and CSS components. (Helps the LLM to understand what the focus of the component is, to be able to provide the manual testing recommendation.)  
- Uses a community-vetted accessibility source to explain issues and provide minimal, semantic fixes. (AXE API)  
- Always cites official sources and refuses to guess without a reference.  
- Outputs scenario for manual testing for QA.  
- (Stretch goal / future long term opportunity) Integrates with CI/CD, and design tools. 

## 2\. Benefits to the open source community {#2.-benefits-to-the-open-source-community}

Open source tool  
Extendable to use on other platforms

## 3\. SWOT analysis {#3.-swot-analysis}

### Strengths {#strengths}

- First **open source** tool to combine static checks with community-vetted AI explanations on how to test a component **manually**.  
- High trust potential through WCAG-cited sources, minimal fixes.  
- Multi-audience appeal: devs, designers, QA, OSS maintainers.  
- Accessibility expertise with collaborative community input  
- Multi-model approach to improve accuracy.

### Weaknesses {#weaknesses}

- Limited coverage at launch.  
- Dependent on LLM quality and pricing.  
- Trust must be earned over time.  
- Framework-specific coverage takes extra work.  
- Requires careful legal disclaimers.

### Opportunities {#opportunities}

- First mover advantage guidance in manual accessibility testing.  
- Integrations with developer and design tools.  
- Sponsorship from vendors and accessibility orgs, including government organizations.  
- Education/training product spin-offs.

### Threats {#threats}

- Larger players could replicate features.  
- WCAG 3.0 changes requiring major updates.  
- AI provider API changes or pricing shifts.  
- Misperception as “AI solves accessibility” tool.  
- Stale data resources undermine trust.

---

## 4\. MVP scope (48-hour hackathon) {#4.-mvp-scope-(48-hour-hackathon)}

In general: we should be able to focus on building the MVP, and last year taught us that having the pillars in place for documentation and an accompanying website really helps.

### Inputs {#inputs}

- HTML, JS and CSS pasted in UI  
- (Stretch) JSON design tokens: colors, typography, spacing

### Process {#process}

1. User adds in component (rendered or source code), and tells the LLM in one sentence what it is. Accordion, tabs, table, etc.   
2. Run test tools (to be determined)   
3. Then we provide a test scenario for manual testing, with **I**f **T**his **T**hen **T**hat Guidance, based on appointed documentation (NoteBookLM principle?)

### What is in scope for the hackathon

* Automatic installation of the component (might be short circuited for WordPress, but it needs to distinguish between non-WP component)  
* Analyse the patterns used (animations, transitions, onclick events, focus events, etc..) in the component and determine test path  
* Organize test path into meaningful “do-this-click-there” output  
* Documentation for what was made

### What is **not** in scope

* Loading the component from third party source or any API implementation other than LLM/AI  
* Automatic mitigation of issues discovered

### Stretch Goal Options

* Context detection simply from the input component  
* CI (Github action) implementation to add a comment on PR with test scenario and explanations

## 

## 5\. Custom rules for MVP wow factor {#5.-custom-rules-for-mvp-wow-factor}

These are the minimum two cases we want to get working.

1. **Link-as-button detector**: `<a>` without `href` but with `onClick`.  
2. **Focus ring removal detector**: flags CSS removing outline without visible replacement.

## 6\. Hackathon dream team (12 people) {#6.-hackathon-dream-team-(12-people)}

1. Product leads / accessibility strategists (Anne & Nemanja)  
2. Project manager Tech  
3. Project manager Documentation / Site / Marketing (Steve)  
4. Accessibility expert – WCAG/ARIA standards \- (Anne)  
5. Accessibility expert – component & testing patterns (if none join, then also Anne)  
6. Backend engineer – API \+ static analyzers integration  
7. Static analysis integrator – ESLint, axe-core, custom rules  
8. Frontend dev – Vite + React UI  
9. UX designer – interface clarity & accessibility  
10. Technical writer – authoring  
11. QA tester – validation & test suite  
12. Pitch lead – storytelling & demo prep (Anne)

---

## 7\. ROI calculations for Users {#7.-roi-calculations-for-users}

This is about “selling” the validity of the tool we build to the rest of the world and specifically on our pond. We will use this in our presentation and our end presentation.

TestAlly serves as a mentor that empowers developers to bridge the manual testing gap themselves.

By catching manual errors during development, TestAlly significantly helps to improve project margins.

### 1\. The Freelancer: Reclaiming Billable Capacity

For a freelancer, a €60/hr billable rate represents their entire "business of one," covering everything from self-employment taxes to hardware. Currently, manual testing is an unbillable anxiety trap that eats 15 hours a month. That is nearly two full workdays lost to nervous guesswork. By using TestAlly, that burden drops to just 2 hours of guided verification, saving over €9,360 a year. It is 13 hours of reclaimed time that can be sold to new clients or invested back into their own life.

### 2\. The Small Agency: Protecting the Blended Margin

In an agency setting, the €80/hr blended rate keeps the lights on, covering office overhead and non-billable staff. Agencies currently bleed 80 hours a month fixing components that were "finished" but failed a manual audit. This redundant labor is a silent profit killer. By empowering a team of 5 developers to get it right the first time, TestAlly cuts that waste down to 16 hours, protecting over €61,000 in annual profit that would have otherwise been burned on re-doing work.

### 3\. The Enterprise: Reducing the "Fully Burdened" Burn Rate

In large organizations, a developer’s €70/hr internal rate is their "Fully Burdened Cost", meaning the total investment in their pension, benefits, and office space. Enterprise teams lose a staggering 250 hours every month to the "ping-pong" effect: developers shipping code, waiting for a separate accessibility department to flag it, and then context-switching back to fix it. TestAlly breaks this bottleneck by giving developers the autonomy to verify their own work. This slashes the remediation time to 70 hours, saving the organization over €151,000 a year in redundant labor costs.

## 

## 8\. Budget / Future Plans {#8.-budget-/-future-plans}

| PS: A remark for the Hackathon organization: this information is in here to show you that we have thought things through. |
| :---- |

### Cost estimates \- Hackathon / Pilot stage {#cost-estimates---hackathon-/-pilot-stage}

| Item | Cost |
| ----- | :---: |
| LLM API: Aim to utilize at least 2 LLM APIs. First to drive results, second to recheck AI's work and return confidence score. | We’ll manage among what we have in common credits, ourselves, for the hackathon |
| General tools for project management | Free options via GitHub to be used |
| Domain for project ([testally.io](http://testally.io)) | $10 |
| Hosting | $0 \- $20 |
| **Totals** | **$10 \- $20\*** |

\* Most items for the hackathon event are expected to be sourced between team members and therefore limited costs involved for MVP.

### Sponsor-backed long term scenario

| Item | Recurring Monthly | Annual / One time |
| ----- | :---: | :---: |
| LLM API (top models) | $300 \- $800 |  |
| Paid audit tools | N/a | $5,000+ |
| Enterprise Hosting | $400 \- $1,300 |  |
| Team tools and Pro plugins | $1,000 \- $2,000 |  |
| **Totals** | **$1,700 \- $4,100** | **$5,000** |

### Project Income and Expenses

#### **Expenses Ledger**

| Date | Description | Payee | Value |
| ----- | :---- | :---- | :---- |
| 12/12/2025 | [testally.io](http://testally.io) domain purchased | Anne | $10.00 |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
| **Total expenses to date** |  |  | **$10.00** |

#### **Income Ledger**

| Date | Description | Payee | Value |
| ----- | :---- | :---- | :---- |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |


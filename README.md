# Australia's Digital Assets Framework Act: What It Means for Tokeniser

An annotated field guide to the *Corporations Amendment (Digital Assets Framework) Act 2026* (Act No. 38, 2026) for issuers, holders and the Redbelly community. It shows where the licensing line falls, the calendar to October 2027, what changes for issuers who tokenise through Tokeniser, and where Redbelly's compliance design lines up with the new rules and where it is still open.

**Live site:** https://australia-daf-act.vercel.app/

> **General information only. This is not legal advice.** Nothing in this repository says that Redbelly Network, Tokeniser or any issuer is licensed, exempt or compliant. It is an independent community explainer prepared for the Redbelly DAO, not an official publication of Redbelly Network, Tokeniser, ASIC or the Australian Government.

## Deliverables

| Deliverable | Web | Files |
|---|---|---|
| 1. The explainer | [Guide](https://australia-daf-act.vercel.app/) | [PDF](public/downloads/australia-daf-act-explainer.pdf), [Word](public/downloads/australia-daf-act-explainer.docx) |
| 2. Community summary | [Share kit](https://australia-daf-act.vercel.app/summary) | [Thread and paragraphs](public/downloads/community-summary.md), [three 1600 x 900 images](public/downloads/cards/) |
| 3. Source list with a link for every claim | [Evidence](https://australia-daf-act.vercel.app/sources) | [Markdown](public/downloads/sources.md), [CSV](public/downloads/sources.csv), [Verification record](VERIFICATION.md) |

## What is in the guide

- **Perimeter map.** One view of what needs a licence, what sits outside it, and what depends on the facts. Each item links to the detail.
- **Calendar ribbon.** Nov 2025 to Dec 2027, with a marker for today, the consultation window and the six-month transition.
- **Annotated text.** Every passage is labelled as law, company statement or analysis. The source and the exact section sit in the margin beside it.
- **Small DAP test.** Checks the four conditions in s 911A(2)(ja) against your own numbers.
- **Custody explorer.** Four key-holding set-ups and how the possession rules in ss 761GB, 761GC and 86 apply to each.
- **Holders panel.** What the Act gives clients of a licensed platform.
- **Rule by rule.** Redbelly and Tokeniser features set against each requirement, with a fit status.
- **Act map.** Schedule 1 part by part, with civil penalty provisions marked.

## Key facts

All sourced in the guide. Sources checked 27 October 2026.

| | |
|---|---|
| Royal Assent | 8 April 2026 |
| ASIC consultation (CP 392) closes | 27 November 2026, 5pm AEDT |
| Commencement | 8 April 2027 on ASIC's latest statement (CP 392 and 26-245MR). ASIC's April 2026 roadmap said 9 April 2027; the guide has a date note on the difference. |
| Transition window closes | 7 October 2027 |
| New financial products | Digital asset platforms (s 761GC) and tokenised custody platforms (s 761GD) |
| Small DAP exemption | Up to $10 million in transactions over 12 months, up to $5,000 per client entry value, no financial products, and a notice to ASIC (s 911A(2)(ja)) |

## Brand

Built on the **Redbelly DAO Task Board brand kit** ("Kinetic Consensus"): https://taskboard.redbellydao.network/brand

- Colour, type, radius and spacing come from the kit's own token file, copied unchanged to `public/assets/css/dao-tokens.css`. The site styles only compose those tokens.
- Brand red `#EF5350` is the single accent; surfaces are the kit's slate neutrals; hero bands stay dark steel in both themes; dark is the default with the kit's light theme on `data-theme="light"`.
- Be Vietnam Pro for all text; JetBrains Mono only for dates, section numbers, source numbers and other machine values.
- The DAO lockup (`dao-logo-on-dark.png`, `dao-logo-on-light.png`) and icon, used bare with no plate. No Redbelly Network corporate logo.
- 4px and 8px radii, no pill buttons, status shown as a dot plus a monospace label, tonal depth without heavy shadows.
- Voice rules: no em or en dashes, no emoji, no filler verbs. Images are 1600 x 900 and carry a dated "Last verified" line.

`npm run check` enforces the voice rules, the logo, the token file and the fonts.

## How the content is organised

- **The law says**: the Act, the Constitution, Parliament, Treasury and ASIC, each with a numbered source and pinpoint.
- **Company says**: what Redbelly or Tokeniser say about their own products, from their own pages.
- **Analysis**: the writer's reading, labelled so it can be told apart from the law.

## Repository layout

```
public/                 Static site served by Vercel (no build step)
  index.html            The guide
  summary.html          Share kit: thread, images, paragraphs
  sources.html          Evidence: claim ledger, source list, link check
  downloads/            PDF, Word, Markdown, CSV and images
  assets/               DAO kit tokens, site CSS and JS, DAO logos, social card
data/
  sources.json          Single source of truth for the source list
  claims.json           Each factual claim, its source, pinpoint and supporting wording
  link-check.json       Result of the last link check
scripts/
  build.mjs             Renders citations, margin notes and source lists; exports PDF, Word, Markdown, CSV and images
  check.mjs             Offline checks (run in CI)
  check-links.mjs       Online link check
  cards/                Templates for the share-kit images and the social card
VERIFICATION.md         Generated claim-by-claim verification record
```

## Working on it

Requires Node 18 or later. Exports also need [Playwright](https://playwright.dev/) with Chromium and [pandoc](https://pandoc.org/).

```sh
npm run check         # offline checks
npm run check:links   # requests every source URL and records the status
npm run render        # renders pages and re-exports PDF, Word, Markdown, CSV and images
npm run render:pages  # renders pages and text exports only
npm run preview       # serves public/ locally
```

Citations are written as `<a class="cite" href="#src-ID" data-pin="s 911A(2)(ja)">ID</a>`. The build turns them into numbered references and fills the margin notes. After changing `public/*.html`, `data/sources.json` or `data/claims.json`, run `npm run render` and `npm run check`.

`npm run check` fails if a citation points to an unlisted source, a listed source is never cited, a margin note is missing, the not-legal-advice statement does not open a page, "9 April 2027" appears outside the date note, an X post is over 280 characters, the PDF or Word edition is out of date, the brand rules are broken, or any page describes Redbelly, Tokeniser or an issuer as licensed or compliant. It also screens for personal credit lines and price talk.

## Deploying

The site is static. Import the repository into Vercel; `vercel.json` sets the output directory to `public/` and skips install and build. Clean URLs are on, so `/summary` and `/sources` work without `.html`.

Pages carry `noindex` (meta tag and `X-Robots-Tag` header) because entries are reviewed by the Redbelly team before anything is published. Remove both once the piece is approved.

# Australia's Digital Assets Framework Act: What It Means for Tokeniser

A plain-language explainer of the *Corporations Amendment (Digital Assets Framework) Act 2026* (Act No. 38, 2026) for issuers and the Redbelly community: what the Act is and why it was introduced, who needs a licence, the key dates, what changes for issuers who tokenise through Tokeniser, and where Redbelly's compliance design lines up with the new rules and where it is unclear.

**Live site:** https://australia-daf-act.vercel.app/

> **General information only. This is not legal advice.** Nothing in this repository says that Redbelly Network, Tokeniser or any issuer is licensed, exempt or compliant. It is an independent community explainer prepared for the Redbelly DAO, not an official publication of Redbelly Network, Tokeniser, ASIC or the Australian Government.

## Deliverables

| Deliverable | Web | Files |
|---|---|---|
| 1. The explainer | [`/`](https://australia-daf-act.vercel.app/) | [PDF](public/downloads/australia-daf-act-explainer.pdf) · [Word](public/downloads/australia-daf-act-explainer.docx) |
| 2. Community summary (X thread and paragraphs) | [`/summary`](https://australia-daf-act.vercel.app/summary) | [Markdown](public/downloads/community-summary.md) |
| 3. Source list, with a link for every factual claim | [`/sources`](https://australia-daf-act.vercel.app/sources) | [Markdown](public/downloads/sources.md) · [CSV](public/downloads/sources.csv) · [Verification record](VERIFICATION.md) |

## Key facts at a glance

All sourced in the explainer. Sources checked 27 October 2026.

| | |
|---|---|
| Royal Assent | 8 April 2026 |
| ASIC consultation (CP 392) closes | 27 November 2026, 5pm AEDT |
| Commencement | 8 April 2027 on ASIC's latest statement (CP 392 and 26-245MR). ASIC's April 2026 roadmap said 9 April 2027; the explainer has a date note explaining the difference. |
| Transition window closes | 7 October 2027 |
| New financial products | Digital asset platforms (s 761GC) and tokenised custody platforms (s 761GD) |
| Low-value DAP exemption | No more than $10 million in transactions over 12 months and $5,000 per client entry value, no financial products, and a notice to ASIC (s 911A(2)(ja)) |

## How the content is organised

- **The law says**: statements of law and regulator material, each with a numbered source (the Act, Parliament, Treasury, ASIC).
- **Company statement**: what Redbelly or Tokeniser say about their own products, attributed to their own pages.
- **Analysis**: the writer's interpretation, labelled so it can be told apart from the law.

Primary sources are used for every statement about the law. Company websites are used only for what the companies say about themselves.

## Repository layout

```
public/                 Static site served by Vercel (no build step)
  index.html            The explainer
  summary.html          Community summary
  sources.html          Source list, claim-by-claim checks, link check
  downloads/            PDF, Word, Markdown and CSV editions
  assets/               CSS, JS, Redbelly brand logos, social card
data/
  sources.json          Single source of truth for the source list
  claims.json           Each factual claim, its source, pinpoint and supporting wording
  link-check.json       Result of the last link check
scripts/
  build.mjs             Renders citations and source lists into the pages; exports PDF, DOCX, MD, CSV, card
  check.mjs             Offline checks (run in CI)
  check-links.mjs       Online link check
VERIFICATION.md         Generated claim-by-claim verification record
```

## Working on it

Requires Node 18+. Exports also need [Playwright](https://playwright.dev/) with Chromium and [pandoc](https://pandoc.org/).

```sh
npm run check         # offline checks: citations, sources, disclaimer, dates, X post length, banned phrasing
npm run check:links   # requests every source URL and records the status
npm run render        # renders pages and re-exports PDF, Word, Markdown, CSV and the social card
npm run render:pages  # renders pages and text exports only
npm run preview       # serves public/ locally
```

To change the content, edit `public/*.html` (citations are written as `<a class="cite" href="#src-ID">ID</a>`), `data/sources.json` or `data/claims.json`, then run `npm run render` and `npm run check`.

`npm run check` fails if a citation points to an unlisted source, a listed source is never cited, the "not legal advice" statement is missing from any page, "9 April 2027" appears outside the date note, an X post is over 280 characters, the PDF or Word edition is out of date, or any page describes Redbelly, Tokeniser or an issuer as licensed or compliant. It also screens for personal credit lines and price talk.

## Deploying

The site is static. Import the repository into Vercel; `vercel.json` sets the output directory to `public/` and skips install and build steps. Clean URLs are on, so `/summary` and `/sources` work without `.html`.

Pages carry `noindex` (meta tag and `X-Robots-Tag` header) because entries are reviewed by the Redbelly team before anything is published. Remove both when the piece is approved for publication.

## Brand

Colours (`#FF5050`, `#283A46`, `#FA423C`, `#142530`, `#848B91`, `#D9D9D9`, `#ECEBEC`), the Readex Pro typeface and the logos come from the Redbelly Network brand kit: https://www.redbelly.network/brand. Readex Pro is loaded from Google Fonts.

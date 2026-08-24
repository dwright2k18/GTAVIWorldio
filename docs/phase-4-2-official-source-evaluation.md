# Phase 4.2 official-source evaluation

Evaluated on 2026-08-23. This document records connector decisions; it does not activate monitoring.

## Rockstar signals

| Signal | Finding | Phase 4.2 use |
| --- | --- | --- |
| Newswire listing | The public listing remains client-rendered for the server connector. Its health must remain independently `DEGRADED` when no server-rendered links are extracted. | Retain as one signal with the bounded known-article fallback. Never relabel it healthy because another connector succeeds. |
| Official GTA VI page | The public page exposes stable GTA VI metadata plus a Featured News section with Newswire article links. | Monitor normalized page changes and discover a maximum of three same-domain Newswire detail URLs per check. |
| Official GTA VI media page | The public media page is a separate known-page change signal. | Monitor normalized public metadata/text only. Do not download media. |
| Rockstar YouTube | The official public Atom feed exposes video IDs, titles, publication times, descriptions, and links. | Retain as an independent first-party video signal and extract any explicit Rockstar Newswire references from feed metadata. |
| `robots.txt` | The public file contains agent-specific restrictions but no advertised sitemap location. | Continue low-rate, identified requests and respect any future applicable rules. |
| `/sitemap.xml` | A single bounded check returned Rockstar's branded 404 shell rather than XML. | Do not depend on a sitemap that is not publicly exposed. |
| Search-engine discovery | No approved free first-party search API is configured. Scraping search-result pages is not an acceptable substitute. | Not implemented. Re-evaluate only if a documented free API or a separately approved paid provider becomes available. |

## Take-Two signal

The public investor-relations listing is server-rendered and exposes GTA VI press-release links. The connector follows only bounded public detail pages whose titles or summaries match configured GTA VI terms. Explicit Rockstar Newswire references become cross-source evidence or an `OFFICIAL_SOURCE_GAP` alert if unresolved.

## Consensus rule

Newswire, known-page, YouTube, and Take-Two observations are signals. Normalized URL matches and deterministic event similarity resolve them into one event decision. Additional matches attach evidence; they do not create separate candidates. Candidate creation and publishing remain separate, gated operations.

## Cost and safety

- Paid services: none.
- Expected connector cost: $0.
- Authentication or access-control bypass: none.
- CAPTCHA or anti-bot circumvention: none.
- Media mirroring: none.
- Sources active: none after migration.
- Recurring monitoring, automated drafting, deep research, and publishing: disabled after migration.

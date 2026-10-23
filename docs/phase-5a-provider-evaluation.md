# Phase 5A provider evaluation

Evaluated September 2, 2026. This document is architecture guidance only. Phase 5A does not configure a provider, store credentials, or make paid calls.

## Recommendation

Use Vercel AI Gateway as the provider-neutral control plane and `openai/gpt-5.4-mini` as the initial manually approved model. It offers strict structured-output support through the existing AI SDK architecture, transparent per-model usage, and materially lower modeled cost than the frontier alternatives. Keep `openai/gpt-5.4` and `anthropic/claude-sonnet-4.6` as human-selected quality fallbacks only. Do not configure automatic expensive fallback.

The database defaults remain fail-closed: provider disabled, emergency stop on, and every budget at zero. Provider activation and every generation call also require the separate server-side `AI_PROVIDER_CONFIGURATION_APPROVED=true` gate. Credentials belong only in a protected server environment variable supplied by the approved provider path; no credential column exists in the Phase 5A schema.

## Current model comparison

| Provider path | Model | Input / 1M tokens | Output / 1M tokens | Research packet | Article draft | Full candidate package |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Vercel AI Gateway | `openai/gpt-5.4-mini` | $0.75 | $4.50 | $0.0405 | $0.0300 | $0.0960 |
| Vercel AI Gateway | `openai/gpt-5.4` | $2.50 | $15.00 | $0.1350 | $0.1000 | $0.3200 |
| Vercel AI Gateway | `anthropic/claude-sonnet-4.6` | $3.00 | $15.00 | $0.1470 | $0.1080 | $0.3450 |
| Vercel AI Gateway | `google/gemini-3.6-flash` | $0.75 | $3.75 | $0.03675 | $0.0270 | $0.08625 |

Gemini 3.6 Flash pricing is promotional through December 31, 2026; its published post-promotion rates are $1.50 input and $7.50 output per million tokens. Prices should be rechecked immediately before provider approval.

Cost assumptions per candidate are deliberately visible in `src/lib/ai/cost.ts`:

- Research packet: 24,000 input / 5,000 output tokens.
- Article draft: 16,000 input / 4,000 output tokens.
- SEO plus primary-video plus Quick Hit packages: 10,000 input / 4,000 output tokens.
- Costs exclude taxes, optional enterprise controls, third-party search, and any model price changes.

At the recommended `gpt-5.4-mini` modeled rate, full-package variable cost is approximately:

| Candidates / day | Daily | 30-day month |
| ---: | ---: | ---: |
| 1 | $0.096 | $2.88 |
| 5 | $0.48 | $14.40 |
| 10 | $0.96 | $28.80 |
| 20 | $1.92 | $57.60 |

## Rate limits, privacy, and safety

- Vercel AI Gateway supports provider/model routing, budgets for API keys, request tagging, and a request option to disallow prompt training. Zero-data-retention controls are plan- and request-dependent; verify the selected team plan before sending newsroom source material.
- OpenAI states that business/API data is not used to train models by default. Retention and abuse-monitoring eligibility still depend on the account and endpoint.
- Anthropic limits are organization/tier specific and combine spend and rate limits. Confirm current console limits before setting newsroom caps.
- Google states that paid Gemini API services do not use submitted content to improve products, while unpaid-service terms differ. Zero-data-retention eligibility is model and project dependent.
- GTAVIWorldio must enforce its own daily calls, input tokens, output tokens, dollars, per-candidate calls/dollars, timeout, retry, regeneration, and emergency-stop limits even when the upstream provider has separate limits.

## Official references

- [Vercel AI Gateway documentation](https://vercel.com/docs/ai-gateway)
- [Vercel AI Gateway models and providers](https://vercel.com/docs/ai-gateway/models-and-providers)
- [Vercel AI Gateway live model catalog](https://ai-gateway.vercel.sh/v1/models)
- [Vercel AI Gateway budgets](https://vercel.com/changelog/budgets-for-api-keys-on-ai-gateway)
- [Vercel AI Gateway zero-data-retention and no-training controls](https://vercel.com/changelog/zero-data-retention-no-prompt-training-on-ai-gateway)
- [OpenAI GPT-5.4 model documentation](https://developers.openai.com/api/docs/models/gpt-5.4)
- [OpenAI business data privacy](https://openai.com/business-data/)
- [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Anthropic rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- [Gemini API zero data retention](https://ai.google.dev/gemini-api/docs/zdr)

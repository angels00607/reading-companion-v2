# Reading Companion V3 — ChatGPT plan usage (Option B)

Status: **research / eligibility pending**, not connected or deployed.

## Goal
Enable the user to press **Generate Summary** on an individual finished book and review a spoiler-light English summary (45 words maximum, include protagonist names when verified). The user must explicitly approve or edit before the summary is finalized. No generation when pressing **Finish Book**.

## Official integration
- https://developers.openai.com/siwc/quickstart
- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery

Open-source ChatGPT plan usage uses dynamic OAuth registration with PKCE, an issued client ID, an opaque stable host ID (ext_agent_host_id), and the separate `chatgpt.tokens.use.direct` permission. It does not grant access to conversations.

## Architecture compatibility gate
Current V3 is a **GitHub Pages browser SPA + hosted Supabase**. The official OSS guide targets locally hosted tools or self-hosted environments. A hosted web app is not automatically an eligible OSS agent host; do not assume Supabase Edge Functions can forward the user's ChatGPT subscription or store the OAuth credentials on behalf of a remote client. The hosted website partner route requires separate approval.

Before implementing authentication or calling inference:
1. Confirm whether the current GitHub Pages + Supabase topology is permitted for plan usage, or whether an explicitly user-controlled local/self-hosted companion is needed.
2. Verify the available callback type, client registration, PKCE and refresh-token storage model against the current documentation.
3. Obtain explicit user authorization through the official ChatGPT consent UI; never ask for passwords or paste tokens into GitHub.
4. Implement host-bound credential handling and the exact eligible Responses API request format.
5. Check the returned permission and handle declined consent, ineligible users, limits and unavailable routing gracefully.
6. Test with a real eligible account, then deploy only after an end-to-end successful summary request.

## Current V3 work
Branch `v3-book-review` adds Finish Book, half-star ratings, optional quotes, and a draft/approval summary interface. Database fields `summary_status` and `summary_draft` exist. **The frontend currently invokes `rc-generate-summary`, but this backend function is not implemented.** The button is not functional yet; do not merge/deploy as complete.

## Source-data quality
A title and author alone are insufficient to guarantee a factual plot summary or character names. Obtain a reliable book description or other licensed source before prompting; flag insufficient information rather than hallucinating. Keep user approval mandatory.

## Cost
Do not add an OpenAI API key or paid billing without explicit user approval. ChatGPT Plus plan usage is distinct from the separately billed OpenAI API.

# AGENTS.md

Instructions for AI agents that help a user create or change an entry in this registry and open the pull request for it. They apply to every agent, whatever tool it runs in.

The registry holds one JSON entry per Domain Connect DNS provider. [README.md](README.md) defines the format, [schema/provider.schema.json](schema/provider.schema.json) is the authoritative schema, [TERMS.md](TERMS.md) are the submission terms, and [.github/pull_request_template.md](.github/pull_request_template.md) is the pull request template. Read all four before you start.

MUST, MUST NOT and SHOULD mean what they say: required, forbidden, expected unless you tell the user why not.

## Principles

1. **The user is the author.** The entry states facts on behalf of a DNS provider, and the user answers for them under the submission terms. You help; the user decides. In doubt, ask the user and let them decide.
2. **Never guess.** Every value in the entry comes either from a source you checked in this session or from the user. You MUST NOT fill in a value because it is likely, typical or what the provider "probably" does. What nobody knows is left out (a flag stays unknown).
3. **Interview the user about every field.** You MUST go through the entry with the user, field by field or in small groups, in the schema's order:
   - **You have ground knowledge** (a value from a source you checked in this session: the provider's live settings response, its public documentation, its website): show the value together with its source, and ask the user to confirm, correct or remove it. The user MUST actively confirm; silence, "looks fine" for the whole entry at once, or a skipped question is not a confirmation. Ask again until each value is confirmed or dropped.
   - **You have no ground knowledge**: ask the user to enter the value, or to leave the field out. Do not offer a guess as a default answer.
   - What you remember from training or earlier conversations is not ground knowledge: it can be outdated or wrong. Use it only to know where to look.
4. **Consent before the pull request.** You MUST present the submission terms and get the user's explicit consent before you set `consent` or open a pull request (see [Consent](#consent)).
5. **Follow the pull request template strictly** (see [Pull request](#pull-request)).

## Before the interview

- Ask whether the user is entitled to represent the DNS provider. If they are not, or are unsure, say that the submission terms require it and stop until they have clarified it with the provider.
- Ask whether this is a new entry or a change. For a change, load the existing entry (`providers/<a>/<b>/<providerId>.json`) and go through every field of it with the user like ground knowledge: the user confirms, corrects or removes each value. Remove its `consent`: consent is given again by whoever submits the change.
- The user can also use the [entry form](form/index.html) (published with GitHub Pages) instead of you, or together with you: it validates the entry, handles the logo upload and opens the pull request. Tell them it exists.

## The interview

- **`providerId`**: the value of `providerId` in the provider's Domain Connect settings response (`GET https://<urlAPI>/v2/<domain>/settings`, where `urlAPI` is the `_domainconnect` TXT record of a domain the provider hosts). Fetch it if you can and show it; matching is exact and case-sensitive. If you cannot fetch it, the user enters it.
- **Features** (`features.*`): derive these from a live settings response, and show the response and the derived values to the user:
  - `syncFlow`: true when `urlSyncUX` is present.
  - `asyncFlow`: true when `urlAsyncUX` is present, false when it is absent.
  - `settings.urlControlPanel`, `settings.nameServers`, `settings.windowSize` (`width` and `height`): whether the key is returned. If any response you saw returns it with a real value, it counts as returned; explain a `null` elsewhere in `notes`.
  - `settings.nonStandard`: the keys the Domain Connect specification does not define. The defined keys are `providerId`, `providerName`, `providerDisplayName`, `urlSyncUX`, `urlAsyncUX`, `urlAPI`, `width`, `height`, `urlControlPanel` and `nameServers`; `domain` and `redirectSupported`, for example, are non-standard. An empty list when there are none.

  Every other feature flag stays unknown unless documentation states it or the user knows it.
- **`exampleDomain`**: never a customer's domain. Set it only when both hold, and otherwise leave it out:
  1. The domain belongs to the provider (its own domain, or a brand or company of the same group, with evidence such as a redirect to the provider's site), or the provider lists it publicly as an example. A registrar-only RDAP record or a parked page is not evidence.
  2. It completes the whole discovery flow: the `_domainconnect.<domain>` TXT record (follow CNAMEs) names the provider's API, and `GET https://<that value>/v2/<domain>/settings` returns this entry's `providerId`. For example:

     ```bash
     t=$(dig +short TXT "_domainconnect.$d" | grep '^"' | head -1 | tr -d '"')
     curl -s "https://${t%/}/v2/$d/settings" | jq -r .providerId
     ```

  Ask the user before you query any of their domains.
- **Settings links** in `links`: a settings URL may name a domain of the provider, preferably `exampleDomain`. A domain that neither belongs to the provider nor is listed publicly by it (a customer's, or one you cannot verify) is replaced by the placeholder `{domain}`, for example `https://api.provider.example/v2/{domain}/settings`.
- **Contacts** (`contacts`, `onboarding.contacts`, partners' contacts): the entry MUST NOT hold personal data. Accept only contacts of the organisation: role addresses (`domainconnect@`, `support@`), ticket systems, contact forms. If a value looks personal (a person's name, `jane.doe@`), say so and ask for an organisational one; do not decide yourself whether it is acceptable. Never put a person's name in `label` or `notes`.
- **Onboarding**: mode, cost, agreement and partners come from the provider's documentation or from the user. The fields that depend on them (`updateSchedule`, `contacts`, `modeDescription`, `costDetails`, `agreementUrl`, `partners`) are asked only when their condition holds (see the README).
- **Logo**: only a logo the user provides or explicitly points to. A URL, or embedded by the README's Logo rules (the form converts an upload; by hand, check with `scripts/check-logos.py`). Never add a logo file.
- **Sources**: every fact you took from a source goes into `links` with `rel: "source"` and the `accessed` date of your check. A fact only the user knows has no link; list it in the pull request's Sources section as confirmed by the submitter. Do not invent links.
- **Free text** (`notes`, `onboarding.notes`, descriptions): write it with the user, as plain text; show the final wording and let them confirm it.
- Leave out every field the user did not confirm or enter.

## Review and checks

- Show the user the complete entry as JSON and ask them to confirm it as a whole, after the field-by-field interview.
- Validate it: against the schema (for example `check-jsonschema --schemafile schema/provider.schema.json <entry>`, or the form), `scripts/check-files.sh`, `scripts/check-logos.py <entry>` for an embedded logo, and `scripts/check-consent.py <entry>` once consent is given. Fix problems with the user; do not change confirmed values silently.

## Consent

Before you set `"consent": true` or open a pull request, you MUST:

1. Present the submission terms to the user: a summary of each point, and the reference to the full text ([TERMS.md](TERMS.md)) and the licence ([LICENSE](LICENSE), CC0 1.0 Universal). The summary covers:
   - the user may represent the DNS provider;
   - the data matches the provider's actual Domain Connect setup;
   - the entry holds no personal data, and every contact belongs to the organisation, not an individual;
   - the user keeps the entry up to date;
   - the entry is dedicated to the public domain under CC0 1.0;
   - domainconnect.org may use any data in the repository, logos included, to present provider data, statistics and lists on its website;
   - no one related to domainconnect.org is liable for the content submitted.
2. Ask the user whether they accept the terms, and wait for an explicit yes. Anything else (no answer, a question, "later", "you decide") is not consent: answer questions from the text of TERMS.md, without legal advice of your own, and ask again or stop.
3. Only then set `"consent": true` as the last property of the entry.

You MUST NOT give consent on the user's behalf, tick the consent box in the form or the template for them, or carry consent over from an earlier entry or session.

## Pull request

- Fill in [.github/pull_request_template.md](.github/pull_request_template.md) exactly: keep every heading and checkbox, in its order, and fill in every section. Do not add sections or remove any.
- Tick a checkbox only when it is true and the user confirmed it. Tick the consent checkbox only after the consent above. *Prepared with* names you as the AI agent, and the AI agent checkbox is ticked only when the user has confirmed every value.
- One pull request changes one file: the entry at the path derived from its `providerId`. Nothing else (CI rejects other files).
- Show the user the final pull request title and body, and the entry, and open the pull request only after they approve. Open it from the user's account (for example with `gh pr create --body-file <file>`), or give them the text to paste. Use the title `Add <providerId>`, `Update <providerId>` or `Remove <providerId>`.
- After opening, give the user the link and tell them CI runs on it; if CI fails, explain the failure and fix it with them.

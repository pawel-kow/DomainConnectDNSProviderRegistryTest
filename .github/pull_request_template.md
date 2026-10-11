<!--
Thank you for contributing to the Domain Connect DNS provider registry.

Fill in every section below and keep the headings. Tick a box only when it is true. One pull
request adds, changes or removes one entry, and changes no other file. The format is in
README.md; the submission terms are in TERMS.md. CI checks the entry, including
"consent": true in every added or changed entry.
-->

## Entry

- **providerId:** <!-- exactly as in the provider's settings response, e.g. example.com -->
- **File:** <!-- providers/<a>/<b>/<providerId>.json -->
- **Change:** <!-- one of: new entry | change to an existing entry | removal -->
- **Prepared with:** <!-- one of: the entry form | by hand | an AI agent (name the agent) -->

## Summary

<!-- What the entry says, or which fields change and why. For a removal, say why. -->

## Sources

<!-- Every fact in the entry is listed in `links` with rel "source" and an accessed date.
     Name each fact that has no public source and that you confirm as the provider's
     representative, e.g. "onboarding contact: no public page, confirmed by the submitter". -->

## Relation to the DNS provider

<!-- Your role at the DNS provider, or on whose behalf you act, e.g. "DNS product team,
     Example Ltd". A role, not personal contact details. -->

## Checklist

- [ ] The entry validates against `schema/provider.schema.json` (the form shows "The entry is valid").
- [ ] The file sits at the path derived from `providerId`, and no other file is added, changed or deleted.
- [ ] Every fact has a source in `links` (`rel: "source"`, `accessed` date), or is named under Sources above.
- [ ] No customer's domain appears in the entry (`exampleDomain`, settings links).
- [ ] The entry holds no personal data: every contact is the organisation's (role address, ticket system, contact form), not an individual's.
- [ ] An embedded logo meets the Logo rules of the README; no separate logo file is added.
- [ ] If an AI agent prepared the entry: I reviewed and confirmed every value myself, and entered what the agent could not source.

## Consent to the submission terms

- [ ] I have read the [submission terms](../blob/main/TERMS.md) (`TERMS.md`) and accept them, and the entry has `"consent": true`. In short: I may represent the DNS provider; the data matches its actual Domain Connect setup; the entry holds no personal data and every contact belongs to the organisation; I keep the entry up to date; I dedicate the entry to the public domain under [CC0 1.0](../blob/main/LICENSE) (`LICENSE`); domainconnect.org may use any data in this repository, logos included, to present provider data, statistics and lists on its website; and no one related to domainconnect.org is liable for the content I submit.

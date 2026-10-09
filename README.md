# Domain Connect DNS Provider Registry

The Domain Connect DNS provider registry: a set of JSON files, one per DNS provider, holding facts about Domain Connect support that cannot be measured by scanning DNS providers: logo, website, documentation, contacts, onboarding process and supported features.

The registry format is a proposal (proposed repository name: `Domain-Connect/DnsProviders`). This first version has one entry for every DNS provider listed on [domainconnect.org/dns-providers](https://www.domainconnect.org/dns-providers/), with the logo published there. Each entry was completed from the provider's public documentation and its live Domain Connect settings response, and lists every source it used in `links`.

## Layout

```
providers/<a>/<b>/<providerId>.json        one entry per providerId
providers/<a>/<b>/<providerId>.<svg|png|jpg>   its logo, next to the entry
schema/provider.schema.json                JSON Schema (draft 2020-12) of an entry
form/index.html                            web form that opens a pull request with an entry
```

`<a>` and `<b>` are the first and second character of `providerId`, lowercased. Any character other than `a-z` or `0-9` becomes `_`, and a one-character id has `<b>` = `_`. The file name is `providerId` as is.

| `providerId` | Entry path |
| --- | --- |
| `cloudflare.com` | `providers/c/l/cloudflare.com.json` |
| `domainchief` | `providers/d/o/domainchief.json` |
| `1and1` | `providers/1/a/1and1.json` |
| `x` | `providers/x/_/x.json` |

## Matching

An entry is keyed by `providerId`: the value a DNS provider declares in its Domain Connect settings response. Matching is exact and case-sensitive. Several deployments of one stack (for example Plesk) share one entry.

## Entry format

The full definition is [schema/provider.schema.json](schema/provider.schema.json). Rules:

- Only `providerId` and `name` are required.
- Booleans are tri-state: `true`, `false`, or `null`/absent = unknown.
- Consumers ignore unknown keys.
- Text fields (`notes`, `onboarding.notes`) are shown verbatim, never rendered as HTML.

| Field | Type | Meaning |
| --- | --- | --- |
| `providerId` | string | Key; equals the settings `providerId`; determines the path. |
| `name` | string | Display name. |
| `url` | URL | Website. |
| `exampleDomain` | domain name | A domain that completes discovery at this provider. See [Example domain](#example-domain). |
| `logo` | string | Logo file name, in the entry's folder. |
| `documentation` | `[{title, url}]` | Public Domain Connect documentation. |
| `contacts.technical` | `[contact]` | Technical contact. |
| `onboarding.mode` | `"automatic"` \| `"on-request"` | `automatic`: templates merged into the Templates repository are deployed without a request. |
| `onboarding.documentationUrl` | URL | Process documentation. |
| `onboarding.formUrl` | URL | Online request form. |
| `onboarding.contacts` | `[contact]` | Where service providers request onboarding. |
| `onboarding.partner` | `{name, url}` | Third-party onboarding partner. |
| `onboarding.usesPartner` | boolean | Onboarding runs through a third party. |
| `onboarding.cost` | boolean | Onboarding is charged. |
| `onboarding.requirements.signedTemplatesOnly` | boolean | Only templates with signing. |
| `onboarding.requirements.warnPhishingRejected` | boolean | Templates with `warnPhishing` are not accepted. |
| `onboarding.requirements.signingKeyPublished` | boolean | The signing key has to be published. |
| `onboarding.notes` | string | Further requirements or restrictions. |
| `features.syncFlow` | boolean | Synchronous flow. |
| `features.syncRedirectUri` | boolean | `redirect_uri` honoured in the synchronous flow. |
| `features.asyncFlow` | boolean | Asynchronous flow (OAuth). |
| `features.asyncRevert` | boolean | Revert in the asynchronous flow. |
| `features.templateStateTracking` | boolean | Applied templates are tracked. |
| `features.templates.txtConflictMatching` | boolean | `txtConflictMatchingMode` / `txtConflictMatchingPrefix`. |
| `features.templates.variablesInNumberFields` | boolean | Variables in TTL, priority, weight, port. |
| `features.templates.multiInstance` | boolean | `multiInstance`. |
| `features.templates.sharedNames` | boolean | `sharedProviderName` / `sharedServiceName`. |
| `features.templates.essential` | boolean | Record attribute `essential`. |
| `features.recordTypes.spfm` | boolean | `SPFM`. |
| `features.recordTypes.custom` | boolean | Custom RR types. |
| `features.recordTypes.apexCname` | boolean | `APEXCNAME`. |
| `features.recordTypes.redir301` | boolean | `REDIR301`. |
| `features.recordTypes.redir302` | boolean | `REDIR302`. |
| `features.settings.urlControlPanel` | boolean | The settings response contains `urlControlPanel`. |
| `features.settings.nameServers` | boolean | The settings response contains `nameServers`. |
| `features.settings.windowSize` | boolean | The settings response contains `width` and `height`. |
| `features.settings.nonStandard` | `[{key, description?}]` | Properties in the settings response that the specification does not define; empty list = none, absent = unknown. |
| `features.nonStandard.cnameFlattening` | boolean | CNAME flattening: templates with a CNAME on the apex. |
| `notes` | string | Anything else. |
| `links` | `[link]` | Generic list of related links; `rel: "source"` marks the sources the entry was built from. |

`contact` is `{"type": "email" | "url" | "other", "value": string, "label"?: string}`.

`link` is `{"url": URL, "title"?: string, "rel"?: string, "accessed"?: "YYYY-MM-DD"}`. `rel` is a lowercase token; `source` is the only value defined so far, and consumers ignore values they do not know. `accessed` is the date the link was last checked.

Minimal entry:

```json
{
  "providerId": "namesilo.com",
  "name": "NameSilo",
  "url": "https://www.namesilo.com",
  "logo": "namesilo.com.png",
  "onboarding": {
    "mode": "on-request",
    "contacts": [{ "type": "email", "value": "domainconnect@namesilo.com" }]
  },
  "links": [
    {
      "url": "https://www.domainconnect.org/dns-providers/",
      "title": "Domain Connect: DNS Providers",
      "rel": "source",
      "accessed": "2026-10-09"
    }
  ]
}
```

Full entry: [providers/p/r/provider.example.json](providers/p/r/provider.example.json) is a dummy entry (`providerId` `provider.example`) that uses every field, with its logo [provider.example.svg](providers/p/r/provider.example.svg). Its values are invented and its `.example` URLs do not resolve.

## Example domain

`exampleDomain` lets anyone reproduce the whole discovery flow: the TXT record `_domainconnect.{exampleDomain}` names the provider's API, and `GET https://{that API}/v2/{exampleDomain}/settings` returns this `providerId`. A domain whose `_domainconnect` record is missing or points elsewhere is not an example domain, even if the settings endpoint answers for it. The domain must also belong to the provider itself (its own site, a brand or company of the same group) or be listed publicly by the provider as an example. A customer's domain is never used.

A settings URL in `links` may name a domain of the provider even when that domain is not `exampleDomain`. A settings URL queried with any other domain, such as a customer's, has that domain replaced by the placeholder `{domain}`, for example `https://domainconnect.api.godaddy.com/v2/{domain}/settings`.

## Contributing

A pull request adds or changes an entry. The [form](form/index.html), published with GitHub Pages, builds an entry from the schema, validates it and opens the pull request on GitHub with the file filled in; it can also load an existing entry to change it. An entry must:

- validate against [schema/provider.schema.json](schema/provider.schema.json),
- sit at the path derived from its `providerId`,
- name a logo file that exists in the same folder, if `logo` is set.

It should also list the sources of its facts in `links` with `rel: "source"` and an `accessed` date, and must not name a customer's domain (see [Example domain](#example-domain)).

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) checks every pull request:

- added and changed entries validate against the schema (all entries when the schema changes),
- every file under `providers/` is a regular file (no symlink) and either an entry at the path derived from its `providerId` or a logo that an entry in the same folder names; the allowed logo extensions are taken from the schema's `logo` pattern,
- a logo named by an entry exists,
- nothing outside `providers/` is added, changed or deleted.

The checks always run from the base branch (`pull_request_target`), so a pull request cannot change them; its files are only read. Run the placement checks locally with `scripts/check-files.sh` (needs `bash`, `git` and `jq`).

The form is served by GitHub Pages from the root of `main` (Settings, Pages, Deploy from a branch, `main`, `/ (root)`); `.nojekyll` makes Pages serve the `_` folders under `providers/`. The form reads the schema from the same site, so a schema change needs no change to the form. Preview it locally with `python3 -m http.server` in the repository root and open `http://localhost:8000/form/`.

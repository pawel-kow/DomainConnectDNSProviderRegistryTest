# Domain Connect DNS Provider Registry (test)

A test version of the Domain Connect DNS provider registry: a set of JSON files, one per DNS provider, holding facts about Domain Connect support that cannot be measured by scanning DNS providers: logo, website, documentation, contacts, onboarding process and supported features.

The registry format is a proposal. The real registry repository does not exist yet (proposed name: `Domain-Connect/DnsProviders`).

> **All data here is fictional.** URLs and contacts use `.example` domains, and the logos are placeholder SVGs, not real brand logos. The entries are a development data set and test fixture for registry consumers, not information about the real companies.

## Layout

```
providers/<a>/<b>/<providerId>.json        one entry per providerId
providers/<a>/<b>/<providerId>.<svg|png>   its logo, next to the entry
schema/provider.schema.json                JSON Schema (draft 2020-12) of an entry
```

`<a>` and `<b>` are the first and second character of `providerId`, lowercased. Any character other than `a-z` or `0-9` becomes `_`, and a one-character id has `<b>` = `_`. The file name is `providerId` as is.

| `providerId` | Entry path |
| --- | --- |
| `cloudflare.com` | `providers/c/l/cloudflare.com.json` |
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
| `features.nonStandard.cnameFlattening` | boolean | CNAME flattening: templates with a CNAME on the apex. |
| `notes` | string | Anything else. |

`contact` is `{"type": "email" | "url" | "other", "value": string, "label"?: string}`.

Minimal entry:

```json
{
  "providerId": "ionos.com",
  "name": "IONOS",
  "url": "https://www.ionos.example",
  "logo": "ionos.com.svg",
  "onboarding": {
    "mode": "on-request",
    "contacts": [{ "type": "email", "value": "domain_connect_admin@ionos.example" }]
  }
}
```

## Test entries

Each entry covers a case a registry consumer has to handle:

| Entry | Case covered |
| --- | --- |
| [cloudflare.com](providers/c/l/cloudflare.com.json) | Every field, with `true`, `false` and unknown values; HTML in notes (must be shown as text); unknown keys to ignore. |
| [ionos.com](providers/i/o/ionos.com.json) | Typical migrated entry: name, url, logo, on-request onboarding, one contact. |
| [plesk.com](providers/p/l/plesk.com.json) | Stack entry shared by several deployments; automatic onboarding; no logo. |

Cases with no entry (a `providerId` without a file, or a DNS provider with no `providerId`) are covered by the absence of a file.

## Contributing

A pull request adds or changes an entry. An entry must:

- validate against [schema/provider.schema.json](schema/provider.schema.json),
- sit at the path derived from its `providerId`,
- name a logo file that exists in the same folder, if `logo` is set.

The proposal has CI check these three points; this test repository has no CI yet.

## Open questions

- Repository owner and name.
- Logos: SVG preferred; licence or permission to republish.
- Who maintains entries and who reviews pull requests.
- Entries for single deployments of a multi-deployment stack (for example a hosting company on Plesk).

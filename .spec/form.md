# Registry entry form

The web form at `form/index.html` builds a registry entry (one `providers/<a>/<b>/<providerId>.json`), validates it against [schema/provider.schema.json](../schema/provider.schema.json) and opens a pull request on GitHub with it. It can also load an existing entry to change it. This document is the feature set every implementation of the form has to meet.

Requirements use MUST (required), SHOULD (expected, a gap has to be named) and MAY.

## Goals

1. **Generated from the schema.** The form is built at run time from the schema the site serves. Adding, removing or changing a property in the schema needs no change to the form. Any customisation of the form library is keyed by the shape of a schema node (for example "a type that allows `null` and `boolean`"), never by a property name or path.
2. **Minimum custom code.** The form library does the rendering, editing and as much of the validation as it can. Code in this repository is limited to the page shell, the GitHub hand-off and the generic adapters a library needs to cover the schema. Prefer a library feature over own code, and configuration over a custom component.
3. **Same look as the Domain Connect statistics site** ([Domain-Connect/Stats](https://github.com/Domain-Connect/Stats), published at [stats.domainconnect.org](https://stats.domainconnect.org/)). See [Design](#design).

## Hosting and dependencies

- H1 MUST: static files only, served by GitHub Pages from the root of `main` as the README describes. No build step, no server code. Preview with `python3 -m http.server` in the repository root.
- H2 MUST: third-party code is loaded from a public CDN, with the packages the page names at exact versions (no ranges, no `latest`). Scripts served as static files carry Subresource Integrity hashes. ES modules that a CDN builds on request (esm.sh) cannot carry them; that is acceptable for libraries that ship no browser bundle.
- H3 MUST: the schema is read from `../schema/provider.schema.json` of the same site, and existing entries from `../providers/...`.
- H4 MUST: works in current Chrome, Firefox and Safari, and at phone width (about 400 px) without horizontal scrolling of the page.

## Schema coverage

The form MUST handle every construct the schema uses today, generically:

| ID | Schema construct | Example | Required behaviour |
| --- | --- | --- | --- |
| S1 | `type: string` with `minLength`, `pattern` | `providerId`, `exampleDomain`, `logo` | Text input. Pattern and length errors are shown. |
| S2 | Local `$ref` into `$defs`, with sibling keywords | `url: {"description": "Website.", "$ref": "#/$defs/url"}` | Resolved. The sibling `description` is shown. |
| S3 | Tri-state flag `type: ["boolean", "null"]` | every `features.*` flag | A choice of *unknown*, *true* and *false*. A loaded `null` stays `null` when the field is not touched. *Unknown* writes `null` or leaves the key out; both mean unknown. |
| S4 | `enum` without `type` | `onboarding.mode`, contact `type` | A select of the enum values. The value written is the enum value as is. |
| S5 | Nested objects, several levels | `features.templates`, `onboarding.requirements` | Grouped and visibly nested, labelled with the property name. |
| S6 | Array of objects | `documentation`, `links`, contacts, `features.settings.nonStandard` | Add, remove and reorder items. An empty array is a valid value (`nonStandard: []` means "none") and MUST be kept when loaded. |
| S7 | `required` in nested objects | `documentation[].title`, `links[].url` | Required fields are marked. |
| S8 | `allOf` with `if` / `then` | contact `value` must be an e-mail address when `type` is `email`, a URL when `url` | Validated; the error is shown. |
| S9 | `description` | almost every property | Shown as help text, as plain text (never interpreted as HTML). |
| S10 | `title` | every property, including next to a `$ref` | The label is the `title`. A property without one is labelled with its name. |

## Data handling

- D1 MUST: optional fields left empty are not written. No empty strings, and no empty objects that the user did not fill in.
- D2 MUST: text is kept verbatim. A `notes` value with `<`, `>` or `&` comes out unchanged.
- D3 MUST: round trip. Loading any entry in `providers/` and not touching the form produces JSON that is equal to the file (key order and formatting may differ).
- D4 SHOULD: keys the schema does not know are kept when an entry is loaded and saved ("consumers ignore unknown keys").
- D5 MUST: the output is the entry as JSON, two-space indent, trailing newline.

## Validation

- V1 MUST: the entry is validated against the full schema with a JSON Schema draft 2020-12 validator (Ajv 2020), the same draft CI checks with `check-jsonschema`. This result decides whether the entry may be submitted.
- V2 MUST: all errors are listed with the path of the field (for example `/links/0/accessed: must match pattern ...`).
- V3 SHOULD: errors are also shown next to the field, once the user has touched it.

## GitHub hand-off

- G1 MUST: the repository is taken from the address when the page is served from `<owner>.github.io/<repo>/`; otherwise from `<meta name="registry-repository">`. The target branch comes from `<meta name="registry-branch">`.
- G2 MUST: the entry path is derived from `providerId` by the README rule (`<a>`/`<b>` = first two characters lowercased, anything but `a-z0-9` becomes `_`, `<b>` is `_` for a one-character id) and shown.
- G3 MUST: the form shows whether the path is a new entry or changes an existing one, by checking whether the file exists on the site.
- G4 MUST: the submit button is disabled while the entry is invalid or has no `providerId`.
- G5 MUST: new entry: open `https://github.com/<repo>/new/<branch>?filename=<path>&value=<json>` in a new tab. If that address is longer than 8000 characters, copy the JSON to the clipboard and open the address without `value`, and tell the user to paste it.
- G6 MUST: existing entry: copy the JSON to the clipboard and open `https://github.com/<repo>/edit/<branch>/<path>`, and tell the user to replace the file's content with it (GitHub's editor cannot be prefilled).
- G7 MUST: a *Copy JSON* button, and the JSON shown on the page (collapsible).
- G8 MUST: messages to the user are shown on the page, not with `alert()`.
- G9 MUST: a note explains that a logo cannot be passed through the link: set `logo` to the file name, then upload the file to the same folder on the pull request's branch.

## Loading an entry

- L1 MUST: an input for a `providerId` and a *Load entry* button fill the form with `../<entry path>`. A missing entry is reported on the page.
- L2 MUST: `?providerId=<id>` in the address loads that entry when the page opens.

## Guidance on the page

- P1 MUST: a short introduction: what the form does, a link to the schema, a link to the README on GitHub, and the two content rules (list a source for every fact in `links` with `rel` `source` and an `accessed` date; never name a customer's domain).

## Design

The page follows the statistics site ([styles.css](https://github.com/Domain-Connect/Stats/blob/main/docs/styles.css)):

- Colours: navy `#03263B` (headings, primary button, footer), secondary navy `#0b3954`, teal `#194f6e`, cyan `#00bfff` (links, focus), light blue-grey `#bddae6` (heading underlines, nested group accents), coral `#ff6663` (errors). Text `#252525`, secondary text `#686868`, page background `#f5f5f5`, cards white, borders `#e0e0e0`.
- Font: Open Sans with the system font stack as fallback.
- Header: white, with a shadow; the Domain Connect logo links to domainconnect.org, next to the title; a grey subtitle below.
- Content in white cards with 12 px radius and a soft shadow, at most 1200 px wide. Card headings in navy with a 2 px light blue-grey underline.
- Footer: navy, with links to domainconnect.org and to the repository on GitHub.
- Form: the top-level groups (`contacts`, `onboarding`, `features`, ...) read as sections; nested groups are indented with a light blue-grey accent; inputs have 4 px radius and a cyan focus ring; help text is small and grey; errors are coral.
- On wide screens the entry panel (path, status, errors, buttons, JSON) sits beside the form and stays in view; on narrow screens it follows the form.
- Respects `prefers-reduced-motion`; visible keyboard focus.

The logo and favicons are taken from the statistics site (MIT licence, Domain Connect).

## Code layout

Library-independent parts are shared, so that implementations differ only in the library adapter:

- `form/styles.css`: the design above, and generic styles for form controls.
- `form/registry.js`: loads the schema, validates with Ajv 2020, entry path, new/existing check, GitHub hand-off, copy, loading entries, and the entry panel. It calls the library adapter through one function: `mount(element, schema, onChange) → { setValue(entry) }`.
- `form/index.html`: the page, the library's scripts and the adapter. Library-specific CSS stays here.

## Acceptance checks

1. Every entry in `providers/` loads through `?providerId=` and round-trips (D3), and validates (V1).
2. A property added to the served schema (for example a new flag under `features`, a new string at the top level) shows up in the form without a change to the form.
3. A new entry with only `providerId` and `name` produces exactly those two keys (D1).
4. A contact with `type` `email` and a value without `@` is reported (S8) and blocks submission (G4).
5. Setting a flag to *unknown*, *true* and *false* writes `null` or nothing, `true` and `false` (S3).
6. `notes` set to `<b>a & b</b>` comes out unchanged (D2).
7. The page has no horizontal scroll at 400 px width (H4).

## Alternatives

Each implementation lives on its own branch, built from this spec:

| Branch | Library |
| --- | --- |
| `feat/inputform-rjsf` | [react-jsonschema-form](https://rjsf-team.github.io/react-jsonschema-form/) (React, core theme) |
| `feat/inputform-jsonform` | [jsonform](https://github.com/jsonform/jsonform) (jQuery) |

[JSON Forms](https://jsonforms.io) was tried and dropped. Its renderers that cover the schema need Material UI, and esm.sh splits Material UI into modules that each keep their own copy of shared component state: items of an array of objects (contacts) could not be opened. A build step would avoid that, but H1 rules it out.

# Registry entry form

The web form at `form/index.html` builds a registry entry (one `providers/<a>/<b>/<providerId>.json`), validates it against [schema/provider.schema.json](../schema/provider.schema.json) and opens a pull request on GitHub with it. It can also load an existing entry to change it. This document is the feature set the form has to meet, the decisions taken, and the state of the work, so that work can resume from it alone.

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
| S1 | `type: string` with `minLength`, `pattern` | `providerId`, `exampleDomain`, `name` | Text input. Pattern and length errors are shown. |
| S2 | Local `$ref` into `$defs`, with sibling keywords | `url: {"description": "Website.", "$ref": "#/$defs/url"}` | Resolved. The sibling `description` is shown. |
| S3 | Tri-state flag `type: ["boolean", "null"]` | every `features.*` flag | A choice of *unknown*, *true* and *false*. A loaded `null` stays `null` when the field is not touched. *Unknown* writes `null` or leaves the key out; both mean unknown. |
| S4 | `enum` without `type` | `onboarding.mode`, contact `type` | A select of the enum values. The value written is the enum value as is. |
| S5 | Nested objects, several levels | `features.templates`, `onboarding.requirements` | Grouped and visibly nested, labelled with the object's title. |
| S6 | Array of objects | `documentation`, `links`, contacts, `features.settings.nonStandard` | Add, remove and reorder items. An empty array is a valid value (`nonStandard: []` means "none") and MUST be kept when loaded. |
| S7 | `required` in nested objects | `documentation[].title`, `links[].url` | Required fields are marked. |
| S8 | `allOf` with `if` / `then` | contact `value` must be an e-mail address when `type` is `email`, a URL when `url` | Validated; the error is shown. Ajv's summary error with keyword `if` ("must match "then" schema") is neither listed nor shown: it would mark the whole object, and the errors inside the branch are reported anyway. |
| S9 | `description` | almost every property | Shown as help text, as plain text (never interpreted as HTML). |
| S10 | `title` | every property, including next to a `$ref` | The label is the `title`. A property without one is labelled with its name. |
| S11 | Conditional property: declared in `properties`, set to `false` by the `else` of an `if` (several such conditions in `allOf`); a `then` may add `required` | `onboarding`: `updateSchedule` (mode `automatic`), `contacts` (mode `on-request`, then required with `minItems: 1`), `modeDescription` (mode `other`), `costDetails` (`cost` true), `agreementUrl` ("Agreement URL", `agreementRequired` true), `partners` (`usesPartner` true) | The field is shown only while the condition holds, at its place in `properties`; a property required by `then` is marked required. While it does not, a value already entered is left out of the entry (not an error) and comes back when the condition holds again. |
| S12 | `format` next to a `pattern` | `$defs/url` (`uri`), e-mail contact `value` (`email`), `links[].accessed` (`date`) | The native input type (`url`, `email`, `date`: mobile keyboards, a date picker). The `pattern` validates; the form does not check `format` (see V1). |
| S13 | `oneOf` of alternatives with a `title` each, of different types | `logo`: *Logo URL* (string, `$ref` to `$defs/url`) or *Embedded logo* (object) | A choice labelled with the alternatives' titles, then the fields of the chosen one. A loaded value selects the alternative that fits it. |
| S14 | Embedded file: an object with a string that has `contentEncoding: "base64"` and `contentMediaType: "application/gzip"`, and a property with an `enum` | `logo` *Embedded logo*: `data` and `format` (`svg`, `png`, `jpg`) | A file upload with a preview, a caption (format, pixel size, file size) and *Remove*. The encoded string is never shown. The upload sets both properties: the enum value is detected from the file's content (PNG or JPEG signature, `<svg` in the text), not from its name, and a file in no allowed format is rejected with a message. The limits are the README's [Logo](../README.md#logo) rules, which CI checks on the stored image (`scripts/check-logos.py`, no scaling there). A PNG or JPEG is rejected (the previous image is kept) when it is smaller than 90 pixels on either side, more than 6 times as wide as high, or more than 2 times as high as wide; one larger than 600 × 200 (width × height) is scaled down to fit (aspect ratio kept, re-encoded in its format, JPEG quality 0.9). The ratio limits keep both sides at 90 pixels or more after scaling: 6 : 1 for wide logos was decided; 1 : 2 for tall ones follows from the 200 pixel height. An SVG is stored as uploaded, without size or ratio checks, but rejected with the reason when it breaks the README's SVG rules (`svgProblem`: not UTF-8 or well-formed, a DOCTYPE, entity or processing instruction, no svg root in the SVG namespace, active content or an external reference). The file is gzip-compressed and base64-encoded in the browser (`CompressionStream`; a loaded value is shown through `DecompressionStream`). |
| S15 | Acknowledgement: a property of the entry with `type: boolean` and `const: true`, not in `required` | `consent` (*Consent to the submission terms*, the last property) | An unticked checkbox, marked required: the form adds it to the root's `required`, so the entry cannot be submitted without it, while entry files need not carry it. Ticked writes `true`; anything else leaves the key out, and the error is the missing property (not *must be equal to constant*). Never ticked by default, never taken over from a loaded entry (L3). |

## Data handling

- D1 MUST: optional fields left empty are not written. No empty strings, and no empty objects that the user did not fill in.
- D2 MUST: text is kept verbatim. A `notes` value with `<`, `>` or `&` comes out unchanged.
- D3 MUST: round trip. Loading any entry in `providers/` and not touching the form produces JSON that is equal to the file (key order and formatting may differ), except for acknowledgements (S15, L3), which are left out until ticked.
- D4 SHOULD: keys the schema does not know are kept when an entry is loaded and saved ("consumers ignore unknown keys").
- D5 MUST: the output is the entry as JSON, two-space indent, trailing newline.
- D6 MUST: a value whose schema resolves to `false` (S11, condition not met) is not written.

## Validation

- V1 MUST: the entry is validated against the full schema with a JSON Schema draft 2020-12 validator (Ajv 2020), the same draft CI checks with `check-jsonschema`. This result decides whether the entry may be submitted. `format` is not checked (`validateFormats: false`, in RJSF too): it only picks the input type, and the patterns carry the validation. Reasons: `uri` alone would allow `mailto:` and other schemes; Ajv's `uri` rejects the `{domain}` placeholder in settings links; CI's check-jsonschema 0.38 checks `email` (loosely) and `date` but not `uri` (no `rfc3987`). So CI is stricter than the form in one case: an impossible `accessed` date such as `2026-02-30`, which the native date input does not produce.
- V2 MUST: all errors are listed, each with the location of the field as breadcrumbs instead of the JSON path: the `title` of each property (its name when it has none) and, for an array index, the items' `title` with the 1-based number (`Item` when the items have no title), joined with ` › `, for example `Links › Link 2 › Accessed: must match pattern ...`. An error on the entry itself is located by the schema's root `title`. Titles are found through `$ref` and in the branches of `allOf`, `if`/`then`/`else`, `oneOf` and `anyOf`. Only the location changes; the message is Ajv's.
- V4 MUST: a failed `oneOf` or `anyOf` lists only what explains it. The alternatives whose `type` does not fit the value (*must be object* for a URL string) and the summary (*must match exactly one schema in oneOf*) are left out while another error at or below that path remains; when every alternative fails on its type, all are listed. The same filter applies to the errors next to the fields.
- V3 SHOULD: errors are also shown next to the field, once the user has touched it. An error on an object or array marks that group, not every input inside it.

## GitHub hand-off

- G1 MUST: the repository is taken from the address when the page is served from `<owner>.github.io/<repo>/`; otherwise from `<meta name="registry-repository">`. The target branch comes from `<meta name="registry-branch">`.
- G2 MUST: the entry path is derived from `providerId` by the README rule (`<a>`/`<b>` = first two characters lowercased, anything but `a-z0-9` becomes `_`, `<b>` is `_` for a one-character id) and shown.
- G3 MUST: the form shows whether the path is a new entry or changes an existing one, by checking whether the file exists on the site.
- G4 MUST: the submit button is disabled while the entry is invalid or has no `providerId`.
- G5 MUST: new entry: open `https://github.com/<repo>/new/<branch>?filename=<path>&value=<json>` in a new tab. If that address is longer than 8000 characters, copy the JSON to the clipboard and open the address without `value`, and tell the user to paste it.
- G6 MUST: existing entry: copy the JSON to the clipboard and open `https://github.com/<repo>/edit/<branch>/<path>`, and tell the user to replace the file's content with it (GitHub's editor cannot be prefilled).
- G7 MUST: a *Copy JSON* button, and the JSON shown on the page (collapsible).
- G8 MUST: messages to the user are shown on the page, not with `alert()`.
- G9 MUST: the logo is part of the entry (a URL or embedded, S14), so the pull request has a single file. An entry with an embedded logo is usually longer than the link allows and goes the G5 way (copy and paste).

## Loading an entry

- L1 MUST: an input for a `providerId` and a *Load entry* button fill the form with `../<entry path>`. A missing entry is reported on the page.
- L2 MUST: `?providerId=<id>` in the address loads that entry when the page opens.
- L3 MUST: acknowledgements (S15) are dropped from a loaded entry: whoever submits a change gives the consent again.

## Guidance on the page

- P1 MUST: a short introduction: what the form does, a link to the schema, a link to the README on GitHub, and the two content rules (list a source for every fact in `links` with `rel` `source` and an `accessed` date; never name a customer's domain).
- P2 MUST: the introduction and the entry panel (above the buttons) link the submission terms (`TERMS.md`) and the licence (`LICENSE`, CC0 1.0) on GitHub, and say that submitting requires the consent at the end of the form. Descriptions are plain text (S9), so the schema's `consent` description names the files but cannot link them.

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

The library-independent parts are kept apart from the library, so that the library could be replaced by changing only `index.html`:

- `form/styles.css`: the design above. Form controls get it through the class `controls` on their container (the library's markup inside `#form`, and the load form).
- `form/registry.js`: loads the schema, validates with Ajv 2020, entry path, new/existing check, GitHub hand-off, copy, loading entries, and the entry panel. It also has the generic helpers the adapter uses: `relevantErrors` (the `if` and V4 filter, for Ajv's and the library's error objects), `breadcrumbs` (V2), `embedImage` and `embeddedImageURL` (S14: detection, scaling, gzip and base64, preview). It drops objects that end up empty (D1); empty arrays and empty strings stay. And it drops values that Ajv reports with the keyword `false schema` (D6), so the form library may keep a hidden conditional value. Acknowledgements (S15): it adds the root properties of that shape to the root's `required` of the schema it validates with and passes to `mount`, writes them only when `true`, and deletes them from a loaded entry. It calls the library adapter through one function: `mount(element, schema, onChange)` returns (a promise of) `{ setValue(entry) }`, and calls `onChange(entry)` with the form's value once the form is built and on every change, `setValue` included. It needs the global `ajv2020` (Ajv's 2020 bundle from cdnjs, with SRI).
- `form/index.html`: the page (header, intro, load form, form card, entry panel, footer), the import map, the library-specific CSS and the adapter.
- `form/assets/`: the Domain Connect logo and favicons.

## Decision: react-jsonschema-form

The form uses [react-jsonschema-form](https://rjsf-team.github.io/react-jsonschema-form/) (RJSF) 6.10.1 with its **core theme** (plain Bootstrap 3 markup, styled in `index.html`). It meets every MUST and SHOULD of this spec with about 50 lines of adapter code and 28 lines of CSS.

Alternatives tried (each on its own branch, now deleted) and why they were dropped:

- **[JSON Forms](https://jsonforms.io) 3.8** with Material UI renderers (its vanilla renderers cannot show nested objects). It needs the schema dereferenced first (it does not follow `$ref` when picking a renderer) and a custom flag renderer. Dropped because esm.sh splits Material UI into modules that each carry their own copy of shared React contexts: items of an array of objects (contacts) could not be opened, and the required marker and focus state of labels were lost. Only a build step would fix that, which H1 rules out.
- **[jsonform](https://github.com/jsonform/jsonform) 2.2.5** (jQuery, last release 2022). It reads an older dialect (no `$ref`, `required` per property, one type per field) and writes descriptions as HTML, so it needed a schema adapter. It still failed D3 for 23 of 25 entries (it drops empty arrays and `null`), D4 (drops unknown keys), V3 (no errors next to fields), and S6 (items can only be removed from the end).
- **RJSF with its Material UI theme** (`@rjsf/mui`): same esm.sh problem as JSON Forms (no required markers, contexts not shared).

## Implementation notes (RJSF)

- Libraries come from esm.sh through an import map: `react@19.3.0`, `react-dom@19.3.0`, `@rjsf/core@6.10.1`, `@rjsf/validator-ajv8@6.10.1`. Pick versions at least two weeks old. Ajv 8.17.1 is the cdnjs UMD bundle with SRI.
- esm.sh pitfalls: map both `react` and `react/` (for `react/jsx-runtime`), and `react-dom/` as `https://esm.sh/react-dom@<v>&external=react/`. Give `@rjsf/core` and `@rjsf/validator-ajv8` the same query (`?external=react,react-dom&deps=@rjsf/utils@<v>`) so they share one `@rjsf/utils`. Two copies of a React library with contexts break silently; check that module URLs match.
- Validation inside RJSF: `customizeValidator({ AjvClass: ajv2020.default })`. Form props: `liveValidate: true`, `showErrorList: false` (the entry panel lists errors), `experimental_defaultFormStateBehavior: { emptyObjectFields: "skipEmptyDefaults", arrayMinItems: { populate: "never" } }` (D1), `uiSchema: { "ui:submitButtonOptions": { norender: true } }`.
- Tri-state flags: the `CheckboxWidget` is replaced by a widget that, for a schema whose type allows `boolean` and `null`, renders the core `SelectWidget` with options *true*/*false* and placeholder *unknown* (empty choice = key left out; a loaded `null` is shown as *unknown* and stays `null` while untouched). Any other boolean still gets the core checkbox. RJSF leaves label and description of a boolean to its widget, so this widget renders them itself.
- The adapter is a small React component holding the form data in state: `useEffect(() => { onChange(data); }, [data])`. Use a block body: `onChange` returns a promise, and an effect must not return one (React calls it as cleanup: "is not a function").
- CSS targets RJSF 6 class names: `.rjsf`, `.rjsf-field`, `.rjsf-array-item` (with `.col-xs-9` content and `.array-item-toolbox`), `.rjsf-array-item-add`, `.control-label`, `.field-description`, `.error-detail`, `.has-error`. The core theme's buttons use Bootstrap glyphicons (`glyphicon-plus`, `-remove`, `-arrow-up`, `-arrow-down`, `-copy`); the CSS draws them with Unicode characters. The legend of an array item ("documentation-1 *") is hidden.
- RJSF shows the schema's root `title` and `description` at the top of the form.
- Conditional properties (S11): RJSF resolves `if`/`then`/`else`, also inside `allOf`, against the form data and merges the branch into the object. A property declared only in a `then` would appear at the end of the object's fields, so the schema declares each conditional property in `properties` (where it keeps its place) and the `else` only sets it to `false`, which RJSF does not render. RJSF keeps the value of a field that disappears; `registry.js` leaves it out of the entry (D6). A failing branch also yields an `if` error on the object (`/onboarding: must match "then" schema`); `transformErrors` drops it in RJSF and `registry.js` drops it from the list.
- A native input that the browser finds invalid after the user has touched it (`:user-invalid`, for example a `url` input with no scheme) also gets the coral border. The browser's own validation messages never show: the form is never submitted.
- The error border applies only to inputs of a field that is not an object or array (`.has-error:not(.rjsf-field-object, .rjsf-field-array)`): RJSF puts `has-error` on the group's wrapper, and a descendant selector would turn every input in the group red.
- Field ids follow the path: `root_providerId`, `root_features_syncFlow`, `root_links_0_url`.
- `oneOf` (S13) is RJSF's `MultiSchemaField`: a select `root_<path>__oneof_select` with the option titles. Switching the option drops a value that does not fit the new one.
- Embedded file (S14): `fields.ObjectField` is replaced by a wrapper that renders `ImageField` for an object of the S14 shape and the core `ObjectField` otherwise. `ImageField` calls `onChange(value, fieldPathId.path)` (the RJSF 6 field signature), shows the errors of its properties from `errorSchema`, and renders its own label and description. The file input sits inside a `label.btn` with `opacity: 0` and `pointer-events: none` (positioned over the label, not the page: a stray absolutely positioned input covered *Remove*). `CompressionStream` needs Chrome 80, Firefox 113, Safari 16.4.
- `transformErrors: errors => relevantErrors(errors, e => e.name, e => e.property)`: RJSF's errors name the keyword `name` and the path `property` (`.logo`).
- Acknowledgement (S15): RJSF renders a `const: true` boolean with the core `CheckboxWidget`. `experimental_defaultFormStateBehavior.constAsDefaults: "never"` is needed: by default RJSF uses `const` as the default and the box would start ticked. RJSF makes a required boolean `false` by default (`getDefaultBasedOnSchemaType`), which is why `registry.js` writes an acknowledgement only when it is `true`, and why `transformErrors` drops RJSF's `const` error with `allowedValue: true`: otherwise *must be equal to constant* shows next to the box as soon as anything is edited or an entry is loaded. What shows next to it after an edit is RJSF's own *must have required property 'Consent to the submission terms'*, as for any required field.

## Status

On branch `feat/inputform` (not pushed, not merged into `main`):

1. `WIP: input form page`: the first form (json-editor), now replaced.
2. `Spec for the entry form`: this file.
3. `Schema: a title for every property`: 65 titles in `schema/provider.schema.json`, nothing else changed; all entries still validate.
4. `Form: shared page style and GitHub hand-off`: `styles.css`, `registry.js`, assets.
5. `Form: react-jsonschema-form alternative`: `index.html` with RJSF.
6. `Spec: choose react-jsonschema-form; record decisions, status and tests`: the decision and the rest of this file.
7. `WIP: partners rework`: `onboarding.partner` (one object) became `onboarding.partners` (array of `#/$defs/partner`: `name`, `url`, `contacts` as `#/$defs/contacts`), allowed only while `usesPartner` is `true` (`if`/`then`/`else` on `onboarding`); `provider.example` and the README follow. The form needed no change for it beyond D6 in `registry.js`; `transformErrors` and the error-border CSS keep an empty partner from marking the whole `onboarding` group.
8. `Onboarding by mode, cost and agreement details; native inputs from format`: onboarding: `mode` gains `other`; conditional fields `updateSchedule` (automatic), `contacts` (on-request only, then required, at least one), `modeDescription` (other), `costDetails` (`cost` true), new flag `agreementRequired` with `agreementUrl`; `formUrl` dropped in favour of the contact type `form` (value a URL). Entries: `provider.example` (form contact, agreement), `domainchief` and `glauca.digital` (automatic: their onboarding contacts moved to `contacts.technical`, the deployment cadence from `notes` to `updateSchedule`). No form change.
9. Same commit: `format` for native inputs (S12): `uri` on `$defs/url`, `email` on an e-mail contact's value, `date` on `links[].accessed`; patterns unchanged; Ajv in `registry.js` and RJSF with `validateFormats: false`; coral border for `:user-invalid`. `agreementUrl` is titled "Agreement URL".

10. `Form: error breadcrumbs; embedded logos with CI checks`: error breadcrumbs (V2) with the `oneOf` filter (V4); `logo` is now a URL or an embedded image (S13, S14, G9), uploaded and converted in the form, with the SVG rules (`svgProblem`).
11. Same commit: the 10 entries with a logo file embed it, converted with the form's `embedImage` in Chromium (cloudflare, glauca.digital, namesilo, plesk and vercel scaled down to fit 600 × 200); the logo files are deleted. `scripts/check-files.sh` allows only entries under `providers/` (no `-s` option any more); the new `scripts/check-logos.py` (standard library only) checks embedded logos in CI (encoding, format match, PNG chunks and CRCs, JPEG markers, size limits, SVG rules), in a step after schema validation that reads the same entry list. README: section Logo, the example, the CI section. Both SVG rule sets give the same verdicts on a set of 16 test SVGs.

All acceptance checks pass with RJSF (checked on 2026-10-10): 25 of 25 entries round-trip and validate, a new string and a new flag added to the served schema appear, a minimal entry has exactly two keys, the new-entry and edit links are right, the e-mail contact error is listed and blocks submission, flags write `true`, `false` and nothing, `notes` stays verbatim, unknown keys are kept, inline errors show, no horizontal scroll at 400 px. The conditional-property checks (`partners.mjs`, `onboarding.mjs`), the format checks (`formats.mjs`), the logo and breadcrumb checks (`logo.mjs`) and the consent checks (`consent.mjs`) pass too. With the logos embedded, the round trip covers them: an embedded logo loads, is previewed and is written back unchanged. `scripts/check-files.sh`, `scripts/check-logos.py` and `check-jsonschema` pass on all entries.

12. `Legal consent and CC0 licence`: `LICENSE` (CC0 1.0 Universal legal code from creativecommons.org, unchanged), `TERMS.md` (submission terms: authority to represent the provider, accuracy, no personal data and organisational contacts only, keeping the entry current, CC0, use of data and logos by domainconnect.org, no liability of anyone related to domainconnect.org), schema property `consent` (S15), README section *Licence and submission terms*. Form: S15, L3, P2 in `registry.js` and `index.html`. No entry changed: the existing entries were compiled from public sources, not submitted by the providers, so they carry no `consent`.
13. `CI requires consent; pull request template; AGENTS.md`: `scripts/check-consent.py` and a CI step check `"consent": true` in the entries a push or pull request adds or changes (not on a full run, not all entries on a schema change; a maintainer's correction needs it too). `.github/pull_request_template.md` (entry, summary, sources, relation to the provider, checklist, consent with a summary of the terms). `AGENTS.md`: AI agents interview the user about every field, show ground knowledge with its source for confirmation, never guess, present the terms and ask for consent before the pull request, and follow the template. The README points to both. `AGENTS.md` is self-contained: it carries the feature and `exampleDomain` rules itself, since CLAUDE.md is not tracked. `provider.example` (the dummy that uses every field) has `"consent": true`. No form change.

## Testing

Serve the repository root (`.venv/bin/python -m http.server 8765 --bind 127.0.0.1`) and drive `http://127.0.0.1:8765/form/` with Playwright. The scripts are in `.form-tests/` (not tracked by git; see its README and CLAUDE.md): `accept.mjs` and `accept2.mjs` run the checks below, `titles.mjs` checks labels from titles, `partners.mjs` and `onboarding.mjs` check the conditional properties (S11, D6), `formats.mjs` the native inputs (S12), `logo.mjs` the logo and the breadcrumbs (S13, S14, V2, V4), `consent.mjs` the consent (S15, L3, P2), `clips.mjs` takes screenshots. Run them with `.scratchpad/shared/bin/node-pw <script>`. If they are gone, rebuild them from this list. Wait about 3 s after loading for the CDN modules. The checks:

- Round trip: for every `providers/*/*/*.json`, fill `#load-id`, submit `#load-form`, and compare `JSON.parse(#json)` with the file (keys sorted, without `consent`); `#errors` must list only the missing `consent`. Scripts that need a valid entry tick `#root_consent` first.
- Schema extension: intercept `**/schema/provider.schema.json` with `page.route` and serve the schema with an extra top-level string and an extra flag under `features`; their names must appear in `#form`'s text. The same way, serve titles to check labels.
- Minimal entry: fill the first two visible inputs of `#form`; `#submit` is disabled; tick `#root_consent`; `#json` must be `{"providerId": …, "name": …, "consent": true}` and `#submit` enabled.
- Hand-off: in a browser context with clipboard permissions, route `https://github.com/**` to a stub, click `#submit`, and check the popup's URL (`/new/main?filename=…&value=…` for a new entry, `/edit/main/<path>` for `provider.example`) and the text of `#message`.
- Flags: `selectOption('[id="root_features_syncFlow"]', { label })` with *true*, *false*, *unknown*.
- Verbatim text: fill `#root_notes` with `<b>a & b</b>`.
- Invalid contact and unknown keys: route `**/providers/t/e/test.invalid.json` to an entry with `url: "nope"`, an unknown key and a contact `{type: "email", value: "nope"}`, open `?providerId=test.invalid`; `#errors` must contain `/contacts/technical/0/value`, `#submit` must be disabled, the unknown key must stay in `#json`.
- Conditional property: on a new entry no `root_onboarding_partners*` element exists, nor with `usesPartner` *false*; with *true* the array appears. Add an empty partner: `#errors` lists `/onboarding/partners/0: must have required property 'name'` and no `"then"` error, and the only coral inputs are `providerId`, `name` and the partner's name. Add two partners, the first with an e-mail contact (`root_onboarding_partners_0_contacts_0_*`); `#json` has exactly those in `onboarding.partners`. Set *false*: the field is gone, `onboarding` in `#json` is `{"usesPartner": false}`, `#errors` names nothing under `/onboarding`. Set *true* again: both partners are back. `?providerId=provider.example` shows its partner and the partner's contact.
- Onboarding conditions: the order of the `root_onboarding_*` fields is `mode documentationUrl cost agreementRequired usesPartner requirements notes` with no mode; mode *automatic* adds `updateSchedule`, *on-request* adds `contacts` (marked required, `#errors` lists `/onboarding: must have required property 'contacts'`, a contact of type `form` must be a URL), *other* adds `modeDescription`, each right after `mode`. A value of a field that disappears is left out of `#json` without an error. `cost`, `agreementRequired`, `usesPartner` *true* add `costDetails`, `agreementUrl`, `partners` right after the flag; *false* or *unknown* hide them, and the entered value comes back with *true*. `provider.example` shows `mode contacts documentationUrl cost agreementRequired agreementUrl usesPartner partners requirements notes`.
- Logo and breadcrumbs: on a new entry, `#errors` begins with `DNS provider registry entry: must have required property 'providerId'` and has no JSON path. *Logo URL* "nope" lists only `Logo: must match pattern` (no *must be object*, no `oneOf`); a URL is written as a string. *Embedded logo*: an 800 × 400 PNG (drawn on a canvas) is written as `{format: "png", data: "H4sI…"}`, gunzips to a 400 × 200 PNG, is previewed, and `H4sI` appears nowhere in `#form`'s text or input values. A 160 × 50 PNG shows "at least 90 × 90" and keeps the previous image; 1300 × 200 and 150 × 400 are rejected for their ratio; 900 × 300 becomes 600 × 200, 1200 × 200 becomes 600 × 100, 540 × 90 stays, 300 × 600 becomes 100 × 200; an SVG with `onload` or with an external `image href` is rejected with the reason and the previous image kept; a 150 × 120 JPEG is kept byte for byte (`jpg`); SVG text uploaded as `logo.txt` becomes `svg` and gunzips to the same text; a GIF is rejected naming `svg, png, jpg`; *Remove* leaves no `logo` key. A routed entry with an embedded SVG round-trips and is previewed; `logo: {format: "png"}` lists `Logo: must have required property 'data'` only. A routed invalid entry lists `Website: …`, `Contacts › Technical contacts › Contact 1 › Value: …`, `Onboarding › Onboarding partners › Partner 1: must have required property 'name'`, `Links › Link 2 › Accessed: …`. At 400 px, no horizontal scroll with a preview.
- Formats: `?providerId=godaddy.com`: `root_url` and `root_links_1_url` have type `url`, `root_links_1_accessed` type `date`, the e-mail contact's value type `email` (type `url` once the contact type is `form`); `#errors` is empty although a link holds `{domain}`, and the console has no "unknown format" warning. Filling the date input writes `YYYY-MM-DD`. `url` "not a url" or "mailto:a@b.example" lists `/url: must match pattern` and the input is coral; an untouched empty required input is not.
- Consent: on a new entry `root_consent` is the last top-level field, an unticked checkbox labelled *Consent to the submission terms* with the required marker, and no error shows next to it; after edits only *must have required property 'Consent to the submission terms'* does, and never *must be equal to constant* (also not after loading an entry). With `providerId` and `name` filled, `#json` has no `consent`, `#errors` lists `DNS provider registry entry: must have required property 'consent'`, `#submit` is disabled; ticked, `consent: true` is written and `#submit` is enabled; cleared, the key is gone again. The page links `/blob/main/TERMS.md` and `/blob/main/LICENSE`. A routed entry with `consent: true` loads unticked and without `consent` in `#json`; ticked, the output equals the file.
- Width: at a 400 px viewport, `document.documentElement.scrollWidth` must be at most 400.

## Open items

- `TERMS.md` was drafted from the maintainer's list of points; have it reviewed by someone qualified in law before the repository is opened to providers. Who "domainconnect.org" is as a legal party (the organisation behind it) is not named.
- The terms forbid personal data, but existing entries were not reviewed for contacts of individuals.

- Some descriptions only repeat their new title (`url` "Website.", `syncFlow` "Synchronous flow.", `onboarding.documentationUrl` "Process documentation."); shorten or drop them.
- `providers/g/o/godaddy.com.json` has `"onboarding": {"notes": ""}`, which looks like a leftover.
- The README describes the form only as `form/index.html`; mention `registry.js`, `styles.css` and `assets/` if the layout table should list them.
- Before merging: squash or reword the `WIP` and "alternative" commit messages, and check the page on GitHub Pages (`.nojekyll`, the CDN modules, the `registry-repository` meta).

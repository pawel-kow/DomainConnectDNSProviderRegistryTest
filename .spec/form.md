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
| S1 | `type: string` with `minLength`, `pattern` | `providerId`, `exampleDomain`, `logo` | Text input. Pattern and length errors are shown. |
| S2 | Local `$ref` into `$defs`, with sibling keywords | `url: {"description": "Website.", "$ref": "#/$defs/url"}` | Resolved. The sibling `description` is shown. |
| S3 | Tri-state flag `type: ["boolean", "null"]` | every `features.*` flag | A choice of *unknown*, *true* and *false*. A loaded `null` stays `null` when the field is not touched. *Unknown* writes `null` or leaves the key out; both mean unknown. |
| S4 | `enum` without `type` | `onboarding.mode`, contact `type` | A select of the enum values. The value written is the enum value as is. |
| S5 | Nested objects, several levels | `features.templates`, `onboarding.requirements` | Grouped and visibly nested, labelled with the object's title. |
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

The library-independent parts are kept apart from the library, so that the library could be replaced by changing only `index.html`:

- `form/styles.css`: the design above. Form controls get it through the class `controls` on their container (the library's markup inside `#form`, and the load form).
- `form/registry.js`: loads the schema, validates with Ajv 2020, entry path, new/existing check, GitHub hand-off, copy, loading entries, and the entry panel. It also drops objects that end up empty (D1); empty arrays and empty strings stay. It calls the library adapter through one function: `mount(element, schema, onChange)` returns (a promise of) `{ setValue(entry) }`, and calls `onChange(entry)` with the form's value once the form is built and on every change, `setValue` included. It needs the global `ajv2020` (Ajv's 2020 bundle from cdnjs, with SRI).
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
- Field ids follow the path: `root_providerId`, `root_features_syncFlow`, `root_links_0_url`.

## Status

On branch `feat/inputform` (not pushed, not merged into `main`):

1. `WIP: input form page`: the first form (json-editor), now replaced.
2. `Spec for the entry form`: this file.
3. `Schema: a title for every property`: 65 titles in `schema/provider.schema.json`, nothing else changed; all entries still validate.
4. `Form: shared page style and GitHub hand-off`: `styles.css`, `registry.js`, assets.
5. `Form: react-jsonschema-form alternative`: `index.html` with RJSF.
6. `Spec: choose react-jsonschema-form; record decisions, status and tests`: the decision and the rest of this file.

All acceptance checks pass with RJSF (checked on 2026-10-10): 25 of 25 entries round-trip and validate, a new string and a new flag added to the served schema appear, a minimal entry has exactly two keys, the new-entry and edit links are right, the e-mail contact error is listed and blocks submission, flags write `true`, `false` and nothing, `notes` stays verbatim, unknown keys are kept, inline errors show, no horizontal scroll at 400 px.

## Testing

Serve the repository root (`.venv/bin/python -m http.server 8765 --bind 127.0.0.1`) and drive `http://127.0.0.1:8765/form/` with Playwright. The scripts are in `.scratchpad/shared/form-tests/` (not tracked by git; see its README and CLAUDE.md): `accept.mjs` and `accept2.mjs` run the checks below, `titles.mjs` checks labels from titles, `clips.mjs` takes screenshots. Run them with `.scratchpad/shared/bin/node-pw <script>`. If they are gone, rebuild them from this list. Wait about 3 s after loading for the CDN modules. The checks:

- Round trip: for every `providers/*/*/*.json`, fill `#load-id`, submit `#load-form`, and compare `JSON.parse(#json)` with the file (keys sorted); `#errors` must be empty.
- Schema extension: intercept `**/schema/provider.schema.json` with `page.route` and serve the schema with an extra top-level string and an extra flag under `features`; their names must appear in `#form`'s text. The same way, serve titles to check labels.
- Minimal entry: fill the first two visible inputs of `#form`; `#json` must be `{"providerId": …, "name": …}` and `#submit` enabled.
- Hand-off: in a browser context with clipboard permissions, route `https://github.com/**` to a stub, click `#submit`, and check the popup's URL (`/new/main?filename=…&value=…` for a new entry, `/edit/main/<path>` for `provider.example`) and the text of `#message`.
- Flags: `selectOption('[id="root_features_syncFlow"]', { label })` with *true*, *false*, *unknown*.
- Verbatim text: fill `#root_notes` with `<b>a & b</b>`.
- Invalid contact and unknown keys: route `**/providers/t/e/test.invalid.json` to an entry with `url: "nope"`, an unknown key and a contact `{type: "email", value: "nope"}`, open `?providerId=test.invalid`; `#errors` must contain `/contacts/technical/0/value`, `#submit` must be disabled, the unknown key must stay in `#json`.
- Width: at a 400 px viewport, `document.documentElement.scrollWidth` must be at most 400.

## Open items

- Some descriptions only repeat their new title (`url` "Website.", `syncFlow` "Synchronous flow.", `onboarding.documentationUrl` "Process documentation."); shorten or drop them.
- `providers/g/o/godaddy.com.json` has `"onboarding": {"notes": ""}`, which looks like a leftover.
- The README describes the form only as `form/index.html`; mention `registry.js`, `styles.css` and `assets/` if the layout table should list them.
- Before merging: squash or reword the `WIP` and "alternative" commit messages, and check the page on GitHub Pages (`.nojekyll`, the CDN modules, the `registry-repository` meta).

# CLAUDE.md

Registry of Domain Connect DNS providers: one JSON entry per `providerId`. [README.md](README.md) defines the format and [schema/provider.schema.json](schema/provider.schema.json) is the authoritative schema. Read both before you add or change an entry. When the format changes, update both together.

An entry is created for a user who submits it: follow [AGENTS.md](AGENTS.md) (interview the user about every field, never guess, consent to [TERMS.md](TERMS.md) before the pull request, the pull request template). The rules below say how you gather and check the facts you put to the user.

The entry form (`form/`) is specified in [.spec/form.md](.spec/form.md), together with its decisions, status and how to test it. Read it before you work on the form, and keep it current.

## Layout

- `providers/<a>/<b>/<providerId>.json`: `<a>` and `<b>` are the first two characters of `providerId`, lowercased. Any other character becomes `_`, and `<b>` is `_` for a one-character id. The file name keeps the original case (`providers/s/y/SYSTEMSEVEN.net.json`).
- `.scratchpad/`: scratch files and shared tools, ignored by git (see Tools).
- `.form-tests/`: Playwright checks of the entry form, ignored by git. They use Playwright from `.scratchpad/shared/`; see `.form-tests/README.md` and `.spec/form.md`.
- `.data/<timestamp>/`: Scanner snapshot, ignored by git through `.git/info/exclude`. `dns-providers.json` lists every DNS provider and its stack (`provider_id`). `dns-providers/<dns_provider_id>.json` holds the URLs taken from the settings response (API, sync and async UX, control panel, name servers), and `stacks/` groups providers by `providerId`. The snapshot tells you which providers exist. It is not a citable source.

## Tools

- Available: `jq`, `curl`, `dig`, `python3`, `node` (LTS, with `npm`).
- Run Python only from the virtualenv at `.venv/` (ignored by git through `.git/info/exclude`), never with the system interpreter or a system-wide `pip install`. Create it if it is missing with `python3 -m venv .venv`, install packages with `.venv/bin/pip install <pkg>`, and run `.venv/bin/python`. `jsonschema` is installed there.
- Validate every entry you add or change against the schema, and also check it with `jq -e .`:

  ```bash
  .venv/bin/python - providers/*/*/*.json <<'EOF'
  import json, sys, jsonschema
  s = json.load(open('schema/provider.schema.json'))
  V = jsonschema.validators.validator_for(s); V.check_schema(s)
  v = V(s, format_checker=V.FORMAT_CHECKER)
  for f in sys.argv[1:]:
      for e in v.iter_errors(json.load(open(f))): print(f, e.json_path, e.message)
  EOF
  ```

- Resolve DNS with `dig`, for example `dig +short TXT _domainconnect.<domain>`. With `+short`, a CNAME shows up as an extra unquoted line before the TXT value, so keep only the quoted lines.
- Keep scratch files in `.scratchpad/` (ignored by git through `.git/info/exclude`), not in the session scratchpad the harness offers under `/tmp` and not elsewhere in the repo:
  - `.scratchpad/<YYYY-MM-DD>-<topic>/`: one folder per session or task, for intermediate files, downloads and screenshots. Create a new one; reuse an existing one when you resume that task.
  - `.scratchpad/shared/`: large tools that stay the same between sessions. Reuse them; do not install them again per session. Add a new tool here when it is big or needed again.
    - Node packages: `shared/package.json` (exact versions) and `shared/node_modules`, installed with `npm --prefix .scratchpad/shared install --save-exact <pkg>@<version>`. `.scratchpad/node_modules` links to it, so any script under `.scratchpad/` can import them.
    - Playwright 1.55.0 with Chromium: the browsers are in `shared/ms-playwright`. Run scripts with `.scratchpad/shared/bin/node-pw <script.mjs>`, which sets `PLAYWRIGHT_BROWSERS_PATH`. Install a browser with `PLAYWRIGHT_BROWSERS_PATH=$PWD/.scratchpad/shared/ms-playwright .scratchpad/node_modules/.bin/playwright install <browser>`.
  - Python stays in `.venv/` at the repository root.
- Run `scripts/check-files.sh` after adding or moving entries, `.venv/bin/python scripts/check-logos.py providers/*/*/*.json` after adding or changing a logo, and `.venv/bin/python scripts/check-consent.py <entry>...` on the entries you add or change. CI runs all three (consent only on added and changed entries), plus schema validation with `check-jsonschema` ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Adding an entry

1. Find candidates by comparing the stacks in `.data/.../dns-providers.json` with `providers/`.
2. Skip a stack that cannot be keyed (`provider_id` null) or that has no public source at all. For example, the settings endpoint never answers and no documentation exists.
3. Fetch a live settings response at `https://<urlAPI>/v2/<domain>/settings`. Try the provider's own domains first. Many endpoints answer only for domains they host.
4. Search for the provider's public Domain Connect documentation. If you find it, add it to `documentation` and take onboarding facts and limitations from it.
5. Add `logo`, onboarding contacts or anything else only when a public source states it. Leave out what you cannot source instead of guessing. A logo is a URL or embedded in the entry (README, Logo); never add a logo file.
6. Put what you found to the user who submits the entry, and let them confirm, correct or complete it, as [AGENTS.md](AGENTS.md) says. CI rejects an added or changed entry without `"consent": true`, and only that user can give it. Never set it yourself.

## Rules for the content

- Every fact needs a source. List each source in `links` with `rel: "source"` and `accessed: "YYYY-MM-DD"` (the day you checked it).
- Derive these features from the settings response:
  - `syncFlow`: `urlSyncUX` is present.
  - `asyncFlow`: true if `urlAsyncUX` is present, false if it is absent.
  - `settings.urlControlPanel`, `settings.nameServers`, `settings.windowSize` (`width` and `height`): whether the key is returned. If any response you saw returns it with a real value, count it as returned and explain a `null` in `notes`.
  - `settings.nonStandard`: keys the specification does not define. The defined keys are `providerId`, `providerName`, `providerDisplayName`, `urlSyncUX`, `urlAsyncUX`, `urlAPI`, `width`, `height`, `urlControlPanel` and `nameServers`. `domain` and `redirectSupported`, for example, are non-standard. Use an empty list when there are none.
- Use `notes` for facts that have no field: odd `providerName` or `providerDisplayName` values, placeholders such as `%domain%` in URLs, an endpoint that answers for domains it does not host, and limitations stated in the documentation. Write notes as plain text, never HTML.
- Do not speculate about ownership, shared software or relationships between providers unless a source says so.
- Match the formatting of existing entries. When you change an existing file, make targeted edits; do not reformat the whole file with `jq`.

## Domains in entries: `exampleDomain` and settings links

Never publish a customer's domain anywhere in an entry.

`exampleDomain` is set only when both conditions hold:

1. **The domain belongs to the provider.** It is the provider's own domain, or a brand or company of the same group, and you have evidence for that (for example a redirect to the provider's site, or links to the provider on the domain's site). The other case is a domain the provider lists publicly as an example. A registrar-only RDAP record or a parked page is not evidence.
2. **It completes the whole discovery flow.** The `_domainconnect.<domain>` TXT record names the provider's API (follow CNAMEs), and `GET https://<that value>/v2/<domain>/settings` returns this entry's `providerId`. A domain whose record is missing, points elsewhere (for example to Cloudflare) or holds something unrelated does not qualify, even if the provider's settings endpoint answers for it.

If no domain qualifies, leave `exampleDomain` out.

Settings links in `links`:

- A link may name a domain of the provider, even when that domain is not `exampleDomain`. Prefer `exampleDomain` when there is one.
- If the domain does not belong to the provider and is not listed publicly by it (a customer's domain, or one you cannot verify), replace it with the placeholder `{domain}`, for example `https://domainconnect.api.godaddy.com/v2/{domain}/settings`.

Re-run the discovery check for every `exampleDomain` after editing (the dummy entry `provider.example` is skipped):

```bash
for f in providers/*/*/*.json; do
  [ "$f" = providers/p/r/provider.example.json ] && continue
  d=$(jq -r '.exampleDomain // empty' "$f"); [ -z "$d" ] && continue
  pid=$(jq -r .providerId "$f")
  t=$(dig +short +time=5 TXT "_domainconnect.$d" | grep '^"' | head -1 | tr -d '"')
  r=$(curl -s -m 10 "https://${t%/}/v2/$d/settings" | jq -r .providerId 2>/dev/null)
  echo "$pid $d $([ "$r" = "$pid" ] && echo OK || echo FAIL)"
done
```

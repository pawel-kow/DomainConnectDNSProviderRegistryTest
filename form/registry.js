// The part of the entry form that does not depend on the form library: schema, validation,
// entry path, loading entries and the hand-off to GitHub. index.html passes the library
// adapter: mount(element, schema, onChange) returns { setValue(entry) } and calls
// onChange(entry) with the form's value once it is built and whenever it changes, setValue
// included. Needs the global ajv2020 (Ajv's 2020 bundle).

const $ = id => document.getElementById(id);
const meta = name => document.querySelector(`meta[name="${name}"]`).content;
const ghPages = location.hostname.match(/^([^.]+)\.github\.io$/);
const REPO = ghPages && location.pathname.split("/")[1]
  ? `${ghPages[1]}/${location.pathname.split("/")[1]}`
  : meta("registry-repository");
const BRANCH = meta("registry-branch");
// GitHub rejects longer addresses; above this the JSON is copied instead of passed in the link.
const MAX_URL = 8000;

// Path rule from the README: providers/<a>/<b>/<providerId>.json.
export function entryPath(id) {
  const c = ch => /^[a-z0-9]$/.test(ch.toLowerCase()) ? ch.toLowerCase() : "_";
  return `providers/${c(id[0])}/${id.length > 1 ? c(id[1]) : "_"}/${id}.json`;
}

// Objects that end up empty are left out (an empty optional group). Empty arrays and empty
// strings are values and stay.
function prune(v) {
  if (Array.isArray(v)) return v.map(prune);
  if (!v || typeof v !== "object") return v;
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    const p = prune(x);
    if (p === undefined) continue;
    if (p && typeof p === "object" && !Array.isArray(p) && !Object.keys(p).length) continue;
    out[k] = p;
  }
  return out;
}

const existing = new Map();
function exists(path) {
  if (!existing.has(path)) {
    existing.set(path, fetch(`../${path}`, { method: "HEAD", cache: "no-store" })
      .then(r => r.ok, () => false));
  }
  return existing.get(path);
}

export async function start(mount) {
  for (const a of document.querySelectorAll("a[data-repo]")) {
    a.href = `https://github.com/${REPO}${a.dataset.repo.replace("{branch}", BRANCH)}`;
  }
  const schema = await (await fetch("../schema/provider.schema.json", { cache: "no-store" })).json();
  const validate = new ajv2020.default({ allErrors: true, strict: false }).compile(schema);
  let entry = {}, mode = "new", seq = 0;
  const json = () => JSON.stringify(entry, null, 2) + "\n";
  const say = text => { $("message").textContent = text; };

  // A value whose schema is false is left out: a conditional property whose condition no
  // longer holds (onboarding.partners once usesPartner is not true). The form keeps the
  // value, so it comes back when the condition holds again.
  function dropForbidden(v) {
    if (validate(v)) return v;
    for (const e of validate.errors) {
      if (e.keyword !== "false schema" || !e.instancePath) continue;
      const keys = e.instancePath.slice(1).split("/").map(k => k.replace(/~1/g, "/").replace(/~0/g, "~"));
      const last = keys.pop();
      const parent = keys.reduce((o, k) => o?.[k], v);
      if (parent && typeof parent === "object" && !Array.isArray(parent)) delete parent[last];
    }
    return prune(v);
  }

  async function update(value) {
    entry = dropForbidden(prune(value ?? {}));
    $("json").textContent = json();
    const ok = validate(entry);
    // An "if" error only says that the "then" or "else" branch failed; the errors inside the
    // branch are listed themselves.
    $("errors").replaceChildren(...(validate.errors || []).filter(e => e.keyword !== "if").map(e => {
      const li = document.createElement("li");
      li.textContent = `${e.instancePath || "/"}: ${e.message}`;
      return li;
    }));
    $("valid").hidden = !ok;
    const id = typeof entry.providerId === "string" && entry.providerId ? entry.providerId : "";
    const path = id && !/[/\\]/.test(id) ? entryPath(id) : "";
    $("path").textContent = path || "–";
    $("submit").disabled = !ok || !path;
    const s = ++seq;
    const isNew = !path || !(await exists(path));
    if (s !== seq) return;
    mode = isNew ? "new" : "edit";
    $("exists").textContent = path ? (isNew ? "new entry" : "changes an existing entry") : "";
    $("submit").textContent = isNew ? "Open pull request on GitHub" : "Copy JSON and edit on GitHub";
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(json());
      return true;
    } catch {
      say("The JSON could not be copied. Copy it from the JSON section below.");
      $("json-details").open = true;
      return false;
    }
  }

  async function submit() {
    const path = entryPath(entry.providerId);
    let url = `https://github.com/${REPO}/new/${BRANCH}?` +
      new URLSearchParams({ filename: path, value: json() });
    if (mode === "edit") {
      // GitHub's file editor cannot be prefilled; the user pastes the copied JSON.
      url = `https://github.com/${REPO}/edit/${BRANCH}/${path}`;
      if (await copy()) say("The JSON is copied. In the GitHub editor, replace the file's content with it.");
    } else if (url.length > MAX_URL) {
      url = `https://github.com/${REPO}/new/${BRANCH}?` + new URLSearchParams({ filename: path });
      if (await copy()) say("The entry is too long for a link. The JSON is copied; paste it into the GitHub editor.");
    } else {
      say("");
    }
    window.open(url, "_blank", "noopener");
  }

  const form = await mount($("form"), schema, update);

  async function load(id) {
    if (!id) return;
    const path = entryPath(id);
    const r = await fetch(`../${path}`, { cache: "no-store" }).catch(() => null);
    if (!r || !r.ok) { $("load-status").textContent = `No entry ${path} found.`; return; }
    const value = await r.json();
    form.setValue(value);
    $("load-status").textContent = `Loaded ${path}.`;
  }

  $("submit").addEventListener("click", submit);
  $("copy").addEventListener("click", async () => { if (await copy()) say("The JSON is copied."); });
  $("load-form").addEventListener("submit", e => { e.preventDefault(); load($("load-id").value.trim()); });
  const id = new URLSearchParams(location.search).get("providerId");
  if (id) { $("load-id").value = id; await load(id); }
}

export function fail(e) {
  $("form").textContent = `The form could not be built: ${e}`;
  console.error(e);
}

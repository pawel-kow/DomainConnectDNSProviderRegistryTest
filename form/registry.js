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

// JSON Pointer segments of an Ajv instancePath.
const segments = path => path ? path.slice(1).split("/").map(k => k.replace(/~1/g, "/").replace(/~0/g, "~")) : [];

// Errors worth showing. An "if" error only says that the "then" or "else" branch failed; the
// errors inside the branch are listed themselves. A failed oneOf or anyOf also reports every
// alternative that does not fit the value's type ("must be object" for a string); while
// another error at or below that path explains the failure, those and the summary are left
// out. keyword and path read an error's keyword and instance path (Ajv and the form library
// name them differently).
export function relevantErrors(errors, keyword = e => e.keyword, path = e => e.instancePath) {
  errors = errors.filter(e => keyword(e) !== "if");
  const branches = new Set(errors.filter(e => ["oneOf", "anyOf"].includes(keyword(e))).map(path));
  const noise = e => branches.has(path(e)) && ["oneOf", "anyOf", "type"].includes(keyword(e));
  const explained = new Set([...branches].filter(p =>
    errors.some(e => !noise(e) && (path(e) === p || path(e).startsWith(p + (p.startsWith(".") ? "." : "/"))))));
  return errors.filter(e => !(noise(e) && explained.has(path(e))));
}

// A readable location for an instancePath: the title (or name) of each property and the
// item's title with its number for an array index, e.g. "Links › Link 2 › Accessed".
export function breadcrumbs(schema, path) {
  const deref = s => {
    while (s && typeof s === "object" && typeof s.$ref === "string" && s.$ref.startsWith("#/")) {
      const t = segments(s.$ref.slice(1)).reduce((o, k) => o?.[k], schema);
      s = { ...t, ...s, $ref: undefined };
    }
    return s;
  };
  // The schema of a property: declared in properties, or in a branch (allOf, if/then/else,
  // oneOf, anyOf) of the object.
  const property = (s, key) => {
    s = deref(s);
    if (!s || typeof s !== "object") return undefined;
    if (s.properties?.[key] && typeof s.properties[key] === "object") return s.properties[key];
    for (const b of [...(s.allOf || []), s.then, s.else, ...(s.oneOf || []), ...(s.anyOf || [])]) {
      const p = property(b, key);
      if (p) return p;
    }
    return undefined;
  };
  // The items schema of an array, also inside a branch.
  const items = s => {
    s = deref(s);
    if (!s || typeof s !== "object") return undefined;
    if (s.items && typeof s.items === "object") return s.items;
    for (const b of [...(s.allOf || []), ...(s.oneOf || []), ...(s.anyOf || [])]) {
      const i = items(b);
      if (i) return i;
    }
    return undefined;
  };
  const crumbs = [];
  let node = schema;
  for (const key of segments(path)) {
    const item = /^\d+$/.test(key) ? items(node) : undefined;
    if (item) {
      crumbs.push(`${deref(item).title ?? "Item"} ${Number(key) + 1}`);
      node = item;
    } else {
      node = property(node, key);
      crumbs.push(node?.title ?? deref(node)?.title ?? key);
    }
  }
  return crumbs.length ? crumbs.join(" › ") : schema.title ?? "Entry";
}

// Why an SVG may not be embedded, or "" if it may: it must be well-formed XML without a
// DOCTYPE, entity declarations or processing instructions besides the XML declaration, with
// an svg root in the SVG namespace, and without active content or external references: no
// script or foreignObject, no on* attributes, no javascript: anywhere in an attribute, no
// animation of href or on* attributes, no @import, and every href and url() points into the
// document (#id) or is a data: PNG, JPEG, GIF or WebP. CI applies the same rules (scripts/check-logos.py).
const SVG_NS = "http://www.w3.org/2000/svg";
const LOCAL_REF = /^\s*(#|data:image\/(png|jpeg|gif|webp)[;,])/i;
export function svgProblem(text) {
  if (/<!(DOCTYPE|ENTITY)/i.test(text)) return "it has a DOCTYPE or entity declaration";
  if (/<\?(?!xml[\s?])/i.test(text)) return "it has a processing instruction (such as xml-stylesheet)";
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (doc.getElementsByTagNameNS("*", "parsererror").length) return "it is not well-formed XML";
  const root = doc.documentElement;
  if (root.localName !== "svg" || root.namespaceURI !== SVG_NS) return "its root element is not svg in the SVG namespace";
  const urls = v => [...v.matchAll(/url\(\s*['"]?([^'")]*)/gi)].map(m => m[1]);
  for (const el of [root, ...root.querySelectorAll("*")]) {
    const name = el.localName.toLowerCase();
    if (name === "script" || name === "foreignobject") return `it contains a ${el.localName} element`;
    if (name === "style" && /@import/i.test(el.textContent)) return "its style imports a file";
    if (name === "style" && urls(el.textContent).some(u => !LOCAL_REF.test(u))) return "its style refers to an external file";
    const animated = (el.getAttribute("attributeName") || "").replace(/^xlink:/i, "").toLowerCase();
    if (/^(animate|set)/.test(name) && (animated === "href" || animated.startsWith("on"))) return `it animates the ${animated} attribute`;
    for (const a of el.attributes) {
      const n = a.localName.toLowerCase();
      if (n.startsWith("on")) return `it has an event attribute (${a.localName})`;
      if (/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i.test(a.value)) return `its ${a.localName} attribute contains javascript:`;
      if (n === "href" && !LOCAL_REF.test(a.value)) return `its ${a.localName} attribute refers to an external resource`;
      if (urls(a.value).some(u => !LOCAL_REF.test(u))) return `its ${a.localName} attribute refers to an external file`;
    }
  }
  return "";
}

// An image file for an embedded logo: the format is taken from the file's content and must
// be one of formats. An SVG must pass svgProblem. A PNG or JPEG must be at least 90 × 90, at
// most 6 times as wide as high and at most 2 times as high as wide, and is scaled down to fit
// in 600 × 200; the limits keep both sides at 90 or more after scaling. CI checks the stored
// image against the same limits (scripts/check-logos.py). Returns { format, data } with data
// the file gzip-compressed and base64-encoded, plus width, height (null for SVG) and the size
// in bytes. Throws an Error with a message for the user.
const MIN_SIDE = 90, MAX_WIDTH = 600, MAX_HEIGHT = 200, MAX_WIDE = 6, MAX_TALL = 2;
const MEDIA = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
export async function embedImage(file, formats) {
  let bytes = new Uint8Array(await file.arrayBuffer());
  const head = new TextDecoder().decode(bytes.slice(0, 2048));
  const kind = bytes[0] === 0x89 && head.slice(1, 4) === "PNG" ? ["png"]
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? ["jpg", "jpeg"]
    : /<svg[\s>]/.test(head) ? ["svg"] : [];
  const format = kind.find(k => formats.includes(k));
  if (!format) throw new Error(`Not an image in an allowed format (${formats.join(", ")}).`);
  let width = null, height = null;
  if (format === "svg") {
    let problem;
    try { problem = svgProblem(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { problem = "it is not UTF-8 text"; }
    if (problem) throw new Error(`The SVG cannot be embedded: ${problem}.`);
  } else {
    const bitmap = await createImageBitmap(new Blob([bytes], { type: MEDIA[format] }))
      .catch(() => { throw new Error("The image cannot be read."); });
    ({ width, height } = bitmap);
    if (width < MIN_SIDE || height < MIN_SIDE) {
      throw new Error(`The image is ${width} × ${height} pixels; it must be at least ${MIN_SIDE} × ${MIN_SIDE}.`);
    }
    if (width > MAX_WIDE * height || height > MAX_TALL * width) {
      throw new Error(`The image is ${width} × ${height} pixels; it may be at most ${MAX_WIDE} times as wide as high and ${MAX_TALL} times as high as wide.`);
    }
    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
      const f = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
      width = Math.round(width * f); height = Math.round(height * f);
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise(r => canvas.toBlob(r, MEDIA[format], 0.9));
      bytes = new Uint8Array(await blob.arrayBuffer());
    }
    bitmap.close();
  }
  const gz = new Uint8Array(await new Response(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  let bin = "";
  for (let i = 0; i < gz.length; i += 0x8000) bin += String.fromCharCode(...gz.subarray(i, i + 0x8000));
  return { format, data: btoa(bin), width, height, size: bytes.length };
}

// An object URL that shows an embedded image (format and gzip-compressed base64 data), and its
// size in bytes. Throws if data is not that.
export async function embeddedImageURL(format, data) {
  const gz = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const blob = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).blob();
  return { url: URL.createObjectURL(new Blob([blob], { type: MEDIA[format] ?? "" })), size: blob.size };
}

// A property of the entry that is a boolean which must be true (const true) is an
// acknowledgement, such as the consent to the submission terms. Entry files need not carry it,
// but the form requires it, and asks for it again on every submission: it is not taken over
// from a loaded entry. Anything but true is left out (the form library makes a required
// boolean false), so the error is the missing property.
const isAcknowledgement = s => s?.type === "boolean" && s.const === true;

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
  const served = await (await fetch("../schema/provider.schema.json", { cache: "no-store" })).json();
  const acknowledgements = Object.keys(served.properties || {}).filter(k => isAcknowledgement(served.properties[k]));
  const schema = { ...served, required: [...new Set([...(served.required || []), ...acknowledgements])] };
  // format only picks the input type in the form; the schema's patterns validate.
  const validate = new ajv2020.default({ allErrors: true, strict: false, validateFormats: false }).compile(schema);
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
      const keys = segments(e.instancePath);
      const last = keys.pop();
      const parent = keys.reduce((o, k) => o?.[k], v);
      if (parent && typeof parent === "object" && !Array.isArray(parent)) delete parent[last];
    }
    return prune(v);
  }

  async function update(value) {
    value = { ...value };
    for (const k of acknowledgements) if (value[k] !== true) delete value[k];
    entry = dropForbidden(prune(value));
    $("json").textContent = json();
    const ok = validate(entry);
    $("errors").replaceChildren(...relevantErrors(validate.errors || []).map(e => {
      const li = document.createElement("li");
      li.textContent = `${breadcrumbs(schema, e.instancePath)}: ${e.message}`;
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
    for (const k of acknowledgements) delete value[k];
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

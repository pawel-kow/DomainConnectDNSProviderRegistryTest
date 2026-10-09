#!/usr/bin/env bash
# Checks the placement of files in the registry.
#
#   scripts/check-files.sh [-s SCHEMA] [CHANGED]
#
# Checks the git repository of the current directory. Every tracked file under
# providers/ must be a regular file (no symlink or submodule) and either
#   - an entry at providers/<a>/<b>/<providerId>.json, derived from its providerId, or
#   - a logo whose name matches the schema's logo pattern and that an entry in the
#     same folder names in `logo`.
# Every logo named by an entry must exist.
#
# SCHEMA is the schema to take the logo pattern from (default: the repository's own).
# CI passes the base branch's copy, because the files checked may come from a fork.
#
# CHANGED is an optional file with NUL-separated paths that were added, changed or deleted.
# None of them may be outside providers/.
#
# The files checked are only read as data, never executed.
set -uo pipefail
export LC_ALL=C.UTF-8

schema=
while getopts s: opt; do
  case $opt in
    s) schema=$(realpath -e -- "$OPTARG") || exit 2 ;;
    *) echo "usage: $0 [-s SCHEMA] [CHANGED]" >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))
changed=
if [[ -n ${1:-} ]]; then changed=$(realpath -e -- "$1") || exit 2; fi

cd "$(git rev-parse --show-toplevel)" || exit 2
schema=${schema:-$PWD/schema/provider.schema.json}
errors=0

# Escapes untrusted text for a workflow command, so a file name or value cannot inject one.
esc_data() { local s=${1//%/%25}; s=${s//$'\r'/%0D}; printf '%s' "${s//$'\n'/%0A}"; }
esc_prop() { local s; s=$(esc_data "$1"); s=${s//:/%3A}; printf '%s' "${s//,/%2C}"; }

fail() { # file message
  echo "::error file=$(esc_prop "$1")::$(esc_data "$1: $2")"
  errors=$((errors + 1))
}

logo_re=$(jq -er '.properties.logo.pattern' "$schema") || { fail "$schema" "properties.logo.pattern not found"; exit 1; }

dir_char() {
  case "${1,,}" in
    [abcdefghijklmnopqrstuvwxyz0123456789]) printf '%s' "${1,,}" ;;
    *) printf _ ;;
  esac
}

# Only regular files are read; symlinks could point outside the repository.
files=()
while IFS= read -r -d '' line; do
  mode=${line%% *}
  f=${line#*$'\t'}
  if [[ $mode == 100644 || $mode == 100755 ]]; then
    files+=("$f")
  else
    fail "$f" "not a regular file (git mode $mode)"
  fi
done < <(git ls-files -s -z providers)

declare -A tracked logos_named
for f in "${files[@]}"; do tracked[$f]=1; done

# Entries
for f in "${files[@]}"; do
  [[ $f == *.json ]] || continue
  id=$(jq -er 'if type == "object" and (.providerId | type) == "string" then .providerId else error end' "$f" 2>/dev/null) \
    || { fail "$f" "not valid JSON or no string providerId"; continue; }
  if [[ -z $id || $id == */* || $id == *\\* ]]; then
    fail "$f" "invalid providerId \"$id\""
    continue
  fi
  a=$(dir_char "${id:0:1}")
  if (( ${#id} > 1 )); then b=$(dir_char "${id:1:1}"); else b=_; fi
  expected="providers/$a/$b/$id.json"
  [[ $f == "$expected" ]] || fail "$f" "providerId \"$id\" belongs at $expected"

  logo=$(jq -r '.logo // empty | strings' "$f")
  [[ -n $logo ]] || continue
  if ! jq -en --arg s "$logo" --arg re "$logo_re" '$s | test($re)' >/dev/null; then
    fail "$f" "logo \"$logo\" does not match $logo_re"
    continue
  fi
  logo_path="$(dirname "$f")/$logo"
  logos_named[$logo_path]=1
  [[ -n ${tracked[$logo_path]:-} ]] || fail "$f" "logo $logo_path does not exist"
done

# Everything else under providers/ must be a logo
for f in "${files[@]}"; do
  [[ $f == *.json ]] && continue
  if [[ ! $f =~ ^providers/[^/]+/[^/]+/[^/]+$ ]]; then
    fail "$f" "not an entry or a logo at providers/<a>/<b>/"
  elif ! jq -en --arg s "$(basename "$f")" --arg re "$logo_re" '$s | test($re)' >/dev/null; then
    fail "$f" "file type not allowed; only entries (.json) and logos matching $logo_re"
  elif [[ -z ${logos_named[$f]:-} ]]; then
    fail "$f" "logo not named by any entry in its folder"
  fi
done

# Changed files outside providers/
if [[ -n $changed ]]; then
  while IFS= read -r -d '' f; do
    [[ $f == providers/* ]] || fail "$f" "not allowed: a pull request may only add, change or delete files under providers/"
  done < "$changed"
fi

if (( errors )); then
  echo "$errors error(s)"
  exit 1
fi
echo "All files are in place."

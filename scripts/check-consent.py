#!/usr/bin/env python3
"""Checks that registry entries carry the consent to the submission terms.

    scripts/check-consent.py ENTRY...

Every entry given must have `"consent": true`: whoever submits it accepted the submission
terms (TERMS.md) and dedicated it to the public domain under CC0 1.0 (LICENSE). CI passes the
entries a pull request or push adds or changes, not all entries: entries that were compiled
from public sources before the terms existed carry no consent until they are changed.

Entries that are not valid JSON are skipped; the placement check reports them. The files are
only read as data, never executed. Uses the standard library only.
"""
import json
import sys

errors = 0


def esc_data(s):
    return s.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def esc_prop(s):
    return esc_data(s).replace(":", "%3A").replace(",", "%2C")


def fail(path, message):
    global errors
    print(f"::error file={esc_prop(path)}::{esc_data(f'{path}: {message}')}")
    errors += 1


def check(path):
    try:
        with open(path, encoding="utf-8") as f:
            entry = json.load(f)
    except (OSError, ValueError):
        return
    if not isinstance(entry, dict) or entry.get("consent") is not True:
        fail(path, 'no consent to the submission terms: an added or changed entry needs "consent": true (see TERMS.md)')


def main(paths):
    for p in paths:
        check(p)
    if errors:
        print(f"{errors} error(s)")
        return 1
    print(f"Consent checked in {len(paths)} entries.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

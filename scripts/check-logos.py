#!/usr/bin/env python3
"""Checks the embedded logos of registry entries.

    scripts/check-logos.py ENTRY...

For every entry whose `logo` is an object with `format` and `data` (a logo URL is not
fetched; the schema checks the shape), `data` must be
  - strict base64 of a complete gzip stream (at most MAX_UNPACKED bytes unpacked),
  - an image whose content matches `format`: a PNG with valid chunks (IHDR first, IEND last,
    every CRC right), a JPEG from SOI to EOI with a frame header, or an SVG,
  - for PNG and JPEG: at least 90 x 90 pixels, at most 600 wide and 200 high, at most 6 times
    as wide as high and at most 2 times as high as wide (the form scales an upload to fit;
    here nothing is scaled, the stored image passes or fails),
  - for SVG: UTF-8, well-formed XML without a DOCTYPE, entity declarations or processing
    instructions other than the XML declaration, an svg root in
    the SVG namespace, and no active content or external references: no script or
    foreignObject, no on* attributes, no javascript: in an attribute, no animation of href or
    on* attributes, no @import, and every href and url() points into the document (#id) or is
    a data: PNG, JPEG, GIF or WebP.
The form applies the same rules on upload (form/registry.js: embedImage, svgProblem).

Entries that are not valid JSON are skipped; the placement check reports them. The files are
only read as data, never executed. Uses the standard library only.
"""
import base64
import binascii
import json
import re
import struct
import sys
import xml.etree.ElementTree as ET
import zlib

MIN_SIDE, MAX_WIDTH, MAX_HEIGHT, MAX_WIDE, MAX_TALL = 90, 600, 200, 6, 2
MAX_UNPACKED = 16 * 1024 * 1024
SVG_NS = "http://www.w3.org/2000/svg"
LOCAL_REF = re.compile(r"^\s*(#|data:image/(png|jpeg|gif|webp)[;,])", re.I)
URL = re.compile(r"""url\(\s*['"]?([^'")]*)""", re.I)
JAVASCRIPT = re.compile(r"j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:", re.I)

errors = 0


def esc_data(s):
    return s.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def esc_prop(s):
    return esc_data(s).replace(":", "%3A").replace(",", "%2C")


def fail(path, message):
    global errors
    print(f"::error file={esc_prop(path)}::{esc_data(f'{path}: {message}')}")
    errors += 1


def unpack(data):
    """The bytes in data (base64 of gzip), or raises ValueError."""
    try:
        packed = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("data is not valid base64")
    d = zlib.decompressobj(wbits=31)  # gzip only
    try:
        out = d.decompress(packed, MAX_UNPACKED + 1)
    except zlib.error as e:
        raise ValueError(f"data is not valid gzip ({e})")
    if len(out) > MAX_UNPACKED:
        raise ValueError(f"the unpacked image is larger than {MAX_UNPACKED} bytes")
    if not d.eof:
        raise ValueError("data is not valid gzip (truncated)")
    if d.unused_data:
        raise ValueError("data has bytes after the gzip stream")
    return out


def png_size(b):
    if b[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("format is png but the image is not a PNG")
    i, first, size = 8, True, None
    while True:
        if i + 12 > len(b):
            raise ValueError("the PNG is truncated (no IEND chunk)")
        length, kind = struct.unpack(">I4s", b[i:i + 8])
        body = b[i + 8:i + 8 + length]
        if len(body) != length or i + 12 + length > len(b):
            raise ValueError("the PNG is truncated")
        (crc,) = struct.unpack(">I", b[i + 8 + length:i + 12 + length])
        if zlib.crc32(kind + body) != crc:
            raise ValueError(f"the PNG chunk {kind!r} has a wrong CRC")
        if first:
            if kind != b"IHDR" or length != 13:
                raise ValueError("the PNG does not start with IHDR")
            size = struct.unpack(">II", body[:8])
            first = False
        i += 12 + length
        if kind == b"IEND":
            if i != len(b):
                raise ValueError("the PNG has bytes after IEND")
            return size


SOF = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def jpeg_size(b):
    if b[:3] != b"\xff\xd8\xff":
        raise ValueError("format is jpg but the image is not a JPEG")
    if b[-2:] != b"\xff\xd9":
        raise ValueError("the JPEG is truncated (no EOI marker)")
    i = 2
    while i + 4 <= len(b):
        if b[i] != 0xFF:
            raise ValueError("the JPEG has a broken marker")
        marker = b[i + 1]
        if marker == 0xFF:  # fill byte
            i += 1
            continue
        (length,) = struct.unpack(">H", b[i + 2:i + 4])
        if marker in SOF:
            if i + 9 > len(b):
                raise ValueError("the JPEG is truncated")
            height, width = struct.unpack(">HH", b[i + 5:i + 9])
            return width, height
        if marker == 0xDA:
            break
        i += 2 + length
    raise ValueError("the JPEG has no frame header")


def svg_problem(text):
    """Why the SVG may not be embedded, or "" if it may (the rules of svgProblem in the form)."""
    if re.search(r"<!(DOCTYPE|ENTITY)", text, re.I):
        return "it has a DOCTYPE or entity declaration"
    if re.search(r"<\?(?!xml[\s?])", text, re.I):
        return "it has a processing instruction (such as xml-stylesheet)"
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return "it is not well-formed XML"

    def local(name):
        return name.rsplit("}", 1)[-1]

    def bad_urls(v):
        return any(not LOCAL_REF.match(u) for u in URL.findall(v))

    if root.tag != f"{{{SVG_NS}}}svg":
        return "its root element is not svg in the SVG namespace"
    for el in root.iter():
        if not isinstance(el.tag, str):
            continue
        name = local(el.tag).lower()
        if name in ("script", "foreignobject"):
            return f"it contains a {local(el.tag)} element"
        if name == "style":
            css = "".join(el.itertext())
            if re.search(r"@import", css, re.I):
                return "its style imports a file"
            if bad_urls(css):
                return "its style refers to an external file"
        animated = re.sub(r"^xlink:", "", el.get("attributeName", ""), flags=re.I).lower()
        if name.startswith(("animate", "set")) and (animated == "href" or animated.startswith("on")):
            return f"it animates the {animated} attribute"
        for attr, value in el.attrib.items():
            n = local(attr).lower()
            if n.startswith("on"):
                return f"it has an event attribute ({local(attr)})"
            if JAVASCRIPT.search(value):
                return f"its {local(attr)} attribute contains javascript:"
            if n == "href" and not LOCAL_REF.match(value):
                return f"its {local(attr)} attribute refers to an external resource"
            if bad_urls(value):
                return f"its {local(attr)} attribute refers to an external file"
    return ""


def detect(b):
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if b[:3] == b"\xff\xd8\xff":
        return "jpg"
    if re.search(rb"<svg[\s>]", b[:2048]):
        return "svg"
    return "an unknown format"


def check(path):
    try:
        with open(path, encoding="utf-8") as f:
            entry = json.load(f)
    except (OSError, ValueError):
        return
    logo = entry.get("logo") if isinstance(entry, dict) else None
    if not isinstance(logo, dict):
        return
    fmt, data = logo.get("format"), logo.get("data")
    if not isinstance(fmt, str) or not isinstance(data, str):
        return
    try:
        image = unpack(data)
        kind = detect(image)
        if kind != fmt:
            raise ValueError(f"format is {fmt} but the image is {kind}")
        if fmt == "svg":
            try:
                text = image.decode("utf-8")
            except UnicodeDecodeError:
                raise ValueError("format is svg but the image is not UTF-8 text")
            problem = svg_problem(text)
            if problem:
                raise ValueError(f"the SVG cannot be embedded: {problem}")
            return
        if fmt == "png":
            width, height = png_size(image)
        elif fmt == "jpg":
            width, height = jpeg_size(image)
        else:
            raise ValueError(f"unknown format {fmt!r}")
        size = f"the image is {width} x {height} pixels"
        if width < MIN_SIDE or height < MIN_SIDE:
            raise ValueError(f"{size}; it must be at least {MIN_SIDE} x {MIN_SIDE}")
        if width > MAX_WIDTH or height > MAX_HEIGHT:
            raise ValueError(f"{size}; it may be at most {MAX_WIDTH} wide and {MAX_HEIGHT} high")
        if width > MAX_WIDE * height or height > MAX_TALL * width:
            raise ValueError(f"{size}; it may be at most {MAX_WIDE} times as wide as high "
                             f"and {MAX_TALL} times as high as wide")
    except ValueError as e:
        fail(path, f"logo: {e}")


def main(paths):
    for p in paths:
        check(p)
    if errors:
        print(f"{errors} error(s)")
        return 1
    print(f"Logos checked in {len(paths)} entries.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

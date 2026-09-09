import html from "@bbob/html";
import presetHTML5 from "@bbob/preset-html5";
import sanitizeHtml from "sanitize-html";

// kurobb-design.md §08: bbob over a hand-rolled parser, specifically because
// it's AST-based (handles nesting correctly, unlike regex) and tolerant of
// malformed/unclosed tags rather than throwing. body_bbcode is always the
// source of truth; this output is a regenerable cache, never authoritative.
//
// @bbob/core's own `.process()` silently returns an empty string unless a
// render function is supplied explicitly (it defaults to a no-op mock) —
// @bbob/html's `html()` wraps parse+process+render into one call and is the
// actual renderer, not @bbob/core alone. Confirmed by reading its source,
// not assumed from the README.
//
// CRITICAL: @bbob/html's renderer does zero HTML escaping of its own — a
// confirmed, verified finding, not a hypothetical. A `[script]...[/script]`
// "BBCode" tag renders as a literal, live <script> element, and known tags
// like [img] pass arbitrary attacker-supplied attributes straight through
// (onerror=... included). sanitize-html below is a mandatory allowlist pass
// on the *output*, not an optional hardening step — bbob alone is not safe
// against untrusted input.
const ALLOWED_COLOR = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|[a-zA-Z]+)$/;
const ALLOWED_FONT_SIZE = /^[\d.]+em$/;

function sanitize(unsafeHtml: string): string {
  return sanitizeHtml(unsafeHtml, {
    allowedTags: ["span", "a", "img", "blockquote", "p", "pre", "ol", "ul", "li", "br"],
    allowedAttributes: {
      span: ["style"],
      a: ["href"],
      img: ["src", "alt"],
    },
    allowedStyles: {
      span: {
        "font-weight": [/^bold$/],
        "font-style": [/^italic$/],
        "text-decoration": [/^(underline|line-through)$/],
        color: [ALLOWED_COLOR],
        "font-size": [ALLOWED_FONT_SIZE],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    disallowedTagsMode: "discard", // strip the tag, keep its text content
  });
}

export function renderBbcodeToHtml(source: string): string {
  return sanitize(html(source, [presetHTML5()]));
}

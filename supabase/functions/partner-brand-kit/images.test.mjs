import test from "node:test";
import assert from "node:assert/strict";
import { isBrandImage } from "./images.mjs";
test("image types must match their signatures", () => {
  const png = atob("iVBORw0KGgo=");
  assert.equal(isBrandImage(png, "image/png"), true);
  assert.equal(isBrandImage(png, "image/jpeg"), false);
  assert.equal(isBrandImage("%PDF-1.0", "image/png"), false);
  assert.equal(isBrandImage("hello", "image/jpeg"), false);
});
test("only static SVG documents are accepted", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
  assert.equal(isBrandImage(svg, "image/svg+xml"), true);
  for (const content of ['<html/>', svg.replace('<path', '<script/><path'), svg.replace('<path', '<image href="https://example.com/a.png"/><path'), svg.replace('<path', '<g onload="alert(1)"/><path')]) {
    assert.equal(isBrandImage(content, "image/svg+xml"), false);
  }
});

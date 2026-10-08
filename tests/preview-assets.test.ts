import test from "node:test";
import assert from "node:assert/strict";
import { previewAssetUrl, rewritePreviewCss, rewritePreviewModule } from "../src/lib/preview-assets.ts";

const base = "https://website.example/assets/site.css";
const endpoint = "https://studio.example/api/proxy";
test("preview CSS resolves fonts and imported styles through the isolated asset proxy", () => {
  const result = rewritePreviewCss('@import "./colors.css"; @font-face {src:url(../fonts/icons.woff2)} .logo{background:url(data:image/png;base64,abc)}', base, endpoint);
  assert.ok(result.includes(encodeURIComponent("https://website.example/fonts/icons.woff2")));
  assert.ok(result.includes(encodeURIComponent("https://website.example/assets/colors.css")));
  assert.ok(result.includes('url("data:image/png;base64,abc")'));
});
test("bundler preload assets and aliased window locations work without changing router state", () => {
  const result = rewritePreviewModule('const deps=["assets/v1/main.js"]; const path=t.location.pathname; state.location=next;', base, endpoint);
  assert.ok(result.includes(encodeURIComponent("https://website.example/assets/v1/main.js")));
  assert.ok(result.includes('window.__INSTAFRAME_READ_LOCATION__(t).pathname'));
  assert.ok(result.includes('state.location=next'));
  assert.equal(previewAssetUrl(`${endpoint}?asset=1&url=test`, base, endpoint), `${endpoint}?asset=1&url=test`);
});
test("preview modules resolve static, dynamic, side effect and re-export dependencies", () => {
  const result = rewritePreviewModule('import {a} from "./a.js"; export {b} from "../b.js"; import("/lazy.js"); import "./setup.js"; const label="./ordinary.js";', base, endpoint);
  for (const url of ["assets/a.js", "b.js", "lazy.js", "assets/setup.js"]) {
    assert.ok(result.includes(encodeURIComponent(`https://website.example/${url}`)));
  }
  assert.ok(result.includes('const label="./ordinary.js"'));
  assert.equal(previewAssetUrl("#icon", base, endpoint), "#icon");
});

import assert from "node:assert/strict";
import test from "node:test";
import { isNonEmpty } from "../src/index.js";

test("identifies non-empty text", () => {
  assert.equal(isNonEmpty("value"), true);
});

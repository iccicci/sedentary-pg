import { strictEqual as eq } from "assert";

import { EntryBase } from "..";

describe("coverage", () => {
  it("EntryBase", () => eq(new EntryBase() instanceof EntryBase, true));
});

import { strictEqual as eq } from "assert";

import { BaseEntry } from "..";

describe("coverage", () => {
  it("BaseEntry", () => eq(new BaseEntry() instanceof BaseEntry, true));
});

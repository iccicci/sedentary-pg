import { strictEqual as eq } from "assert";

import { Entry } from "..";

describe("coverage", () => {
  it("Entry", () => eq(new Entry() instanceof Entry, true));
});

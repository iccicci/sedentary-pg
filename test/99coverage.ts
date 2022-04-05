import { strictEqual as eq } from "assert";
import { PoolClient } from "pg";

import { EntryBase, TransactionPG } from "..";
import { helper } from "./helper";
import { transactions } from "./local";

describe("coverage", () => {
  describe("release", function() {
    helper(transactions.commit, async db => {
      const test2 = db.model("test2", { a: db.INT, b: db.VARCHAR });
      await db.connect();
      const r1 = new test2({ a: 1, b: "1" });
      await r1.save();
      const tx = await db.begin();
      const r2 = new test2({ a: 2, b: "2" }, tx);
      const l1 = await test2.load({}, tx);
      l1[0].a = 11;
      l1[0].b = "11";
      await l1[0].save();
      await r2.save();
      await tx.commit();
      await test2.load({}, ["id"]);
      await tx.commit();
      await tx.rollback();
    });
  });

  it("EntryBase", () => eq(new EntryBase() instanceof EntryBase, true));
  // eslint-disable-next-line no-console
  it("TransactionPG", () => eq(new TransactionPG(console.log, null as unknown as PoolClient) instanceof TransactionPG, true));
});

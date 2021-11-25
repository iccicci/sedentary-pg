import { strictEqual as eq } from "assert";

import { SedentaryPG } from "..";
import { errorHelper } from "./helper";
import { connection } from "./local";

class PGDB extends SedentaryPG {
  getDB() {
    return this.db;
  }
}

function pgdb(): [SedentaryPG, { [key: string]: unknown }] {
  const db = new PGDB(connection, { log: () => {} });

  return [db, db.getDB() as unknown as { [key: string]: unknown }];
}

describe("errors", () => {
  let err: Error;

  describe("SedentaryPG.constructor(connection)", () => {
    before(async () => {
      try {
        new SedentaryPG("" as never);
      } catch(e) {
        err = e;
      }
    });

    it("message", () => eq(err.message, "SedentaryPG.constructor: 'connection' argument: Wrong type, expected 'Object'"));
  });

  describe("PGDB.sync", () => {
    before(async () => {
      const [db, ddb] = pgdb();

      ddb.syncTable = async function(): Promise<void> {
        throw new Error("test");
      };

      try {
        db.model("test1", {});
        await db.connect();
      } catch(e) {
        db.end();
        err = e;
      }
    });

    it("error", () => eq(err.message, "test"));
  });

  describe("PGDB.syncTable", () => {
    before(async () => {
      const [db, ddb] = pgdb();

      ddb.connect = async function(): Promise<void> {
        this.client = {
          query: async (): Promise<void> => {
            throw new Error("test");
          },
          release: () => {}
        };
      };

      try {
        db.model("test1", {});
        await db.connect();
      } catch(e) {
        err = e;
      }
    });

    it("error", () => eq(err.message, "test"));
  });

  describe("Sedentary.FKEY() - not unique target", () =>
    errorHelper(db => {
      class test1 extends db.model("test1", { a: db.INT }) {}
      db.model("test", { a: db.FKEY(test1.a) });
    })("Sedentary.FKEY: 'test1' table: 'a' attribute: is not unique: can't be used as FKEY target"));
});

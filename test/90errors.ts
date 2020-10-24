import { strictEqual as eq } from "assert";

import { SedentaryPG } from "..";
import { connection } from "./local";

class PGDB extends SedentaryPG {
  getDB() {
    return this.db;
  }
}

function pgdb(): [SedentaryPG, { [key: string]: unknown }] {
  const db = new PGDB(connection, { log: () => {} });

  return [db, (db.getDB() as unknown) as { [key: string]: unknown }];
}

describe("errors", () => {
  let err: Error;

  describe("sync", () => {
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

  describe("syncTable", () => {
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
});

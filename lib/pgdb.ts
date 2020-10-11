import { Pool, PoolClient, PoolConfig } from "pg";
import { DB, Table } from "sedentary/lib/db";

export class PGDB extends DB {
  private client: PoolClient;
  private pool: Pool;

  constructor(connection: PoolConfig, log: (message: string) => void) {
    super(log);

    this.pool = new Pool(connection);
  }

  async connect(): Promise<void> {
    this.client = await this.pool.connect();
  }

  async end(): Promise<void> {
    await this.pool.end();
  }

  async sync(): Promise<void> {
    let err: Error;

    try {
      await super.sync();
    } catch(e) {
      err = e;
    }

    this.client.release();

    if(err) throw err;
  }

  async syncTable(table: Table): Promise<void> {
    if(table.autoIncrement) {
      await (async () => {
        try {
          await this.client.query(`SELECT currval('${table.tableName}_id_seq')`);
        } catch(e) {
          if(e.code === "55000") return;
          if(e.code === "42P01") {
            const statement = `CREATE SEQUENCE ${table.tableName}_id_seq`;

            this.log(statement);
            await this.client.query(statement);

            return;
          }

          throw e;
        }
      })();
    }

    const res = await this.client.query("SELECT oid FROM pg_class WHERE relname = $1", [table.tableName]);

    if(! res.rowCount) {
      const parent = table.parent ? ` INHERITS (${table.parent.tableName})` : "";
      const statement = `CREATE TABLE ${table.tableName} ()${parent}`;

      this.log(statement);
      await this.client.query(statement);
    }
  }
}

// farray[0].defaultValue = "nextval('" + tname + "_id_seq'::regclass)";

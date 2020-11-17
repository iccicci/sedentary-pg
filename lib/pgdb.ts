import { Pool, PoolClient, PoolConfig } from "pg";
import { DB, Field, Table, native } from "sedentary/lib/db";

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

  async dropConstraints(table: Table): Promise<void> {}

  async dropFields(table: Table): Promise<void> {
    const res = await this.client.query("SELECT attname FROM pg_attribute WHERE attrelid = $1 AND attnum > 0 AND attisdropped = false AND attinhcount = 0", [table.oid]);

    for(const i in res.rows) {
      if(table.fields.filter(f => f.fieldName === res.rows[i].attname).length === 0) {
        const statement = `ALTER TABLE ${table.tableName} DROP COLUMN ${res.rows[i].attname}`;

        this.log(statement);
        await this.client.query(statement);
      }
    }
  }

  async dropIndexes(table: Table): Promise<void> {}

  async end(): Promise<void> {
    await this.pool.end();
  }

  fieldType(field: Field<native, unknown>): string {
    const { size, type } = field;

    if(type === "INT") {
      if(size === 2) return "SMALLINT";
      if(size === 4) return "INTEGER";
      return "BIGINT";
    }

    throw new Error(`Unknown type: '${type}', '${size}'`);
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

  async syncField(table: Table, field: Field<native, unknown>): Promise<void> {
    const res = await this.client.query(
      "SELECT * FROM pg_type, pg_attribute LEFT JOIN pg_attrdef ON adrelid = attrelid AND adnum = attnum WHERE attrelid = $1 AND attnum > 0 AND atttypid = pg_type.oid AND attislocal = 't' AND attname = $2",
      [table.oid, field.fieldName]
    );

    if(! res.rowCount) {
      const statement = `ALTER TABLE ${table.tableName} ADD COLUMN ${field.fieldName} ${this.fieldType(field)}`;

      this.log(statement);
      await this.client.query(statement);

      return;
    }
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

    let create: boolean;
    const resTable = await this.client.query("SELECT oid FROM pg_class WHERE relname = $1", [table.tableName]);

    if(resTable.rowCount) {
      table.oid = resTable.rows[0].oid;

      let drop: boolean;
      const resParent = await this.client.query("SELECT inhparent FROM pg_inherits WHERE inhrelid = $1", [table.oid]);

      if(resParent.rowCount) {
        if(! table.parent) drop = true;
        else if(this.tables[table.parent.tableName].oid === resParent.rows[0].inhparent) return;

        drop = true;
      } else if(table.parent) drop = true;

      if(drop) {
        const statement = `DROP TABLE ${table.tableName} CASCADE`;

        create = true;
        this.log(statement);
        await this.client.query(statement);
      }
    } else create = true;

    if(create) {
      const parent = table.parent ? ` INHERITS (${table.parent.tableName})` : "";
      const statement = `CREATE TABLE ${table.tableName} ()${parent}`;

      this.log(statement);
      await this.client.query(statement);

      const resTable = await this.client.query("SELECT oid FROM pg_class WHERE relname = $1", [table.tableName]);

      table.oid = resTable.rows[0].oid;
    }
  }
}

// farray[0].defaultValue = "nextval('" + tname + "_id_seq'::regclass)";

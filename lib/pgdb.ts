import { Pool, PoolClient, PoolConfig } from "pg";
import format from "pg-format";
import { DB, Field, Table } from "sedentary/lib/db";

const needDrop = [
  ["DATETIME", "int2"],
  ["DATETIME", "int4"],
  ["DATETIME", "int8"],
  ["INT", "timestamptz"],
  ["INT8", "timestamptz"]
];
const needUsing = [
  ["DATETIME", "varchar"],
  ["INT", "varchar"],
  ["INT8", "varchar"]
];
const types = { int2: "SMALLINT", int4: "INTEGER", int8: "BIGINT", varchar: "VARCHAR" };

export class PGDB extends DB {
  private client: PoolClient;
  private pool: Pool;
  private version: number;

  constructor(connection: PoolConfig, log: (message: string) => void) {
    super(log);

    this.pool = new Pool(connection);
  }

  async connect(): Promise<void> {
    this.client = await this.pool.connect();

    const res = await this.client.query("SELECT version()");

    this.version = parseInt(res.rows[0].version.split(" ")[1].split(".")[0], 10);
  }

  async dropConstraints(table: Table): Promise<void> {
    let place = 1;
    const query = "SELECT conname FROM pg_attribute, pg_constraint WHERE attrelid = $1 AND conrelid = $1 AND attnum = conkey[1]";
    const values: (number | string)[] = [table.oid];
    const wheres = [];

    for(const i in table.constraints) {
      wheres.push(` AND (contype <> $${++place} or attname <> $${++place})`);
      values.push(table.constraints[i].type);
      values.push(table.constraints[i].field);
    }

    const res = await this.client.query(query + wheres.join(""), values);

    if(! res.rowCount) return;
    /*
      return pgo.client.query("SELECT conindid FROM pg_attribute, pg_constraint WHERE attrelid = $1 AND conrelid = $1 AND attnum = conkey[1]", [table.oid], function(err, res) {
        const arr = [];

        if(pgo.error(err, 1011, table.name)) return;

        for(const i in res.rows) arr.push(res.rows[i].conindid);

        dropIndex(pgo, arr);
      });
    */

    for(const i in res.rows) {
      const statement = `ALTER TABLE ${table.tableName} DROP CONSTRAINT ${res.rows[i].conname}`;

      this.log(statement);
      await this.client.query(statement);
    }
  }

  async dropField(tableName: string, fieldName: string): Promise<void> {
    const statement = `ALTER TABLE ${tableName} DROP COLUMN ${fieldName}`;

    this.log(statement);
    await this.client.query(statement);
  }

  async dropFields(table: Table): Promise<void> {
    const res = await this.client.query("SELECT attname FROM pg_attribute WHERE attrelid = $1 AND attnum > 0 AND attisdropped = false AND attinhcount = 0", [table.oid]);

    for(const i in res.rows) if(table.fields.filter(f => f.fieldName === res.rows[i].attname).length === 0) await this.dropField(table.tableName, res.rows[i].attname);
  }

  async dropIndexes(table: Table): Promise<void> {}

  async end(): Promise<void> {
    await this.pool.end();
  }

  fieldType(field: Field<unknown, unknown>): string[] {
    const { size, type } = field;
    let ret;

    switch(type) {
    case "DATETIME":
      return ["DATETIME", "TIMESTAMP (3) WITH TIME ZONE"];
    case "INT":
      ret = size === 2 ? "SMALLINT" : "INTEGER";

      return [ret, ret];
    case "INT8":
      return ["BIGINT", "BIGINT"];
    case "VARCHAR":
      return ["VARCHAR", "VARCHAR" + (size ? `(${size})` : "")];
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

  async syncConstraints(table: Table): Promise<void> {
    for(const i in table.constraints) {
      const constraint = table.constraints[i];

      const res = await this.client.query("SELECT attname FROM pg_attribute, pg_constraint WHERE attrelid = $1 AND conrelid = $1 AND attnum = conkey[1] AND attname = $2", [
        table.oid,
        constraint.field
      ]);

      if(! res.rowCount) {
        const statement = `ALTER TABLE ${table.tableName} ADD CONSTRAINT ${constraint.name} ${constraint.type === "u" ? `UNIQUE(${constraint.field})` : ``}`;

        this.log(statement);
        await this.client.query(statement);
      }
    }
  }

  async syncFields(table: Table): Promise<void> {
    const { fields, oid, tableName } = table;

    for(const i in fields) {
      const field = fields[i];
      const { fieldName, size } = field;
      const defaultValue = field.defaultValue === undefined ? undefined : format("%L", field.defaultValue);
      const [base, type] = this.fieldType(field);

      const res = await this.client.query(
        `SELECT *${
          this.version >= 12 ? ", pg_get_expr(pg_attrdef.adbin, pg_attrdef.adrelid) AS adsrc" : ""
        } FROM pg_type, pg_attribute LEFT JOIN pg_attrdef ON adrelid = attrelid AND adnum = attnum WHERE attrelid = $1 AND attnum > 0 AND atttypid = pg_type.oid AND attislocal = 't' AND attname = $2`,
        [oid, fieldName]
      );

      const addField = async () => {
        const statement = `ALTER TABLE ${tableName} ADD COLUMN ${fieldName} ${type}`;

        this.log(statement);
        await this.client.query(statement);
      };

      const dropDefault = async () => {
        const statement = `ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} DROP DEFAULT`;

        this.log(statement);
        await this.client.query(statement);
      };

      const setDefault = async () => {
        if(defaultValue === undefined) return;

        const statement = `ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} SET DEFAULT ${defaultValue}`;

        this.log(statement);
        await this.client.query(statement);
      };

      if(! res.rowCount) {
        await addField();
        await setDefault();
      } else {
        const { adsrc, typname, atttypmod } = res.rows[0];

        if(types[typname] !== base || (base === "VARCHAR" && (size ? size + 4 !== atttypmod : atttypmod !== -1))) {
          if(needDrop.filter(([type, name]) => field.type === type && typname === name).length) {
            await this.dropField(tableName, fieldName);
            await addField();
            await setDefault();
          } else {
            if(adsrc) dropDefault();

            const using = needUsing.filter(([type, name]) => field.type === type && typname === name).length ? " USING " + fieldName + "::" + type : "";
            const statement = `ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} TYPE ${type}${using}`;

            this.log(statement);
            await this.client.query(statement);
            await setDefault();
          }
        } else if(defaultValue === undefined) {
          if(adsrc) dropDefault();
        } else if(! adsrc || adsrc.split("::")[0] !== defaultValue) await setDefault();
      }
    }
  }

  async syncSequence(table: Table): Promise<void> {
    if(! table.autoIncrementOwn) return;

    const statement = `ALTER SEQUENCE ${table.tableName}_id_seq OWNED BY ${table.tableName}.id`;

    this.log(statement);
    await this.client.query(statement);
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
            table.autoIncrementOwn = true;

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

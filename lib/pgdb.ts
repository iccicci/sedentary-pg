import { Pool, PoolClient, PoolConfig } from "pg";
import format from "pg-format";
import { Attribute, DB, Index, Natural, ForeignKeyActions, Table } from "sedentary/lib/db";
import { adsrc } from "./adsrc";

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

const actions: { [k in ForeignKeyActions]: string } = { cascade: "c", "no action": "a", restrict: "r", "set default": "d", "set null": "n" };

export class PGDB extends DB {
  private client: PoolClient;
  private indexes: string[];
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

  async dropConstraints(table: Table): Promise<number[]> {
    const indexes: number[] = [];
    const res = await this.client.query("SELECT confdeltype, confupdtype, conindid, conname, contype FROM pg_constraint WHERE conrelid = $1 ORDER BY conname", [table.oid]);

    for(const row of res.rows) {
      const arr = table.constraints.filter(_ => _.constraintName === row.conname && _.type === row.contype);
      let drop = false;

      if(arr.length === 0) drop = true;
      else if(row.contype === "u") indexes.push(row.conindid);
      else {
        const { options } = arr[0].attribute.foreignKey;

        if(actions[options.onDelete] !== row.confdeltype || actions[options.onUpdate] !== row.confupdtype) drop = true;
      }

      if(drop) {
        const statement = `ALTER TABLE ${table.tableName} DROP CONSTRAINT ${row.conname} CASCADE`;

        this.syncLog(statement);
        if(this.sync) await this.client.query(statement);
      }
    }

    return indexes;
  }

  async dropField(tableName: string, fieldName: string): Promise<void> {
    const statement = `ALTER TABLE ${tableName} DROP COLUMN ${fieldName}`;

    this.syncLog(statement);
    if(this.sync) await this.client.query(statement);
  }

  async dropFields(table: Table): Promise<void> {
    const res = await this.client.query("SELECT attname FROM pg_attribute WHERE attrelid = $1 AND attnum > 0 AND attisdropped = false AND attinhcount = 0", [table.oid]);

    for(const i in res.rows) if(! table.findField(res.rows[i].attname)) await this.dropField(table.tableName, res.rows[i].attname);
  }

  async dropIndexes(table: Table, constraintIndexes: number[]): Promise<void> {
    const { indexes, oid } = table;
    const iobject: { [key: string]: Index } = {};
    const res = await this.client.query(
      "SELECT amname, attname, indexrelid, indisunique, relname FROM pg_class, pg_index, pg_attribute, pg_am WHERE indrelid = $1 AND indexrelid = pg_class.oid AND attrelid = pg_class.oid AND relam = pg_am.oid ORDER BY attnum",
      [oid]
    );

    for(const row of res.rows) {
      const { amname, attname, indexrelid, indisunique, relname } = row;

      if(! constraintIndexes.includes(indexrelid)) {
        if(iobject[relname]) iobject[relname].fields.push(attname);
        else iobject[relname] = { fields: [attname], indexName: relname, type: amname, unique: indisunique };
      }
    }

    this.indexes = [];
    for(const index of indexes) {
      const { indexName } = index;

      if(iobject[indexName] && this.indexesEq(index, iobject[indexName])) {
        this.indexes.push(indexName);
        delete iobject[indexName];
      }
    }

    for(const index of Object.keys(iobject).sort()) {
      const statement = `DROP INDEX ${index}`;

      this.syncLog(statement);
      if(this.sync) await this.client.query(statement);
    }
  }

  async end(): Promise<void> {
    await this.pool.end();
  }

  fieldType(attribute: Attribute<Natural, unknown>): string[] {
    const { size, type } = attribute;
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

  async syncDataBase(): Promise<void> {
    let err: Error;

    try {
      await super.syncDataBase();
    } catch(e) {
      err = e;
    }

    this.client.release();

    if(err) throw err;
  }

  async syncConstraints(table: Table): Promise<void> {
    for(const constraint of table.constraints) {
      const { attribute, constraintName, type } = constraint;
      const res = await this.client.query("SELECT attname FROM pg_attribute, pg_constraint WHERE attrelid = $1 AND conrelid = $1 AND attnum = conkey[1] AND attname = $2", [
        table.oid,
        attribute.fieldName
      ]);

      if(! res.rowCount) {
        let query: string;

        if(type === "f") {
          const { fieldName, options, tableName } = attribute.foreignKey;
          const onDelete = options.onDelete !== "no action" ? ` ON DELETE ${options.onDelete.toUpperCase()}` : "";
          const onUpdate = options.onUpdate !== "no action" ? ` ON UPDATE ${options.onUpdate.toUpperCase()}` : "";

          query = `FOREIGN KEY (${attribute.fieldName}) REFERENCES ${tableName}(${fieldName})${onDelete}${onUpdate}`;
        } else query = `UNIQUE(${attribute.fieldName})`;

        const statement = `ALTER TABLE ${table.tableName} ADD CONSTRAINT ${constraintName} ${query}`;

        this.syncLog(statement);
        if(this.sync) await this.client.query(statement);
      }
    }
  }

  async syncFields(table: Table): Promise<void> {
    const { attributes, oid, tableName } = table;

    for(const attribute of attributes) {
      const { fieldName, notNull, size } = attribute;
      const defaultValue = attribute.defaultValue === undefined ? undefined : format("%L", attribute.defaultValue);
      const [base, type] = this.fieldType(attribute);
      const where = "attrelid = $1 AND attnum > 0 AND atttypid = pg_type.oid AND attislocal = 't' AND attname = $2";

      const res = await this.client.query(
        `SELECT attnotnull, atttypmod, typname, ${adsrc(this.version)} FROM pg_type, pg_attribute LEFT JOIN pg_attrdef ON adrelid = attrelid AND adnum = attnum WHERE ${where}`,
        [oid, fieldName]
      );

      const addField = async () => {
        const statement = `ALTER TABLE ${tableName} ADD COLUMN ${fieldName} ${type}`;

        this.syncLog(statement);
        if(this.sync) await this.client.query(statement);
      };

      const dropDefault = async () => {
        const statement = `ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} DROP DEFAULT`;

        this.syncLog(statement);
        if(this.sync) await this.client.query(statement);
      };

      const setNotNull = async (isNull: boolean) => {
        if(isNull === notNull) return;

        const statement = `ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} ${notNull ? "SET" : "DROP"} NOT NULL`;

        this.syncLog(statement);
        if(this.sync) await this.client.query(statement);
      };

      const setDefault = async (isNull: boolean) => {
        if(defaultValue !== undefined) {
          let statement = `ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} SET DEFAULT ${defaultValue}`;

          this.syncLog(statement);
          if(this.sync) await this.client.query(statement);

          if(isNull) {
            statement = `UPDATE ${tableName} SET ${fieldName} = ${defaultValue} WHERE ${fieldName} IS NULL`;

            this.syncLog(statement);
            if(this.sync) this.client.query(statement);
          }
        }

        await setNotNull(isNull);
      };

      if(! res.rowCount) {
        await addField();
        await setDefault(false);
      } else {
        const { adsrc, attnotnull, atttypmod, typname } = res.rows[0];

        if(types[typname] !== base || (base === "VARCHAR" && (size ? size + 4 !== atttypmod : atttypmod !== -1))) {
          if(needDrop.filter(([type, name]) => attribute.type === type && typname === name).length) {
            await this.dropField(tableName, fieldName);
            await addField();
            await setDefault(false);
          } else {
            if(adsrc) dropDefault();

            const using = needUsing.filter(([type, name]) => attribute.type === type && typname === name).length ? " USING " + fieldName + "::" + type : "";
            const statement = `ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} TYPE ${type}${using}`;

            this.syncLog(statement);
            if(this.sync) await this.client.query(statement);
            await setDefault(attnotnull);
          }
        } else if(defaultValue === undefined) {
          if(adsrc) dropDefault();
          await setNotNull(attnotnull);
        } else if(! adsrc || adsrc.split("::")[0] !== defaultValue) await setDefault(attnotnull);
      }
    }
  }

  async syncIndexes(table: Table): Promise<void> {
    const { indexes, tableName } = table;

    for(const index of indexes) {
      const { fields, indexName, type, unique } = index;

      if(! this.indexes.includes(indexName)) {
        const statement = `CREATE${unique ? " UNIQUE" : ""} INDEX ${indexName} ON ${tableName} USING ${type} (${fields.join(", ")})`;

        this.syncLog(statement);
        if(this.sync) await this.client.query(statement);
      }
    }
  }

  async syncSequence(table: Table): Promise<void> {
    if(! table.autoIncrementOwn) return;

    const statement = `ALTER SEQUENCE ${table.tableName}_id_seq OWNED BY ${table.tableName}.id`;

    this.syncLog(statement);
    if(this.sync) await this.client.query(statement);
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

            this.syncLog(statement);
            if(this.sync) await this.client.query(statement);
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
        else if(this.findTable(table.parent.tableName).oid === resParent.rows[0].inhparent) return;

        drop = true;
      } else if(table.parent) drop = true;

      if(drop) {
        const statement = `DROP TABLE ${table.tableName} CASCADE`;

        create = true;
        this.syncLog(statement);
        if(this.sync) await this.client.query(statement);
      }
    } else create = true;

    if(create) {
      const parent = table.parent ? ` INHERITS (${table.parent.tableName})` : "";
      const statement = `CREATE TABLE ${table.tableName} ()${parent}`;

      this.syncLog(statement);
      if(this.sync) await this.client.query(statement);

      const resTable = await this.client.query("SELECT oid FROM pg_class WHERE relname = $1", [table.tableName]);

      table.oid = resTable.rows[0]?.oid;
    }
  }
}

// farray[0].defaultValue = "nextval('" + tname + "_id_seq'::regclass)";

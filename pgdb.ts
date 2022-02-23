import { DatabaseError, Pool, PoolClient, PoolConfig } from "pg";
import format from "pg-format";
import { Attribute, DB, EntryBase, ForeignKeyActions, Index, Natural, Table, Transaction } from "sedentary/db";
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
const types = { int2: "SMALLINT", int4: "INTEGER", int8: "BIGINT", timestamptz: "DATETIME", varchar: "VARCHAR" };

const actions: { [k in ForeignKeyActions]: string } = { cascade: "c", "no action": "a", restrict: "r", "set default": "d", "set null": "n" };

export class PGDB extends DB<TransactionPG> {
  private client: PoolClient;
  private indexes: string[];
  private oidLoad: Record<number, (ids: Natural[]) => Promise<EntryBase[]>> = {};
  private pool: Pool;
  private version: number;

  constructor(connection: PoolConfig, log: (message: string) => void) {
    super(log);

    this.client = {} as PoolClient;
    this.indexes = [];
    this.pool = new Pool(connection);
    this.version = 0;
  }

  async connect(): Promise<void> {
    this.client = await this.pool.connect();

    const res = await this.client.query("SELECT version()");

    this.version = parseInt(res.rows[0].version.split(" ")[1].split(".")[0], 10);
  }

  async end(): Promise<void> {
    if(this.client.release) this.client.release();
    await this.pool.end();
  }

  defaultNeq(src: string, value: Natural): boolean {
    if(src === value) return false;

    return src.split("::")[0] !== value;
  }

  async begin() {
    const ret = new TransactionPG(await this.pool.connect());

    await ret.client.query("BEGIN");

    return ret;
  }

  escape(value: Natural): string {
    if(value === null || value === undefined) throw new Error("SedentaryPG: Can't escape null nor undefined values; use the 'IS NULL' operator instead");

    const type = typeof value;

    if(type === "number" || type === "boolean") return value.toString();
    if(type === "string") return format("%L", value);
    if(value instanceof Date) return format("%L", value).replace(/\.\d\d\d\+/, "+");

    return format("%L", JSON.stringify(value));
  }

  fill(attributes: Record<string, string>, row: Record<string, Natural>, entry: Record<string, Natural>) {
    const loaded: Record<string, Natural> = {};

    for(const attribute in attributes) entry[attribute] = loaded[attribute] = row[attributes[attribute]];
    Object.defineProperty(entry, "loaded", { configurable: true, value: loaded });
  }

  load(
    tableName: string,
    attributes: Record<string, string>,
    pk: Attribute<Natural, unknown>,
    model: new (from: "load") => EntryBase,
    table: Table
  ): (where: string, order?: string[], tx?: Transaction) => Promise<EntryBase[]> {
    const pkFldName = pk.fieldName;

    return async (where: string, order?: string[], tx?: Transaction) => {
      const { oid } = table;
      const ret: EntryBase[] = [];
      const client = tx ? (tx as TransactionPG).client : await this.pool.connect();
      const oidPK: Record<number, [number, Natural][]> = {};

      try {
        const query = `SELECT *, tableoid FROM ${tableName}${where ? ` WHERE ${where}` : ""}${
          order && order.length ? ` ORDER BY ${order.map(_ => (_.startsWith("-") ? `${_.substring(1)} DESC` : _)).join(",")}` : ""
        }`;

        this.log(query);
        const res = await client.query(query);

        for(const row of res.rows) {
          if(row.tableoid === oid) {
            const entry = new model("load") as EntryBase & Record<string, Natural>;

            this.fill(attributes, row, entry);

            ret.push(entry);
            entry.postLoad();
          } else {
            if(! oidPK[row.tableoid]) oidPK[row.tableoid] = [];
            oidPK[row.tableoid].push([ret.length, row[pkFldName]]);
            ret.push(null as unknown as EntryBase);
          }
        }

        for(const oid in oidPK) {
          const res = await this.oidLoad[oid](oidPK[oid].map(_ => _[1]));

          for(const entry of res) for(const [id] of oidPK[oid]) ret[id] = entry;
        }
      } finally {
        if(! tx) client.release();
      }

      return ret;
    };
  }

  save(
    tableName: string,
    attributes: Record<string, string>,
    pk: Attribute<Natural, unknown>
  ): (this: Record<string, Natural> & { loaded?: Record<string, unknown>; tx?: TransactionPG }) => Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const pkAttrnName = pk.attributeName;
    const pkFldName = pk.fieldName;

    return async function() {
      let changed = false;
      const client = this.tx ? this.tx.client : await self.pool.connect();

      try {
        const { loaded } = this;

        if(loaded) {
          const actions: string[] = [];

          for(const attribute in attributes) {
            const value = this[attribute];

            if(value !== loaded[attribute]) actions.push(`${attributes[attribute]} = ${self.escape(value)}`);
          }

          if(actions.length) {
            const query = `UPDATE ${tableName} SET ${actions.join(", ")} WHERE ${pkFldName} = ${self.escape(this[pkAttrnName])}`;

            self.log(query);
            self.fill(attributes, (await client.query(query + " RETURNING *")).rows[0], this);
            changed = true;
          }
        } else {
          const fields: string[] = [];
          const values: string[] = [];

          for(const attribute in attributes) {
            const value = this[attribute];

            if(value !== null && value !== undefined) {
              fields.push(attributes[attribute]);
              values.push(self.escape(value));
            }
          }

          const query = fields.length ? `INSERT INTO ${tableName} (${fields.join(", ")}) VALUES (${values.join(", ")})` : `INSERT INTO ${tableName} DEFAULT VALUES`;

          self.log(query);
          self.fill(attributes, (await client.query(query + " RETURNING *")).rows[0], this);

          changed = true;
        }
      } finally {
        if(! this.tx) client.release();
      }

      return changed;
    };
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
        const { options } = arr[0].attribute.foreignKey as { attributeName: string; fieldName: string; options: { onDelete: ForeignKeyActions; onUpdate: ForeignKeyActions }; tableName: string };

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
          const { fieldName, options, tableName } = attribute.foreignKey as {
            attributeName: string;
            fieldName: string;
            options: { onDelete: ForeignKeyActions; onUpdate: ForeignKeyActions };
            tableName: string;
          };
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

  async syncDataBase(): Promise<void> {
    await super.syncDataBase();

    for(const table of this.tables) this.oidLoad[table.oid || 0] = (ids: Natural[]) => table.model.load({ [table.pk.attributeName]: ["IN", ids] });
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

  async syncFields(table: Table): Promise<void> {
    const { attributes, autoIncrement, oid, tableName } = table;

    for(const attribute of attributes) {
      const { fieldName, notNull, size } = attribute;
      const defaultValue = attribute.defaultValue === undefined ? (autoIncrement && fieldName === "id" ? `nextval('${tableName}_id_seq'::regclass)` : undefined) : this.escape(attribute.defaultValue);
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

      const setNotNull = async (isNotNull: boolean) => {
        if(isNotNull === notNull) return;

        const statement = `ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} ${notNull ? "SET" : "DROP"} NOT NULL`;

        this.syncLog(statement);
        if(this.sync) await this.client.query(statement);
      };

      const setDefault = async (isNotNull: boolean, create: boolean) => {
        if(defaultValue !== undefined) {
          let statement = `ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} SET DEFAULT ${defaultValue}`;

          this.syncLog(statement);
          if(this.sync) await this.client.query(statement);

          if(! isNotNull && ! create) {
            statement = `UPDATE ${tableName} SET ${fieldName} = ${defaultValue} WHERE ${fieldName} IS NULL`;

            this.syncLog(statement);
            if(this.sync) this.client.query(statement);
          }
        }

        await setNotNull(isNotNull);
      };

      if(! res.rowCount) {
        await addField();
        await setDefault(false, true);
      } else {
        const { adsrc, attnotnull, atttypmod, typname } = res.rows[0];

        if(types[typname as keyof typeof types] !== base || (base === "VARCHAR" && (size ? size + 4 !== atttypmod : atttypmod !== -1))) {
          if(needDrop.filter(([type, name]) => attribute.type === type && typname === name).length) {
            await this.dropField(tableName, fieldName);
            await addField();
            await setDefault(false, true);
          } else {
            if(adsrc) dropDefault();

            const using = needUsing.filter(([type, name]) => attribute.type === type && typname === name).length ? " USING " + fieldName + "::" + type : "";
            const statement = `ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} TYPE ${type}${using}`;

            this.syncLog(statement);
            if(this.sync) await this.client.query(statement);
            await setDefault(attnotnull, false);
          }
        } else if(defaultValue === undefined) {
          if(adsrc) dropDefault();
          await setNotNull(attnotnull);
        } else if(! adsrc || this.defaultNeq(adsrc, defaultValue)) await setDefault(attnotnull, false);
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
          if(e instanceof DatabaseError && e.code === "55000") return;
          if(e instanceof DatabaseError && e.code === "42P01") {
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

    let create = false;
    const resTable = await this.client.query("SELECT oid FROM pg_class WHERE relname = $1", [table.tableName]);

    if(resTable.rowCount) {
      table.oid = resTable.rows[0].oid;

      let drop = false;
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

export class TransactionPG extends Transaction {
  client: PoolClient;
  released = false;

  constructor(client: PoolClient) {
    super();
    this.client = client;
  }

  private release() {
    this.released = true;
    this.client.release();
  }

  async commit() {
    if(! this.released) {
      await this.client.query("COMMIT");
      this.release();
      super.commit();
    }
  }

  async rollback() {
    try {
      if(! this.released) {
        super.rollback();
        await this.client.query("ROLLBACK");
      }
    } finally {
      if(! this.released) this.release();
    }
  }
}
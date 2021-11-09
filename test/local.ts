import { Pool } from "pg";

if(! process.env.SPG) throw "Missing SPG!";

const v10 = process.version.startsWith("v10");

export const connection = JSON.parse(process.env.SPG);

export const wrongConnection = { host: "none.nodomain.none" };
export const wrongConnectionError = `getaddrinfo ENOTFOUND none.nodomain.none${v10 ? " none.nodomain.none:5432" : ""}`;

export async function clean(): Promise<void> {
  const pool = new Pool(connection);
  const client = await pool.connect();

  const drop = async (what: string): Promise<void> => {
    try {
      await client.query(`DROP ${what} CASCADE`);
    } catch(e) {
      if(e.code !== "42P01") throw e;
    }
  };

  await drop("TABLE test1s");
  await drop("TABLE test2s");
  await drop("TABLE test3s");
  await drop("SEQUENCE test1s_id_seq");
  await drop("SEQUENCE test2s_id_seq");
  await drop("SEQUENCE test3s_id_seq");

  client.release();
  await pool.end();
}

export const expected = {
  types_datetime: [
    "CREATE SEQUENCE test1s_id_seq",
    "CREATE TABLE test1s ()",
    "ALTER TABLE test1s ADD COLUMN id INTEGER",
    "ALTER TABLE test1s ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test1s ADD COLUMN a TIMESTAMP (3) WITH TIME ZONE",
    "ALTER TABLE test1s ADD COLUMN b TIMESTAMP (3) WITH TIME ZONE",
    "ALTER TABLE test1s ADD COLUMN c VARCHAR",
    "ALTER TABLE test1s ADD COLUMN d TIMESTAMP (3) WITH TIME ZONE",
    "ALTER TABLE test1s ADD COLUMN e INTEGER",
    "ALTER SEQUENCE test1s_id_seq OWNED BY test1s.id",
    "ALTER TABLE test1s ADD CONSTRAINT test1s_id_unique UNIQUE(id)"
  ],
  types_datetime_changes: [
    "ALTER TABLE test1s ALTER COLUMN a TYPE TIMESTAMP (3) WITH TIME ZONE",
    "ALTER TABLE test1s ALTER COLUMN b TYPE VARCHAR",
    "ALTER TABLE test1s ALTER COLUMN c TYPE TIMESTAMP (3) WITH TIME ZONE USING c::TIMESTAMP (3) WITH TIME ZONE",
    "ALTER TABLE test1s DROP COLUMN d",
    "ALTER TABLE test1s ADD COLUMN d BIGINT",
    "ALTER TABLE test1s DROP COLUMN e",
    "ALTER TABLE test1s ADD COLUMN e TIMESTAMP (3) WITH TIME ZONE"
  ],
  types_int: [
    "CREATE SEQUENCE test1s_id_seq",
    "CREATE TABLE test1s ()",
    "ALTER TABLE test1s ADD COLUMN id INTEGER",
    "ALTER TABLE test1s ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test1s ADD COLUMN a VARCHAR(23)",
    "ALTER TABLE test1s ADD COLUMN b VARCHAR(23)",
    "ALTER TABLE test1s ADD COLUMN c VARCHAR",
    "ALTER TABLE test1s ADD COLUMN d VARCHAR(23)",
    "ALTER TABLE test1s ADD COLUMN e VARCHAR",
    "ALTER TABLE test1s ALTER COLUMN e SET DEFAULT '23'",
    "ALTER TABLE test1s ALTER COLUMN e SET NOT NULL",
    "ALTER TABLE test1s ADD COLUMN f VARCHAR",
    "ALTER TABLE test1s ALTER COLUMN f SET DEFAULT '23'",
    "ALTER TABLE test1s ALTER COLUMN f SET NOT NULL",
    "ALTER SEQUENCE test1s_id_seq OWNED BY test1s.id",
    "ALTER TABLE test1s ADD CONSTRAINT test1s_id_unique UNIQUE(id)"
  ],
  types_int_change: [
    "ALTER TABLE test1s ALTER COLUMN a TYPE INTEGER USING a::INTEGER",
    "ALTER TABLE test1s ALTER COLUMN b TYPE VARCHAR",
    "ALTER TABLE test1s ALTER COLUMN c TYPE VARCHAR(23)",
    "ALTER TABLE test1s ALTER COLUMN d TYPE VARCHAR(42)",
    "ALTER TABLE test1s ALTER COLUMN e SET DEFAULT '42'"
  ],
  sync_create_table: [
    "CREATE SEQUENCE test1s_id_seq",
    "CREATE TABLE test1s ()",
    "ALTER TABLE test1s ADD COLUMN id INTEGER",
    "ALTER TABLE test1s ALTER COLUMN id SET NOT NULL",
    "ALTER SEQUENCE test1s_id_seq OWNED BY test1s.id",
    "ALTER TABLE test1s ADD CONSTRAINT test1s_id_unique UNIQUE(id)"
  ],
  sync_create_table_exists: [""],
  sync_create_table_int8id: [
    "CREATE SEQUENCE test1s_id_seq",
    "CREATE TABLE test1s ()",
    "ALTER TABLE test1s ADD COLUMN id BIGINT",
    "ALTER TABLE test1s ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test1s ADD COLUMN a INTEGER",
    "ALTER TABLE test1s ADD COLUMN b BIGINT",
    "ALTER SEQUENCE test1s_id_seq OWNED BY test1s.id",
    "ALTER TABLE test1s ADD CONSTRAINT test1s_id_unique UNIQUE(id)"
  ],
  sync_create_table_parent:        ["CREATE TABLE test3s () INHERITS (test1s)"],
  sync_create_table_parent_add:    ["DROP TABLE test3s CASCADE", "CREATE TABLE test3s () INHERITS (test1s)"],
  sync_create_table_parent_change: ["DROP TABLE test3s CASCADE", "CREATE TABLE test3s () INHERITS (test2s)"],
  sync_create_table_parent_remove: [
    "CREATE SEQUENCE test3s_id_seq",
    "DROP TABLE test3s CASCADE",
    "CREATE TABLE test3s ()",
    "ALTER TABLE test3s ADD COLUMN id INTEGER",
    "ALTER TABLE test3s ALTER COLUMN id SET NOT NULL",
    "ALTER SEQUENCE test3s_id_seq OWNED BY test3s.id",
    "ALTER TABLE test3s ADD CONSTRAINT test3s_id_unique UNIQUE(id)"
  ],
  sync_create_table_parent_same: [""],
  sync_create_table_pk:          [
    "CREATE TABLE test2s ()",
    "ALTER TABLE test2s ADD COLUMN a INTEGER",
    "ALTER TABLE test2s ALTER COLUMN a SET NOT NULL",
    "ALTER TABLE test2s ADD COLUMN b INTEGER",
    "ALTER TABLE test2s ADD CONSTRAINT test2s_a_unique UNIQUE(a)",
    "ALTER TABLE test2s ADD CONSTRAINT test2s_b_unique UNIQUE(b)"
  ],
  sync_drop_column:   ["ALTER TABLE test2s DROP CONSTRAINT test2s_b_unique", "ALTER TABLE test2s DROP COLUMN b"],
  sync_field_options: [
    "CREATE SEQUENCE test1s_id_seq",
    "CREATE TABLE test1s ()",
    "ALTER TABLE test1s ADD COLUMN id INTEGER",
    "ALTER TABLE test1s ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test1s ADD COLUMN a INTEGER",
    "ALTER TABLE test1s ADD COLUMN b INTEGER",
    "ALTER TABLE test1s ALTER COLUMN b SET NOT NULL",
    "ALTER TABLE test1s ADD COLUMN c SMALLINT",
    "ALTER TABLE test1s ALTER COLUMN c SET DEFAULT '23'",
    "ALTER TABLE test1s ALTER COLUMN c SET NOT NULL",
    "ALTER TABLE test1s ADD COLUMN d VARCHAR",
    "ALTER TABLE test1s ALTER COLUMN d SET DEFAULT '23'",
    "ALTER TABLE test1s ALTER COLUMN d SET NOT NULL",
    "ALTER TABLE test1s ADD COLUMN f INTEGER",
    "ALTER TABLE test1s ADD COLUMN h INTEGER",
    "ALTER SEQUENCE test1s_id_seq OWNED BY test1s.id",
    "ALTER TABLE test1s ADD CONSTRAINT test1s_id_unique UNIQUE(id)",
    "ALTER TABLE test1s ADD CONSTRAINT test1s_a_unique UNIQUE(a)"
  ],
  sync_field_options_change: [
    "ALTER TABLE test1s DROP CONSTRAINT test1s_a_unique",
    "ALTER TABLE test1s DROP COLUMN h",
    "ALTER TABLE test1s ALTER COLUMN a SET DEFAULT '23'",
    "ALTER TABLE test1s ALTER COLUMN a SET NOT NULL",
    "ALTER TABLE test1s ALTER COLUMN b DROP NOT NULL",
    "ALTER TABLE test1s ALTER COLUMN c DROP DEFAULT",
    "ALTER TABLE test1s ALTER COLUMN d DROP DEFAULT",
    "ALTER TABLE test1s ALTER COLUMN d TYPE BIGINT USING d::BIGINT",
    "ALTER TABLE test1s ALTER COLUMN d SET DEFAULT '42'",
    "ALTER TABLE test1s ALTER COLUMN f TYPE BIGINT",
    "ALTER TABLE test1s ALTER COLUMN f SET NOT NULL",
    "ALTER TABLE test1s ADD CONSTRAINT test1s_b_unique UNIQUE(b)"
  ],
  sync_foreign_keys: [""],
  sync_index_1:      [
    "CREATE SEQUENCE test1s_id_seq",
    "CREATE TABLE test1s ()",
    "ALTER TABLE test1s ADD COLUMN id INTEGER",
    "ALTER TABLE test1s ADD COLUMN a INTEGER",
    "ALTER TABLE test1s ADD COLUMN b BIGINT",
    "ALTER SEQUENCE test1s_id_seq OWNED BY test1s.id",
    "ALTER TABLE test1s ADD CONSTRAINT test1s_id_unique UNIQUE(id)",
    "CREATE INDEX ON test1s USING btree (a)"
  ],
  sync_index_2: [] as string[],
  sync_index_3: [] as string[],
  sync_index_4: [] as string[]
};

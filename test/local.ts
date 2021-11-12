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
    "CREATE SEQUENCE test1s_id_seq\n",
    "CREATE TABLE test1s ()\n",
    "ALTER TABLE test1s ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1s ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test1s ADD COLUMN a TIMESTAMP (3) WITH TIME ZONE\n",
    "ALTER TABLE test1s ADD COLUMN b TIMESTAMP (3) WITH TIME ZONE\n",
    "ALTER TABLE test1s ADD COLUMN c VARCHAR\n",
    "ALTER TABLE test1s ADD COLUMN d TIMESTAMP (3) WITH TIME ZONE\n",
    "ALTER TABLE test1s ADD COLUMN e INTEGER\n",
    "ALTER TABLE test1s ADD COLUMN f TIMESTAMP (3) WITH TIME ZONE\n",
    "ALTER TABLE test1s ALTER COLUMN f SET DEFAULT '1976-01-23 14:00:00.000+00'\n",
    "ALTER TABLE test1s ALTER COLUMN f SET NOT NULL\n",
    "ALTER SEQUENCE test1s_id_seq OWNED BY test1s.id\n",
    "CREATE UNIQUE INDEX test1s_id_unique ON test1s USING btree (id)\n"
  ],
  types_datetime_changes: [
    "ALTER TABLE test1s DROP COLUMN f\n",
    "ALTER TABLE test1s ALTER COLUMN a TYPE TIMESTAMP (3) WITH TIME ZONE\n",
    "ALTER TABLE test1s ALTER COLUMN b TYPE VARCHAR\n",
    "ALTER TABLE test1s ALTER COLUMN c TYPE TIMESTAMP (3) WITH TIME ZONE USING c::TIMESTAMP (3) WITH TIME ZONE\n",
    "ALTER TABLE test1s DROP COLUMN d\n",
    "ALTER TABLE test1s ADD COLUMN d BIGINT\n",
    "ALTER TABLE test1s DROP COLUMN e\n",
    "ALTER TABLE test1s ADD COLUMN e TIMESTAMP (3) WITH TIME ZONE\n"
  ],
  types_int: [
    "CREATE SEQUENCE test1s_id_seq\n",
    "CREATE TABLE test1s ()\n",
    "ALTER TABLE test1s ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1s ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test1s ADD COLUMN a VARCHAR(23)\n",
    "ALTER TABLE test1s ADD COLUMN b VARCHAR(23)\n",
    "ALTER TABLE test1s ADD COLUMN c VARCHAR\n",
    "ALTER TABLE test1s ADD COLUMN d VARCHAR(23)\n",
    "ALTER TABLE test1s ADD COLUMN e VARCHAR\n",
    "ALTER TABLE test1s ALTER COLUMN e SET DEFAULT '23'\n",
    "ALTER TABLE test1s ALTER COLUMN e SET NOT NULL\n",
    "ALTER TABLE test1s ADD COLUMN f VARCHAR\n",
    "ALTER TABLE test1s ALTER COLUMN f SET DEFAULT '23'\n",
    "ALTER TABLE test1s ALTER COLUMN f SET NOT NULL\n",
    "ALTER SEQUENCE test1s_id_seq OWNED BY test1s.id\n",
    "CREATE UNIQUE INDEX test1s_id_unique ON test1s USING btree (id)\n"
  ],
  types_int_change: [
    "ALTER TABLE test1s ALTER COLUMN a TYPE INTEGER USING a::INTEGER\n",
    "ALTER TABLE test1s ALTER COLUMN b TYPE VARCHAR\n",
    "ALTER TABLE test1s ALTER COLUMN c TYPE VARCHAR(23)\n",
    "ALTER TABLE test1s ALTER COLUMN d TYPE VARCHAR(42)\n",
    "ALTER TABLE test1s ALTER COLUMN e SET DEFAULT '42'\n",
    "UPDATE test1s SET e = '42' WHERE e IS NULL\n"
  ],
  sync_create_table: [
    "CREATE SEQUENCE test1s_id_seq\n",
    "CREATE TABLE test1s ()\n",
    "ALTER TABLE test1s ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1s ALTER COLUMN id SET NOT NULL\n",
    "ALTER SEQUENCE test1s_id_seq OWNED BY test1s.id\n",
    "CREATE UNIQUE INDEX test1s_id_unique ON test1s USING btree (id)\n"
  ],
  sync_create_table_exists: [""],
  sync_create_table_int8id: [
    "CREATE SEQUENCE test1s_id_seq\n",
    "CREATE TABLE test1s ()\n",
    "ALTER TABLE test1s ADD COLUMN id BIGINT\n",
    "ALTER TABLE test1s ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test1s ADD COLUMN a INTEGER\n",
    "ALTER TABLE test1s ADD COLUMN b BIGINT\n",
    "ALTER SEQUENCE test1s_id_seq OWNED BY test1s.id\n",
    "CREATE UNIQUE INDEX test1s_id_unique ON test1s USING btree (id)\n"
  ],
  sync_create_table_parent:        ["CREATE TABLE test3s () INHERITS (test1s)\n"],
  sync_create_table_parent_add:    ["DROP TABLE test3s CASCADE\n", "CREATE TABLE test3s () INHERITS (test1s)\n"],
  sync_create_table_parent_change: ["DROP TABLE test3s CASCADE\n", "CREATE TABLE test3s () INHERITS (test2s)\n"],
  sync_create_table_parent_remove: [
    "CREATE SEQUENCE test3s_id_seq\n",
    "DROP TABLE test3s CASCADE\n",
    "CREATE TABLE test3s ()\n",
    "ALTER TABLE test3s ADD COLUMN id INTEGER\n",
    "ALTER TABLE test3s ALTER COLUMN id SET NOT NULL\n",
    "ALTER SEQUENCE test3s_id_seq OWNED BY test3s.id\n",
    "CREATE UNIQUE INDEX test3s_id_unique ON test3s USING btree (id)\n"
  ],
  sync_create_table_parent_same: [""],
  sync_create_table_pk:          [
    "CREATE TABLE test2s ()\n",
    "ALTER TABLE test2s ADD COLUMN a INTEGER\n",
    "ALTER TABLE test2s ALTER COLUMN a SET NOT NULL\n",
    "ALTER TABLE test2s ADD COLUMN b INTEGER\n",
    "CREATE UNIQUE INDEX test2s_a_unique ON test2s USING btree (a)\n",
    "CREATE UNIQUE INDEX test2s_b_unique ON test2s USING btree (b)\n"
  ],
  sync_drop_column:   ["DROP INDEX test2s_b_unique\n", "ALTER TABLE test2s DROP COLUMN b\n"],
  sync_field_options: [
    "CREATE SEQUENCE test1s_id_seq\n",
    "CREATE TABLE test1s ()\n",
    "ALTER TABLE test1s ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1s ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test1s ADD COLUMN a INTEGER\n",
    "ALTER TABLE test1s ADD COLUMN b INTEGER\n",
    "ALTER TABLE test1s ALTER COLUMN b SET NOT NULL\n",
    "ALTER TABLE test1s ADD COLUMN c SMALLINT\n",
    "ALTER TABLE test1s ALTER COLUMN c SET DEFAULT '23'\n",
    "ALTER TABLE test1s ALTER COLUMN c SET NOT NULL\n",
    "ALTER TABLE test1s ADD COLUMN d VARCHAR\n",
    "ALTER TABLE test1s ALTER COLUMN d SET DEFAULT '23'\n",
    "ALTER TABLE test1s ALTER COLUMN d SET NOT NULL\n",
    "ALTER TABLE test1s ADD COLUMN f INTEGER\n",
    "ALTER TABLE test1s ADD COLUMN h INTEGER\n",
    "ALTER SEQUENCE test1s_id_seq OWNED BY test1s.id\n",
    "CREATE UNIQUE INDEX test1s_id_unique ON test1s USING btree (id)\n",
    "CREATE UNIQUE INDEX test1s_a_unique ON test1s USING btree (a)\n"
  ],
  sync_field_options_change: [
    "DROP INDEX test1s_a_unique\n",
    "ALTER TABLE test1s DROP COLUMN h\n",
    "ALTER TABLE test1s ALTER COLUMN a SET DEFAULT '23'\n",
    "ALTER TABLE test1s ALTER COLUMN a SET NOT NULL\n",
    "ALTER TABLE test1s ALTER COLUMN b DROP NOT NULL\n",
    "ALTER TABLE test1s ALTER COLUMN c DROP DEFAULT\n",
    "ALTER TABLE test1s ALTER COLUMN d DROP DEFAULT\n",
    "ALTER TABLE test1s ALTER COLUMN d TYPE BIGINT USING d::BIGINT\n",
    "ALTER TABLE test1s ALTER COLUMN d SET DEFAULT '42'\n",
    "UPDATE test1s SET d = '42' WHERE d IS NULL\n",
    "ALTER TABLE test1s ALTER COLUMN f TYPE BIGINT\n",
    "ALTER TABLE test1s ALTER COLUMN f SET NOT NULL\n",
    "CREATE UNIQUE INDEX test1s_b_unique ON test1s USING btree (b)\n"
  ],
  sync_foreign_keys: [""],
  sync_index_1:      [
    "CREATE SEQUENCE test1s_id_seq\n",
    "CREATE TABLE test1s ()\n",
    "ALTER TABLE test1s ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1s ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test1s ADD COLUMN a INTEGER\n",
    "ALTER TABLE test1s ADD COLUMN b BIGINT\n",
    "ALTER SEQUENCE test1s_id_seq OWNED BY test1s.id\n",
    "CREATE UNIQUE INDEX test1s_id_unique ON test1s USING btree (id)\n",
    "CREATE INDEX ia ON test1s USING btree (a)\n"
  ],
  sync_index_2: ["CREATE INDEX ib ON test1s USING btree (a, b)\n"],
  sync_index_3: ["DROP INDEX ia\n", "DROP INDEX ib\n", "CREATE INDEX ia ON test1s USING hash (a)\n", "CREATE UNIQUE INDEX ib ON test1s USING btree (a, b)\n"],
  sync_index_4: ["DROP INDEX ia\n", "DROP INDEX ib\n", "CREATE INDEX ia ON test1s USING btree (a, b)\n", "CREATE UNIQUE INDEX ib ON test1s USING btree (b, a)\n"]
};

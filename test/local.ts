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

  await drop("TABLE test1");
  await drop("TABLE test2");
  await drop("TABLE test3");
  await drop("SEQUENCE test1_id_seq");
  await drop("SEQUENCE test2_id_seq");
  await drop("SEQUENCE test3_id_seq");

  client.release();
  await pool.end();
}

export const dryrun = {
  dryrun: [
    "NOT SYNCING: ALTER TABLE test1 DROP CONSTRAINT test1_c_unique CASCADE\n",
    "NOT SYNCING: DROP INDEX a\n",
    "NOT SYNCING: DROP INDEX test1_c_unique\n",
    "NOT SYNCING: ALTER TABLE test1 DROP COLUMN c\n",
    "NOT SYNCING: ALTER TABLE test1 ALTER COLUMN a TYPE BIGINT\n",
    "NOT SYNCING: ALTER TABLE test1 ALTER COLUMN a SET DEFAULT '23'\n",
    "NOT SYNCING: ALTER TABLE test1 ALTER COLUMN a SET NOT NULL\n",
    "NOT SYNCING: ALTER TABLE test1 ADD CONSTRAINT test1_a_unique UNIQUE(a)\n",
    "NOT SYNCING: CREATE INDEX b ON test1 USING btree (b)\n",
    "NOT SYNCING: CREATE SEQUENCE test2_id_seq\n",
    "NOT SYNCING: DROP TABLE test2 CASCADE\n",
    "NOT SYNCING: CREATE TABLE test2 ()\n",
    "NOT SYNCING: ALTER TABLE test2 DROP CONSTRAINT fkey_d_test1_b CASCADE\n",
    "NOT SYNCING: ALTER TABLE test2 DROP COLUMN d\n",
    "NOT SYNCING: ALTER TABLE test2 ADD COLUMN id INTEGER\n",
    "NOT SYNCING: ALTER TABLE test2 ALTER COLUMN id SET NOT NULL\n",
    "NOT SYNCING: ALTER TABLE test2 ALTER COLUMN e DROP DEFAULT\n",
    "NOT SYNCING: ALTER TABLE test2 ALTER COLUMN e DROP NOT NULL\n",
    "NOT SYNCING: ALTER TABLE test2 ALTER COLUMN f SET DEFAULT '42'\n",
    "NOT SYNCING: UPDATE test2 SET f = '42' WHERE f IS NULL\n",
    "NOT SYNCING: ALTER TABLE test2 ADD COLUMN g INTEGER\n",
    "NOT SYNCING: ALTER SEQUENCE test2_id_seq OWNED BY test2.id\n",
    "NOT SYNCING: ALTER TABLE test2 ADD CONSTRAINT test2_id_unique UNIQUE(id)\n",
    "NOT SYNCING: ALTER TABLE test2 ADD CONSTRAINT fkey_g_test1_b FOREIGN KEY (g) REFERENCES test1(b)\n",
    "NOT SYNCING: CREATE SEQUENCE test3_id_seq\n",
    "NOT SYNCING: CREATE TABLE test3 ()\n",
    "NOT SYNCING: ALTER TABLE test3 ADD COLUMN id INTEGER\n",
    "NOT SYNCING: ALTER TABLE test3 ALTER COLUMN id SET NOT NULL\n",
    "NOT SYNCING: ALTER SEQUENCE test3_id_seq OWNED BY test3.id\n",
    "NOT SYNCING: ALTER TABLE test3 ADD CONSTRAINT test3_id_unique UNIQUE(id)\n",
    "NOT SYNCING: CREATE TABLE test4 () INHERITS (test1)\n"
  ],
  sync: [
    "CREATE SEQUENCE test1_id_seq\n",
    "CREATE TABLE test1 ()\n",
    "ALTER TABLE test1 ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test1 ADD COLUMN a INTEGER\n",
    "ALTER TABLE test1 ADD COLUMN b INTEGER\n",
    "ALTER TABLE test1 ADD COLUMN c INTEGER\n",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_b_unique UNIQUE(b)\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_c_unique UNIQUE(c)\n",
    "CREATE INDEX a ON test1 USING btree (c)\n",
    "CREATE TABLE test2 () INHERITS (test1)\n",
    "ALTER TABLE test2 ADD COLUMN d INTEGER\n",
    "ALTER TABLE test2 ADD COLUMN e INTEGER\n",
    "ALTER TABLE test2 ALTER COLUMN e SET DEFAULT '23'\n",
    "ALTER TABLE test2 ALTER COLUMN e SET NOT NULL\n",
    "ALTER TABLE test2 ADD COLUMN f INTEGER\n",
    "ALTER TABLE test2 ALTER COLUMN f SET DEFAULT '23'\n",
    "ALTER TABLE test2 ALTER COLUMN f SET NOT NULL\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_d_test1_b FOREIGN KEY (d) REFERENCES test1(b)\n"
  ]
};

export const expected = {
  sync_create_table: [
    "CREATE SEQUENCE test1_id_seq\n",
    "CREATE TABLE test1 ()\n",
    "ALTER TABLE test1 ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL\n",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)\n"
  ],
  sync_create_table_exists: [""],
  sync_create_table_int8id: [
    "CREATE SEQUENCE test1_id_seq\n",
    "CREATE TABLE test1 ()\n",
    "ALTER TABLE test1 ADD COLUMN id BIGINT\n",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test1 ADD COLUMN a INTEGER\n",
    "ALTER TABLE test1 ADD COLUMN b BIGINT\n",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)\n"
  ],
  sync_create_table_parent:        ["CREATE TABLE test3 () INHERITS (test1)\n"],
  sync_create_table_parent_add:    ["DROP TABLE test3 CASCADE\n", "CREATE TABLE test3 () INHERITS (test1)\n"],
  sync_create_table_parent_change: ["DROP TABLE test3 CASCADE\n", "CREATE TABLE test3 () INHERITS (test2)\n"],
  sync_create_table_parent_remove: [
    "CREATE SEQUENCE test3_id_seq\n",
    "DROP TABLE test3 CASCADE\n",
    "CREATE TABLE test3 ()\n",
    "ALTER TABLE test3 ADD COLUMN id INTEGER\n",
    "ALTER TABLE test3 ALTER COLUMN id SET NOT NULL\n",
    "ALTER SEQUENCE test3_id_seq OWNED BY test3.id\n",
    "ALTER TABLE test3 ADD CONSTRAINT test3_id_unique UNIQUE(id)\n"
  ],
  sync_create_table_parent_same: [""],
  sync_create_table_pk:          [
    "CREATE TABLE test2 ()\n",
    "ALTER TABLE test2 ADD COLUMN a INTEGER\n",
    "ALTER TABLE test2 ALTER COLUMN a SET NOT NULL\n",
    "ALTER TABLE test2 ADD COLUMN b INTEGER\n",
    "ALTER TABLE test2 ADD CONSTRAINT test2_a_unique UNIQUE(a)\n",
    "ALTER TABLE test2 ADD CONSTRAINT test2_b_unique UNIQUE(b)\n"
  ],
  sync_drop_column:   ["ALTER TABLE test2 DROP CONSTRAINT test2_b_unique CASCADE\n", "ALTER TABLE test2 DROP COLUMN b\n"],
  sync_field_options: [
    "CREATE SEQUENCE test1_id_seq\n",
    "CREATE TABLE test1 ()\n",
    "ALTER TABLE test1 ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test1 ADD COLUMN a INTEGER\n",
    "ALTER TABLE test1 ADD COLUMN b INTEGER\n",
    "ALTER TABLE test1 ALTER COLUMN b SET NOT NULL\n",
    "ALTER TABLE test1 ADD COLUMN c SMALLINT\n",
    "ALTER TABLE test1 ALTER COLUMN c SET DEFAULT '23'\n",
    "ALTER TABLE test1 ALTER COLUMN c SET NOT NULL\n",
    "ALTER TABLE test1 ADD COLUMN d VARCHAR\n",
    "ALTER TABLE test1 ALTER COLUMN d SET DEFAULT '23'\n",
    "ALTER TABLE test1 ALTER COLUMN d SET NOT NULL\n",
    "ALTER TABLE test1 ADD COLUMN f INTEGER\n",
    "ALTER TABLE test1 ADD COLUMN h INTEGER\n",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_a_unique UNIQUE(a)\n"
  ],
  sync_field_options_change: [
    "ALTER TABLE test1 DROP CONSTRAINT test1_a_unique CASCADE\n",
    "ALTER TABLE test1 DROP COLUMN h\n",
    "ALTER TABLE test1 ALTER COLUMN a SET DEFAULT '23'\n",
    "ALTER TABLE test1 ALTER COLUMN a SET NOT NULL\n",
    "ALTER TABLE test1 ALTER COLUMN b DROP NOT NULL\n",
    "ALTER TABLE test1 ALTER COLUMN c DROP DEFAULT\n",
    "ALTER TABLE test1 ALTER COLUMN d DROP DEFAULT\n",
    "ALTER TABLE test1 ALTER COLUMN d TYPE BIGINT USING d::BIGINT\n",
    "ALTER TABLE test1 ALTER COLUMN d SET DEFAULT '42'\n",
    "UPDATE test1 SET d = '42' WHERE d IS NULL\n",
    "ALTER TABLE test1 ALTER COLUMN f TYPE BIGINT\n",
    "ALTER TABLE test1 ALTER COLUMN f SET NOT NULL\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_b_unique UNIQUE(b)\n"
  ],
  sync_foreign_keys_1: [
    "CREATE SEQUENCE test1_id_seq\n",
    "CREATE TABLE test1 ()\n",
    "ALTER TABLE test1 ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test1 ADD COLUMN a INTEGER\n",
    "ALTER TABLE test1 ADD COLUMN b BIGINT\n",
    "ALTER TABLE test1 ADD COLUMN d VARCHAR\n",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_a_unique UNIQUE(a)\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_b_unique UNIQUE(b)\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_d_unique UNIQUE(d)\n",
    "CREATE SEQUENCE test2_id_seq\n",
    "CREATE TABLE test2 ()\n",
    "ALTER TABLE test2 ADD COLUMN id INTEGER\n",
    "ALTER TABLE test2 ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test2 ADD COLUMN a INTEGER\n",
    "ALTER TABLE test2 ADD COLUMN b INTEGER\n",
    "ALTER TABLE test2 ADD COLUMN c BIGINT\n",
    "ALTER TABLE test2 ADD COLUMN d VARCHAR\n",
    "ALTER SEQUENCE test2_id_seq OWNED BY test2.id\n",
    "ALTER TABLE test2 ADD CONSTRAINT test2_id_unique UNIQUE(id)\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_a_test1_id FOREIGN KEY (a) REFERENCES test1(id)\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_b_test1_a FOREIGN KEY (b) REFERENCES test1(a)\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_c_test1_b FOREIGN KEY (c) REFERENCES test1(b)\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_d_test1_d FOREIGN KEY (d) REFERENCES test1(d)\n"
  ],
  sync_foreign_keys_2: [
    "ALTER TABLE test1 DROP CONSTRAINT test1_b_unique CASCADE\n",
    "ALTER TABLE test1 DROP CONSTRAINT test1_d_unique CASCADE\n",
    "CREATE SEQUENCE test3_id_seq\n",
    "CREATE TABLE test3 ()\n",
    "ALTER TABLE test3 ADD COLUMN id INTEGER\n",
    "ALTER TABLE test3 ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test3 ADD COLUMN b BIGINT\n",
    "ALTER SEQUENCE test3_id_seq OWNED BY test3.id\n",
    "ALTER TABLE test3 ADD CONSTRAINT test3_id_unique UNIQUE(id)\n",
    "ALTER TABLE test3 ADD CONSTRAINT test3_b_unique UNIQUE(b)\n",
    "ALTER TABLE test2 DROP CONSTRAINT fkey_a_test1_id CASCADE\n",
    "ALTER TABLE test2 DROP COLUMN d\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_a_test1_a FOREIGN KEY (a) REFERENCES test1(a)\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_c_test3_b FOREIGN KEY (c) REFERENCES test3(b)\n"
  ],
  sync_foreign_keys_3: [
    "CREATE SEQUENCE test1_id_seq\n",
    "CREATE TABLE test1 ()\n",
    "ALTER TABLE test1 ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL\n",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)\n",
    "CREATE SEQUENCE test2_id_seq\n",
    "CREATE TABLE test2 ()\n",
    "ALTER TABLE test2 ADD COLUMN id INTEGER\n",
    "ALTER TABLE test2 ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test2 ADD COLUMN a INTEGER\n",
    "ALTER TABLE test2 ADD COLUMN b INTEGER\n",
    "ALTER TABLE test2 ADD COLUMN c INTEGER\n",
    "ALTER TABLE test2 ADD COLUMN d INTEGER\n",
    "ALTER TABLE test2 ADD COLUMN e INTEGER\n",
    "ALTER TABLE test2 ADD COLUMN f INTEGER\n",
    "ALTER TABLE test2 ADD COLUMN g INTEGER\n",
    "ALTER TABLE test2 ADD COLUMN h INTEGER\n",
    "ALTER SEQUENCE test2_id_seq OWNED BY test2.id\n",
    "ALTER TABLE test2 ADD CONSTRAINT test2_id_unique UNIQUE(id)\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_a_test1_id FOREIGN KEY (a) REFERENCES test1(id)\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_b_test1_id FOREIGN KEY (b) REFERENCES test1(id)\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_c_test1_id FOREIGN KEY (c) REFERENCES test1(id)\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_d_test1_id FOREIGN KEY (d) REFERENCES test1(id) ON DELETE CASCADE\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_e_test1_id FOREIGN KEY (e) REFERENCES test1(id) ON UPDATE RESTRICT\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_f_test1_id FOREIGN KEY (f) REFERENCES test1(id) ON DELETE SET DEFAULT ON UPDATE SET NULL\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_g_test1_id FOREIGN KEY (g) REFERENCES test1(id)\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_h_test1_id FOREIGN KEY (h) REFERENCES test1(id) ON DELETE CASCADE ON UPDATE SET NULL\n"
  ],
  sync_foreign_keys_4: [
    "ALTER TABLE test2 DROP CONSTRAINT fkey_a_test1_id CASCADE\n",
    "ALTER TABLE test2 DROP CONSTRAINT fkey_b_test1_id CASCADE\n",
    "ALTER TABLE test2 DROP CONSTRAINT fkey_c_test1_id CASCADE\n",
    "ALTER TABLE test2 DROP CONSTRAINT fkey_d_test1_id CASCADE\n",
    "ALTER TABLE test2 DROP CONSTRAINT fkey_e_test1_id CASCADE\n",
    "ALTER TABLE test2 DROP CONSTRAINT fkey_f_test1_id CASCADE\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_a_test1_id FOREIGN KEY (a) REFERENCES test1(id) ON DELETE CASCADE\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_b_test1_id FOREIGN KEY (b) REFERENCES test1(id) ON UPDATE RESTRICT\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_c_test1_id FOREIGN KEY (c) REFERENCES test1(id) ON DELETE SET DEFAULT ON UPDATE SET NULL\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_d_test1_id FOREIGN KEY (d) REFERENCES test1(id)\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_e_test1_id FOREIGN KEY (e) REFERENCES test1(id)\n",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_f_test1_id FOREIGN KEY (f) REFERENCES test1(id)\n"
  ],
  sync_index_1: [
    "CREATE SEQUENCE test1_id_seq\n",
    "CREATE TABLE test1 ()\n",
    "ALTER TABLE test1 ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test1 ADD COLUMN a INTEGER\n",
    "ALTER TABLE test1 ADD COLUMN b BIGINT\n",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)\n",
    "CREATE INDEX ia ON test1 USING btree (a)\n"
  ],
  sync_index_2:   ["CREATE INDEX ib ON test1 USING btree (a, b)\n"],
  sync_index_3:   ["DROP INDEX ia\n", "DROP INDEX ib\n", "CREATE INDEX ia ON test1 USING hash (a)\n", "CREATE UNIQUE INDEX ib ON test1 USING btree (a, b)\n"],
  sync_index_4:   ["DROP INDEX ia\n", "DROP INDEX ib\n", "CREATE INDEX ia ON test1 USING btree (a, b)\n", "CREATE UNIQUE INDEX ib ON test1 USING btree (b, a)\n"],
  types_datetime: [
    "CREATE SEQUENCE test1_id_seq\n",
    "CREATE TABLE test1 ()\n",
    "ALTER TABLE test1 ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test1 ADD COLUMN a TIMESTAMP (3) WITH TIME ZONE\n",
    "ALTER TABLE test1 ADD COLUMN b TIMESTAMP (3) WITH TIME ZONE\n",
    "ALTER TABLE test1 ADD COLUMN c VARCHAR\n",
    "ALTER TABLE test1 ADD COLUMN d TIMESTAMP (3) WITH TIME ZONE\n",
    "ALTER TABLE test1 ADD COLUMN e INTEGER\n",
    "ALTER TABLE test1 ADD COLUMN f TIMESTAMP (3) WITH TIME ZONE\n",
    "ALTER TABLE test1 ALTER COLUMN f SET DEFAULT '1976-01-23 14:00:00.000+00'\n",
    "ALTER TABLE test1 ALTER COLUMN f SET NOT NULL\n",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)\n"
  ],
  types_datetime_changes: [
    "ALTER TABLE test1 DROP COLUMN f\n",
    "ALTER TABLE test1 ALTER COLUMN a TYPE TIMESTAMP (3) WITH TIME ZONE\n",
    "ALTER TABLE test1 ALTER COLUMN b TYPE VARCHAR\n",
    "ALTER TABLE test1 ALTER COLUMN c TYPE TIMESTAMP (3) WITH TIME ZONE USING c::TIMESTAMP (3) WITH TIME ZONE\n",
    "ALTER TABLE test1 DROP COLUMN d\n",
    "ALTER TABLE test1 ADD COLUMN d BIGINT\n",
    "ALTER TABLE test1 DROP COLUMN e\n",
    "ALTER TABLE test1 ADD COLUMN e TIMESTAMP (3) WITH TIME ZONE\n"
  ],
  types_int: [
    "CREATE SEQUENCE test1_id_seq\n",
    "CREATE TABLE test1 ()\n",
    "ALTER TABLE test1 ADD COLUMN id INTEGER\n",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL\n",
    "ALTER TABLE test1 ADD COLUMN a VARCHAR(23)\n",
    "ALTER TABLE test1 ADD COLUMN b VARCHAR(23)\n",
    "ALTER TABLE test1 ADD COLUMN c VARCHAR\n",
    "ALTER TABLE test1 ADD COLUMN d VARCHAR(23)\n",
    "ALTER TABLE test1 ADD COLUMN e VARCHAR\n",
    "ALTER TABLE test1 ALTER COLUMN e SET DEFAULT '23'\n",
    "ALTER TABLE test1 ALTER COLUMN e SET NOT NULL\n",
    "ALTER TABLE test1 ADD COLUMN f VARCHAR\n",
    "ALTER TABLE test1 ALTER COLUMN f SET DEFAULT '23'\n",
    "ALTER TABLE test1 ALTER COLUMN f SET NOT NULL\n",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id\n",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)\n"
  ],
  types_int_change: [
    "ALTER TABLE test1 ALTER COLUMN a TYPE INTEGER USING a::INTEGER\n",
    "ALTER TABLE test1 ALTER COLUMN b TYPE VARCHAR\n",
    "ALTER TABLE test1 ALTER COLUMN c TYPE VARCHAR(23)\n",
    "ALTER TABLE test1 ALTER COLUMN d TYPE VARCHAR(42)\n",
    "ALTER TABLE test1 ALTER COLUMN e SET DEFAULT '42'\n",
    "UPDATE test1 SET e = '42' WHERE e IS NULL\n"
  ]
};

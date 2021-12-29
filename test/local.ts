import { DatabaseError, Pool } from "pg";

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
      if(! (e instanceof DatabaseError) || e.code !== "42P01") throw e;
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
    "NOT SYNCING: ALTER TABLE test1 DROP CONSTRAINT test1_c_unique CASCADE",
    "NOT SYNCING: DROP INDEX a",
    "NOT SYNCING: DROP INDEX test1_c_unique",
    "NOT SYNCING: ALTER TABLE test1 DROP COLUMN c",
    "NOT SYNCING: ALTER TABLE test1 ALTER COLUMN a TYPE BIGINT",
    "NOT SYNCING: ALTER TABLE test1 ALTER COLUMN a SET DEFAULT '23'",
    "NOT SYNCING: ALTER TABLE test1 ALTER COLUMN a SET NOT NULL",
    "NOT SYNCING: ALTER TABLE test1 ADD CONSTRAINT test1_a_unique UNIQUE(a)",
    "NOT SYNCING: CREATE INDEX b ON test1 USING btree (b)",
    "NOT SYNCING: CREATE SEQUENCE test2_id_seq",
    "NOT SYNCING: DROP TABLE test2 CASCADE",
    "NOT SYNCING: CREATE TABLE test2 ()",
    "NOT SYNCING: ALTER TABLE test2 DROP CONSTRAINT fkey_d_test1_b CASCADE",
    "NOT SYNCING: ALTER TABLE test2 DROP COLUMN d",
    "NOT SYNCING: ALTER TABLE test2 ADD COLUMN id INTEGER",
    "NOT SYNCING: ALTER TABLE test2 ALTER COLUMN id SET NOT NULL",
    "NOT SYNCING: ALTER TABLE test2 ALTER COLUMN e DROP DEFAULT",
    "NOT SYNCING: ALTER TABLE test2 ALTER COLUMN e DROP NOT NULL",
    "NOT SYNCING: ALTER TABLE test2 ALTER COLUMN f SET DEFAULT '42'",
    "NOT SYNCING: UPDATE test2 SET f = '42' WHERE f IS NULL",
    "NOT SYNCING: ALTER TABLE test2 ADD COLUMN g INTEGER",
    "NOT SYNCING: ALTER SEQUENCE test2_id_seq OWNED BY test2.id",
    "NOT SYNCING: ALTER TABLE test2 ADD CONSTRAINT test2_id_unique UNIQUE(id)",
    "NOT SYNCING: ALTER TABLE test2 ADD CONSTRAINT fkey_g_test1_b FOREIGN KEY (g) REFERENCES test1(b)",
    "NOT SYNCING: CREATE SEQUENCE test3_id_seq",
    "NOT SYNCING: CREATE TABLE test3 ()",
    "NOT SYNCING: ALTER TABLE test3 ADD COLUMN id INTEGER",
    "NOT SYNCING: ALTER TABLE test3 ALTER COLUMN id SET NOT NULL",
    "NOT SYNCING: ALTER SEQUENCE test3_id_seq OWNED BY test3.id",
    "NOT SYNCING: ALTER TABLE test3 ADD CONSTRAINT test3_id_unique UNIQUE(id)",
    "NOT SYNCING: CREATE TABLE test4 () INHERITS (test1)"
  ],
  sync: [
    "CREATE SEQUENCE test1_id_seq",
    "CREATE TABLE test1 ()",
    "ALTER TABLE test1 ADD COLUMN id INTEGER",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test1 ADD COLUMN a INTEGER",
    "ALTER TABLE test1 ADD COLUMN b INTEGER",
    "ALTER TABLE test1 ADD COLUMN c INTEGER",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)",
    "ALTER TABLE test1 ADD CONSTRAINT test1_b_unique UNIQUE(b)",
    "ALTER TABLE test1 ADD CONSTRAINT test1_c_unique UNIQUE(c)",
    "CREATE INDEX a ON test1 USING btree (c)",
    "CREATE TABLE test2 () INHERITS (test1)",
    "ALTER TABLE test2 ADD COLUMN d INTEGER",
    "ALTER TABLE test2 ADD COLUMN e INTEGER",
    "ALTER TABLE test2 ALTER COLUMN e SET DEFAULT '23'",
    "ALTER TABLE test2 ALTER COLUMN e SET NOT NULL",
    "ALTER TABLE test2 ADD COLUMN f INTEGER",
    "ALTER TABLE test2 ALTER COLUMN f SET DEFAULT '23'",
    "ALTER TABLE test2 ALTER COLUMN f SET NOT NULL",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_d_test1_b FOREIGN KEY (d) REFERENCES test1(b)"
  ]
};

export const expected = {
  sync_create_table: [
    "CREATE SEQUENCE test1_id_seq",
    "CREATE TABLE test1 ()",
    "ALTER TABLE test1 ADD COLUMN id INTEGER",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)"
  ],
  sync_create_table_exists: [""],
  sync_create_table_int8id: [
    "CREATE SEQUENCE test1_id_seq",
    "CREATE TABLE test1 ()",
    "ALTER TABLE test1 ADD COLUMN id BIGINT",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test1 ADD COLUMN a INTEGER",
    "ALTER TABLE test1 ADD COLUMN b BIGINT",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)"
  ],
  sync_create_table_parent:        ["CREATE TABLE test3 () INHERITS (test1)"],
  sync_create_table_parent_add:    ["DROP TABLE test3 CASCADE", "CREATE TABLE test3 () INHERITS (test1)"],
  sync_create_table_parent_change: ["DROP TABLE test3 CASCADE", "CREATE TABLE test3 () INHERITS (test2)"],
  sync_create_table_parent_remove: [
    "CREATE SEQUENCE test3_id_seq",
    "DROP TABLE test3 CASCADE",
    "CREATE TABLE test3 ()",
    "ALTER TABLE test3 ADD COLUMN id INTEGER",
    "ALTER TABLE test3 ALTER COLUMN id SET NOT NULL",
    "ALTER SEQUENCE test3_id_seq OWNED BY test3.id",
    "ALTER TABLE test3 ADD CONSTRAINT test3_id_unique UNIQUE(id)"
  ],
  sync_create_table_parent_same: [""],
  sync_create_table_pk:          [
    "CREATE TABLE test2 ()",
    "ALTER TABLE test2 ADD COLUMN a INTEGER",
    "ALTER TABLE test2 ALTER COLUMN a SET NOT NULL",
    "ALTER TABLE test2 ADD COLUMN b INTEGER",
    "ALTER TABLE test2 ADD CONSTRAINT test2_a_unique UNIQUE(a)",
    "ALTER TABLE test2 ADD CONSTRAINT test2_b_unique UNIQUE(b)"
  ],
  sync_drop_column:   ["ALTER TABLE test2 DROP CONSTRAINT test2_b_unique CASCADE", "ALTER TABLE test2 DROP COLUMN b"],
  sync_field_options: [
    "CREATE SEQUENCE test1_id_seq",
    "CREATE TABLE test1 ()",
    "ALTER TABLE test1 ADD COLUMN id INTEGER",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test1 ADD COLUMN a INTEGER",
    "ALTER TABLE test1 ADD COLUMN b INTEGER",
    "ALTER TABLE test1 ALTER COLUMN b SET NOT NULL",
    "ALTER TABLE test1 ADD COLUMN c SMALLINT",
    "ALTER TABLE test1 ALTER COLUMN c SET DEFAULT '23'",
    "ALTER TABLE test1 ALTER COLUMN c SET NOT NULL",
    "ALTER TABLE test1 ADD COLUMN d VARCHAR",
    "ALTER TABLE test1 ALTER COLUMN d SET DEFAULT '23'",
    "ALTER TABLE test1 ALTER COLUMN d SET NOT NULL",
    "ALTER TABLE test1 ADD COLUMN f INTEGER",
    "ALTER TABLE test1 ADD COLUMN h INTEGER",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)",
    "ALTER TABLE test1 ADD CONSTRAINT test1_a_unique UNIQUE(a)"
  ],
  sync_field_options_change: [
    "ALTER TABLE test1 DROP CONSTRAINT test1_a_unique CASCADE",
    "ALTER TABLE test1 DROP COLUMN h",
    "ALTER TABLE test1 ALTER COLUMN a SET DEFAULT '23'",
    "ALTER TABLE test1 ALTER COLUMN a SET NOT NULL",
    "ALTER TABLE test1 ALTER COLUMN b DROP NOT NULL",
    "ALTER TABLE test1 ALTER COLUMN c DROP DEFAULT",
    "ALTER TABLE test1 ALTER COLUMN d DROP DEFAULT",
    "ALTER TABLE test1 ALTER COLUMN d TYPE BIGINT USING d::BIGINT",
    "ALTER TABLE test1 ALTER COLUMN d SET DEFAULT '42'",
    "UPDATE test1 SET d = '42' WHERE d IS NULL",
    "ALTER TABLE test1 ALTER COLUMN f TYPE BIGINT",
    "ALTER TABLE test1 ALTER COLUMN f SET NOT NULL",
    "ALTER TABLE test1 ADD CONSTRAINT test1_b_unique UNIQUE(b)"
  ],
  sync_foreign_keys_1: [
    "CREATE SEQUENCE test1_id_seq",
    "CREATE TABLE test1 ()",
    "ALTER TABLE test1 ADD COLUMN id INTEGER",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test1 ADD COLUMN a INTEGER",
    "ALTER TABLE test1 ADD COLUMN b BIGINT",
    "ALTER TABLE test1 ADD COLUMN d VARCHAR",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)",
    "ALTER TABLE test1 ADD CONSTRAINT test1_a_unique UNIQUE(a)",
    "ALTER TABLE test1 ADD CONSTRAINT test1_b_unique UNIQUE(b)",
    "ALTER TABLE test1 ADD CONSTRAINT test1_d_unique UNIQUE(d)",
    "CREATE SEQUENCE test2_id_seq",
    "CREATE TABLE test2 ()",
    "ALTER TABLE test2 ADD COLUMN id INTEGER",
    "ALTER TABLE test2 ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test2 ADD COLUMN a INTEGER",
    "ALTER TABLE test2 ADD COLUMN b INTEGER",
    "ALTER TABLE test2 ADD COLUMN c BIGINT",
    "ALTER TABLE test2 ADD COLUMN d VARCHAR",
    "ALTER SEQUENCE test2_id_seq OWNED BY test2.id",
    "ALTER TABLE test2 ADD CONSTRAINT test2_id_unique UNIQUE(id)",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_a_test1_id FOREIGN KEY (a) REFERENCES test1(id)",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_b_test1_a FOREIGN KEY (b) REFERENCES test1(a)",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_c_test1_b FOREIGN KEY (c) REFERENCES test1(b)",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_d_test1_d FOREIGN KEY (d) REFERENCES test1(d)"
  ],
  sync_foreign_keys_2: [
    "ALTER TABLE test1 DROP CONSTRAINT test1_b_unique CASCADE",
    "ALTER TABLE test1 DROP CONSTRAINT test1_d_unique CASCADE",
    "CREATE SEQUENCE test3_id_seq",
    "CREATE TABLE test3 ()",
    "ALTER TABLE test3 ADD COLUMN id INTEGER",
    "ALTER TABLE test3 ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test3 ADD COLUMN b BIGINT",
    "ALTER SEQUENCE test3_id_seq OWNED BY test3.id",
    "ALTER TABLE test3 ADD CONSTRAINT test3_id_unique UNIQUE(id)",
    "ALTER TABLE test3 ADD CONSTRAINT test3_b_unique UNIQUE(b)",
    "ALTER TABLE test2 DROP CONSTRAINT fkey_a_test1_id CASCADE",
    "ALTER TABLE test2 DROP COLUMN d",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_a_test1_a FOREIGN KEY (a) REFERENCES test1(a)",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_c_test3_b FOREIGN KEY (c) REFERENCES test3(b)"
  ],
  sync_foreign_keys_3: [
    "CREATE SEQUENCE test1_id_seq",
    "CREATE TABLE test1 ()",
    "ALTER TABLE test1 ADD COLUMN id INTEGER",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)",
    "CREATE SEQUENCE test2_id_seq",
    "CREATE TABLE test2 ()",
    "ALTER TABLE test2 ADD COLUMN id INTEGER",
    "ALTER TABLE test2 ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test2 ADD COLUMN a INTEGER",
    "ALTER TABLE test2 ADD COLUMN b INTEGER",
    "ALTER TABLE test2 ADD COLUMN c INTEGER",
    "ALTER TABLE test2 ADD COLUMN d INTEGER",
    "ALTER TABLE test2 ADD COLUMN e INTEGER",
    "ALTER TABLE test2 ADD COLUMN f INTEGER",
    "ALTER TABLE test2 ADD COLUMN g INTEGER",
    "ALTER TABLE test2 ADD COLUMN h INTEGER",
    "ALTER SEQUENCE test2_id_seq OWNED BY test2.id",
    "ALTER TABLE test2 ADD CONSTRAINT test2_id_unique UNIQUE(id)",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_a_test1_id FOREIGN KEY (a) REFERENCES test1(id)",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_b_test1_id FOREIGN KEY (b) REFERENCES test1(id)",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_c_test1_id FOREIGN KEY (c) REFERENCES test1(id)",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_d_test1_id FOREIGN KEY (d) REFERENCES test1(id) ON DELETE CASCADE",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_e_test1_id FOREIGN KEY (e) REFERENCES test1(id) ON UPDATE RESTRICT",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_f_test1_id FOREIGN KEY (f) REFERENCES test1(id) ON DELETE SET DEFAULT ON UPDATE SET NULL",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_g_test1_id FOREIGN KEY (g) REFERENCES test1(id)",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_h_test1_id FOREIGN KEY (h) REFERENCES test1(id) ON DELETE CASCADE ON UPDATE SET NULL"
  ],
  sync_foreign_keys_4: [
    "ALTER TABLE test2 DROP CONSTRAINT fkey_a_test1_id CASCADE",
    "ALTER TABLE test2 DROP CONSTRAINT fkey_b_test1_id CASCADE",
    "ALTER TABLE test2 DROP CONSTRAINT fkey_c_test1_id CASCADE",
    "ALTER TABLE test2 DROP CONSTRAINT fkey_d_test1_id CASCADE",
    "ALTER TABLE test2 DROP CONSTRAINT fkey_e_test1_id CASCADE",
    "ALTER TABLE test2 DROP CONSTRAINT fkey_f_test1_id CASCADE",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_a_test1_id FOREIGN KEY (a) REFERENCES test1(id) ON DELETE CASCADE",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_b_test1_id FOREIGN KEY (b) REFERENCES test1(id) ON UPDATE RESTRICT",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_c_test1_id FOREIGN KEY (c) REFERENCES test1(id) ON DELETE SET DEFAULT ON UPDATE SET NULL",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_d_test1_id FOREIGN KEY (d) REFERENCES test1(id)",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_e_test1_id FOREIGN KEY (e) REFERENCES test1(id)",
    "ALTER TABLE test2 ADD CONSTRAINT fkey_f_test1_id FOREIGN KEY (f) REFERENCES test1(id)"
  ],
  sync_index_1: [
    "CREATE SEQUENCE test1_id_seq",
    "CREATE TABLE test1 ()",
    "ALTER TABLE test1 ADD COLUMN id INTEGER",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test1 ADD COLUMN a INTEGER",
    "ALTER TABLE test1 ADD COLUMN b BIGINT",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)",
    "CREATE INDEX ia ON test1 USING btree (a)"
  ],
  sync_index_2:   ["CREATE INDEX ib ON test1 USING btree (a, b)"],
  sync_index_3:   ["DROP INDEX ia", "DROP INDEX ib", "CREATE INDEX ia ON test1 USING hash (a)", "CREATE UNIQUE INDEX ib ON test1 USING btree (a, b)"],
  sync_index_4:   ["DROP INDEX ia", "DROP INDEX ib", "CREATE INDEX ia ON test1 USING btree (a, b)", "CREATE UNIQUE INDEX ib ON test1 USING btree (b, a)"],
  types_datetime: [
    "CREATE SEQUENCE test1_id_seq",
    "CREATE TABLE test1 ()",
    "ALTER TABLE test1 ADD COLUMN id INTEGER",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test1 ADD COLUMN a TIMESTAMP (3) WITH TIME ZONE",
    "ALTER TABLE test1 ADD COLUMN b TIMESTAMP (3) WITH TIME ZONE",
    "ALTER TABLE test1 ADD COLUMN c VARCHAR",
    "ALTER TABLE test1 ADD COLUMN d TIMESTAMP (3) WITH TIME ZONE",
    "ALTER TABLE test1 ADD COLUMN e INTEGER",
    "ALTER TABLE test1 ADD COLUMN f TIMESTAMP (3) WITH TIME ZONE",
    "ALTER TABLE test1 ALTER COLUMN f SET DEFAULT '1976-01-23 14:00:00.000+00'",
    "ALTER TABLE test1 ALTER COLUMN f SET NOT NULL",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)"
  ],
  types_datetime_changes: [
    "ALTER TABLE test1 DROP COLUMN f",
    "ALTER TABLE test1 ALTER COLUMN a TYPE TIMESTAMP (3) WITH TIME ZONE",
    "ALTER TABLE test1 ALTER COLUMN b TYPE VARCHAR",
    "ALTER TABLE test1 ALTER COLUMN c TYPE TIMESTAMP (3) WITH TIME ZONE USING c::TIMESTAMP (3) WITH TIME ZONE",
    "ALTER TABLE test1 DROP COLUMN d",
    "ALTER TABLE test1 ADD COLUMN d BIGINT",
    "ALTER TABLE test1 DROP COLUMN e",
    "ALTER TABLE test1 ADD COLUMN e TIMESTAMP (3) WITH TIME ZONE"
  ],
  types_int: [
    "CREATE SEQUENCE test1_id_seq",
    "CREATE TABLE test1 ()",
    "ALTER TABLE test1 ADD COLUMN id INTEGER",
    "ALTER TABLE test1 ALTER COLUMN id SET NOT NULL",
    "ALTER TABLE test1 ADD COLUMN a VARCHAR(23)",
    "ALTER TABLE test1 ADD COLUMN b VARCHAR(23)",
    "ALTER TABLE test1 ADD COLUMN c VARCHAR",
    "ALTER TABLE test1 ADD COLUMN d VARCHAR(23)",
    "ALTER TABLE test1 ADD COLUMN e VARCHAR",
    "ALTER TABLE test1 ALTER COLUMN e SET DEFAULT '23'",
    "ALTER TABLE test1 ALTER COLUMN e SET NOT NULL",
    "ALTER TABLE test1 ADD COLUMN f VARCHAR",
    "ALTER TABLE test1 ALTER COLUMN f SET DEFAULT '23'",
    "ALTER TABLE test1 ALTER COLUMN f SET NOT NULL",
    "ALTER SEQUENCE test1_id_seq OWNED BY test1.id",
    "ALTER TABLE test1 ADD CONSTRAINT test1_id_unique UNIQUE(id)"
  ],
  types_int_change: [
    "ALTER TABLE test1 ALTER COLUMN a TYPE INTEGER USING a::INTEGER",
    "ALTER TABLE test1 ALTER COLUMN b TYPE VARCHAR",
    "ALTER TABLE test1 ALTER COLUMN c TYPE VARCHAR(23)",
    "ALTER TABLE test1 ALTER COLUMN d TYPE VARCHAR(42)",
    "ALTER TABLE test1 ALTER COLUMN e SET DEFAULT '42'",
    "UPDATE test1 SET e = '42' WHERE e IS NULL"
  ]
};

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
  sync_create_table:               ["CREATE SEQUENCE test1s_id_seq", "CREATE TABLE test1s ()"],
  sync_create_table_exists:        [""],
  sync_create_table_parent:        ["CREATE TABLE test3s () INHERITS (test1s)"],
  sync_create_table_parent_add:    ["DROP TABLE test3s CASCADE", "CREATE TABLE test3s () INHERITS (test1s)"],
  sync_create_table_parent_change: ["DROP TABLE test3s CASCADE", "CREATE TABLE test3s () INHERITS (test2s)"],
  sync_create_table_parent_remove: ["CREATE SEQUENCE test3s_id_seq", "DROP TABLE test3s CASCADE", "CREATE TABLE test3s ()"],
  sync_create_table_pk:            ["CREATE TABLE test2s ()"]
};

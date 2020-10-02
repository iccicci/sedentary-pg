import { Pool, PoolConfig } from "pg";
import { DB as DB_ } from "sedentary/src/db";

export class DB extends DB_ {
  private pg: Pool;

  constructor(connection: PoolConfig) {
    super("");
    this.pg = new Pool(connection);
  }

  async connect(): Promise<void> {
    const client = await this.pg.connect();
    client.release();
  }

  async end(): Promise<void> {
    await this.pg.end();
  }
}

import { SchemaOptions, Sedentary } from "sedentary";
import { PoolConfig } from "pg";

import { PGDB } from "./lib/pgdb";

export class SedentaryPG extends Sedentary {
  constructor(connection: PoolConfig, options?: SchemaOptions) {
    super("", options);
    this.db = new PGDB(connection, this.log);
  }
}

export const Package = SedentaryPG;

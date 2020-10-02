import { SchemaOptions, Sedentary } from "sedentary";
import { PoolConfig } from "pg";

import { DB } from "./src/db";

export class SedentaryPG extends Sedentary {
  constructor(connection: PoolConfig, options?: SchemaOptions) {
    super("", options);
    this.db = new DB(connection);
  }
}

export const Package = SedentaryPG;

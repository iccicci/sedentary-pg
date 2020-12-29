import { SchemaOptions, Sedentary } from "sedentary";
import { PoolConfig } from "pg";

import { PGDB } from "./lib/pgdb";

export class SedentaryPG extends Sedentary {
  constructor(connection: PoolConfig, options?: SchemaOptions) {
    super("", options);

    if(! (connection instanceof Object)) throw new Error("SedentaryPG.constructor: 'connection' argument: Wrong type, expected 'Object'");

    this.db = new PGDB(connection, this.log);
  }
}

export const Package = SedentaryPG;

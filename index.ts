import { Entry, Natural, SedentaryOptions, Sedentary, Type } from "sedentary";
import { PoolConfig } from "pg";

import { PGDB } from "./lib/pgdb";

export { AttributeDefinition, AttributeOptions, AttributesDefinition, Entry, IndexAttributes, IndexDefinition, IndexOptions } from "sedentary";
export { ModelOptions, Natural, SedentaryOptions, Type, TypeDefinition } from "sedentary";

export class SedentaryPG extends Sedentary {
  constructor(connection: PoolConfig, options?: SedentaryOptions) {
    super("", options);

    if(! (connection instanceof Object)) throw new Error("SedentaryPG.constructor: 'connection' argument: Wrong type, expected 'Object'");

    this.db = new PGDB(connection, this.log);
  }

  FKEY<N extends Natural, E extends Entry>(attribute: Type<N, E>): Type<N, E> {
    const { attributeName, tableName, unique } = attribute as never;

    if(! unique) throw new Error(`Sedentary.FKEY: '${tableName}' table: '${attributeName}' attribute: is not unique: can't be used as FKEY target`);

    return super.FKEY(attribute);
  }
}

export const Package = SedentaryPG;

import { EntryBase, ForeignKeyOptions, Natural, Sedentary, SedentaryOptions, Type } from "sedentary";
import { PoolConfig } from "pg";

import { PGDB } from "./lib/pgdb";

export { EntryBase, SedentaryOptions } from "sedentary";

export class SedentaryPG extends Sedentary {
  constructor(connection: PoolConfig, options?: SedentaryOptions) {
    super("", options);

    if(! (connection instanceof Object)) throw new Error("SedentaryPG.constructor: 'connection' argument: Wrong type, expected 'Object'");

    this.db = new PGDB(connection, this.log);
  }

  FKEY<N extends Natural, E extends EntryBase>(attribute: Type<N, E>, options?: ForeignKeyOptions): Type<N, E> {
    const { attributeName, modelName, unique } = attribute as never;

    if(! unique) throw new Error(`Sedentary.FKEY: '${modelName}' model: '${attributeName}' attribute: is not unique: can't be used as FKEY target`);

    return super.FKEY(attribute, options);
  }
}

export const Package = SedentaryPG;

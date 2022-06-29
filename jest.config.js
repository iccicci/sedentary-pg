/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  collectCoverageFrom:    ["index.ts", "pgdb.ts"],
  preset:                 "ts-jest",
  testEnvironment:        "jest-environment-node-single-context",
  testPathIgnorePatterns: ["/node_modules/"],
  testSequencer:          "../testSequencer.js"
};

export function adsrc(version: number) {
  return version >= 12 ? "pg_get_expr(pg_attrdef.adbin, pg_attrdef.adrelid) AS adsrc" : "adsrc";
}

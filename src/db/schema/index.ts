/**
 * The full schema. Import tables from here, not from the individual files,
 * so that drizzle-kit and the query client see one consistent surface.
 */

export * from "./enums"
export * from "./auth"
export * from "./contacts"
export * from "./catalogue"
export * from "./enrollment"
export * from "./ops"
export * from "./messaging"

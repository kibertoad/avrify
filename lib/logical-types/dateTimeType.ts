import { types as avroTypes } from 'avsc'

// This logical type will accept a string, and encode as millis, and decode to string.
export class IsoDateTimeStringMillis extends avroTypes.LogicalType {
  override _fromValue(val: number): string {
    // Avro gives us millis -> output ISO string
    return new Date(val).toISOString()
  }
  override _toValue(val: unknown): number {
    // Incoming: string or Date, output: millis
    if (typeof val === 'string') {
      const millis = Date.parse(val)
      if (Number.isNaN(millis)) throw new Error(`Invalid ISO date: ${val}`)
      return millis
    }
    if (val instanceof Date) return val.getTime()
    throw new Error(`Invalid value for timestamp-millis: ${val}`)
  }
  // Optionally: `_resolve` and `_export` if you want advanced compatibility features
}

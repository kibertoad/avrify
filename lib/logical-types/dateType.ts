import { types } from 'avsc'

/**
 * Value is the number of days since the Unix epoch (1970-01-01).
 */
export class IsoDateStringDays extends types.LogicalType {
  override _fromValue(val: unknown) {
    // Avro int → JS Date (UTC, no time part)
    if (typeof val === 'number') {
      // Days since epoch
      const ms = val * 86400000
      const date = new Date(ms)
      // Return as YYYY-MM-DD
      return date.toISOString().slice(0, 10)
    }
    return val
  }
  override _toValue(val: unknown) {
    // Accept ISO string, output days since epoch
    if (typeof val === 'string') {
      const ms = Date.parse(`${val}T00:00:00Z`)
      if (Number.isNaN(ms)) throw new Error(`Invalid date string: ${val}`)
      return Math.floor(ms / 86400000)
    }
    if (val instanceof Date) {
      return Math.floor(val.getTime() / 86400000)
    }
    throw new Error('Expected ISO date string or Date for logicalType: date')
  }
}

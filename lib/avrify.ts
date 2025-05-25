import type { Schema } from 'avsc'
import type { ZodObject, ZodTypeAny, ZodUnion } from 'zod'
import { sanitizeAvroFieldName, toPascalCaseAvroName } from './nameUtils.js'

export interface ZodToAvroConfig {
  topLevelName: string
  nameFieldMap?: Record<string, string>
  autoGenerateRecordName?: boolean
}

interface AvroContext {
  name?: string
  path?: string[]
  fieldName?: string
  recordNameCounter: { value: number }
}

export interface AvroRecordType {
  type: 'record'
  name: string
  namespace?: string
  doc?: string
  aliases?: string[]
  fields: AvroField[]
}

export interface AvroField {
  name: string
  type: Schema
  default?: unknown
  [key: string]: unknown
}

function pickAvroName(
  atTopLevel: boolean,
  config: ZodToAvroConfig,
  ctx: AvroContext,
  mappedName?: string,
  fallback?: string,
): string {
  if (atTopLevel) return config.topLevelName
  if (mappedName) return mappedName
  if (ctx?.name) return sanitizeAvroFieldName(ctx.name)
  if (fallback) return fallback
  return 'Anonymous'
}

function ensureNonUnionForArrayItem(item: unknown, contextMsg = "Avro array 'items'"): Schema {
  if (Array.isArray(item)) {
    throw new Error(`${contextMsg} cannot be a union type: ${JSON.stringify(item)}`)
  }
  return item as Schema
}

type AvroHandler = (
  zodSchema: ZodTypeAny,
  config: ZodToAvroConfig,
  ctx: AvroContext,
  atTopLevel: boolean,
) => Schema | Schema[]

const zodTypeHandlers: Record<string, AvroHandler> = {
  ZodString: () => 'string',
  ZodNumber: (schema) => {
    const def = schema._def
    if (def.checks) {
      for (const check of def.checks) {
        if (check.kind === 'int') return 'int'
      }
    }
    return 'double'
  },
  ZodBoolean: () => 'boolean',

  ZodEnum: (schema, config, ctx, atTopLevel) => {
    const def = schema._def
    const path = ctx?.path ? [...ctx.path] : []
    if (!atTopLevel && ctx?.fieldName) path.push(ctx.fieldName)
    let mappedName: string | undefined
    if (config?.nameFieldMap) {
      const pathStr = path.join('.')
      mappedName = config.nameFieldMap[pathStr]
    }
    const name = pickAvroName(atTopLevel, config, ctx, mappedName, 'Enum')
    return { type: 'enum', name, symbols: def.values }
  },

  ZodLiteral: (schema, config, ctx, atTopLevel) => {
    const def = schema._def
    const path = ctx?.path ? [...ctx.path] : []
    if (!atTopLevel && ctx?.fieldName) path.push(ctx.fieldName)
    let mappedName: string | undefined
    if (config?.nameFieldMap) {
      const pathStr = path.join('.')
      mappedName = config.nameFieldMap[pathStr]
    }
    const name = pickAvroName(atTopLevel, config, ctx, mappedName, 'Literal')
    return { type: 'enum', name, symbols: [def.value] }
  },

  ZodArray: (schema, config, ctx, _atTopLevel) => {
    const def = schema._def
    const itemType = zodToAvro(def.type, config, ctx, false)
    return { type: 'array', items: ensureNonUnionForArrayItem(itemType, "Array 'items'") }
  },

  ZodObject: (schema, config, ctx, atTopLevel) => {
    const def = schema._def
    const path = ctx?.path ? ctx.path : []
    const currentPath = [...path]
    if (!atTopLevel && ctx?.fieldName) currentPath.push(ctx.fieldName)

    let mappedName: string | undefined
    if (config?.nameFieldMap) {
      const pathStr = currentPath.join('.')
      mappedName = config.nameFieldMap[pathStr]
    }

    const autoGen = config.autoGenerateRecordName !== false
    let generatedName: string | undefined

    if (autoGen && ctx?.fieldName) {
      generatedName = toPascalCaseAvroName(ctx.fieldName)
    } else if (!autoGen) {
      // Anonymous, always increment
      generatedName = `Anonymous${ctx.recordNameCounter.value++}`
    }

    const recordName = pickAvroName(atTopLevel, config, ctx, mappedName, generatedName)

    const fields: AvroField[] = Object.entries(def.shape()).map(([key, value]) => {
      // Generate the Avro type for this field
      const fieldType = zodToAvro(
        value as ZodTypeAny,
        config,
        {
          path: currentPath,
          fieldName: key,
          recordNameCounter: ctx.recordNameCounter,
        },
        false,
      ) as Schema

      // Add default: null if this is an optional/nullable field
      if (Array.isArray(fieldType) && fieldType[0] === 'null') {
        return { name: sanitizeAvroFieldName(key), type: fieldType, default: null }
      }

      return { name: sanitizeAvroFieldName(key), type: fieldType }
    })

    return { type: 'record', name: recordName, fields }
  },

  ZodOptional: (schema, config, ctx, _atTopLevel) => {
    const def = schema._def
    const inner = zodToAvro(def.innerType, config, ctx, false)
    return ['null', ...(Array.isArray(inner) ? inner : [inner])]
  },
  ZodNullable: (schema, config, ctx, _atTopLevel) => {
    const def = schema._def
    const inner = zodToAvro(def.innerType, config, ctx, false)
    return ['null', ...(Array.isArray(inner) ? inner : [inner])]
  },
  ZodUnion: (schema, config, ctx, _atTopLevel) => {
    const def = schema._def
    const avroTypes = def.options.map((opt: ZodTypeAny) => zodToAvro(opt, config, ctx, false))
    return avroTypes.flat()
  },
}

/**
 * Recursively normalizes Avro field types by unwrapping simple types.
 *
 * - If an Avro type is an object with only a single key `type` whose value is a string (e.g. `{ type: "int" }`),
 *   this function converts it to the string itself (`"int"`).
 * - Complex objects (e.g. enums, records, logical types, or types with constraints or multiple properties)
 *   are left as objects to preserve important metadata.
 * - Arrays are traversed recursively, ensuring all elements are normalized.
 * - This helps produce Avro schemas that are as concise and canonical as possible.
 *
 * @param {unknown} avroType - The Avro type or schema to normalize.
 * @returns {unknown} - The normalized Avro type/schema, with simple types unwrapped to strings where possible.
 */
function cleanAvroType(avroType: unknown): unknown {
  if (Array.isArray(avroType)) {
    return avroType.map(cleanAvroType)
  }
  if (typeof avroType === 'object' && avroType !== null) {
    const cleaned: Record<string, unknown> = {}
    for (const key in avroType as Record<string, unknown>) {
      cleaned[key] = cleanAvroType((avroType as Record<string, unknown>)[key])
    }
    return cleaned
  }
  return avroType
}

export function zodToAvro<
  TTopLevel extends boolean = true,
  TSchema extends ZodTypeAny = ZodTypeAny,
  // biome-ignore lint/suspicious/noExplicitAny : we do not care
  TIsUnion extends boolean = TSchema extends ZodUnion<any> ? true : false,
  // biome-ignore lint/suspicious/noExplicitAny : we do not care
  TIsObject extends boolean = TSchema extends ZodObject<any> ? true : false,
>(
  zodSchema: TSchema,
  config: ZodToAvroConfig & {
    isUnionType?: TIsUnion
    isObjectType?: TIsObject
  },
  context: AvroContext = { recordNameCounter: { value: 0 } },
  atTopLevel: TTopLevel = true as TTopLevel,
): TIsObject extends true
  ? AvroRecordType
  : TIsUnion extends true
    ? TTopLevel extends true
      ? { type: Schema[] }
      : Schema[]
    : TTopLevel extends true
      ? { type: Schema }
      : Schema {
  if (config.topLevelName === undefined) {
    throw new Error('config.topLevelName is required')
  }
  const typeName = zodSchema._def.typeName
  const handler = zodTypeHandlers[typeName]
  if (!handler) throw new Error(`Unsupported Zod schema type: ${typeName}`)
  const rawAvro = handler(zodSchema, config, context, atTopLevel)
  const cleaned = cleanAvroType(rawAvro)

  if (atTopLevel) {
    if (
      typeof cleaned === 'object' &&
      cleaned !== null &&
      typeof (cleaned as AvroRecordType).type === 'string'
    ) {
      // @ts-expect-error - it is safe
      return cleaned as Schema
    }
    // @ts-expect-error - it is safe
    return { type: cleaned }
  }

  // @ts-expect-error - it is safe
  return cleaned
}

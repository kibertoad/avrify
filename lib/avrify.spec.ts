import { describe, expect, it } from 'vitest'
import { z } from 'zod'
// Import your `zodToAvro` function from `avrify.ts`
import { type AvroField, type AvroRecordType, zodToAvro } from './avrify.ts'

describe('avrify', () => {
  describe('zodToAvro', () => {
    it('should convert a Zod string schema to an Avro string schema', () => {
      const schema = z.string()
      const result = zodToAvro(schema, {
        topLevelName: 'MyRecord',
      })

      // for primitive types top level name is not used
      expect(result).toMatchInlineSnapshot(`
        {
          "type": "string",
        }
      `)
    })

    it('should convert a Zod integer schema to an Avro int schema', () => {
      const schema = z.number().int() // Explicitly define an integer schema
      const result = zodToAvro(schema, {
        topLevelName: 'MyRecord',
      })

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "int",
        }
      `)
    })

    it('should convert a Zod floating-point number schema to an Avro double schema', () => {
      const schema = z.number() // General number maps to double
      const result = zodToAvro(schema, {
        topLevelName: 'MyRecord',
      })

      expect(result).toMatchInlineSnapshot(`
        {
          "type": "double",
        }
      `)
    })

    it('should convert a Zod object schema to an Avro record schema', () => {
      const schema = z.object({
        id: z.number().int(), // Explicitly an integer
        name: z.string(),
        isActive: z.boolean(),
      })

      const result = zodToAvro(schema, {
        topLevelName: 'MyRecord',
      })

      expect(result).toEqual({
        type: 'record',
        name: 'MyRecord',
        fields: [
          { name: 'id', type: 'int' },
          { name: 'name', type: 'string' },
          { name: 'isActive', type: 'boolean' },
        ],
      })
    })

    it('should convert a Zod array schema to an Avro array schema', () => {
      const schema = z.array(z.string())
      const result = zodToAvro(schema, {
        topLevelName: 'MyRecord',
      })

      expect(result).toEqual({
        type: 'array',
        items: 'string',
      })
    })

    it('should convert a Zod optional schema to a nullable Avro field', () => {
      const schema = z.string().optional()
      const result = zodToAvro(schema, {
        topLevelName: 'MyRecord',
      })

      expect(result).toEqual({
        type: ['null', 'string'],
      })
    })

    it('should convert a Zod nullable schema to a nullable Avro field', () => {
      const schema = z.string().nullable()
      const result = zodToAvro(schema, {
        topLevelName: 'MyRecord',
      })

      expect(result).toEqual({
        type: ['null', 'string'],
      })
    })

    it('should convert a Zod union schema to an Avro union schema', () => {
      const schema = z.union([z.string(), z.number().int()]) // Union of string and integer
      const result = zodToAvro(schema, {
        topLevelName: 'MyRecord',
      })

      expect(result).toEqual({
        type: ['string', 'int'],
      })
    })

    it('should throw an error for unsupported Zod schemas', () => {
      const schema = z.function(z.tuple([]), z.string()) // Zod function schema

      expect(() =>
        zodToAvro(schema, {
          topLevelName: 'MyRecord',
        }),
      ).toThrow('Unsupported Zod schema type: ZodFunction')
    })

    it('should convert deeply nested Zod object schemas', () => {
      const schema = z.object({
        id: z.number().int(),
        name: z.string(),
        address: z.object({
          street: z.string(),
          city: z.string(),
          postalCode: z.number().int(),
        }),
      })

      const result = zodToAvro(schema, {
        topLevelName: 'MyRecord',
      })

      expect(result).toMatchInlineSnapshot(`
        {
          "fields": [
            {
              "name": "id",
              "type": "int",
            },
            {
              "name": "name",
              "type": "string",
            },
            {
              "name": "address",
              "type": {
                "fields": [
                  {
                    "name": "street",
                    "type": "string",
                  },
                  {
                    "name": "city",
                    "type": "string",
                  },
                  {
                    "name": "postalCode",
                    "type": "int",
                  },
                ],
                "name": "Address",
                "type": "record",
              },
            },
          ],
          "name": "MyRecord",
          "type": "record",
        }
      `)
    })

    it('should not flatten named nested records, but flatten anonymous ones', () => {
      // Nested record schema, with one named and one anonymous
      const schema = z.object({
        user: z.object({
          id: z.number().int(),
          // This should be anonymous, so will be flattened
          info: z.object({
            email: z.string(),
            age: z.number().int(),
          }),
          // This will be named, so should NOT be flattened
          address: z.object({
            street: z.string(),
            city: z.string(),
            zip: z.string(),
          }),
        }),
      })

      // Name the nested address record only
      const avro = zodToAvro(
        schema,
        {
          topLevelName: 'MyRecord',
          nameFieldMap: {
            'user.address': 'UserAddress',
          },
        },
        {},
        true,
      )

      expect(avro).toMatchInlineSnapshot(`
        {
          "fields": [
            {
              "name": "user",
              "type": {
                "fields": [
                  {
                    "name": "id",
                    "type": "int",
                  },
                  {
                    "name": "info",
                    "type": {
                      "fields": [
                        {
                          "name": "email",
                          "type": "string",
                        },
                        {
                          "name": "age",
                          "type": "int",
                        },
                      ],
                      "name": "Info",
                      "type": "record",
                    },
                  },
                  {
                    "name": "address",
                    "type": {
                      "fields": [
                        {
                          "name": "street",
                          "type": "string",
                        },
                        {
                          "name": "city",
                          "type": "string",
                        },
                        {
                          "name": "zip",
                          "type": "string",
                        },
                      ],
                      "name": "UserAddress",
                      "type": "record",
                    },
                  },
                ],
                "name": "User",
                "type": "record",
              },
            },
          ],
          "name": "MyRecord",
          "type": "record",
        }
      `)
    })

    it('should handle nullable nested fields in an object schema', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().nullable(),
      })

      const result = zodToAvro(schema, {
        topLevelName: 'MyRecord',
      })

      expect(result).toEqual({
        type: 'record',
        name: 'MyRecord',
        fields: [
          { name: 'name', type: 'string' },
          { name: 'email', type: ['null', 'string'] },
        ],
      })
    })
  })

  it('should throw for unsupported Zod types', () => {
    // This will hit the error branch in zodToAvro if not handled
    // If you support z.any(), replace with another unsupported type
    const schema: any = { _def: { typeName: 'ZodNever' } }
    expect(() => zodToAvro(schema, { topLevelName: 'MyRecord' })).toThrow(
      'Unsupported Zod schema type: ZodNever',
    )
  })

  it('should not use context.name for root object name if no mapped name exists', () => {
    const schema = z.object({
      a: z.string(),
    })

    // Provide context with name, but no matching mapping in config
    const result = zodToAvro(schema, { topLevelName: 'MyRecord' }, { name: 'MyObj' })

    expect(result).toEqual({
      type: 'record',
      name: 'MyRecord',
      fields: [{ name: 'a', type: 'string' }],
    })
  })

  it('should handle a nested ZodEnum with path and fieldName', () => {
    const schema = z.object({
      status: z.enum(['ON', 'OFF']),
    })
    // Map using the "status" field
    const result = zodToAvro(
      schema,
      {
        topLevelName: 'MyRecord',
        nameFieldMap: { status: 'StatusEnum' },
      },
      {},
      true,
    )
    expect(result).toEqual({
      type: 'record',
      name: 'MyRecord',
      fields: [
        {
          name: 'status',
          type: {
            type: 'enum',
            name: 'StatusEnum',
            symbols: ['ON', 'OFF'],
          },
        },
      ],
    })
  })

  it('should handle a nested ZodLiteral with path and fieldName', () => {
    const schema = z.object({
      flag: z.literal('YES'),
    })
    // Map using the "flag" field
    const result = zodToAvro(
      schema,
      {
        topLevelName: 'MyRecord',
        nameFieldMap: { flag: 'FlagLiteral' },
      },
      {},
      true,
    )

    expect(result).toEqual({
      type: 'record',
      name: 'MyRecord',
      fields: [
        {
          name: 'flag',
          type: {
            type: 'enum',
            name: 'FlagLiteral',
            symbols: ['YES'],
          },
        },
      ],
    })
  })

  // --- 1. Error: Missing topLevelName
  it('throws if config.topLevelName is missing', () => {
    expect(() => zodToAvro(z.string(), {} as any)).toThrow(/topLevelName/)
  })

  // --- 2. Error: Unsupported Zod type
  it('throws if unsupported Zod type is used', () => {
    expect(() =>
      zodToAvro(z.function(z.tuple([]), z.string()), { topLevelName: 'MyRecord' }),
    ).toThrow(/Unsupported Zod schema type/)
  })

  // --- 3. ZodNumber branches for int/double
  it('should handle ZodNumber .int()', () => {
    expect(zodToAvro(z.number().int(), { topLevelName: 'Num' })).toEqual({ type: 'int' })
  })

  it('should handle ZodNumber default (double)', () => {
    expect(zodToAvro(z.number(), { topLevelName: 'Num' })).toEqual({ type: 'double' })
  })

  it('should use context name for nested enum', () => {
    // Set context for nested: pass through by manually calling zodToAvro for just enum
    const avro = zodToAvro(z.enum(['X', 'Y']), { topLevelName: 'Top' }, { name: 'CtxEnum' }, false)
    expect(avro).toMatchObject({ type: 'enum', name: 'CtxEnum', symbols: ['X', 'Y'] })
  })

  it('should use fallback for nested enum', () => {
    const avro = zodToAvro(z.enum(['X']), { topLevelName: 'Top' }, {}, false)
    expect(avro).toMatchObject({ type: 'enum', name: 'Enum', symbols: ['X'] })
  })

  it('should use context name for nested literal', () => {
    const avro = zodToAvro(z.literal('foo'), { topLevelName: 'Top' }, { name: 'CtxLit' }, false)
    expect(avro).toMatchObject({ type: 'enum', name: 'CtxLit', symbols: ['foo'] })
  })

  it('should use fallback for nested literal', () => {
    const avro = zodToAvro(z.literal('foo'), { topLevelName: 'Top' }, {}, false)
    expect(avro).toMatchObject({ type: 'enum', name: 'Literal', symbols: ['foo'] })
  })

  // --- 6. ZodArray - union item should error
  it('throws if ZodArray items is a union', () => {
    expect(() =>
      zodToAvro(z.array(z.union([z.string(), z.number()])), { topLevelName: 'Arr' }),
    ).toThrow(/cannot be a union type/)
  })

  it('should use context.name for nested object', () => {
    const avro = zodToAvro(
      z.object({ x: z.string() }),
      { topLevelName: 'Top' },
      { name: 'CtxObj' },
      false,
    )
    expect(avro).toMatchObject({ name: 'CtxObj' })
  })

  // --- 8. ZodObject - fallback to anonymous
  it('should fallback to anonymous name', () => {
    const schema = z.object({ foo: z.string() })
    const avro = zodToAvro(schema, { topLevelName: 'T', autoGenerateRecordName: false }, {}, false)
    expect(avro).toMatchObject({ name: /AnonymousRecord\d+/ })
  })

  // --- 10. ZodOptional/ZodNullable/ZodUnion coverage
  it('should handle optional, nullable, and union', () => {
    const opt = z.string().optional()
    expect(zodToAvro(opt, { topLevelName: 'Top' })).toEqual({ type: ['null', 'string'] })
    const nul = z.string().nullable()
    expect(zodToAvro(nul, { topLevelName: 'Top' })).toEqual({ type: ['null', 'string'] })

    const union = z.union([z.string(), z.number().int()])
    expect(zodToAvro(union, { topLevelName: 'Top' })).toEqual({ type: ['string', 'int'] })
  })

  it('toPascalCase handles special characters', () => {
    const schema = z.object({ 'foo_bar-baz!': z.string() })
    const avro = zodToAvro(schema, { topLevelName: 'Top' })
    const nested = avro.fields.find((f: any) => f.name === 'foo_bar-baz!')

    expect(nested?.type).toBe('string')
  })

  it('pickAvroName uses topLevelName even if context.name is present', () => {
    const schema = z.object({ x: z.string() })
    const avro = zodToAvro(schema, { topLevelName: 'Top' }, { name: 'FromContext' })
    expect(avro).toMatchInlineSnapshot(`
      {
        "fields": [
          {
            "name": "x",
            "type": "string",
          },
        ],
        "name": "Top",
        "type": "record",
      }
    `)
  })

  it('pickAvroName uses fallback if no name or map', () => {
    const inner = z.object({ foo: z.string() })
    const schema = z.object({ inner })
    const avro = zodToAvro(schema, { topLevelName: 'Top' })
    const nested = avro.fields.find((f: any) => f.name === 'inner')?.type as AvroRecordType
    expect(nested.name).toBe('Inner')
  })

  it('pickAvroName returns Anonymous if no fallbacks apply', () => {
    const schema = z.object({})
    const result = zodToAvro(schema, { topLevelName: 'Top' }, {}, false)
    expect(result.name).toBe('Anonymous')
  })

  it('cleanAvroType unwraps if object has only type', () => {
    const schema = z.string()
    const result = zodToAvro(schema, { topLevelName: 'Top' })
    expect(result.type).toBe('string')
  })

  it('cleanAvroType keeps object if multiple keys', () => {
    const schema = z.enum(['A', 'B'])
    const result = zodToAvro(
      schema,
      {
        topLevelName: 'Top',
        nameFieldMap: { foo: 'MyEnum' },
      },
      { path: ['foo'] },
    ) as any
    expect(result).toMatchInlineSnapshot(`
      {
        "name": "Top",
        "symbols": [
          "A",
          "B",
        ],
        "type": "enum",
      }
    `)
  })

  it('zodToAvro returns raw schema for union types', () => {
    const union = z.union([z.string(), z.number()])
    const result = zodToAvro(union, { topLevelName: 'U' })
    expect(result).toMatchInlineSnapshot(`
      {
        "type": [
          "string",
          "double",
        ],
      }
    `)
  })

  it('zodToAvro returns cleaned primitive at top level', () => {
    const schema = z.string()
    const result = zodToAvro(schema, { topLevelName: 'T' })
    expect(result).toEqual({ type: 'string' })
  })

  it('zodToAvro returns wrapped object for complex top-level types', () => {
    const schema = z.object({ foo: z.string() })
    const result = zodToAvro(schema, { topLevelName: 'ComplexTop' })
    expect(result).toMatchInlineSnapshot(`
      {
        "fields": [
          {
            "name": "foo",
            "type": "string",
          },
        ],
        "name": "ComplexTop",
        "type": "record",
      }
    `)
  })

  it('zodToAvro does not wrap non-top-level schemas', () => {
    const inner = z.string()
    const result = zodToAvro(inner, { topLevelName: 'T' }, {}, false) as any
    expect(result).toBe('string')
  })

  it('auto-generates record name from currentPath if fieldName is not provided', () => {
    const schema = z.object({
      nested: z.object({
        deep: z.object({ val: z.string() }),
      }),
    })

    const result = zodToAvro(schema, { topLevelName: 'Top' })
    const nested = result.fields.find((f: any) => f.name === 'nested')?.type as AvroRecordType
    const deep = nested.fields.find((f: any) => f.name === 'deep')?.type as AvroRecordType

    expect(deep.name).toBe('Deep')
  })

  it('flattens anonymous nested record in fields', () => {
    const schema = z.object({
      anon: z.object({ a: z.string(), b: z.number() }),
    })

    // Prevent naming to ensure it's anonymous
    const avro = zodToAvro(schema, { topLevelName: 'Top', autoGenerateRecordName: false })

    const anonField = avro.fields.find((f: any) => f.name === 'anon')
    expect(anonField).toMatchInlineSnapshot(`
      {
        "name": "anon",
        "type": {
          "fields": [
            {
              "name": "a",
              "type": "string",
            },
            {
              "name": "b",
              "type": "double",
            },
          ],
          "name": "Anonymous1",
          "type": "record",
        },
      }
    `)
  })

  it('auto-generates record name from currentPath when fieldName is missing', () => {
    const schema = z.object({
      outer: z.object({
        inner: z.object({
          val: z.string(),
        }),
      }),
    })

    const avro = zodToAvro(schema, { topLevelName: 'Top' })
    const outerField = avro.fields.find((f: any) => f.name === 'outer')?.type as AvroRecordType
    const innerField = outerField?.fields.find((f: any) => f.name === 'inner')
      ?.type as AvroRecordType

    expect(innerField?.name).toBe('Inner') // <- triggers fallback to currentPath
  })

  it('flattens anonymous record without name key', () => {
    const schema = z.object({
      anon: z.object({ x: z.string() }),
    })

    const avro = zodToAvro(schema, { topLevelName: 'Top', autoGenerateRecordName: false })
    const field = avro.fields.find((f) => f.name === 'anon') as AvroField

    // It should flatten the anonymous record so that field.type is a record named 'Anonymous'
    expect((field.type as AvroRecordType).fields).toEqual([{ name: 'x', type: 'string' }])
    expect((field.type as AvroRecordType).name).toBe('Anonymous1')
  })

  it('gives unique names to multiple anonymous records', () => {
    const schema = z.object({
      foo: z.object({ x: z.string() }),
      bar: z.object({ y: z.string() }),
    })
    const avro = zodToAvro(schema, {
      topLevelName: 'Top',
      autoGenerateRecordName: false,
    }) as AvroRecordType

    const fooField = avro.fields.find((f) => f.name === 'foo')!
    const barField = avro.fields.find((f) => f.name === 'bar')!

    expect(fooField).toMatchInlineSnapshot(`
      {
        "name": "foo",
        "type": {
          "fields": [
            {
              "name": "x",
              "type": "string",
            },
          ],
          "name": "Anonymous1",
          "type": "record",
        },
      }
    `)
    expect(barField).toMatchInlineSnapshot(`
      {
        "name": "bar",
        "type": {
          "fields": [
            {
              "name": "y",
              "type": "string",
            },
          ],
          "name": "Anonymous2",
          "type": "record",
        },
      }
    `)
  })

  it('optional union produces ["null", "string", "int"]', () => {
    const schema = z.union([z.string(), z.number().int()]).optional()
    const result = zodToAvro(schema, { topLevelName: 'OptUnion' }, {}, false)
    expect(result).toEqual(['null', 'string', 'int'])
  })

  it('nullable union produces ["null", "string", "int"]', () => {
    const schema = z.union([z.string(), z.number().int()]).nullable()
    const result = zodToAvro(schema, { topLevelName: 'OptUnion' }, {}, false)
    expect(result).toEqual(['null', 'string', 'int'])
  })
})

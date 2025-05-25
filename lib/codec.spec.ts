import { Type } from 'avsc'
import { z } from 'zod'
import { zodToAvro } from './avrify.js'

describe('Coding and decoding with generated avro schemas', () => {
  it('should perform lossless conversion for flat schema', () => {
    const schema = z.object({
      id: z.number().int(),
      name: z.string(),
      active: z.boolean(),
    })

    // Generate Avro schema
    const avroSchema = zodToAvro(schema, { topLevelName: 'User' })

    // Get the "type" object for avsc
    const avroType = Type.forSchema(avroSchema)

    const value = { id: 5, name: 'Alice', active: true }

    // Encode and decode
    const buf = avroType.toBuffer(value)
    const decoded = avroType.fromBuffer(buf)

    // Data roundtrips
    expect(decoded).toEqual(value)
  })

  it('should fail validation for missing required fields', () => {
    const schema = z.object({
      id: z.number().int(),
      name: z.string(),
    })

    const avroSchema = zodToAvro(schema, { topLevelName: 'User' })
    const avroType = Type.forSchema(avroSchema)

    // Missing "name"
    const invalid = { id: 5 }

    expect(() => avroType.toBuffer(invalid)).toThrow()
  })

  it('should validate nested structures', () => {
    const schema = z.object({
      user: z.object({
        id: z.number(),
        profile: z.object({
          email: z.string(),
        }),
      }),
    })

    const avroSchema = zodToAvro(schema, { topLevelName: 'Wrapper' })
    const avroType = Type.forSchema(avroSchema)

    const valid = { user: { id: 42, profile: { email: 'me@test.com' } } }
    const buf = avroType.toBuffer(valid)
    const decoded = avroType.fromBuffer(buf)
    expect(decoded).toEqual(valid)

    // Invalid: profile missing
    const invalid = { user: { id: 1 } }
    expect(() => avroType.toBuffer(invalid)).toThrow()
  })

  it('should handle unions', () => {
    const schema = z.object({
      value: z.union([z.string(), z.number()]),
    })

    const avroSchema = zodToAvro(schema, { topLevelName: 'UnionTest' })
    const avroType = Type.forSchema(avroSchema)

    const valid1 = { value: 'hello' }
    const valid2 = { value: 42 }

    expect(avroType.fromBuffer(avroType.toBuffer(valid1))).toEqual(valid1)
    expect(avroType.fromBuffer(avroType.toBuffer(valid2))).toEqual(valid2)

    // Invalid: not matching the union
    const invalid = { value: true }
    expect(() => avroType.toBuffer(invalid)).toThrow()
  })

  it('should handle optional fields', () => {
    const schema = z.object({
      foo: z.string().optional(),
      bar: z.number(),
    })

    const avroSchema = zodToAvro(schema, { topLevelName: 'OptionalTest' })
    const avroType = Type.forSchema(avroSchema)

    const withFoo = { foo: 'yo', bar: 123 }
    const withoutFoo = { bar: 456 }

    expect(avroType.fromBuffer(avroType.toBuffer(withFoo))).toEqual(withFoo)
    expect(avroType.fromBuffer(avroType.toBuffer(withoutFoo))).toEqual({ foo: null, bar: 456 })

    // Invalid: missing required "bar"
    expect(() => avroType.toBuffer({ foo: 'hey' })).toThrow()
  })

  it('should reject values of wrong type', () => {
    const schema = z.object({
      score: z.number(),
    })
    const avroSchema = zodToAvro(schema, { topLevelName: 'RejectType' })
    const avroType = Type.forSchema(avroSchema)

    expect(() => avroType.toBuffer({ score: 'notANumber' })).toThrow()
  })
})

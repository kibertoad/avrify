import { describe } from 'vitest'
import { sanitizeAvroFieldName, toPascalCaseAvroName } from './nameUtils.js'

describe('nameUtils', () => {
  describe('toPascalCaseAvroName', () => {
    it('toPascalCaseAvroName returns "_" for input with only special characters', () => {
      expect(toPascalCaseAvroName('!!!')).toBe('_')
      expect(toPascalCaseAvroName('--__--')).toBe('_')
    })

    it('toPascalCaseAvroName prepends underscore for candidate starting with a digit', () => {
      expect(toPascalCaseAvroName('123hello')).toBe('_123Hello')
      expect(toPascalCaseAvroName('4foo_bar')).toBe('_4FooBar')
    })

    it('toPascalCaseAvroName returns normal PascalCase when input is valid', () => {
      expect(toPascalCaseAvroName('my_value')).toBe('MyValue')
      expect(toPascalCaseAvroName('alreadyPascal')).toBe('AlreadyPascal')
    })

    it('prepends underscore if final PascalCase is just digits (or digits and underscores)', () => {
      expect(toPascalCaseAvroName('123')).toBe('_123')
      expect(toPascalCaseAvroName('456__')).toBe('_456')
      expect(toPascalCaseAvroName('7__')).toBe('_7')
      expect(toPascalCaseAvroName('9')).toBe('_9')
    })
  })

  describe('sanitizeAvroFieldName', () => {
    it('prepends underscore if Avro field name does not start with a letter/underscore', () => {
      expect(sanitizeAvroFieldName('9fieldName')).toBe('_9fieldName')
      expect(sanitizeAvroFieldName('-notGood')).toBe('_notGood')
      expect(sanitizeAvroFieldName('_alreadyGood')).toBe('_alreadyGood')
      expect(sanitizeAvroFieldName('aOk')).toBe('aOk')
    })
  })
})

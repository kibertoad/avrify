# avrify
Zod-to-avro converter

## Basic usage

```ts
import { z } from 'zod'
import { zodToAvro } from 'avrify'

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
```

## Optional field handling

Optional fields are represented as `null` in Avro, so optional fields will have their defaults set to `null` in generated Avro schemas.

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

## Date handling

In case you would like to have automatic conversion between Zod z.string().datetime() to Avro long, as well as z.string().date() to Avro int, and vice-versa, you need to register extra logical types:

```ts
const avroDateTimeType = Type.forSchema(avroSchema, {
  logicalTypes: {
    // for datetime
    'timestamp-millis': IsoDateTimeStringMillis,
    // for date
    date: IsoDateStringDays
  }
});
```

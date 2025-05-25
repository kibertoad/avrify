// --- Cached regexes ---
const NON_ALPHANUMERIC_UNDERSCORE = /[^A-Za-z0-9_]/g
const NOT_LETTER_OR_UNDERSCORE = /^[A-Za-z_]/
const SPLIT_ON_SEPARATOR = /[\s_-]+/
const LEADING_DIGIT = /^[0-9]/
const TRAILING_NON_WORD = /[^\w]+$/g
const LEADING_DIGITS_AND_LETTER = /^([0-9]+)([a-zA-Z])/

/**
 * Sanitize a string for use as an Avro field name.
 * - Replaces all non-alphanumeric/underscore chars with '_'.
 * - Prepends '_' if the name doesn't start with a letter or underscore.
 */
export function sanitizeAvroFieldName(name: string): string {
  let sanitized = name.replace(NON_ALPHANUMERIC_UNDERSCORE, '_')
  if (!NOT_LETTER_OR_UNDERSCORE.test(sanitized)) sanitized = `_${sanitized}`
  return sanitized
}

/**
 * Convert a string to Avro-compliant PascalCase (for record/enum names).
 * - Removes all non-alphanumeric/underscore characters.
 * - Joins segments in PascalCase.
 * - Prepends '_' if the name would start with a digit or is empty.
 */
export function toPascalCaseAvroName(input: string): string {
  // Remove special chars, split into words
  const parts = input
    .replace(NON_ALPHANUMERIC_UNDERSCORE, ' ')
    .split(SPLIT_ON_SEPARATOR)
    .filter(Boolean)

  let candidate = parts.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('')

  // Find leading digits, preserve them, capitalize first real letter after them
  candidate = candidate.replace(
    LEADING_DIGITS_AND_LETTER,
    (_m, digits, char) => `_${digits}${char.toUpperCase()}`,
  )

  if (!candidate) candidate = '_'
  if (LEADING_DIGIT.test(candidate)) candidate = `_${candidate}`
  candidate = candidate.replace(TRAILING_NON_WORD, '')

  return candidate
}

/**
 * JSON Response Healing Utility
 * Based on OpenRouter's response healing capabilities
 * Automatically fixes malformed JSON responses from AI models
 */

export interface HealedResponse<T = any> {
  success: boolean
  data?: T
  original: string
  healed?: string
  errors?: string[]
  warnings?: string[]
}

export class JSONHealer {
  /**
   * Main healing function - attempts to fix malformed JSON
   */
  static heal<T = any>(input: string): HealedResponse<T> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Try parsing as-is first
      const parsed = JSON.parse(input)
      return {
        success: true,
        data: parsed,
        original: input,
      }
    } catch (error) {
      // JSON is malformed, attempt healing
      warnings.push('Original JSON was malformed, attempting to heal')
    }

    // Apply healing strategies in order
    let healed = input

    // 1. Extract from markdown code blocks
    healed = this.extractFromMarkdown(healed)

    // 2. Extract JSON from mixed text
    healed = this.extractJSONFromText(healed)

    // 3. Fix unquoted keys
    healed = this.fixUnquotedKeys(healed)

    // 4. Remove trailing commas
    healed = this.removeTrailingCommas(healed)

    // 5. Fix missing closing brackets
    healed = this.fixMissingBrackets(healed)

    // 6. Remove comments
    healed = this.removeComments(healed)

    // 7. Fix single quotes to double quotes
    healed = this.fixQuotes(healed)

    // 8. Escape unescaped characters
    healed = this.escapeCharacters(healed)

    // Try parsing the healed JSON
    try {
      const parsed = JSON.parse(healed)
      return {
        success: true,
        data: parsed,
        original: input,
        healed,
        warnings,
      }
    } catch (error) {
      errors.push(`Failed to heal JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return {
        success: false,
        original: input,
        healed,
        errors,
        warnings,
      }
    }
  }

  /**
   * Extract JSON from markdown code blocks
   * Input: ```json\n{"name": "Bob"}\n```
   * Output: {"name": "Bob"}
   */
  private static extractFromMarkdown(input: string): string {
    // Match markdown code blocks with optional language identifier
    const markdownPattern = /```(?:json|javascript|js)?\s*\n?([\s\S]*?)\n?```/g
    const matches = input.match(markdownPattern)

    if (matches && matches.length > 0) {
      // Extract content from first code block
      return matches[0]
        .replace(/```(?:json|javascript|js)?\s*\n?/, '')
        .replace(/\n?```$/, '')
        .trim()
    }

    return input
  }

  /**
   * Extract JSON from text with surrounding content
   * Input: Here's the data:\n{"name": "Charlie"}
   * Output: {"name": "Charlie"}
   */
  private static extractJSONFromText(input: string): string {
    // Try to find JSON object or array patterns
    const jsonObjectPattern = /\{[\s\S]*\}/
    const jsonArrayPattern = /\[[\s\S]*\]/

    // Try object first
    const objectMatch = input.match(jsonObjectPattern)
    if (objectMatch) {
      return objectMatch[0]
    }

    // Try array
    const arrayMatch = input.match(jsonArrayPattern)
    if (arrayMatch) {
      return arrayMatch[0]
    }

    return input
  }

  /**
   * Fix unquoted keys (JavaScript-style objects)
   * Input: {name: "Eve", age: 40}
   * Output: {"name": "Eve", "age": 40}
   */
  private static fixUnquotedKeys(input: string): string {
    // Match unquoted keys like: word: (but not inside quotes)
    return input.replace(/(\{|,)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
  }

  /**
   * Remove trailing commas
   * Input: {"name": "David", "age": 35,}
   * Output: {"name": "David", "age": 35}
   */
  private static removeTrailingCommas(input: string): string {
    // Remove commas before closing braces or brackets
    return input
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/,(\s*$)/g, '')
  }

  /**
   * Fix missing closing brackets
   * Input: {"name": "Alice", "age": 30
   * Output: {"name": "Alice", "age": 30}
   */
  private static fixMissingBrackets(input: string): string {
    let result = input.trim()

    // Count opening and closing brackets
    const openBraces = (result.match(/\{/g) || []).length
    const closeBraces = (result.match(/\}/g) || []).length
    const openBrackets = (result.match(/\[/g) || []).length
    const closeBrackets = (result.match(/\]/g) || []).length

    // Add missing closing braces
    for (let i = 0; i < openBraces - closeBraces; i++) {
      result += '}'
    }

    // Add missing closing brackets
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      result += ']'
    }

    return result
  }

  /**
   * Remove JavaScript-style comments
   * Input: {"name": "Test"}
   * Output: {"name": "Test"}
   */
  private static removeComments(input: string): string {
    // Remove single-line comments
    let result = input.replace(/\/\/.*$/gm, '')

    // Remove multi-line comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, '')

    return result
  }

  /**
   * Fix single quotes to double quotes (where appropriate)
   * Input: {'name': 'Test'}
   * Output: {"name": "Test"}
   */
  private static fixQuotes(input: string): string {
    // This is tricky as we need to avoid replacing single quotes inside double-quoted strings
    // Simple approach: replace single quotes with double quotes for keys and string values
    let inString = false
    let quoteChar = ''
    let fixed = ''

    let i = 0
    while (i < input.length) {
      const char = input[i]

      if (char === '\\') {
        if (i + 1 < input.length) {
          const nextChar = input[i + 1]
          // If we are in a single quoted string and see an escaped single quote, unescape it
          if (inString && quoteChar === "'" && nextChar === "'") {
            fixed += "'"
            i += 2
            continue
          }
          fixed += char + nextChar
          i += 2
          continue
        }
      }

      if (!inString && (char === '"' || char === "'")) {
        inString = true
        quoteChar = char
        fixed += '"'
      } else if (inString && char === quoteChar) {
        inString = false
        quoteChar = ''
        fixed += '"'
      } else if (inString && quoteChar === "'" && char === '"') {
        fixed += '\\"'
      } else {
        fixed += char
      }
      i++
    }

    return fixed
  }

  /**
   * Escape raw control characters that appear inside JSON string literals.
   * Walks the input character-by-character tracking string context so that
   * only characters inside quotes are touched, leaving structural JSON intact.
   */
  private static escapeCharacters(input: string): string {
    let result = ''
    let inString = false
    let i = 0

    while (i < input.length) {
      const ch = input[i]
      const code = ch.charCodeAt(0)

      if (inString) {
        if (ch === '\\') {
          // Already-escaped sequence: copy both the backslash and the next char verbatim.
          // We always increment past the backslash first; if it was a trailing backslash
          // (i.e., i is now ≥ length) the while-loop guard will exit cleanly.
          result += ch
          i++
          if (i < input.length) {
            result += input[i]
            i++
          }
          continue
        }
        if (ch === '"') {
          // Closing quote – leave string context
          inString = false
          result += ch
          i++
          continue
        }
        // Raw control character (U+0000–U+001F) must be escaped inside strings
        if (code < 0x20) {
          switch (ch) {
            case '\n': result += '\\n'; break
            case '\r': result += '\\r'; break
            case '\t': result += '\\t'; break
            case '\b': result += '\\b'; break
            case '\f': result += '\\f'; break
            default:
              result += `\\u${code.toString(16).padStart(4, '0').toUpperCase()}`
              break
          }
          i++
          continue
        }
        result += ch
        i++
      } else {
        if (ch === '"') {
          inString = true
        }
        result += ch
        i++
      }
    }

    return result
  }

  /**
   * Validate against a JSON schema (optional).
   * Supports nested objects and arrays with required-field checks.
   */
  static validateSchema<T>(data: any, schema: any): { valid: boolean; errors?: string[] } {
    const errors: string[] = []
    JSONHealer._validateValue(data, schema, '', errors)
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    }
  }

  /** Recursive value validator used by validateSchema */
  private static _validateValue(data: any, schema: any, path: string, errors: string[]): void {
    const label = path || 'root'

    if (schema.type === 'object') {
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        errors.push(`${label}: expected object`)
        return
      }
      if (schema.required && Array.isArray(schema.required)) {
        for (const field of schema.required) {
          if (!(field in data)) {
            errors.push(`${label}: missing required field "${field}"`)
          }
        }
      }
      if (schema.properties) {
        for (const key of Object.keys(schema.properties)) {
          if (key in data) {
            JSONHealer._validateValue(
              data[key],
              schema.properties[key],
              path ? `${path}.${key}` : key,
              errors,
            )
          }
        }
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(data)) {
        errors.push(`${label}: expected array`)
        return
      }
      if (schema.items) {
        for (let idx = 0; idx < data.length; idx++) {
          JSONHealer._validateValue(data[idx], schema.items, `${label}[${idx}]`, errors)
        }
      }
    } else if (schema.type === 'string') {
      if (typeof data !== 'string') {
        errors.push(`${label}: expected string`)
      }
    } else if (schema.type === 'number') {
      if (typeof data !== 'number') {
        errors.push(`${label}: expected number`)
      }
    } else if (schema.type === 'boolean') {
      if (typeof data !== 'boolean') {
        errors.push(`${label}: expected boolean`)
      }
    }
  }

  /**
   * Heal and validate in one step
   */
  static healAndValidate<T>(input: string, schema?: any): HealedResponse<T> {
    const healed = this.heal<T>(input)

    if (healed.success && schema && healed.data) {
      const validation = this.validateSchema(healed.data, schema)
      if (!validation.valid) {
        return {
          ...healed,
          success: false,
          errors: [...(healed.errors || []), ...(validation.errors || [])],
        }
      }
    }

    return healed
  }
}

/**
 * Convenience function for healing JSON
 */
export function healJSON<T = any>(input: string, schema?: any): HealedResponse<T> {
  if (schema) {
    return JSONHealer.healAndValidate<T>(input, schema)
  }
  return JSONHealer.heal<T>(input)
}

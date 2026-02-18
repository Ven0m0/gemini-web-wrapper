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
   * Input: {"name": "Test" /* comment */}
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
    let result = input
    let inString = false
    let quoteChar = ''
    let fixed = ''
    
    for (let i = 0; i < result.length; i++) {
      const char = result[i]
      const prevChar = i > 0 ? result[i - 1] : ''
      
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          // Starting a string
          inString = true
          quoteChar = char
          fixed += '"'
        } else if (char === quoteChar) {
          // Ending a string
          inString = false
          quoteChar = ''
          fixed += '"'
        } else {
          // Quote inside string
          fixed += char
        }
      } else {
        fixed += char
      }
    }
    
    return fixed
  }

  /**
   * Escape unescaped special characters
   */
  private static escapeCharacters(input: string): string {
    // This is complex and risky, so we'll skip for now
    // In production, you'd want more sophisticated escaping
    return input
  }

  /**
   * Validate against a JSON schema (optional)
   */
  static validateSchema<T>(data: any, schema: any): { valid: boolean; errors?: string[] } {
    // Simple validation - in production, use a library like ajv
    const errors: string[] = []
    
    if (schema.type === 'object') {
      if (typeof data !== 'object' || Array.isArray(data)) {
        errors.push('Expected an object')
        return { valid: false, errors }
      }
      
      // Check required fields
      if (schema.required && Array.isArray(schema.required)) {
        for (const field of schema.required) {
          if (!(field in data)) {
            errors.push(`Missing required field: ${field}`)
          }
        }
      }
      
      // Check properties
      if (schema.properties) {
        for (const key in schema.properties) {
          if (key in data) {
            const propSchema = schema.properties[key]
            const propData = data[key]
            
            if (propSchema.type === 'string' && typeof propData !== 'string') {
              errors.push(`Field ${key} should be a string`)
            } else if (propSchema.type === 'number' && typeof propData !== 'number') {
              errors.push(`Field ${key} should be a number`)
            } else if (propSchema.type === 'boolean' && typeof propData !== 'boolean') {
              errors.push(`Field ${key} should be a boolean`)
            }
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
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

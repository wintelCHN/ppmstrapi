/**
 * DeepSeek AI Translation Provider for strapi-plugin-translate v2
 *
 * Uses DeepSeek's Chat Completions API (OpenAI-compatible).
 * Set DEEPSEEK_API_KEY and DEEPSEEK_BASE_URL in .env
 *
 * Handles Strapi 5 formats: plain, markdown, html, jsonb (Slate blocks)
 */

module.exports = {
  provider: 'deepseek',
  name: 'DeepSeek AI',

  init(providerOptions = {}) {
    const apiKey = providerOptions.apiKey || process.env.DEEPSEEK_API_KEY
    const baseUrl =
      providerOptions.baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
    const model = providerOptions.model || 'deepseek-chat'

    if (!apiKey) {
      throw new Error('[DeepSeek Provider] DEEPSEEK_API_KEY is required in .env or providerOptions')
    }

    const endpoint = `${baseUrl}/v1/chat/completions`

    // Language name lookup for building better prompts
    const localeNames = {
      en: 'English', zh: 'Chinese (Simplified)', 'zh-Hant': 'Chinese (Traditional)',
      fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', pt: 'Portuguese',
      ru: 'Russian', ja: 'Japanese', ko: 'Korean', ar: 'Arabic', hi: 'Hindi',
      nl: 'Dutch', pl: 'Polish', sv: 'Swedish', da: 'Danish', fi: 'Finnish',
      nb: 'Norwegian', tr: 'Turkish', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
      ms: 'Malay', cs: 'Czech', hu: 'Hungarian', ro: 'Romanian', bg: 'Bulgarian',
      uk: 'Ukrainian', he: 'Hebrew', fa: 'Persian',
    }

    const formatHints = {
      plain:
        'Return ONLY the translated text. No explanations, no quotes, no commentary.',
      markdown:
        'Translate the text while preserving ALL Markdown formatting exactly. ' +
        'Do NOT translate URLs, code blocks, image alt text, or frontmatter. ' +
        'Return ONLY the translated Markdown.',
      html:
        'Translate the visible text content while preserving ALL HTML tags, ' +
        'attributes, class names, and structure exactly. ' +
        'Do NOT translate URLs (href, src). Return ONLY the translated HTML.',
      jsonb:
        'You are translating a Strapi CMS rich-text document in Slate JSON format. ' +
        'The input is a JSON array of block objects. Each block has a "type" ' +
        '(e.g. "paragraph", "heading", "list", "quote", "image", "code") and ' +
        '"children" array. Translate ONLY the "text" property values inside ' +
        '"children" — do NOT modify block types, image URLs, formatting marks ' +
        '(bold/italic/code/strikethrough/underline), link URLs, or any other ' +
        'structure. Preserve all numeric ranges in inline nodes like links. ' +
        'The order of blocks must stay the same. ' +
        'Return ONLY the translated JSON array — no markdown fences, no ' +
        'explanations, no wrapping text. The response MUST be valid JSON ' +
        'parseable by JSON.parse().',
    }

    /**
     * Build a locale-aware system prompt.
     */
    function systemPrompt(sourceLocale, targetLocale, format) {
      const sourceName = localeNames[sourceLocale] || sourceLocale
      const targetName = localeNames[targetLocale] || targetLocale
      const hint = formatHints[format] || formatHints.plain

      return (
        `You are a professional translator. Translate the following text ` +
        `from ${sourceName} to ${targetName}. ${hint}`
      )
    }

    /**
     * Call DeepSeek API and return the response text.
     */
    async function callDeepSeek(systemContent, userContent) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ],
          temperature: 0.1,
          max_tokens: 16384,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        throw new Error(`DeepSeek API error ${response.status}: ${errorBody.slice(0, 200)}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content?.trim()

      if (!content) {
        throw new Error('DeepSeek returned empty response')
      }

      return content
    }

    /**
     * For jsonb format: validate that the response is valid JSON.
     * If DeepSeek wrapped it in markdown fences, strip them.
     */
    function validateJsonbResponse(raw) {
      // Strip markdown code fences if present
      let cleaned = raw.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      }

      try {
        JSON.parse(cleaned)
        return cleaned
      } catch {
        return null // invalid JSON
      }
    }

    /**
     * Translate text(s) using DeepSeek Chat Completions.
     *
     * @param {Object} options
     * @param {string|string[]} options.text - Text or array of texts to translate
     * @param {string} options.sourceLocale - Source language code (e.g. 'en')
     * @param {string} options.targetLocale - Target language code (e.g. 'zh')
     * @param {string} options.format - 'plain' | 'markdown' | 'html' | 'jsonb'
     * @returns {Promise<string[]>} Translated texts in same order
     */
    /**
     * Prepare text for the API call. For jsonb format, Strapi may pass
     * a JavaScript object/array (parsed from the JSON column) rather than
     * a string — we must JSON.stringify it first, otherwise String(obj)
     * produces "[object Object]" which DeepSeek can't translate.
     */
    function prepareText(t, format) {
      if (t === null || t === undefined) return ''
      if (typeof t === 'string') return t
      // Strapi passes parsed objects for jsonb/blocks fields
      if (typeof t === 'object') return JSON.stringify(t)
      return String(t)
    }

    async function translate({ text, sourceLocale, targetLocale, format = 'plain' }) {
      const texts = Array.isArray(text) ? text : [text]
      if (texts.length === 0) return []

      const results = []

      for (const t of texts) {
        // Prepare: objects → JSON string
        const content = prepareText(t, format)

        // Skip empty content
        if (!content || content.trim() === '') {
          results.push(t)
          continue
        }

        const prompt = systemPrompt(sourceLocale, targetLocale, format)

        // Track original type — for jsonb we must return same type (object→object, string→string)
          const wasObject = typeof t === 'object'

          try {
            let translated = await callDeepSeek(prompt, content)

            // For jsonb format: validate, retry if broken, and match original type
            if (format === 'jsonb') {
              const validated = validateJsonbResponse(translated)

              if (!validated) {
                // First attempt failed — retry with a stronger prompt
                const retryPrompt =
                  prompt +
                  ' CRITICAL: Your previous response was not valid JSON. ' +
                  'You MUST return ONLY a valid JSON array. Do NOT add any ' +
                  'explanatory text, markdown fences, or apologies. ' +
                  'The response must start with "[" and be parseable by JSON.parse().'

                translated = await callDeepSeek(retryPrompt, content)

                const retryValidated = validateJsonbResponse(translated)
                if (!retryValidated) {
                  throw new Error(
                    `DeepSeek returned invalid JSON for jsonb field (after retry). ` +
                      `First 200 chars of response: "${translated.slice(0, 200)}"`,
                  )
                }
                translated = retryValidated
              } else {
                translated = validated
              }

              // CRITICAL: Strapi passes blocks fields as parsed JavaScript arrays.
              // If the original value was an object/array, we must return a parsed
              // object/array too — returning a JSON string causes Slate to fail with
              // "initialValue is invalid! Expected a list of elements but got: ..."
              if (wasObject) {
                translated = JSON.parse(translated)
              }
            }

            results.push(translated)
        } catch (err) {
          throw new Error(
            `[DeepSeek] Translation failed for ${sourceLocale}→${targetLocale} ` +
              `(format: ${format}): ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }

      return results
    }

    /**
     * Return usage stats. DeepSeek doesn't provide a real-time usage API,
     * so we return 0 — the plugin handles this gracefully.
     */
    async function usage() {
      return { count: 0, limit: 10_000_000 }
    }

    return { translate, usage }
  },
}

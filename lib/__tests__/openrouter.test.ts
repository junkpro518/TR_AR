import { describe, it, expect, vi } from 'vitest'
import { buildHeaders, buildChatBody, buildAnalysisBody } from '../openrouter'

describe('buildHeaders', () => {
  it('includes Authorization with Bearer token', () => {
    const headers = buildHeaders('test-key')
    expect(headers['Authorization']).toBe('Bearer test-key')
  })

  it('includes required OpenRouter headers', () => {
    const headers = buildHeaders('key')
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['HTTP-Referer']).toBeDefined()
    expect(headers['X-Title']).toBeDefined()
  })
})

describe('buildChatBody', () => {
  it('includes stream: true', () => {
    const body = buildChatBody('model-id', [{ role: 'user', content: 'hi' }])
    expect(body.stream).toBe(true)
    expect(body.model).toBe('model-id')
  })

  it('passes messages correctly', () => {
    const messages = [{ role: 'user' as const, content: 'Merhaba' }]
    const body = buildChatBody('model', messages)
    expect(body.messages).toEqual(messages)
  })
})

describe('buildAnalysisBody', () => {
  it('includes stream: false for JSON response', () => {
    const body = buildAnalysisBody('model-id', 'analyze this', 'turkish')
    expect(body.stream).toBe(false)
    expect(body.response_format).toEqual({ type: 'json_object' })
  })
})

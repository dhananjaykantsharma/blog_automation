import { api, ApiError, getAccessToken, refreshSession } from './api'

export type BlogType =
  | 'how_to'
  | 'listicle'
  | 'tutorial'
  | 'comparison'
  | 'opinion'
  | 'news'
  | 'case_study'
  | 'review'

export type Tone = 'professional' | 'conversational' | 'technical' | 'friendly' | 'authoritative'

export type BlogLength = 'short' | 'medium' | 'long'

export type BlogStatus = 'running' | 'awaiting_outline_review' | 'awaiting_content_review' | 'completed' | 'failed'

// short/medium/long map to rough word targets on the backend
export const lengthWords: Record<BlogLength, string> = {
  short: '~800 words',
  medium: '~1,500 words',
  long: '~2,500+ words',
}

export interface CreateBlogRequest {
  title: string
  blog_type: BlogType
  research_urls: string[]
  // false = research only from research_urls, true = also search the web
  web_research: boolean
  primary_keyword: string
  secondary_keywords: string[]
  target_audience: string
  tone: Tone
  length: BlogLength
  language: string
  include_faq: boolean
  include_cta: boolean
  instructions: string
}

export interface OutlineSection {
  heading: string
  key_points: string[]
}

export interface Outline {
  title: string
  sections: OutlineSection[]
}

// Mirrors the dicts passed to interrupt() in the graph's review nodes (backend/app/agents/blog/nodes.py)
export type OutlineReviewPayload = { type: 'outline_review'; outline: Outline; can_regenerate: boolean }
export type ContentReviewPayload = { type: 'content_review'; content: string }
export type ReviewPayload = OutlineReviewPayload | ContentReviewPayload

// What we send back; the graph receives it as the return value of interrupt()
export type OutlineDecision = { action: 'approve'; outline: Outline } | { action: 'regenerate'; feedback: string }
// content = the draft as edited in the editor; the graph uses it instead of its own version
export type ContentDecision =
  | { action: 'approve'; content: string }
  | { action: 'revise'; feedback: string; content: string }

export interface BlogSummary {
  id: string
  title: string
  blog_type: BlogType
  status: BlogStatus
  created_at: string
}

export interface BlogDetail extends BlogSummary {
  error: string | null
  pending_review: ReviewPayload | null
  outline: Outline | null
  content: string | null
}

export function createBlog(payload: CreateBlogRequest): Promise<BlogSummary> {
  return api.post<BlogSummary>('/blogs', payload)
}

export function getBlog(id: string): Promise<BlogDetail> {
  return api.get<BlogDetail>(`/blogs/${id}`)
}

export function reviewOutline(id: string, decision: OutlineDecision): Promise<BlogSummary> {
  return api.post<BlogSummary>(`/blogs/${id}/outline/review`, decision)
}

export function reviewContent(id: string, decision: ContentDecision): Promise<BlogSummary> {
  return api.post<BlogSummary>(`/blogs/${id}/content/review`, decision)
}

export type BlogEventHandler = (event: string, data: unknown) => void

const RECONNECT_DELAY_MS = 2000

/**
 * Reads the blog's SSE stream with fetch (EventSource can't send the Authorization header).
 * Reconnects with Last-Event-ID after network drops; resolves once the server closes the stream.
 */
export async function streamBlogEvents(id: string, onEvent: BlogEventHandler, signal: AbortSignal): Promise<void> {
  let lastId: string | null = null
  let refreshed = false

  while (!signal.aborted) {
    try {
      const headers = new Headers({ Authorization: `Bearer ${getAccessToken() ?? ''}` })
      if (lastId !== null) headers.set('Last-Event-ID', lastId)
      const res = await fetch(`/api/blogs/${id}/events`, { headers, signal })

      if (res.status === 401 && !refreshed) {
        refreshed = true
        await refreshSession()
        continue
      }
      if (!res.ok || !res.body) throw new ApiError(res.status, `Event stream failed (${res.status})`)
      refreshed = false

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) return // server closes the stream after the final event
        buffer += value
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? '' // keep a partial event for the next read
        for (const chunk of chunks) {
          let event = 'message'
          let data = ''
          for (const line of chunk.split('\n')) {
            if (line.startsWith('id: ')) lastId = line.slice(4)
            else if (line.startsWith('event: ')) event = line.slice(7)
            else if (line.startsWith('data: ')) data += line.slice(6)
          }
          if (data) onEvent(event, JSON.parse(data))
        }
      }
    } catch (err) {
      if (signal.aborted) return
      if (err instanceof ApiError && err.status < 500) throw err // 401/404 won't fix themselves
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS))
    }
  }
}

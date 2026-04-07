import {
  PAGINATION_DEFAULT_PER_PAGE,
  TOAST_AUTO_DISMISS_MS,
  SEARCH_DEBOUNCE_MS,
  API_TIMEOUT_MS,
  API_SLOW_REQUEST_THRESHOLD_MS,
  MAX_SEARCH_LENGTH,
  HLS_MAX_RETRIES,
  LIVE_CHANNELS_POLL_INTERVAL_MS,
  PASSWORD_MIN_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  CHANNEL_NAME_MAX_LENGTH,
  CATEGORY_NAME_MAX_LENGTH,
  VOD_TITLE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  MAX_FILE_SIZE_MB,
  UPLOAD_TIMEOUT_MS,
} from '@/lib/constants'

describe('Constants', () => {
  it('pagination defaults are reasonable', () => {
    expect(PAGINATION_DEFAULT_PER_PAGE).toBe(20)
    expect(PAGINATION_DEFAULT_PER_PAGE).toBeGreaterThan(0)
  })

  it('UI timing constants are positive', () => {
    expect(TOAST_AUTO_DISMISS_MS).toBeGreaterThan(0)
    expect(SEARCH_DEBOUNCE_MS).toBeGreaterThan(0)
  })

  it('API timeouts are positive', () => {
    expect(API_TIMEOUT_MS).toBeGreaterThan(0)
    expect(API_SLOW_REQUEST_THRESHOLD_MS).toBeGreaterThan(0)
    expect(API_SLOW_REQUEST_THRESHOLD_MS).toBeLessThan(API_TIMEOUT_MS)
  })

  it('validation limits are correct', () => {
    expect(MAX_SEARCH_LENGTH).toBe(200)
    expect(PASSWORD_MIN_LENGTH).toBe(8)
    expect(USERNAME_MIN_LENGTH).toBe(3)
    expect(USERNAME_MAX_LENGTH).toBe(32)
    expect(USERNAME_MIN_LENGTH).toBeLessThan(USERNAME_MAX_LENGTH)
  })

  it('content limits are reasonable', () => {
    expect(CHANNEL_NAME_MAX_LENGTH).toBe(100)
    expect(CATEGORY_NAME_MAX_LENGTH).toBe(100)
    expect(VOD_TITLE_MAX_LENGTH).toBe(255)
    expect(DESCRIPTION_MAX_LENGTH).toBe(5000)
  })

  it('streaming constants are positive', () => {
    expect(HLS_MAX_RETRIES).toBeGreaterThan(0)
    expect(LIVE_CHANNELS_POLL_INTERVAL_MS).toBeGreaterThan(0)
  })

  it('upload limits are reasonable', () => {
    expect(MAX_FILE_SIZE_MB).toBe(500)
    expect(UPLOAD_TIMEOUT_MS).toBe(300000)
    expect(UPLOAD_TIMEOUT_MS).toBeGreaterThan(0)
  })
})

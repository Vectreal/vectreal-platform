import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  saveReferralAttribution,
  getReferralAttribution,
  clearReferralAttribution,
} from '../app/lib/analytics/referral-attribution'

beforeEach(() => {
  const store: Record<string, string> = {}
  const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
  }
  vi.stubGlobal('localStorage', localStorageMock)
  vi.stubGlobal('document', { referrer: '' })
  vi.stubGlobal('window', {
    location: { search: '' },
    localStorage: localStorageMock,
  })
  vi.clearAllMocks()

  // Expose for test assertions
  ;(globalThis as any).__testStore = store
  ;(globalThis as any).__testLocalStorageMock = localStorageMock
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (globalThis as any).__testStore
  delete (globalThis as any).__testLocalStorageMock
})

function getStore(): Record<string, string> {
  return (globalThis as any).__testStore
}

function getLocalStorageMock() {
  return (globalThis as any).__testLocalStorageMock
}

describe('saveReferralAttribution', () => {
  it('writes referrer and utm_source when both present', () => {
    vi.stubGlobal('document', { referrer: 'https://google.com' })
    vi.stubGlobal('window', {
      location: { search: '?utm_source=cpc' },
      localStorage: getLocalStorageMock(),
    })
    saveReferralAttribution()
    expect(getLocalStorageMock().setItem).toHaveBeenCalledWith(
      'vr_referral',
      JSON.stringify({ referrer: 'https://google.com', utm_source: 'cpc' })
    )
  })

  it('writes only utm_source when referrer is empty', () => {
    vi.stubGlobal('document', { referrer: '' })
    vi.stubGlobal('window', {
      location: { search: '?utm_source=email' },
      localStorage: getLocalStorageMock(),
    })
    saveReferralAttribution()
    expect(getLocalStorageMock().setItem).toHaveBeenCalledWith(
      'vr_referral',
      JSON.stringify({ utm_source: 'email' })
    )
  })

  it('writes nothing when both are absent', () => {
    saveReferralAttribution()
    expect(getLocalStorageMock().setItem).not.toHaveBeenCalled()
  })
})

describe('getReferralAttribution', () => {
  it('returns stored values', () => {
    getStore()['vr_referral'] = JSON.stringify({
      referrer: 'https://x.com',
      utm_source: 'social',
    })
    expect(getReferralAttribution()).toEqual({
      referrer: 'https://x.com',
      utm_source: 'social',
    })
  })

  it('returns empty object when nothing stored', () => {
    expect(getReferralAttribution()).toEqual({})
  })

  it('returns empty object on malformed JSON', () => {
    getStore()['vr_referral'] = 'not-json'
    expect(getReferralAttribution()).toEqual({})
  })
})

describe('clearReferralAttribution', () => {
  it('removes the storage key', () => {
    getStore()['vr_referral'] = '{}'
    clearReferralAttribution()
    expect(getLocalStorageMock().removeItem).toHaveBeenCalledWith('vr_referral')
  })
})

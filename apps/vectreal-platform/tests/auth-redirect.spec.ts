import { describe, expect, it } from 'vitest'
import {
  SAFE_NEXT_PATH_PREFIXES,
  getSafeNextPath,
  buildSigninErrorRedirect,
} from '../app/lib/domain/auth/auth-redirect.server'

describe('getSafeNextPath', () => {
  it('returns /dashboard for null', () => {
    expect(getSafeNextPath(null)).toBe('/dashboard')
  })

  it('returns /dashboard for empty string', () => {
    expect(getSafeNextPath('')).toBe('/dashboard')
  })

  it('returns /dashboard for relative path without leading slash', () => {
    expect(getSafeNextPath('dashboard')).toBe('/dashboard')
  })

  it('returns /dashboard for disallowed path', () => {
    expect(getSafeNextPath('/evil')).toBe('/dashboard')
  })

  it('allows exact prefix matches', () => {
    for (const prefix of SAFE_NEXT_PATH_PREFIXES) {
      expect(getSafeNextPath(prefix)).toBe(prefix)
    }
  })

  it('allows paths nested under safe prefixes', () => {
    expect(getSafeNextPath('/dashboard/projects/abc')).toBe('/dashboard/projects/abc')
    expect(getSafeNextPath('/publisher/scene-123')).toBe('/publisher/scene-123')
    expect(getSafeNextPath('/reset-password')).toBe('/reset-password')
  })

  it('rejects /dashboardevil (prefix but not slash-separated)', () => {
    expect(getSafeNextPath('/dashboardevil')).toBe('/dashboard')
  })
})

describe('buildSigninErrorRedirect', () => {
  it('encodes error code and next path into sign-in URL', () => {
    const url = buildSigninErrorRedirect('missing_code', '/dashboard')
    expect(url).toBe('/sign-in?error=missing_code&next=%2Fdashboard')
  })
})
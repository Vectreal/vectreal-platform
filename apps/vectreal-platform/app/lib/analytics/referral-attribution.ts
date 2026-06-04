const STORAGE_KEY = 'vr_referral'

interface ReferralAttribution {
  referrer?: string
  utm_source?: string
}

export function saveReferralAttribution(): void {
  if (typeof window === 'undefined') return
  const referrer = document.referrer || undefined
  const utm_source =
    new URLSearchParams(window.location.search).get('utm_source') || undefined
  if (!referrer && !utm_source) return
  const data: ReferralAttribution = {}
  if (referrer) data.referrer = referrer
  if (utm_source) data.utm_source = utm_source
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // private mode or quota exceeded
  }
}

export function getReferralAttribution(): ReferralAttribution {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as ReferralAttribution
  } catch {
    return {}
  }
}

export function clearReferralAttribution(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

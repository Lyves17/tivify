import {
  ROUTES,
  getChannelUrl,
  getVODUrl,
  getSeriesUrl,
  getAdminChannelUrl,
  getAdminVODUrl,
  getAdminSeriesUrl,
} from '@/lib/routes'

describe('ROUTES constants', () => {
  it('has LOGIN route', () => {
    expect(ROUTES.LOGIN).toBe('/login')
  })
  it('has HOME route', () => {
    expect(ROUTES.HOME).toBe('/home')
  })
  it('has admin routes starting with /admin', () => {
    expect(ROUTES.ADMIN).toBe('/admin')
    expect(ROUTES.ADMIN_CHANNELS).toBe('/admin/channels')
    expect(ROUTES.ADMIN_VOD).toBe('/admin/vod')
    expect(ROUTES.ADMIN_SERIES).toBe('/admin/series')
    expect(ROUTES.ADMIN_CATEGORIES).toBe('/admin/categories')
    expect(ROUTES.ADMIN_USERS).toBe('/admin/users')
    expect(ROUTES.ADMIN_EPG).toBe('/admin/epg')
    expect(ROUTES.ADMIN_LIBRARY).toBe('/admin/library')
    expect(ROUTES.ADMIN_IPTV).toBe('/admin/iptv')
  })
  it('has user page routes', () => {
    expect(ROUTES.CHANNELS).toBe('/channels')
    expect(ROUTES.VOD).toBe('/vod')
    expect(ROUTES.SERIES).toBe('/series')
    expect(ROUTES.FAVORITES).toBe('/favorites')
    expect(ROUTES.HISTORY).toBe('/history')
    expect(ROUTES.GUIDE).toBe('/guide')
    expect(ROUTES.SETTINGS).toBe('/settings')
    expect(ROUTES.HELP).toBe('/help')
  })
})

describe('Dynamic route builders', () => {
  it('getChannelUrl builds correct URL', () => {
    expect(getChannelUrl(1)).toBe('/channels/1')
    expect(getChannelUrl(42)).toBe('/channels/42')
  })
  it('getVODUrl builds correct URL', () => {
    expect(getVODUrl(10)).toBe('/vod/10')
  })
  it('getSeriesUrl builds correct URL', () => {
    expect(getSeriesUrl(5)).toBe('/series/5')
  })
  it('getAdminChannelUrl builds correct URL', () => {
    expect(getAdminChannelUrl(1)).toBe('/admin/channels/1')
  })
  it('getAdminVODUrl builds correct URL', () => {
    expect(getAdminVODUrl(10)).toBe('/admin/vod/10')
  })
  it('getAdminSeriesUrl builds correct URL', () => {
    expect(getAdminSeriesUrl(5)).toBe('/admin/series/5')
  })
})

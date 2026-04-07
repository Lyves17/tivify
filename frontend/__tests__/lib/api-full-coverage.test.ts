/**
 * Full coverage tests for api.ts — covers all remaining adminAPI and userAPI methods
 * that were not exercised by api-extended.test.ts
 */

// Mock secure token store before importing api
jest.mock('@/lib/secure-token-store', () => ({
  secureTokenStore: {
    getToken: jest.fn(),
    setToken: jest.fn(),
    clearToken: jest.fn(),
    hasToken: jest.fn(),
  },
}))

// Mock axios — create a mock instance that tracks all calls
jest.mock('axios', () => {
  const mockAxios: any = {
    create: jest.fn(() => mockAxios),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    isAxiosError: jest.fn(),
  }
  return { default: mockAxios, __esModule: true }
})

import axios from 'axios'

describe('adminAPI — remaining methods', () => {
  let adminAPI: any

  beforeEach(() => {
    jest.clearAllMocks()
    adminAPI = require('@/lib/api').adminAPI
  })

  // Categories
  it('getCategoriesByType calls GET /v1/admin/categories/by-type with type param', async () => {
    await adminAPI.getCategoriesByType('live')
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/categories/by-type', { params: { type: 'live' } })
  })

  // Channels — update and streams
  it('updateChannel calls PUT /v1/admin/channels/:id', async () => {
    const data = { name: 'Updated' }
    await adminAPI.updateChannel(10, data)
    expect(axios.put).toHaveBeenCalledWith('/v1/admin/channels/10', data)
  })

  it('addStream calls POST /v1/admin/channels/:id/streams', async () => {
    const data = { url: 'http://stream.example.com' }
    await adminAPI.addStream(5, data)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/channels/5/streams', data)
  })

  it('updateStream calls PUT /v1/admin/channels/:id/streams/:streamId', async () => {
    const data = { url: 'http://updated.example.com' }
    await adminAPI.updateStream(5, 3, data)
    expect(axios.put).toHaveBeenCalledWith('/v1/admin/channels/5/streams/3', data)
  })

  it('deleteStream calls DELETE /v1/admin/channels/:id/streams/:streamId', async () => {
    await adminAPI.deleteStream(5, 3)
    expect(axios.delete).toHaveBeenCalledWith('/v1/admin/channels/5/streams/3')
  })

  // VOD
  it('getVOD calls GET /v1/admin/vod/:id', async () => {
    await adminAPI.getVOD(42)
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/vod/42')
  })

  it('getVODDebugStats calls GET /v1/admin/vod/debug', async () => {
    await adminAPI.getVODDebugStats()
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/vod/debug')
  })

  it('createVOD calls POST /v1/admin/vod', async () => {
    const data = { title: 'New Movie' }
    await adminAPI.createVOD(data)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/vod', data)
  })

  it('updateVOD calls PUT /v1/admin/vod/:id', async () => {
    const data = { title: 'Updated Movie' }
    await adminAPI.updateVOD(42, data)
    expect(axios.put).toHaveBeenCalledWith('/v1/admin/vod/42', data)
  })

  // Series
  it('getSeriesById calls GET /v1/admin/series/:id', async () => {
    await adminAPI.getSeriesById(10)
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/series/10')
  })

  it('createSeries calls POST /v1/admin/series', async () => {
    const data = { title: 'New Series' }
    await adminAPI.createSeries(data)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/series', data)
  })

  it('updateSeries calls PUT /v1/admin/series/:id', async () => {
    const data = { title: 'Updated Series' }
    await adminAPI.updateSeries(10, data)
    expect(axios.put).toHaveBeenCalledWith('/v1/admin/series/10', data)
  })

  it('deleteSeries calls DELETE /v1/admin/series/:id', async () => {
    await adminAPI.deleteSeries(10)
    expect(axios.delete).toHaveBeenCalledWith('/v1/admin/series/10')
  })

  it('getSeriesEpisodes calls GET /v1/series/:id/episodes', async () => {
    await adminAPI.getSeriesEpisodes(10)
    expect(axios.get).toHaveBeenCalledWith('/v1/series/10/episodes')
  })

  // Users
  it('getUser calls GET /v1/admin/users/:id', async () => {
    await adminAPI.getUser('user-123')
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/users/user-123')
  })

  it('createUser calls POST /v1/admin/users', async () => {
    const data = { username: 'newuser', password: 'pass' }
    await adminAPI.createUser(data)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/users', data)
  })

  it('updateUser calls PUT /v1/admin/users/:id', async () => {
    const data = { email: 'updated@test.com' }
    await adminAPI.updateUser('user-123', data)
    expect(axios.put).toHaveBeenCalledWith('/v1/admin/users/user-123', data)
  })

  // EPG
  it('getEPG calls GET /v1/admin/epg with pagination', async () => {
    await adminAPI.getEPG(2, 10)
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/epg', { params: { page: 2, per_page: 10 } })
  })

  it('createEPG calls POST /v1/admin/epg', async () => {
    const data = { channel_id: 1, title: 'News' }
    await adminAPI.createEPG(data)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/epg', data)
  })

  it('updateEPG calls PUT /v1/admin/epg/:id', async () => {
    const data = { title: 'Updated News' }
    await adminAPI.updateEPG(5, data)
    expect(axios.put).toHaveBeenCalledWith('/v1/admin/epg/5', data)
  })

  it('deleteEPG calls DELETE /v1/admin/epg/:id', async () => {
    await adminAPI.deleteEPG(5)
    expect(axios.delete).toHaveBeenCalledWith('/v1/admin/epg/5')
  })

  // Local Media
  it('uploadMedia calls POST /v1/admin/media/upload with FormData', async () => {
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' })
    const onProgress = jest.fn()
    await adminAPI.uploadMedia(file, onProgress)
    expect(axios.post).toHaveBeenCalledWith(
      '/v1/admin/media/upload',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 5 * 60 * 1000,
      })
    )
  })

  it('uploadMedia onUploadProgress calls onProgress callback', async () => {
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' })
    const onProgress = jest.fn()

    // Capture the config passed to axios.post
    ;(axios.post as jest.Mock).mockImplementation((_url, _data, config) => {
      if (config?.onUploadProgress) {
        config.onUploadProgress({ loaded: 50, total: 100 })
      }
      return Promise.resolve({ data: {} })
    })

    await adminAPI.uploadMedia(file, onProgress)
    expect(onProgress).toHaveBeenCalledWith(50)
  })

  it('uploadMedia onUploadProgress does nothing if no total', async () => {
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' })
    const onProgress = jest.fn()

    ;(axios.post as jest.Mock).mockImplementation((_url, _data, config) => {
      if (config?.onUploadProgress) {
        config.onUploadProgress({ loaded: 50, total: 0 })
      }
      return Promise.resolve({ data: {} })
    })

    await adminAPI.uploadMedia(file, onProgress)
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('uploadMedia works without onProgress callback', async () => {
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' })

    ;(axios.post as jest.Mock).mockImplementation((_url, _data, config) => {
      if (config?.onUploadProgress) {
        config.onUploadProgress({ loaded: 50, total: 100 })
      }
      return Promise.resolve({ data: {} })
    })

    await adminAPI.uploadMedia(file)
    // Should not throw
  })

  it('uploadMediaWithVOD calls POST /v1/admin/media/upload-vod with title', async () => {
    const file = new File(['content'], 'movie.mp4', { type: 'video/mp4' })
    await adminAPI.uploadMediaWithVOD(file, 'My Movie')
    expect(axios.post).toHaveBeenCalledWith(
      '/v1/admin/media/upload-vod',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 5 * 60 * 1000,
      })
    )
  })

  it('uploadMediaWithVOD appends series params when provided', async () => {
    const file = new File(['content'], 'episode.mp4', { type: 'video/mp4' })
    const seriesParams = { series_id: 1, season_number: 2, episode_number: 3 }
    await adminAPI.uploadMediaWithVOD(file, 'Episode Title', undefined, seriesParams)

    // Verify the FormData was constructed correctly
    const callArgs = (axios.post as jest.Mock).mock.calls[0]
    const formData = callArgs[1] as FormData
    expect(formData.get('series_id')).toBe('1')
    expect(formData.get('season_number')).toBe('2')
    expect(formData.get('episode_number')).toBe('3')
  })

  it('uploadMediaWithVOD onUploadProgress calls onProgress callback', async () => {
    const file = new File(['content'], 'movie.mp4', { type: 'video/mp4' })
    const onProgress = jest.fn()

    ;(axios.post as jest.Mock).mockImplementation((_url, _data, config) => {
      if (config?.onUploadProgress) {
        config.onUploadProgress({ loaded: 75, total: 100 })
      }
      return Promise.resolve({ data: {} })
    })

    await adminAPI.uploadMediaWithVOD(file, 'My Movie', onProgress)
    expect(onProgress).toHaveBeenCalledWith(75)
  })

  it('getUploadDiagnostics calls GET /v1/admin/media/diagnostics', async () => {
    await adminAPI.getUploadDiagnostics()
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/media/diagnostics')
  })

  it('getMediaList calls GET /v1/admin/media with pagination', async () => {
    await adminAPI.getMediaList(2, 10)
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/media', { params: { page: 2, per_page: 10 } })
  })

  it('getMedia calls GET /v1/admin/media/:id', async () => {
    await adminAPI.getMedia(5)
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/media/5')
  })

  it('deleteMedia calls DELETE /v1/admin/media/:id', async () => {
    await adminAPI.deleteMedia(5)
    expect(axios.delete).toHaveBeenCalledWith('/v1/admin/media/5')
  })

  it('createVODFromMedia calls POST /v1/admin/media/:id/create-vod', async () => {
    const data = { title: 'From Media' }
    await adminAPI.createVODFromMedia(5, data)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/media/5/create-vod', data)
  })

  // Playlist
  it('getChannelPlaylist calls GET /v1/admin/channels/:id/playlist', async () => {
    await adminAPI.getChannelPlaylist(3)
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/channels/3/playlist')
  })

  it('addPlaylistItem calls POST /v1/admin/channels/:id/playlist/items', async () => {
    const data = { local_media_id: 5, sort_order: 1 }
    await adminAPI.addPlaylistItem(3, data)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/channels/3/playlist/items', data)
  })

  it('removePlaylistItem calls DELETE /v1/admin/channels/:id/playlist/items/:itemId', async () => {
    await adminAPI.removePlaylistItem(3, 7)
    expect(axios.delete).toHaveBeenCalledWith('/v1/admin/channels/3/playlist/items/7')
  })

  it('reorderPlaylist calls PUT /v1/admin/channels/:id/playlist/reorder', async () => {
    const items = [{ id: 1, sort_order: 0 }, { id: 2, sort_order: 1 }]
    await adminAPI.reorderPlaylist(3, items)
    expect(axios.put).toHaveBeenCalledWith('/v1/admin/channels/3/playlist/reorder', { items })
  })

  it('updatePlaylistMode calls PUT /v1/admin/channels/:id/playlist/mode', async () => {
    await adminAPI.updatePlaylistMode(3, 'loop')
    expect(axios.put).toHaveBeenCalledWith('/v1/admin/channels/3/playlist/mode', { playback_mode: 'loop' })
  })

  it('generatePlaylistStream calls POST /v1/admin/channels/:id/playlist/generate', async () => {
    await adminAPI.generatePlaylistStream(3)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/channels/3/playlist/generate')
  })

  // Emission
  it('startEmission calls POST /v1/admin/channels/:id/emission/start', async () => {
    await adminAPI.startEmission(3)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/channels/3/emission/start')
  })

  it('stopEmission calls POST /v1/admin/channels/:id/emission/stop', async () => {
    await adminAPI.stopEmission(3)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/channels/3/emission/stop')
  })

  it('getEmissionStatus calls GET /v1/admin/channels/:id/emission/status', async () => {
    await adminAPI.getEmissionStatus(3)
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/channels/3/emission/status')
  })

  // IPTV Import
  it('iptvImport calls POST /v1/admin/iptv/import', async () => {
    const data = { url: 'http://iptv.example.com', source: 'test' }
    await adminAPI.iptvImport(data)
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/iptv/import', data)
  })

  it('iptvStatus calls GET /v1/admin/iptv/status', async () => {
    await adminAPI.iptvStatus()
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/iptv/status')
  })

  it('iptvDeleteBySource calls DELETE /v1/admin/iptv/channels with source param', async () => {
    await adminAPI.iptvDeleteBySource('custom-source')
    expect(axios.delete).toHaveBeenCalledWith('/v1/admin/iptv/channels?source=custom-source')
  })

  it('iptvDeleteBySource uses default source iptv-org', async () => {
    await adminAPI.iptvDeleteBySource()
    expect(axios.delete).toHaveBeenCalledWith('/v1/admin/iptv/channels?source=iptv-org')
  })

  // Library Scanner
  it('getLibraryDevices calls GET /v1/admin/library/devices', async () => {
    await adminAPI.getLibraryDevices()
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/library/devices')
  })

  it('scanLibrary calls POST /v1/admin/library/scan with paths', async () => {
    await adminAPI.scanLibrary(['/mnt/media'])
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/library/scan', { paths: ['/mnt/media'] })
  })

  it('scanLibrary calls POST /v1/admin/library/scan without paths', async () => {
    await adminAPI.scanLibrary()
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/library/scan', {})
  })

  it('getScanStatus calls GET /v1/admin/library/scan/:sessionId/status', async () => {
    await adminAPI.getScanStatus('sess-123')
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/library/scan/sess-123/status')
  })

  it('getScanResults calls GET /v1/admin/library/scan/:sessionId with pagination', async () => {
    await adminAPI.getScanResults('sess-123', 2, 25)
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/library/scan/sess-123', { params: { page: 2, per_page: 25 } })
  })

  it('updateScanItem calls PUT /v1/admin/library/scan/items/:id', async () => {
    const data = { title: 'Updated' }
    await adminAPI.updateScanItem(10, data)
    expect(axios.put).toHaveBeenCalledWith('/v1/admin/library/scan/items/10', data)
  })

  it('importLibraryItems calls POST /v1/admin/library/import', async () => {
    await adminAPI.importLibraryItems('sess-123', [1, 2, 3])
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/library/import', {
      session_id: 'sess-123',
      item_ids: [1, 2, 3],
    })
  })

  it('searchTMDB calls POST /v1/admin/library/tmdb/search', async () => {
    await adminAPI.searchTMDB('Inception', 2010, 'movie')
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/library/tmdb/search', {
      query: 'Inception',
      year: 2010,
      media_type: 'movie',
    })
  })

  it('getTMDBStatus calls GET /v1/admin/library/tmdb/status', async () => {
    await adminAPI.getTMDBStatus()
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/library/tmdb/status')
  })

  // Tailscale
  it('getTailscaleStatus calls GET /v1/admin/tailscale/status', async () => {
    await adminAPI.getTailscaleStatus()
    expect(axios.get).toHaveBeenCalledWith('/v1/admin/tailscale/status')
  })

  it('startTailscale calls POST /v1/admin/tailscale/start', async () => {
    await adminAPI.startTailscale()
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/tailscale/start')
  })

  it('stopTailscale calls POST /v1/admin/tailscale/stop', async () => {
    await adminAPI.stopTailscale()
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/tailscale/stop')
  })

  it('restartTailscale calls POST /v1/admin/tailscale/restart', async () => {
    await adminAPI.restartTailscale()
    expect(axios.post).toHaveBeenCalledWith('/v1/admin/tailscale/restart')
  })
})

describe('userAPI — remaining methods', () => {
  let userAPI: any

  beforeEach(() => {
    jest.clearAllMocks()
    userAPI = require('@/lib/api').userAPI
  })

  it('getSeriesById calls GET /v1/series/:id', async () => {
    await userAPI.getSeriesById(15)
    expect(axios.get).toHaveBeenCalledWith('/v1/series/15')
  })

  it('getSeriesEpisodes calls GET /v1/series/:id/episodes', async () => {
    await userAPI.getSeriesEpisodes(15)
    expect(axios.get).toHaveBeenCalledWith('/v1/series/15/episodes')
  })

  it('getCategories calls GET /v1/categories with type param', async () => {
    await userAPI.getCategories('vod')
    expect(axios.get).toHaveBeenCalledWith('/v1/categories', { params: { type: 'vod' } })
  })

  it('getEPG calls GET /v1/epg with channel_id and date', async () => {
    await userAPI.getEPG(5, '2024-01-15')
    expect(axios.get).toHaveBeenCalledWith('/v1/epg', { params: { channel_id: 5, date: '2024-01-15' } })
  })

  it('recordHistory calls POST /v1/history', async () => {
    const data = { content_type: 'vod', content_id: 10, progress: 300, duration: 7200 }
    await userAPI.recordHistory(data)
    expect(axios.post).toHaveBeenCalledWith('/v1/history', data)
  })
})

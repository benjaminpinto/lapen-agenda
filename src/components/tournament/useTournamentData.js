import {useCallback, useEffect, useRef, useState} from 'react'
import {errorMessage, getJson} from './tournamentApi'

export const POLL_INTERVAL_MS = 60_000

/**
 * Loads `url` and keeps it fresh: one request every minute while the tab is visible, none while it is hidden,
 * and a catch-up refresh when the tab comes back after a minute or more. A request still running when a new one
 * starts (or when the url changes or the screen closes) is cancelled, so a slow answer never overwrites a newer one.
 * `url` null does nothing.
 */
export default function useTournamentData(url, { pollMs = POLL_INTERVAL_MS } = {}) {
  const [state, setState] = useState({ url, data: null, error: null, status: null, updatedAt: null })
  const [refreshing, setRefreshing] = useState(false)
  const controller = useRef(null)
  const lastFetch = useRef(0)

  const load = useCallback(async (background) => {
    if (!url) return
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    if (background) setRefreshing(true)
    const result = await getJson(url, current.signal)
    if (current.signal.aborted) return
    lastFetch.current = Date.now()
    setRefreshing(false)
    setState((previous) => {
      const same = previous.url === url
      return result.ok
        ? { url, data: result.data, error: null, status: result.status, updatedAt: new Date() }
        : { url, data: same ? previous.data : null, error: errorMessage(result), status: result.status, updatedAt: same ? previous.updatedAt : null }
    })
  }, [url])

  useEffect(() => {
    load(false)
    const tick = () => {
      if (!document.hidden) load(true)
    }
    const onVisibility = () => {
      if (!document.hidden && Date.now() - lastFetch.current >= pollMs) load(true)
    }
    const timer = setInterval(tick, pollMs)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      controller.current?.abort()
    }
  }, [load, pollMs])

  const current = state.url === url
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    status: current ? state.status : null,
    updatedAt: current ? state.updatedAt : null,
    loading: Boolean(url) && !(current && (state.data || state.error)),
    refreshing,
    refresh: () => load(true),
  }
}

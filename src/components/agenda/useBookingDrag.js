import {useEffect, useRef, useState} from 'react'

const HOLD_MS = 350      // touch: press and hold this long to pick a card up
const TOUCH_SLOP = 10    // touch: moving more than this before the hold ends means the user is scrolling
const MOUSE_SLOP = 5     // mouse: moving more than this with the button down starts a drag
const EDGE = 80          // px from the viewport edge where the page scrolls by itself
const SETTLE_MS = 200    // the card gliding into its new slot (or back home)

// Drop targets mark themselves with data-drop-court / data-drop-slot.
const targetAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-drop-court]')
    return el ? {courtId: Number(el.dataset.dropCourt), slot: el.dataset.dropSlot, el} : null
}

const swallowNextClick = () => {
    const swallow = (e) => { e.preventDefault(); e.stopPropagation() }
    window.addEventListener('click', swallow, {capture: true, once: true})
    setTimeout(() => window.removeEventListener('click', swallow, {capture: true}), 50)
}

/**
 * Drag a booking card onto a free slot, with mouse (drag past a few pixels) or touch
 * (press and hold, then drag — before the hold ends the page scrolls as usual).
 * `bind(payload)` goes on each draggable card; `onDrop(payload, {courtId, slot})` runs on a valid drop.
 * Returns `drag` (ghost position, hovered target) and `pressing` (card being held) for rendering.
 */
export default function useBookingDrag(onDrop) {
    const [drag, setDrag] = useState(null)
    const [pressing, setPressing] = useState(null)
    const session = useRef(null)
    const onDropRef = useRef(onDrop)
    onDropRef.current = onDrop

    useEffect(() => () => session.current?.cleanup(), [])

    const begin = (e, payload, point, isTouch) => {
        session.current?.cleanup()
        const el = e.currentTarget
        const rect = el.getBoundingClientRect()
        const s = {x: point.x, y: point.y, active: false, target: null, timer: null, raf: null}
        const grabX = point.x - rect.left
        const grabY = point.y - rect.top
        session.current = s

        const render = (extra) => setDrag({
            payload, width: rect.width, height: rect.height,
            x: s.x - grabX, y: s.y - grabY,
            over: s.target && {courtId: s.target.courtId, slot: s.target.slot},
            ...extra,
        })
        const update = () => { s.target = targetAt(s.x, s.y); render() }

        const autoScroll = () => {
            const v = s.y < EDGE ? -(EDGE - s.y) / 5 : s.y > innerHeight - EDGE ? (s.y - innerHeight + EDGE) / 5 : 0
            if (v) { window.scrollBy(0, v); update() }
            s.raf = requestAnimationFrame(autoScroll)
        }

        const activate = () => {
            s.active = true
            setPressing(null)
            navigator.vibrate?.(15)
            document.body.classList.add('booking-dragging')
            update()
            s.raf = requestAnimationFrame(autoScroll)
        }

        const move = (point, ev) => {
            s.x = point.x
            s.y = point.y
            if (!s.active) {
                const dist = Math.hypot(point.x - rect.left - grabX, point.y - rect.top - grabY)
                if (isTouch && dist > TOUCH_SLOP) s.cleanup()
                else if (!isTouch && dist > MOUSE_SLOP) activate()
                return
            }
            if (ev.cancelable) ev.preventDefault()  // keep the page still while a card is in hand
            update()
        }

        const end = (ev, drop = true) => {
            const wasActive = s.active
            s.cleanup()
            if (!wasActive) return
            if (ev?.cancelable) ev.preventDefault()
            swallowNextClick()  // releasing a card is not a tap on it
            const target = drop ? targetAt(s.x, s.y) : null
            const home = el.isConnected ? el.getBoundingClientRect() : rect
            const dest = target ? target.el.getBoundingClientRect() : home
            render({settle: {x: dest.left, y: dest.top, width: dest.width, height: dest.height}, over: null})
            setTimeout(() => {
                setDrag(null)
                if (target) onDropRef.current(payload, {courtId: target.courtId, slot: target.slot})
            }, SETTLE_MS)
        }

        const onTouchMove = (ev) => ev.touches.length === 1 && move({x: ev.touches[0].clientX, y: ev.touches[0].clientY}, ev)
        const onPointerMove = (ev) => move({x: ev.clientX, y: ev.clientY}, ev)
        const onCancel = (ev) => end(ev, false)
        const onKey = (ev) => ev.key === 'Escape' && end(ev, false)
        const onScroll = () => { if (!s.active) s.cleanup() }  // page scrolled during the hold: not a drag

        s.cleanup = () => {
            clearTimeout(s.timer)
            cancelAnimationFrame(s.raf)
            if (isTouch) {
                window.removeEventListener('touchmove', onTouchMove)
                window.removeEventListener('touchend', end)
                window.removeEventListener('touchcancel', onCancel)
                window.removeEventListener('scroll', onScroll, true)
            } else {
                window.removeEventListener('pointermove', onPointerMove)
                window.removeEventListener('pointerup', end)
                window.removeEventListener('pointercancel', onCancel)
            }
            window.removeEventListener('keydown', onKey)
            document.body.classList.remove('booking-dragging')
            setPressing(null)
            if (session.current === s) session.current = null
        }

        if (isTouch) {
            // Non-passive so the page can be held still once the card is picked up
            window.addEventListener('touchmove', onTouchMove, {passive: false})
            window.addEventListener('touchend', end)
            window.addEventListener('touchcancel', onCancel)
            window.addEventListener('scroll', onScroll, true)
            setPressing(payload.key)
            s.timer = setTimeout(activate, HOLD_MS)
        } else {
            window.addEventListener('pointermove', onPointerMove)
            window.addEventListener('pointerup', end)
            window.addEventListener('pointercancel', onCancel)
        }
        window.addEventListener('keydown', onKey)
    }

    const bind = (payload) => ({
        onPointerDown: (e) => {
            if (e.pointerType === 'touch' || e.button !== 0) return
            begin(e, payload, {x: e.clientX, y: e.clientY}, false)
        },
        onTouchStart: (e) => {
            if (e.touches.length !== 1) return
            begin(e, payload, {x: e.touches[0].clientX, y: e.touches[0].clientY}, true)
        },
        onContextMenu: (e) => e.preventDefault(),  // Android long-press menu
        onDragStart: (e) => e.preventDefault(),    // no native HTML5 drag image
    })

    return {drag, pressing, bind}
}

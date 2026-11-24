import {useEffect, useMemo, useState} from 'react'
import {Link, useNavigate} from 'react-router-dom'
import {Ban, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GraduationCap, Plus, X} from 'lucide-react'
import {getLocalDateString} from '@/utils/dateUtils'

const SLOT_MINUTES = 90
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const WEEKDAYS_LONG = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const parseDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d)
}
const shiftDate = (iso, days) => {
    const date = parseDate(iso)
    date.setDate(date.getDate() + days)
    return getLocalDateString(date)
}
const toMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
}
const slotEnd = (slot) => {
    const end = toMinutes(slot) + SLOT_MINUTES
    return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}
// "Eduardo Regueira - Q1" -> "Q1"; names without a suffix keep their first word.
const courtShort = (name) => name.includes(' - ') ? name.split(' - ').pop().trim() : name.split(' ')[0]
// The courts people actually book; the rest start hidden but are one tap away in the selector.
const MAIN_COURTS = ['Q1', 'Q2']
const defaultCourtIds = (courts) => {
    const main = courts.filter(c => MAIN_COURTS.includes(courtShort(c.name))).map(c => c.id)
    return main.length ? main : courts.map(c => c.id)
}
const firstName = (name) => (name || '').trim().split(' ')[0]

// Which status wins when several things share a slot.
const statusOf = (items) => {
    if (!items || items.length === 0) return 'free'
    if (items.some(i => i.kind === 'blocked')) return 'blocked'
    if (items.some(i => i.kind === 'booked')) return 'booked'
    return 'recurring'
}

const STATUS_LABEL = {free: 'Livre', booked: 'Jogo', recurring: 'Aula / fixo', blocked: 'Bloqueado'}

const isPast = (date, slot, now) => {
    const today = getLocalDateString(now)
    if (date !== today) return date < today
    return toMinutes(slot) <= now.getHours() * 60 + now.getMinutes()
}

const CourtAvailability = ({compact = false, defaultMode = 'week'}) => {
    const navigate = useNavigate()
    const today = getLocalDateString()
    const [anchor, setAnchor] = useState(today)
    const [selectedDay, setSelectedDay] = useState(today)
    const [mode, setMode] = useState(compact ? 'day' : defaultMode)
    const [pickedCourts, setPickedCourts] = useState(null)
    const [data, setData] = useState(null)
    const [error, setError] = useState(false)
    const [sheet, setSheet] = useState(null)
    const now = new Date()

    useEffect(() => {
        let cancelled = false
        setError(false)
        fetch(`/api/public/availability/week?date=${anchor}`)
            .then(r => (r.ok ? r.json() : Promise.reject(r)))
            .then(json => { if (!cancelled) setData(json) })
            .catch(() => { if (!cancelled) setError(true) })
        return () => { cancelled = true }
    }, [anchor])

    const cellMap = useMemo(() => {
        const map = {}
        data?.cells.forEach(c => { map[`${c.court_id}|${c.date}|${c.slot}`] = c.items })
        return map
    }, [data])

    const itemsAt = (courtId, date, slot) => cellMap[`${courtId}|${date}|${slot}`] || []

    const goWeek = (direction) => {
        const next = shiftDate(anchor, direction * 7)
        setAnchor(next)
        setSelectedDay(shiftDate(selectedDay, direction * 7))
    }
    const goToday = () => { setAnchor(today); setSelectedDay(today) }

    const book = (courtId, date, slot) => navigate(`/schedule?court_id=${courtId}&date=${date}&time=${slot}`)

    if (error) {
        return <p className="text-sm text-muted-foreground py-6 text-center">Não foi possível carregar a agenda.</p>
    }
    if (!data) {
        return <div className="h-72 rounded-2xl bg-muted/60 animate-pulse" data-testid="availability-loading" />
    }

    const {dates, slots, courts} = data
    const shownIds = pickedCourts ?? defaultCourtIds(courts)
    const visibleCourts = courts.filter(c => shownIds.includes(c.id))
    const allShown = visibleCourts.length === courts.length
    const toggleCourt = (id) => setPickedCourts(prev => {
        const current = prev ?? defaultCourtIds(courts)
        const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
        return next.length ? next : current  // at least one court stays on
    })
    const first = parseDate(dates[0])
    const last = parseDate(dates[6])
    const weekLabel = first.getMonth() === last.getMonth()
        ? `${first.getDate()}–${last.getDate()} ${MONTHS[last.getMonth()]}`
        : `${first.getDate()} ${MONTHS[first.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]}`
    const isCurrentWeek = dates.includes(today)

    const freeCount = (date, courtList = visibleCourts) => slots.reduce((n, slot) =>
        n + courtList.filter(c => !isPast(date, slot, now) && statusOf(itemsAt(c.id, date, slot)) === 'free').length, 0)

    const dayBlock = (date) => {
        const items = courts.length ? itemsAt(courts[0].id, date, slots[0]) : []
        return items.find(i => i.kind === 'blocked' && !i.start_time)
    }

    return (
        <div className="space-y-3 bg-background" data-testid="court-availability" data-weekly-calendar>
            {/* Week navigation */}
            <div className="flex items-center gap-2">
                <button type="button" onClick={() => goWeek(-1)} aria-label="Semana anterior"
                        className="h-10 w-10 shrink-0 rounded-full border bg-card grid place-items-center active:scale-95 transition"
                        data-testid="availability-prev-week">
                    <ChevronLeft className="h-4 w-4"/>
                </button>
                <div className="flex-1 text-center leading-tight">
                    <div className="font-display text-lg font-bold tracking-tight" data-testid="availability-week-label">{weekLabel}</div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        {isCurrentWeek ? 'Esta semana' : first.getFullYear()}
                    </div>
                </div>
                {!isCurrentWeek && (
                    <button type="button" onClick={goToday}
                            className="h-10 px-3 shrink-0 rounded-full border bg-card text-sm font-semibold text-primary"
                            data-testid="availability-today">
                        Hoje
                    </button>
                )}
                <button type="button" onClick={() => goWeek(1)} aria-label="Próxima semana"
                        className="h-10 w-10 shrink-0 rounded-full border bg-card grid place-items-center active:scale-95 transition"
                        data-testid="availability-next-week">
                    <ChevronRight className="h-4 w-4"/>
                </button>
            </div>

            {!compact && (
                <div className="grid grid-cols-2 p-1 rounded-full bg-muted text-sm font-semibold" role="tablist">
                    {[['week', 'Semana'], ['day', 'Dia']].map(([value, label]) => (
                        <button key={value} type="button" role="tab" aria-selected={mode === value}
                                onClick={() => setMode(value)}
                                className={`h-10 rounded-full transition ${mode === value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                                data-testid={`availability-mode-${value}`}>
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {/* Court filter: several courts can be shown at once */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" data-testid="availability-courts">
                <button type="button" onClick={() => setPickedCourts(courts.map(c => c.id))}
                        aria-pressed={allShown}
                        className={`min-h-0 h-9 px-4 shrink-0 rounded-full text-sm font-semibold border transition ${allShown
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-card text-muted-foreground'}`}
                        data-testid="availability-court-all">
                    Todas
                </button>
                {courts.map(c => {
                    const on = shownIds.includes(c.id)
                    return (
                        <button key={c.id} type="button" onClick={() => toggleCourt(c.id)} aria-pressed={on}
                                className={`min-h-0 h-9 px-4 shrink-0 rounded-full text-sm font-semibold border transition ${on
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card text-muted-foreground border-dashed'}`}
                                title={`${c.name} · ${c.type}`}
                                data-testid={`availability-court-${c.id}`}>
                            {courtShort(c.name)}
                        </button>
                    )
                })}
            </div>

            {mode === 'week' ? (
                <>
                    <WeekGrid
                        dates={dates} slots={slots} courts={visibleCourts} today={today} now={now}
                        itemsAt={itemsAt}
                        onSelect={(date, slot) => setSheet({date, slot})}
                        onPickDay={(date) => { setSelectedDay(date); setMode('day') }}
                    />
                </>
            ) : (
                <>
                    <DayStrip dates={dates} today={today} selected={selectedDay}
                              onSelect={setSelectedDay} freeCount={freeCount} dayBlock={dayBlock}/>
                    <DayTable key={selectedDay} date={selectedDay} slots={slots} courts={visibleCourts} now={now}
                              itemsAt={itemsAt} dayBlock={dayBlock(selectedDay)}
                              onBook={book} onSelect={(slot) => setSheet({date: selectedDay, slot})}/>
                </>
            )}

            <Legend/>

            {compact && (
                <Link to="/view" className="block text-center text-sm font-semibold text-primary py-2"
                      data-testid="availability-see-week">
                    Ver a semana inteira →
                </Link>
            )}

            {sheet && (
                <SlotSheet
                    date={sheet.date} slot={sheet.slot} courts={visibleCourts}
                    past={isPast(sheet.date, sheet.slot, now)} itemsAt={itemsAt}
                    onBook={book} onClose={() => setSheet(null)}
                />
            )}
        </div>
    )
}

const cellClass = (status, past) => {
    const base = {
        free: 'cell-free',
        booked: 'cell-booked',
        recurring: 'cell-recurring',
        blocked: 'cell-blocked',
    }[status]
    return `${base} ${past ? 'opacity-35' : ''}`
}

const WeekGrid = ({dates, slots, courts, today, now, itemsAt, onSelect, onPickDay}) => (
    <div className="rounded-2xl border bg-card p-2 sm:p-3 shadow-sm">
        <div className="grid gap-[3px]" style={{gridTemplateColumns: '2.6rem repeat(7, minmax(0, 1fr))'}}>
            <div/>
            {dates.map((date, i) => {
                const isToday = date === today
                return (
                    <button key={date} type="button" onClick={() => onPickDay(date)}
                            className="min-w-0 min-h-0 flex flex-col items-center py-1 rounded-lg active:bg-muted"
                            data-testid={`week-day-${date}`}>
                        <span className={`text-[10px] uppercase tracking-wider ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                            {WEEKDAYS[i]}
                        </span>
                        <span className={`mt-0.5 h-7 w-7 grid place-items-center rounded-full text-sm font-bold tabular-nums ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
                            {parseDate(date).getDate()}
                        </span>
                    </button>
                )
            })}

            {slots.map(slot => (
                <div key={slot} className="contents">
                    <div className="text-[11px] tabular-nums text-muted-foreground flex items-center justify-end pr-1.5 font-medium">
                        {slot}
                    </div>
                    {dates.map(date => {
                        const past = isPast(date, slot, now)
                        return (
                            <button key={date} type="button" onClick={() => onSelect(date, slot)}
                                    className={`min-w-0 min-h-0 h-9 flex gap-px p-0 rounded-[7px] overflow-hidden bg-border ring-1 ring-inset ring-border focus-visible:ring-2 focus-visible:ring-ring ${past ? 'opacity-40' : ''}`}
                                    aria-label={`${date} ${slot}`}
                                    data-testid={`week-cell-${date}-${slot}`}>
                                {courts.map(c => {
                                    const items = itemsAt(c.id, date, slot)
                                    const status = statusOf(items)
                                    return (
                                        <span key={c.id}
                                              className={`flex-1 h-full grid place-items-center ${status === 'free' ? 'seg-free' : cellClass(status, false)}`}>
                                            {courts.length === 1 && status === 'booked' && (
                                                <span className="text-[9px] font-bold leading-none text-white/95">
                                                    {items.find(i => i.kind === 'booked')?.match_type?.[0]}
                                                </span>
                                            )}
                                        </span>
                                    )
                                })}
                            </button>
                        )
                    })}
                </div>
            ))}
        </div>
        {courts.length > 1 && (
            <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Cada horário mostra {courts.map(c => courtShort(c.name)).join(' · ')} lado a lado. Toque para detalhes.
            </p>
        )}
    </div>
)

const DayStrip = ({dates, today, selected, onSelect, freeCount, dayBlock}) => (
    <div className="grid grid-cols-7 gap-1">
        {dates.map((date, i) => {
            const active = date === selected
            const closed = dayBlock(date)
            const free = freeCount(date)
            return (
                <button key={date} type="button" onClick={() => onSelect(date)}
                        className={`min-w-0 min-h-0 flex flex-col items-center py-2 rounded-xl border transition ${active
                            ? 'bg-foreground text-background border-foreground shadow'
                            : 'bg-card'}`}
                        data-testid={`day-pill-${date}`}>
                    <span className={`text-[10px] uppercase tracking-wider ${active ? 'opacity-80' : date === today ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                        {date === today ? 'Hoje' : WEEKDAYS[i]}
                    </span>
                    <span className="text-base font-bold tabular-nums leading-tight">{parseDate(date).getDate()}</span>
                    <span className={`mt-0.5 text-[9px] font-semibold tabular-nums ${active ? 'opacity-80' : closed ? 'text-stone-500' : free ? 'text-primary' : 'text-muted-foreground'}`}>
                        {closed ? 'fechado' : `${free} livre${free === 1 ? '' : 's'}`}
                    </span>
                </button>
            )
        })}
    </div>
)

// Most bookings are in the evening: the day opens on PRIME_START onwards and earlier slots
// (plus, today, the ones already gone) fold behind a toggle in the middle of the table.
const PRIME_START = '16:30'

const DayTable = ({date, slots, courts, now, itemsAt, dayBlock, onBook, onSelect}) => {
    const d = parseDate(date)
    const weekday = WEEKDAYS_LONG[(d.getDay() + 6) % 7]
    const [expanded, setExpanded] = useState(false)
    const isToday = date === getLocalDateString(now)
    const folded = slots.filter(slot => slot < PRIME_START || (isToday && isPast(date, slot, now)))
    const canFold = folded.length > 0 && folded.length < slots.length
    const visibleSlots = canFold && !expanded ? slots.filter(slot => !folded.includes(slot)) : slots
    const lastFolded = folded[folded.length - 1]

    const foldedGames = folded.reduce((n, slot) =>
        n + courts.filter(c => statusOf(itemsAt(c.id, date, slot)) !== 'free').length, 0)
    const foldedFree = folded.reduce((n, slot) =>
        n + (isPast(date, slot, now) ? 0 : courts.filter(c => statusOf(itemsAt(c.id, date, slot)) === 'free').length), 0)
    const foldedSummary = [
        foldedGames && `${foldedGames} ocupado${foldedGames === 1 ? '' : 's'}`,
        foldedFree && `${foldedFree} livre${foldedFree === 1 ? '' : 's'}`,
    ].filter(Boolean).join(' · ')

    const FoldToggle = () => (
        <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}
                style={{gridColumn: '1 / -1'}}
                className="min-h-0 my-0.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground active:text-foreground"
                data-testid="day-fold-toggle">
            <span className="h-px flex-1 bg-border"/>
            <span className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 shadow-sm">
                {expanded ? <ChevronDown className="h-3.5 w-3.5 text-primary"/> : <ChevronUp className="h-3.5 w-3.5 text-primary"/>}
                {expanded
                    ? 'Recolher'
                    : <>{folded[0]}–{lastFolded}{foldedSummary && <span className="font-normal">· {foldedSummary}</span>}</>}
            </span>
            <span className="h-px flex-1 bg-border"/>
        </button>
    )

    return (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden" data-testid="day-table">
            <div className="px-3 py-2.5 border-b">
                <span className="font-display font-bold">{weekday}, {d.getDate()} {MONTHS[d.getMonth()]}</span>
            </div>
            {dayBlock && (
                <div className="m-3 mb-0 rounded-xl cell-blocked text-white px-3 py-2.5 text-sm flex items-center gap-2"
                     data-testid="day-closed-banner">
                    <Ban className="h-4 w-4 shrink-0"/>
                    <span><b>Quadras fechadas</b> · {dayBlock.description}</span>
                </div>
            )}
            <div className="p-2 sm:p-3">
                <div className="grid gap-1" style={{gridTemplateColumns: `2.9rem repeat(${courts.length}, minmax(0, 1fr))`}}>
                    <div/>
                    {courts.map(c => (
                        <div key={c.id} className="text-center pb-1 min-w-0">
                            <div className="text-xs font-bold truncate">{courtShort(c.name)}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{c.type}</div>
                        </div>
                    ))}
                    {canFold && !expanded && <FoldToggle/>}
                    {visibleSlots.map(slot => {
                        const past = isPast(date, slot, now)
                        return (
                            <div key={slot} className="contents">
                                <div className={`text-[11px] tabular-nums font-semibold flex flex-col justify-center items-end pr-1 leading-tight ${past ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                                    <span>{slot}</span>
                                </div>
                                {courts.map(c => (
                                    <DayCell key={c.id} items={itemsAt(c.id, date, slot)} past={past}
                                             onBook={() => onBook(c.id, date, slot)}
                                             onDetails={() => onSelect(slot)}
                                             testId={`day-cell-${c.id}-${slot}`}/>
                                ))}
                                {canFold && expanded && slot === lastFolded && <FoldToggle/>}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

const DayCell = ({items, past, onBook, onDetails, testId}) => {
    const status = statusOf(items)
    const base = 'min-w-0 min-h-0 h-11 w-full rounded-lg px-1.5 text-left flex flex-col justify-center overflow-hidden transition active:scale-[0.97]'
    if (status === 'free') {
        if (past) return <div className="h-7 rounded-lg bg-muted/60 grid place-items-center text-xs text-muted-foreground/50" data-testid={testId}>—</div>
        return (
            <button type="button" onClick={onBook} className={`${base} cell-free items-center text-primary`}
                    data-testid={testId} data-status="free">
                <span className="flex items-center gap-0.5 text-xs font-bold"><Plus className="h-3.5 w-3.5"/>Livre</span>
            </button>
        )
    }
    const booked = items.find(i => i.kind === 'booked')
    const other = items.find(i => i.kind === status)
    return (
        <button type="button" onClick={onDetails} className={`${base} ${cellClass(status, past)} text-white`}
                data-testid={testId} data-status={status}>
            {status === 'booked' ? (
                <>
                    <span className="text-[11px] font-bold leading-tight truncate w-full">{firstName(booked.player1_name)}</span>
                    <span className="text-[11px] font-bold leading-tight truncate w-full"><span className="opacity-70 font-normal">×</span> {firstName(booked.player2_name)}</span>
                </>
            ) : (
                <span className="text-[11px] font-semibold leading-tight line-clamp-2 flex items-start gap-1">
                    {status === 'recurring' ? <GraduationCap className="h-3 w-3 shrink-0 mt-px"/> : <Ban className="h-3 w-3 shrink-0 mt-px"/>}
                    {other?.description || STATUS_LABEL[status]}
                </span>
            )}
        </button>
    )
}

const Legend = () => (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        {['free', 'booked', 'recurring', 'blocked'].map(s => (
            <span key={s} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded-[4px] ${cellClass(s, false)}`}/>
                {STATUS_LABEL[s]}
            </span>
        ))}
    </div>
)

const SlotSheet = ({date, slot, courts, past, itemsAt, onBook, onClose}) => {
    const d = parseDate(date)
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])
    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" data-testid="slot-sheet">
            <div className="absolute inset-0 bg-black/40 animate-fade" onClick={onClose}/>
            <div className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-sheet">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted sm:hidden"/>
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            {WEEKDAYS_LONG[(d.getDay() + 6) % 7]}, {d.getDate()} {MONTHS[d.getMonth()]}
                        </div>
                        <div className="font-display text-2xl font-bold tabular-nums">{slot}<span className="text-muted-foreground font-medium text-lg"> – {slotEnd(slot)}</span></div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar"
                            className="h-10 w-10 rounded-full bg-muted grid place-items-center" data-testid="slot-sheet-close">
                        <X className="h-4 w-4"/>
                    </button>
                </div>
                <div className="space-y-2">
                    {courts.map(c => {
                        const items = itemsAt(c.id, date, slot)
                        const status = statusOf(items)
                        return (
                            <div key={c.id} className="flex items-center gap-3 rounded-2xl border p-3" data-testid={`sheet-court-${c.id}`}>
                                <span className={`h-10 w-1.5 rounded-full ${cellClass(status, false)}`}/>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold truncate">{c.name}</div>
                                    {status === 'free' ? (
                                        <div className="text-xs text-muted-foreground">{past ? 'Horário já passou' : 'Livre'}</div>
                                    ) : items.map((item, idx) => (
                                        <div key={idx} className="text-xs text-muted-foreground truncate">
                                            {item.kind === 'booked'
                                                ? <><b className="text-foreground">{item.player1_name} × {item.player2_name}</b> · {item.match_type} · {item.start_time}</>
                                                : item.kind === 'recurring'
                                                    ? <>{item.description} · {item.start_time}–{item.end_time}</>
                                                    : <>{item.description}{item.start_time ? ` · ${item.start_time}–${item.end_time}` : ' · dia todo'}</>}
                                        </div>
                                    ))}
                                </div>
                                {status === 'free' && !past && (
                                    <button type="button" onClick={() => onBook(c.id, date, slot)}
                                            className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0 active:scale-95 transition"
                                            data-testid={`sheet-book-${c.id}`}>
                                        Agendar
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default CourtAvailability

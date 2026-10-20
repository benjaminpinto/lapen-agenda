import {dayTitle} from '../schedule/scheduleUtils'

// The day's summary drawn straight on a canvas (no DOM capture: html2canvas misplaces text vertically in current browsers),
// in the look of the app's other share cards: court background, dark panels, amber headings.

export const WIDTH = 1080
export const MIN_HEIGHT = 1350
const PAD = 48
const GAP = 24
const PANEL_PAD = 24
const HEADER_HEIGHT = 186
const TITLE_HEIGHT = 42
const GAME_ROW = 62
const GAMES_ROW = 68
const TODAY_SHOWN = 10
const NEXT_SHOWN = 6
const EMPTY_HEIGHT = 120
const FOOTER_HEIGHT = 40
const BACKGROUND = '/summary_share_bg.jpg'
const LOGO = '/lapen-logo.png'
const FONT = 'Inter, system-ui, Arial, Helvetica, sans-serif'
const MONO = '"SF Mono", Menlo, Consolas, monospace'
const AMBER = '#fcd34d'
const AMBER_STRONG = '#fbbf24'
const SOFT = '#e7e5e4'

/** Where every block of the picture goes (top, height) and how tall the picture is: at least 4:5, taller for a full day. */
export function layoutSummary(data) {
  const blocks = [{ type: 'header', height: HEADER_HEIGHT }]
  if (data.total === 0) {
    blocks.push({ type: 'empty', height: EMPTY_HEIGHT })
  } else {
    for (const category of data.categories) {
      blocks.push({ type: 'category', category, height: PANEL_PAD + TITLE_HEIGHT + 8 + category.games.length * GAME_ROW + PANEL_PAD })
    }
  }
  const lists = [
    [data.pending, TODAY_SHOWN, data.pendingTitle.toUpperCase()],
    [data.next, NEXT_SHOWN, data.nextDay && `PRÓXIMOS JOGOS · ${dayTitle(data.nextDay).toUpperCase()}`],
  ]
  for (const [games, limit, title] of lists) {
    if (games.length === 0) continue
    const shown = games.slice(0, limit)
    const hidden = games.length - shown.length
    blocks.push({ type: 'games', title, shown, hidden, height: PANEL_PAD + TITLE_HEIGHT + 8 + shown.length * GAMES_ROW + (hidden > 0 ? 36 : 0) + PANEL_PAD })
  }
  let y = PAD
  for (const block of blocks) {
    block.y = y
    y += block.height + GAP
  }
  return { blocks, height: Math.max(MIN_HEIGHT, y + FOOTER_HEIGHT + PAD) }
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = reject
  image.src = src
})

const panel = (ctx, y, height) => {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.beginPath()
  ctx.roundRect(PAD, y, WIDTH - 2 * PAD, height, 16)
  ctx.fill()
}

const text = (ctx, value, x, y, { font, color, align = 'left', spacing = 0 }) => {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`
  ctx.fillText(value, x, y)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
}

/** The text cut with an ellipsis so that it fits `maxWidth` (in the context's current font). */
const fit = (ctx, value, font, maxWidth) => {
  ctx.font = font
  if (ctx.measureText(value).width <= maxWidth) return value
  let cut = value
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

function drawHeader(ctx, block, { tournamentName, data, logo }) {
  panel(ctx, block.y, block.height)
  const centre = block.y + block.height / 2
  ctx.save()
  ctx.beginPath()
  ctx.arc(PAD + PANEL_PAD + 56, centre, 56, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(logo, PAD + PANEL_PAD, centre - 56, 112, 112)
  ctx.restore()
  const left = PAD + PANEL_PAD + 112 + 32
  const right = WIDTH - PAD - PANEL_PAD
  const counterRoom = data.total > 0 ? 120 : 0
  text(ctx, 'RESUMO DO DIA', left, block.y + 48, { font: `600 22px ${FONT}`, color: AMBER, spacing: 5 })
  text(ctx, fit(ctx, tournamentName, `700 46px ${FONT}`, right - left - counterRoom), left, block.y + 98, { font: `700 46px ${FONT}`, color: '#ffffff' })
  text(ctx, dayTitle(data.day), left, block.y + 144, { font: `400 30px ${FONT}`, color: '#fde68a' })
  if (data.total > 0) {
    text(ctx, String(data.total), right - 40, block.y + 76, { font: `700 64px ${FONT}`, color: AMBER_STRONG, align: 'center' })
    text(ctx, data.total === 1 ? 'jogo' : 'jogos', right - 40, block.y + 130, { font: `400 22px ${FONT}`, color: SOFT, align: 'center' })
  }
}

function drawCategory(ctx, block, pill) {
  panel(ctx, block.y, block.height)
  text(ctx, block.category.name.toUpperCase(), PAD + PANEL_PAD, block.y + PANEL_PAD + TITLE_HEIGHT / 2, { font: `700 28px ${FONT}`, color: AMBER, spacing: 1 })
  const centreX = WIDTH / 2
  const reach = (WIDTH - 2 * PAD - 2 * PANEL_PAD - pill) / 2 - 20
  block.category.games.forEach((game, index) => {
    const top = block.y + PANEL_PAD + TITLE_HEIGHT + 8 + index * GAME_ROW
    const middle = top + GAME_ROW / 2
    if (index > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.fillRect(PAD + PANEL_PAD, top, WIDTH - 2 * PAD - 2 * PANEL_PAD, 1)
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.beginPath()
    ctx.roundRect(centreX - pill / 2, middle - 23, pill, 46, 10)
    ctx.fill()
    text(ctx, game.score, centreX, middle, { font: `400 24px ${MONO}`, color: '#ffffff', align: 'center' })
    ;[[game.first, 1, 'right'], [game.second, 2, 'left']].forEach(([name, side, align]) => {
      const font = `${game.winner === side ? 700 : 400} 26px ${FONT}`
      const x = align === 'right' ? centreX - pill / 2 - 20 : centreX + pill / 2 + 20
      text(ctx, fit(ctx, name, font, reach), x, middle, { font, color: game.winner === side ? AMBER : SOFT, align })
    })
  })
}

function drawGames(ctx, block) {
  panel(ctx, block.y, block.height)
  text(ctx, block.title, PAD + PANEL_PAD, block.y + PANEL_PAD + TITLE_HEIGHT / 2, { font: `700 28px ${FONT}`, color: AMBER, spacing: 1 })
  const room = WIDTH - 2 * PAD - 2 * PANEL_PAD
  block.shown.forEach((match, index) => {
    const top = block.y + PANEL_PAD + TITLE_HEIGHT + 8 + index * GAMES_ROW
    const detail = `${match.time} · ${match.court} · ${match.category}`
    text(ctx, fit(ctx, detail, `400 20px ${FONT}`, room), PAD + PANEL_PAD, top + 16, { font: `400 20px ${FONT}`, color: '#fde68a' })
    text(ctx, fit(ctx, `${match.first} × ${match.second}`, `400 24px ${FONT}`, room), PAD + PANEL_PAD, top + 46, { font: `400 24px ${FONT}`, color: '#ffffff' })
  })
  if (block.hidden > 0) {
    text(ctx, `+ ${block.hidden} ${block.hidden === 1 ? 'jogo' : 'jogos'}`, PAD + PANEL_PAD, block.y + block.height - PANEL_PAD - 18, { font: `400 22px ${FONT}`, color: '#d6d3d1' })
  }
}

/** Draws the summary (data from summaryData) and resolves to the PNG. */
export async function drawSummary({ tournamentName, data }) {
  const [background, logo] = await Promise.all([loadImage(BACKGROUND), loadImage(LOGO)])
  await Promise.allSettled([document.fonts.load(`700 26px ${FONT}`), document.fonts.load(`400 26px ${FONT}`)])
  const { blocks, height } = layoutSummary(data)
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')

  const scale = Math.max(WIDTH / background.width, height / background.height)
  ctx.drawImage(background, (WIDTH - background.width * scale) / 2, (height - background.height * scale) / 2, background.width * scale, background.height * scale)
  const shade = ctx.createLinearGradient(0, 0, 0, height)
  shade.addColorStop(0, 'rgba(28, 25, 23, 0.35)')
  shade.addColorStop(1, 'rgba(28, 25, 23, 0.65)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, WIDTH, height)

  ctx.font = `400 24px ${MONO}`
  const scores = blocks.filter((b) => b.type === 'category').flatMap((b) => b.category.games.map((g) => ctx.measureText(g.score).width))
  const pill = Math.max(210, Math.ceil(Math.max(0, ...scores)) + 36)

  for (const block of blocks) {
    if (block.type === 'header') drawHeader(ctx, block, { tournamentName, data, logo })
    else if (block.type === 'category') drawCategory(ctx, block, pill)
    else if (block.type === 'games') drawGames(ctx, block)
    else {
      panel(ctx, block.y, block.height)
      text(ctx, 'Nenhum resultado lançado neste dia.', WIDTH / 2, block.y + block.height / 2, { font: `400 30px ${FONT}`, color: SOFT, align: 'center' })
    }
  }
  text(ctx, 'LAPEN · LIGA PENEDENSE DE TÊNIS', WIDTH / 2, height - PAD - FOOTER_HEIGHT / 2, { font: `600 22px ${FONT}`, color: '#fde68a', align: 'center', spacing: 4 })

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas vazio'))), 'image/png'))
}

const PROXY = url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
const PROXY2 = url => `https://corsproxy.io/?${encodeURIComponent(url)}`

const SOURCES = [
    { name: 'Polygon', color: '#ff4500', feed: 'https://www.polygon.com/rss/index.xml' },
    { name: 'IGN', color: '#e2002a', feed: 'https://feeds.ign.com/ign/games-all' },
    { name: 'Kotaku', color: '#00c99a', feed: 'https://kotaku.com/rss' },
    { name: 'Eurogamer', color: '#ff7c1f', feed: 'https://www.eurogamer.net/feed' },
    { name: 'GameSpot', color: '#ffcc00', feed: 'https://www.gamespot.com/feeds/mashup/' },
    { name: 'VGC', color: '#a78bfa', feed: 'https://www.videogameschronicle.com/feed/' },
    { name: 'Xbox', color: '#52b043', feed: 'https://news.xbox.com/en-us/feed/' },
    { name: 'PlayStation', color: '#0070d1', feed: 'https://blog.playstation.com/feed/' },
    { name: 'Nintendo', color: '#e4001d', feed: 'https://www.nintendo.com/whatsnew/feed/news.xml' }
]

let knownUrls = new Set()
let isFirstLoad = true

function ageMs(d) { try { return Date.now() - new Date(d).getTime() } catch { return Infinity } }
function fmtAge(ms) { const m = Math.floor(ms / 60000); if (m < 2) return 'JUST NOW'; if (m < 60) return m + 'M AGO'; const h = Math.floor(m / 60); if (h < 24) return h + 'H AGO'; return Math.floor(h / 24) + 'D AGO' }
function cleanText(s) { if (!s) return ''; return s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() }

function parseXML(xmlStr) {
    try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(xmlStr, 'text/xml')
        const items = Array.from(doc.querySelectorAll('item, entry'))
        return items.map(item => {
            const get = (...tags) => { for (const t of tags) { const el = item.querySelector(t); if (el) return el.textContent || el.getAttribute('href') || '' } return '' }
            const link = item.querySelector('link')
            const url = link ? (link.textContent.trim() || link.getAttribute('href') || '') : ''
            const pubDate = get('pubDate', 'published', 'updated', 'dc\\:date')
            return { title: cleanText(get('title')), desc: cleanText(get('description', 'summary', 'content\\:encoded', 'content')).slice(0, 300), url, date: pubDate, age: ageMs(pubDate) }
        }).filter(a => a.title && a.url)
    } catch { return [] }
}

async function fetchFeed(src) {
    for (const proxyFn of [PROXY, PROXY2]) {
        try {
            const res = await fetch(proxyFn(src.feed), { signal: AbortSignal.timeout(10000) })
            if (!res.ok) continue
            const text = await res.text()
            let xmlStr
            try { const j = JSON.parse(text); xmlStr = j.contents || j.data || text } catch { xmlStr = text }
            if (!xmlStr || xmlStr.length < 100) continue
            const items = parseXML(xmlStr)
            if (!items.length) continue
            return items.map(a => ({ ...a, source: src.name, color: src.color }))
        } catch { }
    }
    return []
}

function loadAll(forceFullRender = false) {
    fetchAll(forceFullRender)
}

async function fetchAll(forceFullRender) {
    const btn = document.getElementById('btn')
    btn.disabled = true
    const results = await Promise.allSettled(SOURCES.map(fetchFeed))
    let articles = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
    const seen = new Set()
    articles = articles.filter(a => { if (!a.url || seen.has(a.url)) return false; seen.add(a.url); return true })
    articles = articles.sort((a, b) => a.age - b.age).slice(0, 20)
    render(articles)
    btn.disabled = false
}

function render(articles) {
    const container = document.getElementById('container')
    container.innerHTML = ''
    articles.forEach(a => {
        const el = document.createElement('div')
        el.className = 'card'
        el.innerHTML = `<div class="ctitle">${a.title}</div>`
        container.appendChild(el)
    })
}

document.getElementById('dateStr').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()
loadAll()
setInterval(() => loadAll(false), 5 * 60 * 1000)
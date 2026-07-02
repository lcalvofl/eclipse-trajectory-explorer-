import './style.css'
import * as d3 from 'd3'
import { feature } from 'topojson-client'

const width = 1800
const height = 790

const eclipseInfo = {
  '2026-08-12': {
    label: 'SPAIN · AUG 12, 2026',
    short: 'Aug 12, 2026 · Total',
    color: '#633806',
    opacity: 0.92,
    dash: null,
    type: 'Total',
    duration: '2m 18s',
    pathWidth: '178 km',
    pathWidthKm: 178,
    point: '40.2°N · 6.1°W',
    saros: '126'
  },
  '2027-08-02': {
    label: 'SPAIN · AUG 2, 2027',
    short: 'Aug 2, 2027 · Total',
    color: '#BA7517',
    opacity: 0.85,
    dash: null,
    type: 'Total',
    duration: '6m 23s',
    pathWidth: '258 km',
    pathWidthKm: 258,
    point: '25.5°N · 33.2°E',
    saros: '136'
  },
  '2028-01-26': {
    label: 'SPAIN · JAN 26, 2028',
    short: 'Jan 26, 2028 · Annular',
    color: '#EF9F27',
    opacity: 0.78,
    dash: '7 4',
    type: 'Annular',
    duration: '10m 27s',
    pathWidth: '323 km',
    pathWidthKm: 323,
    point: '12.4°S · 70.3°W',
    saros: '141'
  }
}

const spanishDates = new Set(Object.keys(eclipseInfo))

const pathWidthScale = d3.scaleSqrt()
  .domain([40, 350])
  .range([0.8, 1.8])
  .clamp(true)

document.querySelector('#app').innerHTML = `
  <main class="page">
    <a class="github-link" href="https://github.com/" target="_blank" rel="noreferrer">
      View on GitHub ↗
    </a>

    <header class="hero">
      <p class="eyebrow">FROM 1600 TO 2100</p>
      <h1>500 years of total solar eclipses</h1>
      <p class="subtitle">
        Official geometries calculated by Fred Espenak (NASA/GSFC). Each line represents the Moon's shadow crossing the Earth — darkness over the illuminated surface.
      </p>

      <section class="alert">
        <div class="alert-icon">⚠</div>
        <div>
          <p class="alert-title">3 eclipses visible from Spain — little known</p>
          <div class="pills">
            ${Object.values(eclipseInfo).map(d => `
              <span class="pill"><i style="background:${d.color}"></i>${d.short}</span>
            `).join('')}
          </div>
        </div>
      </section>
    </header>

    <section class="viz-layout">
      <section class="map-card">
        <svg id="map" viewBox="0 0 ${width} ${height}"></svg>
        <div id="tooltip" class="tooltip"></div>
        <div class="hint">● Hover over any maximum eclipse point for more information</div>
        <div class="source">
  Source: NASA/GSFC ·
  <a href="https://eclipsewise.com/" target="_blank" rel="noopener noreferrer">
    Fred Espenak
  </a>
</div>
        </section>
    </section>
  </main>
`

const svg = d3.select('#map')
const tooltipEl = document.getElementById('tooltip')
const mapCard = document.querySelector('.map-card')

Promise.all([
  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'),
  d3.json(`${import.meta.env.BASE_URL}data/eclipse_paths.geojson`)
]).then(([world, eclipses]) => {
  const countries = feature(world, world.objects.countries)

 const projection = d3.geoNaturalEarth1()
  .scale(300)
  .translate([width / 2, height / 2 - 20])

  const path = d3.geoPath(projection)

  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#ede8dc')

  const defs = svg.append('defs')

  defs.append('filter')
    .attr('id', 'softBlur')
    .append('feGaussianBlur')
    .attr('stdDeviation', 0.55)

  svg.append('g')
    .attr('class', 'countries')
    .selectAll('path')
    .data(countries.features)
    .join('path')
    .attr('d', path)
    .attr('fill', '#ddd8cc')
    .attr('stroke', 'rgba(26,24,20,0.16)')
    .attr('stroke-width', 0.45)

  const lines = eclipses.features.filter(d =>
    d.geometry?.type === 'LineString' &&
    d.properties?.name?.toLowerCase().includes('central')
  )

  const allPoints = eclipses.features.filter(d =>
    d.geometry?.type === 'Point' &&
    d.properties?.name?.toLowerCase().includes('greatest')
  )

  const historicalPoints = allPoints.filter(d => !spanishDates.has(d.properties?.date))
  const highlightedPoints = allPoints.filter(d => spanishDates.has(d.properties?.date))

  const historicalLines = []
  const highlightedLines = []

  lines.forEach(d => {
    if (spanishDates.has(d.properties?.date)) {
      highlightedLines.push(d)
    } else {
      historicalLines.push(d)
    }
  })

  const lineByDate = new Map(lines.map(d => [d.properties?.date, d]))

  const historicalGroup = svg.append('g').attr('class', 'historical')
  const highlightedGroup = svg.append('g').attr('class', 'highlighted')
  const pointLayer = svg.append('g').attr('class', 'points')

  // Líneas históricas — blur, oscuras, fondo
  historicalGroup
    .selectAll('.historical-line')
    .data(historicalLines)
    .join('path')
    .attr('class', d => `historical-line eclipse-line line-${safeDateClass(d.properties?.date)}`)
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', '#1a1814')
    .attr('stroke-width', d => pathWidthScale(getPathWidthKm(d)))
    .attr('stroke-opacity', 0.16)
    .attr('stroke-linecap', 'round')
    .attr('filter', 'url(#softBlur)')

  // Halo difuso líneas destacadas
  highlightedGroup
    .selectAll('.highlight-halo')
    .data(highlightedLines)
    .join('path')
    .attr('class', 'highlight-halo')
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', d => eclipseInfo[d.properties.date].color)
    .attr('stroke-width', d => pathWidthScale(getPathWidthKm(d)) + 3.2)
    .attr('stroke-opacity', 0.14)
    .attr('stroke-linecap', 'round')
    .attr('stroke-dasharray', d => eclipseInfo[d.properties.date].dash)

  // Líneas destacadas
  highlightedGroup
    .selectAll('.highlight-line')
    .data(highlightedLines)
    .join('path')
    .attr('class', 'highlight-line')
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', d => eclipseInfo[d.properties.date].color)
    .attr('stroke-width', d => pathWidthScale(getPathWidthKm(d)) + 1.4)
    .attr('stroke-opacity', d => eclipseInfo[d.properties.date].opacity)
    .attr('stroke-linecap', 'round')
    .attr('stroke-dasharray', d => eclipseInfo[d.properties.date].dash)

  // Puntos históricos — máximo eclipse interactivo
  pointLayer
    .selectAll('.historical-point')
    .data(historicalPoints)
    .join('circle')
    .attr('class', 'historical-point')
    .attr('cx', d => projection(d.geometry.coordinates)?.[0])
    .attr('cy', d => projection(d.geometry.coordinates)?.[1])
    .attr('r', 3.6)
    .attr('fill', '#1a1814')
    .attr('opacity', 0.26)
    .attr('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this)
        .raise()
        .transition().duration(140)
        .attr('r', 6.4)
        .attr('opacity', 0.72)

      highlightHistoricalPath(d)
      showTooltip(event, d)
    })
    .on('mousemove', moveTooltip)
    .on('mouseleave', function(event, d) {
      d3.select(this)
        .transition().duration(140)
        .attr('r', 3.6)
        .attr('opacity', 0.26)

      resetHistoricalPath(d)
      hideTooltip()
    })

  // Hit area para que el hover sobre puntos históricos sea cómodo sin ensuciar visualmente
  pointLayer
    .selectAll('.historical-point-hit')
    .data(historicalPoints)
    .join('circle')
    .attr('class', 'historical-point-hit')
    .attr('cx', d => projection(d.geometry.coordinates)?.[0])
    .attr('cy', d => projection(d.geometry.coordinates)?.[1])
    .attr('r', 9)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      pointLayer.selectAll('.historical-point')
        .filter(p => p.properties?.date === d.properties?.date)
        .raise()
        .transition().duration(140)
        .attr('r', 6.4)
        .attr('opacity', 0.72)

      highlightHistoricalPath(d)
      showTooltip(event, d)
    })
    .on('mousemove', moveTooltip)
    .on('mouseleave', function(event, d) {
      pointLayer.selectAll('.historical-point')
        .filter(p => p.properties?.date === d.properties?.date)
        .transition().duration(140)
        .attr('r', 3.6)
        .attr('opacity', 0.26)

      resetHistoricalPath(d)
      hideTooltip()
    })

  // Puntos destacados — radio reducido, hover gestionado en D3 (r no es animable en CSS)
  pointLayer
    .selectAll('.highlight-point')
    .data(highlightedPoints)
    .join('circle')
    .attr('class', 'highlight-point')
    .attr('cx', d => projection(d.geometry.coordinates)?.[0])
    .attr('cy', d => projection(d.geometry.coordinates)?.[1])
    .attr('r', 8)
    .attr('fill', d => eclipseInfo[d.properties.date].color)
    .attr('stroke', '#f5f0e8')
    .attr('stroke-width', 2.6)
    .attr('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this)
        .raise()
        .transition().duration(150)
        .attr('r', 11)
        .attr('stroke-width', 3.6)
      showTooltip(event, d)
    })
    .on('mousemove', moveTooltip)
    .on('mouseleave', function(event, d) {
      d3.select(this)
        .transition().duration(150)
        .attr('r', 8)
        .attr('stroke-width', 2.6)
      hideTooltip()
    })

  // FIX 4: labels más grandes en el mapa
  pointLayer
    .selectAll('text')
    .data(highlightedPoints)
    .join('text')
    .attr('x', d => projection(d.geometry.coordinates)?.[0] + 18)
    .attr('y', d => projection(d.geometry.coordinates)?.[1] - 13)
    .attr('class', 'map-label')
    .attr('fill', d => eclipseInfo[d.properties.date].color)
    .attr('font-size', 16)
    .text(d => eclipseInfo[d.properties.date].label)

  // ── TOOLTIP con posicionamiento inteligente ──
  function showTooltip(event, d) {
    const info = getTooltipInfo(d, lineByDate)

    tooltipEl.innerHTML = `
      <strong>${formatFullDate(info.date)}</strong>
      <div class="tooltip-row"><span>Type</span><b>${info.type}</b></div>
      <div class="tooltip-row"><span>Maximum duration</span><b>${info.duration}</b></div>
      <div class="tooltip-row"><span>Path width</span><b>${info.pathWidth}</b></div>
      <div class="tooltip-row"><span>Greatest eclipse point</span><b></b></div>
      <div class="tooltip-row"><span>lat-long</span><b>${info.point}</b></div>
      <div class="tooltip-row"><span>Saros series</span><b>${info.saros}</b></div>
      <em>${info.type === 'Annular' ? 'Annular solar eclipse' : 'Total solar eclipse'}</em>
    `
    tooltipEl.style.opacity = 0.9
    moveTooltip(event)
  }

  function moveTooltip(event) {
    const cardRect = mapCard.getBoundingClientRect()
    const tooltipW = 292
    const tooltipH = tooltipEl.offsetHeight || 240

    // posición del cursor relativa al map-card
    let x = event.clientX - cardRect.left + 20
    let y = event.clientY - cardRect.top - 20

    // FIX tooltip recorte: si se sale por la derecha, lo ponemos a la izquierda del cursor
    if (x + tooltipW > cardRect.width - 12) {
      x = event.clientX - cardRect.left - tooltipW - 20
    }

    // Si se sale por abajo, lo subimos
    if (y + tooltipH > cardRect.height - 12) {
      y = cardRect.height - tooltipH - 16
    }

    // Si se sale por arriba
    if (y < 12) y = 12

    tooltipEl.style.left = `${x}px`
    tooltipEl.style.top = `${y}px`
  }

  function hideTooltip() {
    tooltipEl.style.opacity = 0
  }


  function highlightHistoricalPath(d) {
    const dateClass = safeDateClass(d.properties?.date)

    historicalGroup.selectAll('.historical-line')
      .filter(line => line.properties?.date === d.properties?.date)
      .raise()
      .transition().duration(140)
      .attr('stroke-width', line => pathWidthScale(getPathWidthKm(line)) + 2.6)
      .attr('stroke-opacity', 0.62)
      .attr('filter', null)
      .attr('stroke', '#1a1814')

    svg.selectAll(`.line-${dateClass}`).raise()
  }

  function resetHistoricalPath(d) {
    historicalGroup.selectAll('.historical-line')
      .filter(line => line.properties?.date === d.properties?.date)
      .transition().duration(140)
      .attr('stroke-width', line => pathWidthScale(getPathWidthKm(line)))
      .attr('stroke-opacity', 0.16)
      .attr('filter', 'url(#softBlur)')
  }

}).catch(error => {
  console.error('Error loading map data:', error)
})

function getPathWidthKm(d) {
  const value =
    d.properties?.pathWidthKm ??
    d.properties?.path_width_km ??
    d.properties?.path_width ??
    d.properties?.width_km ??
    eclipseInfo[d.properties?.date]?.pathWidthKm

  const numeric = Number(String(value ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 120
}


function getTooltipInfo(d, lineByDate = new Map()) {
  const date = d.properties?.date
  const custom = eclipseInfo[date]
  const matchingLine = lineByDate.get(date)
  const source = matchingLine ?? d
  const type = custom?.type ?? inferEclipseType(source)
  const widthKm = getPathWidthKm(source)

  return {
    date,
    type,
    duration: custom?.duration ?? getProperty(source, ['duration', 'duration_max', 'max_duration', 'central_duration']) ?? 'Not available',
    pathWidth: custom?.pathWidth ?? (Number.isFinite(widthKm) ? `${Math.round(widthKm)} km` : 'Not available'),
    point: custom?.point ?? formatCoordinates(d.geometry?.coordinates),
    saros: custom?.saros ?? getProperty(source, ['saros', 'saros_series', 'sarosSeries']) ?? 'Not available'
  }
}

function getProperty(d, keys) {
  for (const key of keys) {
    const value = d.properties?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

function inferEclipseType(d) {
  const text = `${d.properties?.type ?? ''} ${d.properties?.eclipse_type ?? ''} ${d.properties?.name ?? ''}`.toLowerCase()
  if (text.includes('annular')) return 'Annular'
  if (text.includes('hybrid')) return 'Hybrid'
  return 'Total'
}

function formatCoordinates(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return 'Not available'
  const [lon, lat] = coords
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${ns} · ${Math.abs(lon).toFixed(1)}°${ew}`
}

function safeDateClass(date) {
  return String(date ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '-')
}

function formatFullDate(date) {
  const [year, month, day] = date.split('-')
  const months = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
    '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
  }
  return `${months[month]} ${Number(day)}, ${year}`
}

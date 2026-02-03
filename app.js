/* ============================================
   Mensurando o Invisível — App.js
   Interactive map & data visualization
   ============================================ */

(function () {
  'use strict';

  let dadosEstados = [];
  let map = null;
  let geoLayer = null;
  const GEO_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';

  const panel = document.getElementById('state-panel');
  const overlay = document.getElementById('panel-overlay');

  // Estados sem dados (não estão no JSON)
  const ESTADOS_SEM_DADOS = ['AC', 'AL', 'AP', 'AM', 'RJ', 'TO'];

  document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initScrollReveal();
    await loadData();
    await initMap();
  });

  function initNavigation() {
    const nav = document.querySelector('.nav-sticky');
    if (!nav) return;

    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    document.querySelectorAll('.nav-link, .btn-primary, .btn-secondary').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    const sections = document.querySelectorAll('section[id]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
          const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    sections.forEach(s => observer.observe(s));
  }

  function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(el => observer.observe(el));
  }

  async function loadData() {
    try {
      const resp = await fetch('dados.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      dadosEstados = await resp.json();
      console.log('Dados carregados:', dadosEstados.length, 'estados');
    } catch (err) {
      console.error('Erro ao carregar dados.json:', err);
      dadosEstados = [];
    }
  }

  async function initMap() {
    const container = document.getElementById('mapa-brasil');
    if (!container) return;

    map = L.map('mapa-brasil', {
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      minZoom: 3,
      maxZoom: 8,
      attributionControl: false
    }).setView([-14.5, -52], 4.25);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    L.control.attribution({ prefix: false, position: 'bottomright' })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>')
      .addTo(map);

    try {
      const resp = await fetch(GEO_URL);
      const geojson = await resp.json();
      renderGeoJSON(geojson);
    } catch (err) {
      console.error('Erro ao carregar GeoJSON:', err);
      container.innerHTML = '<p style="text-align:center;padding:4rem 1rem;color:#94a3b8;">Não foi possível carregar o mapa.</p>';
    }
  }

  const UF_NAME_MAP = {
    'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM',
    'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF',
    'Espírito Santo': 'ES', 'Goiás': 'GO', 'Maranhão': 'MA',
    'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG',
    'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR', 'Pernambuco': 'PE',
    'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
    'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR',
    'Santa Catarina': 'SC', 'São Paulo': 'SP', 'Sergipe': 'SE',
    'Tocantins': 'TO'
  };

  function getUFSigla(featureName) {
    return UF_NAME_MAP[featureName] || null;
  }

  function findEstadoData(sigla) {
    return dadosEstados.find(e => e.uf === sigla) || null;
  }

  function getStateColor(sigla, estado) {
    // Estados sem dados
    if (ESTADOS_SEM_DADOS.includes(sigla) || !estado) {
      return '#374151';
    }

    // Benchmark (SC) in blue
    if (estado.status === 'benchmark') {
      return '#3b82f6';
    }

    const taxa = estado.metricas_estaduais?.taxa_subnotificacao;
    if (taxa == null) return '#374151';

    // Gradient based on underreporting rate
    if (taxa < 50) return '#fbbf24';
    if (taxa < 65) return '#f59e0b';
    if (taxa < 75) return '#ef4444';
    if (taxa < 85) return '#dc2626';
    return '#991b1b';
  }

  function getStateStyle(sigla, estado) {
    return {
      fillColor: getStateColor(sigla, estado),
      weight: 1,
      color: '#1e293b',
      fillOpacity: 0.85
    };
  }

  function renderGeoJSON(geojson) {
    geoLayer = L.geoJSON(geojson, {
      style: (feature) => {
        const sigla = getUFSigla(feature.properties.name);
        const estado = findEstadoData(sigla);
        return getStateStyle(sigla, estado);
      },
      onEachFeature: (feature, layer) => {
        const sigla = getUFSigla(feature.properties.name);
        const estado = findEstadoData(sigla);

        let tooltipContent = '<strong style="color:#f1f5f9;">' + feature.properties.name + '</strong>';
        
        if (ESTADOS_SEM_DADOS.includes(sigla)) {
          tooltipContent += '<br><span style="color:#64748b;">Dados não disponíveis</span>';
        } else if (estado && estado.status === 'benchmark') {
          tooltipContent += '<br><span style="color:#3b82f6;font-weight:600;">★ Benchmark</span>';
        } else if (estado && estado.metricas_estaduais) {
          const taxa = estado.metricas_estaduais.taxa_subnotificacao;
          tooltipContent += '<br><span style="color:#94a3b8;">Subnotificação:</span> <strong style="color:#f87171;">' + taxa.toFixed(1) + '%</strong>';
        } else {
          tooltipContent += '<br><span style="color:#64748b;">Dados não disponíveis</span>';
        }

        layer.bindTooltip(tooltipContent, { sticky: true, direction: 'top', offset: [0, -8] });

        layer.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 2, color: '#22d3ee', fillOpacity: 0.95 });
            e.target.bringToFront();
          },
          mouseout: (e) => {
            geoLayer.resetStyle(e.target);
          },
          click: () => {
            if (estado && estado.metricas_estaduais) {
              openPanel(estado);
            } else {
              openPanelSemDados(feature.properties.name, sigla);
            }
          }
        });
      }
    }).addTo(map);
  }

  function formatNumber(num) {
    if (num == null) return '—';
    return num.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  }

  function openPanel(estado) {
    const m = estado.metricas_estaduais;
    const isBenchmark = estado.status === 'benchmark';

    let html = '<div class="panel-header" style="position:relative;">';
    html += '<button class="panel-close" id="btn-close-panel" aria-label="Fechar">×</button>';
    
    if (isBenchmark) {
      html += '<span style="display:inline-flex;align-items:center;gap:0.35rem;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);color:#3b82f6;font-size:0.8rem;font-weight:600;padding:0.35rem 0.85rem;border-radius:9999px;margin-bottom:0.75rem;">★ Benchmark</span>';
    }
    
    html += '<h3 style="font-size:1.4rem;font-weight:700;margin:0 0 0.25rem;color:#f1f5f9;">' + estado.estado_nome + '</h3>';
    html += '<p style="font-size:0.85rem;color:#64748b;margin:0;">UF: ' + estado.uf + ' · ' + (m.total_municipios || estado.municipios.length) + ' municípios</p>';
    html += '</div>';
    html += '<div class="panel-body" id="panel-body-inner">';
    
    if (isBenchmark) {
      // Benchmark: only show total BOs registered
      html += '<div class="panel-metric" style="margin-bottom:1.5rem;"><div class="panel-metric-value" style="color:#3b82f6;">' + formatNumber(m.bo_registrado) + '</div><div class="panel-metric-label">BOs Registrados (2021-2024)</div></div>';
      html += '<p style="font-size:0.9rem;color:#94a3b8;line-height:1.6;margin-bottom:1.5rem;">Santa Catarina foi utilizada como <strong style="color:#3b82f6;">benchmark</strong> para o modelo. Os dados de SC serviram como referência para projetar a subnotificação nos demais estados.</p>';
    } else {
      // Regular state: show all metrics
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;">';
      html += '<div class="panel-metric"><div class="panel-metric-value">' + formatNumber(m.bo_registrado) + '</div><div class="panel-metric-label">BOs Registrados</div></div>';
      html += '<div class="panel-metric"><div class="panel-metric-value">' + formatNumber(m.bo_previsto) + '</div><div class="panel-metric-label">BOs Previstos</div></div>';
      html += '</div>';
      html += '<div class="panel-metric" style="margin-bottom:1.5rem;"><div class="panel-metric-value" style="color:#f87171;">' + (m.taxa_subnotificacao != null ? m.taxa_subnotificacao.toFixed(2) + '%' : '—') + '</div><div class="panel-metric-label">Taxa de Subnotificação</div></div>';
    }

    // Municipal dropdown
    if (estado.municipios && estado.municipios.length > 0) {
      html += '<div style="margin-bottom:1rem;"><label style="font-size:0.75rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:0.4rem;">Consultar município</label>';
      html += '<select class="select-municipality" id="select-municipio"><option value="">Selecione um município…</option>';
      
      // Sort municipalities alphabetically
      const sortedMunicipios = [...estado.municipios].sort((a, b) => a.nome.localeCompare(b.nome));
      sortedMunicipios.forEach((mun, i) => {
        const originalIndex = estado.municipios.findIndex(m => m.codigo_ibge === mun.codigo_ibge);
        html += '<option value="' + originalIndex + '">' + mun.nome + '</option>';
      });
      
      html += '</select></div><div id="municipio-data"></div>';
    } else {
      html += '<p style="font-size:0.9rem;color:#64748b;margin-top:1rem;">Nenhum município disponível.</p>';
    }

    html += '</div>';

    panel.innerHTML = html;
    panel.classList.add('open');
    overlay.classList.add('visible');

    document.getElementById('btn-close-panel').addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    const select = document.getElementById('select-municipio');
    if (select) {
      select.addEventListener('change', () => {
        const idx = select.value;
        const container = document.getElementById('municipio-data');
        if (idx === '' || !estado.municipios[idx]) {
          container.innerHTML = '';
          return;
        }
        renderMunicipio(estado.municipios[idx], container, isBenchmark);
      });
    }
  }

  function openPanelSemDados(nomeFull, sigla) {
    let reason = 'Dados não disponíveis para esta Unidade Federativa.';
    
    if (sigla === 'SC') {
      reason = 'Santa Catarina foi utilizada como benchmark para o modelo. Os dados de SC serviram como referência para projetar a subnotificação nos demais estados.';
    } else if (['AC', 'AL', 'AP'].includes(sigla)) {
      reason = 'Este estado forneceu apenas dados de crimes cibernéticos próprios (cyber-dependent), não permitindo a análise completa.';
    } else if (['AM', 'RJ'].includes(sigla)) {
      reason = 'Os dados deste estado estavam indisponíveis ou insuficientes para inclusão na análise.';
    } else if (sigla === 'TO') {
      reason = 'Tocantins não respondeu à solicitação de dados dentro do prazo estabelecido.';
    }

    let html = '<div class="panel-header" style="position:relative;">';
    html += '<button class="panel-close" id="btn-close-panel" aria-label="Fechar">×</button>';
    html += '<h3 style="font-size:1.4rem;font-weight:700;margin:0 0 0.25rem;color:#f1f5f9;">' + nomeFull + '</h3>';
    html += '<p style="font-size:0.85rem;color:#64748b;margin:0;">UF: ' + sigla + '</p>';
    html += '</div>';
    html += '<div class="panel-body">';
    html += '<div style="text-align:center;padding:2rem 1rem;">';
    html += '<div style="font-size:2.5rem;margin-bottom:1rem;">📭</div>';
    html += '<p style="font-size:0.95rem;color:#94a3b8;line-height:1.6;">' + reason + '</p>';
    html += '</div></div>';

    panel.innerHTML = html;
    panel.classList.add('open');
    overlay.classList.add('visible');
    document.getElementById('btn-close-panel').addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);
  }

  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.remove('visible');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  function renderMunicipio(mun, container, isBenchmark = false) {
    // Get all year keys
    const anoKeys = Object.keys(mun).filter(k => k.startsWith('ano_')).sort((a, b) => {
      return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
    });

    if (anoKeys.length === 0) {
      container.innerHTML = '<p style="color:#64748b;font-size:0.9rem;">Sem dados anuais disponíveis.</p>';
      return;
    }

    let html = '<h4 style="font-size:1rem;font-weight:600;color:#f1f5f9;margin:1rem 0 0.5rem;">📍 ' + mun.nome + '</h4>';
    
    // Municipality info
    if (mun.populacao) {
      html += '<p style="font-size:0.85rem;color:#64748b;margin-bottom:0.5rem;">População: ' + formatNumber(mun.populacao) + '</p>';
    }
    
    if (isBenchmark) {
      // Benchmark: only show year and BO quantity
      html += '<table class="muni-table"><thead><tr><th>Ano</th><th>BOs Registrados</th></tr></thead><tbody>';
      
      anoKeys.forEach(key => {
        const year = key.split('_')[1];
        const d = mun[key];
        const qtd = d.qtd != null ? formatNumber(d.qtd) : '—';
        
        html += '<tr>';
        html += '<td style="font-weight:600;color:#f1f5f9;">' + year + '</td>';
        html += '<td style="color:#3b82f6;">' + qtd + '</td>';
        html += '</tr>';
      });
    } else {
      // Regular state: show all columns
      html += '<table class="muni-table"><thead><tr><th>Ano</th><th>BOs</th><th>Previsto</th><th>Taxa</th></tr></thead><tbody>';

      anoKeys.forEach(key => {
        const year = key.split('_')[1];
        const d = mun[key];
        const qtd = d.qtd != null ? formatNumber(d.qtd) : '—';
        const previsto = d.previsto != null ? formatNumber(Math.round(d.previsto)) : '—';
        const taxa = d.taxa != null ? d.taxa.toFixed(1) + '%' : '—';
        
        html += '<tr>';
        html += '<td style="font-weight:600;color:#f1f5f9;">' + year + '</td>';
        html += '<td>' + qtd + '</td>';
        html += '<td>' + previsto + '</td>';
        html += '<td style="color:#f87171;">' + taxa + '</td>';
        html += '</tr>';
      });
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  }

})();

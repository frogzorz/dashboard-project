import {loadData} from './data.js';
import {createMap, transitionColors} from './map.js';
import {formatValue, renderProfile} from './profile.js';

async function start() {
  const status = document.querySelector('#status');
  try {
    const data = await loadData();
    const features = new Map(data.collection.features.map((f) => [f.properties.tract_geoid, f]));
    let map;
    let selectedTract = null;

    const selectTract = (geoid) => {
      const feature = features.get(geoid);
      if (!feature) return;
      selectedTract = geoid;
      renderProfile(feature.properties, data);
      map?.select(geoid);
      for (const button of document.querySelectorAll('[data-geoid]')) {
        button.setAttribute('aria-pressed', String(button.dataset.geoid === geoid));
      }
      status.textContent = `Selected tract ${feature.properties.tract_name}. Details updated in the tract profile.`;
    };

    const fragment = document.createDocumentFragment();
    for (const {properties: p} of data.collection.features) {
      const row = document.createElement('tr');
      const heading = document.createElement('th');
      heading.scope = 'row';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `Tract ${p.tract_name}`;
      button.dataset.geoid = p.tract_geoid;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => selectTract(p.tract_geoid));
      heading.append(button);
      row.append(heading);
      const poverty = data.records.get(`${p.tract_geoid}:poverty`);
      for (const value of [p.tract_geoid, p.transition, formatValue(p.early_count, 0),
        formatValue(p.late_count, 0), formatValue(poverty.value)]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      fragment.append(row);
    }
    document.querySelector('#tract-rows').replaceChildren(fragment);
    for (const [label, color] of Object.entries(transitionColors)) {
      const item = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = label === 'Unavailable' ? 'swatch unavailable' : 'swatch';
      swatch.style.backgroundColor = color;
      swatch.setAttribute('aria-hidden', 'true');
      item.append(swatch, document.createTextNode(label));
      document.querySelector('#legend').append(item);
    }
    document.querySelector('#benchmark').textContent = formatValue(data.metadata.benchmark_rate_10k, 2);
    if (typeof L === 'undefined') {
      document.querySelector('#map-status').textContent = 'Map library unavailable. Use the tract table to select a profile.';
    } else {
      map = createMap(data.collection, selectTract);
    }
    document.querySelector('#reset').disabled = false;
    document.querySelector('#reset').addEventListener('click', () => {
      selectedTract = null;
      map?.select(selectedTract);
      map?.reset();
      document.querySelector('#profile-title').textContent = 'Select a tract';
      document.querySelector('#profile-details').replaceChildren();
      for (const button of document.querySelectorAll('[data-geoid]')) button.setAttribute('aria-pressed', 'false');
      status.textContent = 'Selection cleared. Philadelphia extent restored.';
    });
    status.textContent = `Loaded ${features.size} tracts and ${data.definitions.size} contextual measures. Select a tract using the map or table.`;
  } catch (error) {
    status.textContent = `Data unavailable: ${error.message}`;
  }
}

start();

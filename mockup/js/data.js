export const exportFiles = [
  'tracts.geojson', 'indicators.json', 'comparisons.json', 'metadata.json',
  'tract_indicators.csv', 'group_summaries.csv',
];

export function validateData(collection, indicators, comparisons, metadata) {
  const generation = metadata.generation_id;
  if (!generation || indicators.generation_id !== generation ||
      comparisons.generation_id !== generation) {
    throw new Error('Mixed export generations. Refresh the complete R export set.');
  }
  if (collection.type !== 'FeatureCollection' || !collection.features.length) {
    throw new Error('Tract geometry is missing.');
  }
  const geoids = new Set();
  for (const feature of collection.features) {
    const p = feature.properties;
    if (!/^42101\d{6}$/.test(p.tract_geoid) || geoids.has(p.tract_geoid) ||
        p.generation_id !== generation ||
        !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type) ||
        ![...metadata.transition_groups, 'Unavailable'].includes(p.transition)) {
      throw new Error('Invalid tract identifiers, geometry or generation.');
    }
    geoids.add(p.tract_geoid);
  }
  const definitions = new Map(metadata.indicators.map((d) => [d.id, d]));
  const records = new Map();
  for (const record of indicators.records) {
    const key = `${record.tract_geoid}:${record.indicator}`;
    const definition = definitions.get(record.indicator);
    const maximum = definition?.domain === 'SVI' ? 1 : 100;
    if (!geoids.has(record.tract_geoid) || !definition || records.has(key) ||
        record.generation_id !== generation ||
        (record.value !== null && (!Number.isFinite(record.value) ||
          record.value < 0 || record.value > maximum))) {
      throw new Error('Invalid or duplicate indicator record.');
    }
    records.set(key, record);
  }
  if (records.size !== geoids.size * definitions.size) {
    throw new Error('Incomplete tract–indicator grid.');
  }
  return {collection, indicators, comparisons, metadata, records, definitions};
}

async function loadJSON(filename) {
  const response = await fetch(`data/${filename}`);
  if (!response.ok) throw new Error(`Unable to load ${filename} (${response.status}).`);
  return response.json();
}

export async function loadData() {
  const files = await Promise.all(exportFiles.slice(0, 4).map(loadJSON));
  return validateData(...files);
}

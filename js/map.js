// js/map.js

// =========================
// 1. INITIAL MAP SETUP
// =========================
// Initial view constants
const INITIAL_CENTER = [43.765, -79.205];
const INITIAL_ZOOM = 12;
const MIN_ZOOM = 11

const map = L.map("map", {
  center: INITIAL_CENTER,
  zoom: INITIAL_ZOOM,
  minZoom: MIN_ZOOM,
});

const PANES = [
  { name: "rirPane", zIndex: 200 },
  { name: "wardPane", zIndex: 300 },
  { name: "rentersPane", zIndex: 400 },
  { name: "mppPane", zIndex: 450 },
];

PANES.forEach(({ name, zIndex }) => {
  map.createPane(name);
  map.getPane(name).style.zIndex = zIndex;
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  minZoom: 11,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// =========================
// 2. LAYER CONFIG
// =========================

const LAYER_CONFIGS = [
{
  id: "ward-points",
  name: "MPP Parties",
  url: "data/ward-points.geojson",
  defaultVisible: true,
  valueField: "mpp_renter_pct",
  partyField: "offices-all_Party",
  pane: "rentersPane",
  minZoom: 12,
},
    {
    id: "wards",
    name: "Wards",
    url: "data/percent-renters_poly.geojson",
    defaultVisible: true,
    valueField: "AREA_NA13",
    // pane: "wardPane",
  },
  {
    id: "rir",
    name: "Renter Households Spending 30%+ on Shelter",
    url: "data/shelter-costs-above-30-pct.geojson",
    defaultVisible: true,
    valueField: "pct_above_30",
    pane: "rirPane",
  },
];


const overlayLayers = {};
let combinedBounds = null;

// =========================
// 3. STYLING HELPERS
// =========================

// --- MPP Party colors & square markers ---

const PARTY_COLORS = {
  "PC": "#1A4782",
  "OLP": "#D71920",
  "NDP": "#F37021",
};

function getPartyColor(partyRaw) {
  if (!partyRaw) return "#666666";
  const party = String(partyRaw).trim();
  return PARTY_COLORS[party] || "#666666";
}

function createWardMarker(feature, latlng, cfg) {
  const props = feature.properties || {};
  const renterPct = Number(props[cfg.valueField]);
  const party = props[cfg.partyField];
  const color = getPartyColor(party);

  const radius = getRentersRadius(renterPct);
  const diameter = radius * 2;
  const labelText = isNaN(renterPct) ? "" : `${renterPct.toFixed(0)}%`;

  const html = `
    <div class="ward-marker"
         style="background-color:${color};
                width:${diameter}px;
                height:${diameter}px;">
      <span class="ward-label">${labelText}</span>
    </div>
  `;

  const icon = L.divIcon({
    html,
    className: "ward-icon",
    iconSize: [diameter, diameter],
    iconAnchor: [radius, radius],
  });

  return L.marker(latlng, { icon, pane: cfg.pane });
}


// --- Percent Renters: symbol size by value ---

function getRentersRadius(value) {
  if (value == null || isNaN(value)) return 15;
  if (value < 30) return 20;
  if (value < 40) return 30;
  if (value < 50) return 40;
  if (value < 60) return 50;
  return 60; // 60%+
}

function createRentersMarker(feature, latlng, cfg) {
  const props = feature.properties || {};
  const value = Number(props[cfg.valueField]);
  const radius = getRentersRadius(value);

  return L.circleMarker(latlng, {
    radius,
    fillColor: "#747575",
    opacity: 1,
    fillOpacity: 0.9,
    className: "renters-circle",
  });
}


// --- Shelter Cost polygons: choropleth by value ---

function getRirColor(value) {
  if (value == null || isNaN(value)) return "#f0f0f0";

  // value is a fraction: 0.316 = 31.6%
  if (value <= 11) return "#e8e5f0";
  if (value < 32) return "#beacd3";
  if (value <  41) return "#9373b7";
  if (value <  51) return "#69399a";
  if (value >=  51) return "#3f007d";
  return "#f16913";
}

// --- RIR legend classes (match getRirColor) ---
const RIR_LEGEND_CLASSES = [
  { label: "< 11%",     color: "#e8e5f0" },
  { label: "11–32%",    color: "#beacd3" },
  { label: "32-41%",     color: "#9373b7" },
  { label: "41-51%",    color: "#69399a" },
  { label: "≥ 51%",     color: "#3f007d" },
];

// --- MPP Party legend (use PARTY_COLORS) ---
const MPP_LEGEND_ITEMS = [
  {
    label: "Progressive Conservative",
    color: PARTY_COLORS["PC"],
  },
  {
    label: "Liberal",
    color: PARTY_COLORS["OLP"],
  },
  {
    label: "NDP",
    color: PARTY_COLORS["NDP"],
  },
];

// --- Renters % legend (size by value; match getRentersRadius) ---
const RENTERS_LEGEND_CLASSES = [
  { label: "< 30%", radius: getRentersRadius(20) },
  { label: "30–40%", radius: getRentersRadius(30) },
  { label: "40–50%", radius: getRentersRadius(40) },
];


function styleForFeature(feature, cfg) {
  const geomType = feature.geometry?.type;
  const props = feature.properties || {};

  // RIR polygons
  if (cfg.id === "rir" && (geomType === "Polygon" || geomType === "MultiPolygon")) {
    const value = Number(props[cfg.valueField]);
    return {
      color: "#ffffff",
      weight: 1,
      opacity: 0.7,
      fillColor: getRirColor(value),
      fillOpacity: 0.8,
    };
  }

  //ward polygons
  if(cfg.id==="wards" &&(geomType==="Polygon" || geomType ==="MultiPolygon")) {
    return {
      color: "#000",
      weight: 2,
      fillOpacity: 0,
    };
  }

  // Default line/polygon fallback
  switch (geomType) {
    case "LineString":
    case "MultiLineString":
      return { color: "#FF851B", weight: 3, opacity: 0.9 };
    case "Polygon":
    case "MultiPolygon":
      return { color: "#2ECC40", weight: 1, fillColor: "#2ECC40", fillOpacity: 0.2 };
    default:
      return { color: "#666", weight: 1, fillColor: "#999", fillOpacity: 0.3 };
  }
}

// =========================
// 4. POPUPS
// =========================

function onEachFeature(feature, layer, cfg) {
  if (!feature.properties) return;

  const props = feature.properties;
  let html = "";

  // Title: ward / area name
  const wardName = props.AREA_NA13 || props.name;
  if (wardName) {
    html += `<strong>${wardName}</strong><br>`;
  }

    // Percent renters spending ≥ 30% (where present)
  if (props["30_pct_plus_inc"] != null) {
    const pctAbove30 = Number(props["30_pct_plus_inc"]);
    const pctAbove30Formatted = isNaN(pctAbove30)
      ? props["30_pct_plus_inc"]
      : pctAbove30.toFixed(1);

    html += `Renter households spending ≥30% of income: ${pctAbove30Formatted}%<br>`;
  }

    // Percent renters (where present)
  if (props.pct_renters != null) {
    const renters = Number(props.pct_renters);
    const rentersFormatted = isNaN(renters)
      ? props.pct_renters
      : renters.toFixed(1);
    html += `Renter households: ${rentersFormatted}%<br>`;
  }

  //Party (only present for MPP-related layers)
  const party =
    props.mpp_party ||
    props["offices-all_Party"] || props["mpp_party"];

  if (party) {
    html += `MPP party: ${party}<br>`;
  }

  // 5. Fallback dump of attributes, if nothing else was added
  if (!html) {
    const rows = Object.entries(props)
      .map(([k, v]) => `<strong>${k}</strong>: ${v}`)
      .join("<br>");
    html = rows || "No attributes";
  }

  layer.bindPopup(html);
}

// =========================
// 5. CUSTOM LEGEND / TOGGLE
// =========================

const legendControl = L.control({ position: "topright" });

legendControl.onAdd = function () {
  const div = L.DomUtil.create("div", "layer-legend");
  div.innerHTML = `
    <h3>Renter Housing Cost Burden</h3>
    <h4>Layers</h4>
    <form id="layer-legend-form"></form>
  `;
  L.DomEvent.disableClickPropagation(div);
  return div;
};
legendControl.addTo(map);

function rebuildLegend() {
  const form = document.getElementById("layer-legend-form");
  if (!form) return;

  form.innerHTML = "";

  LAYER_CONFIGS.forEach((cfg) => {
    const layer = overlayLayers[cfg.id];
    if (!layer) return;

    const container = document.createElement("div");
    container.className = "layer-entry";

    const wrapper = document.createElement("label");
    wrapper.className = "layer-toggle";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = cfg.id;
    checkbox.checked = map.hasLayer(layer);
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) map.addLayer(layer);
      else map.removeLayer(layer);
    });

    const text = document.createElement("span");
    text.textContent = cfg.name;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(text);
    container.appendChild(wrapper);

    // 1) RIR colour classes (unchanged)
    if (cfg.id === "rir") {
      const classesDiv = document.createElement("div");
      classesDiv.className = "layer-classes";

      RIR_LEGEND_CLASSES.forEach((item) => {
        const row = document.createElement("div");
        row.className = "layer-classes-row";

        const swatch = document.createElement("span");
        swatch.className = "layer-classes-swatch";
        swatch.style.background = item.color;

        const label = document.createElement("span");
        label.textContent = item.label;

        row.appendChild(swatch);
        row.appendChild(label);
        classesDiv.appendChild(row);
      });

      container.appendChild(classesDiv);
    }

    // 2) Ward points: party colours + renters size
    if (cfg.id === "ward-points") {
      // Small explanatory note
      const note = document.createElement("div");
      note.className = "layer-note";
      note.textContent =
        "Circle colour = MPP party; circle size & number = % of households that rent.";
      container.appendChild(note);

      // 2a) Party colour legend
      const partyDiv = document.createElement("div");
      partyDiv.className = "layer-classes";

      MPP_LEGEND_ITEMS.forEach((item) => {
        const row = document.createElement("div");
        row.className = "layer-classes-row";

        const swatch = document.createElement("span");
        swatch.className = "layer-classes-swatch";
        swatch.style.background = item.color;

        const label = document.createElement("span");
        label.textContent = item.label;

        row.appendChild(swatch);
        row.appendChild(label);
        partyDiv.appendChild(row);
      });

      container.appendChild(partyDiv);

      // 2b) Renters % size legend
      const rentersDiv = document.createElement("div");
      rentersDiv.className = "layer-classes";

      RENTERS_LEGEND_CLASSES.forEach((item) => {
        const row = document.createElement("div");
        row.className = "layer-classes-row";

        const circle = document.createElement("span");
        circle.className = "layer-classes-swatch-circle";

        const diameter = item.radius * 2;
        circle.style.width = `${diameter}px`;
        circle.style.height = `${diameter}px`;

        const label = document.createElement("span");
        label.textContent = item.label;

        row.appendChild(circle);
        row.appendChild(label);
        rentersDiv.appendChild(row);
      });

      container.appendChild(rentersDiv);
    }

    form.appendChild(container);
  });
}

// =========================
// 5b. RESET VIEW CONTROL
// =========================

const resetControl = L.control({ position: "topleft" });

resetControl.onAdd = function (map) {
  const container = L.DomUtil.create("div", "leaflet-bar reset-control");

  const link = L.DomUtil.create("a", "", container);
  link.href = "#";
  link.title = "Reset view";
  link.innerHTML = "⟳"; // you can change this to "R" or a house icon

  L.DomEvent.on(link, "click", function (e) {
    L.DomEvent.stop(e);
    map.setView(INITIAL_CENTER, INITIAL_ZOOM);
  });

  return container;
};

resetControl.addTo(map);


// =========================
// 6. LOAD GEOJSON LAYERS
// =========================

LAYER_CONFIGS.forEach((cfg) => {
  fetch(cfg.url)
    .then((response) => {
      if (!response.ok) console.warn(`Failed to load ${cfg.url}`);
      return response.json();
    })
    .then((geojson) => {
const layer = L.geoJSON(geojson, {
  pane: cfg.pane,
  style: (feature) => styleForFeature(feature, cfg),
  pointToLayer: (feature, latlng) => {
    if (cfg.id === "ward-points") return createWardMarker(feature, latlng, cfg);
    return L.circleMarker(latlng, {
      radius: 6,
      fillColor: "#747575",
      color: "#ffffff",
      weight: 1,
      opacity: 1,
      fillOpacity: 1,
    });
  },
  onEachFeature: (feature, layer) => onEachFeature(feature, layer, cfg),
});


      overlayLayers[cfg.id] = layer;
      if (cfg.defaultVisible) layer.addTo(map);

      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        combinedBounds = combinedBounds ? combinedBounds.extend(bounds) : bounds;
      }

      rebuildLegend();
      updateZoomVisibility();
    })
    .catch((err) => console.error(`Error loading ${cfg.url}`, err));
});

// =========================
// 7. ZOOM-BASED VISIBILITY
// =========================

function updateZoomVisibility() {
  const z = map.getZoom();

  const wardPointsLayer = overlayLayers["ward-points"];
  if (!wardPointsLayer) return;

  const checkbox = document.querySelector(
    'input[type="checkbox"][value="ward-points"]'
  );
  const checkboxChecked = checkbox ? checkbox.checked : true;
  const shouldShow = z >= 12 && checkboxChecked;

  if (shouldShow && !map.hasLayer(wardPointsLayer)) {
    map.addLayer(wardPointsLayer);
  } else if (!shouldShow && map.hasLayer(wardPointsLayer)) {
    map.removeLayer(wardPointsLayer);
  }
}

map.on("zoomend", updateZoomVisibility);
map.whenReady(updateZoomVisibility);

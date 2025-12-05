const INITIAL_CENTER = [43.726, -79.390];
const INITIAL_ZOOM = 11;
const MIN_ZOOM = 10;

const map = L.map("map", {
  center: INITIAL_CENTER,
  zoom: INITIAL_ZOOM,
  minZoom: MIN_ZOOM,
});

const PANES = [
  { name: "ctRenterPane", zIndex: 250 },
  { name: "shelterPane", zIndex: 350 },
  { name: "wardPane", zIndex: 450 },
  { name: "mppPane", zIndex: 550 },
];

const WARD_LABEL_MIN_ZOOM = 12;
const wardLabelLayer = L.layerGroup();

PANES.forEach(({ name, zIndex }) => {
  map.createPane(name);
  map.getPane(name).style.zIndex = zIndex;
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  minZoom: 10,
  attribution: "&copy; OpenStreetMap contributors | Data: City of Toronto Open Data Portal & Statistics Canada (Census 2021)",
}).addTo(map);

const LAYER_CONFIGS = [
  {
    id: "ward-points",
    name: "MPP Parties",
    url: "data/ward-points.geojson",
    defaultVisible: true,
    valueField: "pct_renters",
    partyField: "mpp_party",
    pane: "mppPane",
    minZoom: 12,
  },
  {
    id: "wards",
    name: "Wards",
    url: "data/ward-info.geojson",
    defaultVisible: true,
    valueField: "ward_name",
    pane: "wardPane",
  },
  {
    id: "shelter",
    name: "Estimated At-Risk Renter Households (Census Tract)",
    url: "data/shelter.geojson",
    defaultVisible: true,
    valueField: "ct_risk",
    pane: "shelterPane",
  },
];

const overlayLayers = {};
let combinedBounds = null;

const PARTY_COLORS = {
  "Progressive Conservative": "#1A4782",
  Liberal: "#D71920",
  NDP: "#F37021",
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

function getRentersRadius(value) {
  if (value == null || isNaN(value)) return 15;
  if (value < 30) return 20;
  if (value < 40) return 25;
  if (value < 50) return 30;
  if (value < 60) return 35;
  return 40;
}

function getShelterColor(value) {
  if (value == null || isNaN(value)) return "#f0f0f0";
  if (value <= 10.0) return "#e8e5f0";
  if (value < 20.0) return "#beacd3";
  if (value < 30.0) return "#9373b7";
  if (value < 40.0) return "#69399a";
  return "#3f007d";
}

const SHELTER_LEGEND_CLASSES = [
  { label: "< 10%", color: "#e8e5f0" },
  { label: "11–20%", color: "#beacd3" },
  { label: "21-30%", color: "#9373b7" },
  { label: "31-40%", color: "#69399a" },
  { label: "≥ 40%", color: "#3f007d" },
];

function getCtRentersColor(value) {
  if (value == null || isNaN(value)) return "#f0f0f0";
  if (value >= 50) return "#226B21";
  if (value >= 40) return "#3EA931";
  if (value >= 30) return "#5DB844";
  if (value >= 20) return "#7CC657";
  return "#9BD46A";
}

const CT_RENTERS_LEGEND_CLASSES = [
  { label: "< 20%", color: "#9BD46A" },
  { label: "20–30%", color: "#7CC657" },
  { label: "30–40%", color: "#5DB844" },
  { label: "40–50%", color: "#3EA931" },
  { label: "≥ 50%", color: "#226B21" },
];

const MPP_LEGEND_ITEMS = [
  { label: "Progressive Conservative", color: PARTY_COLORS["Progressive Conservative"] },
  { label: "Liberal", color: PARTY_COLORS["Liberal"] },
  { label: "NDP", color: PARTY_COLORS["NDP"] },
];

const RENTERS_LEGEND_CLASSES = [
  { label: "< 30%", radius: getRentersRadius(20) },
  { label: "30–40%", radius: getRentersRadius(30) },
  { label: "40–50%", radius: getRentersRadius(40) },
];

function styleForFeature(feature, cfg) {
  const geomType = feature.geometry?.type;
  const props = feature.properties || {};

  if (cfg.id === "shelter" && (geomType === "Polygon" || geomType === "MultiPolygon")) {
    const value = Number(props[cfg.valueField]);
    return { color: "#ffffff", weight: 1, opacity: 0.7, fillColor: getShelterColor(value), fillOpacity: 0.9 };
  }

  if (cfg.id === "ct-renters" && (geomType === "Polygon" || geomType === "MultiPolygon")) {
    const value = Number(props[cfg.valueField]);
    return { color: "#ffffff", weight: 1, opacity: 0.7, fillColor: getCtRentersColor(value), fillOpacity: 0.9 };
  }

  if (cfg.id === "wards" && (geomType === "Polygon" || geomType === "MultiPolygon")) {
    return { color: "#000", weight: 2, fillOpacity: 0 };
  }

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

function onEachFeature(feature, layer, cfg) {
  if (!feature.properties) return;

  const props = feature.properties;
  let html = "";
  let title = "";

  if(cfg.id==="wards" && props.ward_name) {
    title = `Ward: ${props.ward_name}`;

    const center = layer.getBounds().getCenter();

    const labelMarker = L.marker(center, {
      pane: "wardPane",
      interactive: false,
      icon: L.divIcon({
        className: "ward-name-label",
        html: `<span>${props.ward_name} </span>`,
        iconSize: [80,24],
        // iconAnchor: [20, 20],
      }),
    });

    wardLabelLayer.addLayer(labelMarker);
  }else if(cfg.id === "shelter" && props.DGUID) {
    title = `Census Tract: ${props.DGUID}`;
  }else if(cfg.id === "ward-points" && props.ward_name) {
    title= `Ward: ${props.ward_name}`
  }else if (props.name) {
    title = props.name;
  }

  if(title) {
    html += `<strong>${title}</strong><br>`;
  }

  if (props ["30_pct_plus_inc"] != null && cfg.id !== "shelter") {
    const pctAbove30 = Number(props["30_pct_plus_inc"]);
    const pctAbove30Formatted = isNaN(pctAbove30)
      ? props["30_pct_plus_inc"]
      : pctAbove30.toFixed(1);

      html += `Renter households spending ≥30% of income: ${pctAbove30Formatted}%<br>`;
  }

  if(props["ct_30_pct_plus_inc"] != null) {
    const ct_PctAbove30 = Number(props["ct_30_pct_plus_inc"]);
    const ct_PctAbove30Formatted = isNaN(ct_PctAbove30)
      ? props["ct_30_pct_plus_inc"]
      : ct_PctAbove30.toFixed(1);

      html +=  `Renter households spending ≥30% of income: ${ct_PctAbove30Formatted}%<br>`;
  }

  if(props.pct_renters != null && cfg.id !== "shelter") {
    const renters = Number(props.pct_renters);
    const rentersFormatted = isNaN(renters)
      ? props.pct_renters
      : renters.toFixed();

      html += `Renter households: ${rentersFormatted}%<br>`;
  }

  if(props.ct_percent_renters != null) {
    const ctRenters = Number(props.ct_percent_renters);
    const ctRentersFormatted = isNaN(ctRenters)
      ? props.ct_pct_renters
      : ctRenters.toFixed(1);

    html += `Renter households: ${ctRentersFormatted}%<br>`
  }

  if(props.ct_risk != null) {
    const ctRisk = Number(props.ct_risk);
    const ctRiskFormatted = isNaN(ctRisk)
      ? props.ct_risk
      : ctRisk.toFixed(1);

      html += `Estimated total households at risk: ${ctRiskFormatted}%<br>`
  }

  layer.bindPopup(html);
}


let legendContainer = null;

const legendControl = L.control({ position: "topright" });

legendControl.onAdd = function () {
  const div = L.DomUtil.create("div", "layer-legend");
  div.innerHTML = `
    <h3>Renter Housing Cost Burden</h3>
    <h4>Layers</h4>
    <form id="layer-legend-form"></form>
  `;
  L.DomEvent.disableClickPropagation(div);
  legendContainer = div;
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


    if(cfg.id=== "ward-points") {
      updateZoomVisibility();
    }
  });

    const text = document.createElement("span");
    text.textContent = cfg.name;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(text);
    container.appendChild(wrapper);

    if (cfg.id === "shelter") {
      const classesDiv = document.createElement("div");
      classesDiv.className = "layer-classes";
      SHELTER_LEGEND_CLASSES.forEach((item) => {
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

    if (cfg.id === "ct-renters") {
      const classesDiv = document.createElement("div");
      classesDiv.className = "layer-classes";
      CT_RENTERS_LEGEND_CLASSES.forEach((item) => {
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

    if (cfg.id === "ward-points") {
      const note = document.createElement("div");
      note.className = "layer-note";
      note.textContent = "Circle colour = MPP party; circle size & number = % of households that rent (by ward/riding).";
      container.appendChild(note);

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

const resetControl = L.control({ position: "topleft" });

resetControl.onAdd = function (map) {
  const container = L.DomUtil.create("div", "leaflet-bar reset-control");
  const link = L.DomUtil.create("a", "", container);
  link.href = "#";
  link.title = "Reset view";
  link.innerHTML = "⟳";
  L.DomEvent.on(link, "click", function (e) {
    L.DomEvent.stop(e);
    map.setView(INITIAL_CENTER, INITIAL_ZOOM);
  });
  return container;
};

resetControl.addTo(map);

const legendToggleControl = L.control({ position: "bottomright" });

legendToggleControl.onAdd = function (map) {
  const container = L.DomUtil.create("div", "legend-toggle-btn leaflet-bar");
  L.DomEvent.disableClickPropagation(container);
  const link = L.DomUtil.create("a", "", container);
  link.href = "#";
  link.title = "Toggle layers";
  link.innerHTML = "☰";
  L.DomEvent.on(link, "click", function (e) {
    L.DomEvent.stop(e);
    if (!legendContainer) {
      console.warn("Legend container not ready yet");
      return;
    }
    legendContainer.classList.toggle("is-open");
    console.log("Legend toggled, classes:", legendContainer.className);
  });
  return container;
};

legendToggleControl.addTo(map);

LAYER_CONFIGS.forEach((cfg) => {
  fetch(cfg.url)
    .then((response) => {
      if (!response.ok) console.warn(`Failed to load ${cfg.url}`);
      return response.json();
    })
    .then((geojson) => {
      const options =  {
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
      };

      if(cfg.id === "wards") {
        options.interactive = false;
      }

      const layer = L.geoJSON(geojson, options);

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

function updateZoomVisibility() {
  const z = map.getZoom();

  const wardPointsLayer = overlayLayers["ward-points"];
  if (!wardPointsLayer) return;

  const checkbox = document.querySelector(
    'input[type="checkbox"][value="ward-points"]'
  );
  const checkboxChecked = checkbox ? checkbox.checked: true;

  const showPoints = z >= 12 && checkboxChecked;

  if (showPoints && !map.hasLayer(wardPointsLayer)) {
    map.addLayer(wardPointsLayer);
  } else if (!showPoints && map.hasLayer(wardPointsLayer)) {
    map.removeLayer(wardPointsLayer);
  }

  const showLabels = z >= WARD_LABEL_MIN_ZOOM && !showPoints
if(showLabels && !map.hasLayer(wardLabelLayer)) {
  map.addLayer(wardLabelLayer);
}else if (!showLabels && map.hasLayer(wardLabelLayer)) {
  map.removeLayer(wardLabelLayer)
}
}


map.on("zoomend", updateZoomVisibility);
map.whenReady(updateZoomVisibility);

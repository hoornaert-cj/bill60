README — Toronto Renter Housing Cost Burden Map
------------------------------------------------

Project Title:
Toronto Renter Housing Cost Burden (Interactive Web Map)

Author / Developer:
Christopher [Your Last Name]
Freelance GIS & Web Mapping Specialist
Email: [your email]
Website: [your portfolio URL]

Partner Organization:
Social and Economic Analysis (SEA)

------------------------------------------------
PROJECT OVERVIEW

This interactive Leaflet map visualizes renter housing cost burden across Toronto. 
It combines data at the ward and census tract levels to show areas where renter 
households face higher financial vulnerability.

The map allows users to:
- View the percentage of renter households spending 30%+ of income on shelter (census tract)
- Compare overall renter household percentages
- Identify wards with higher concentrations of housing cost burden
- Estimate the proportion of total households most at risk of unaffordable housing

------------------------------------------------
FILE STRUCTURE

index.html
│
├── js/
│   └── map.js
│
├── styles/
│   └── styles.css
│
└── data/
    ├── ward-info.geojson
    ├── shelter.geojson
    └── ward-points.geojson

------------------------------------------------
HOW TO USE

1. Unzip the folder.
2. To preview locally, open index.html in any modern web browser.
3. To publish on your site:
   - Upload all files to the same directory on the SEA web server.
   - Keep the folder structure intact.
   - Access the map by visiting the uploaded index.html page.

------------------------------------------------
DATA SOURCES

- City of Toronto Open Data Portal — Ward Boundaries (2022)
- Statistics Canada — 2021 Census of Population (Census Tract data)
- OpenStreetMap — Base map tiles (© OpenStreetMap contributors)

Derived and processed using QGIS 3.34 and Leaflet.js.

------------------------------------------------
DATA NOTES

- “Renter Households Spending ≥30%” (ct_30_pct_plus_inc):
  Percentage of renter households spending 30% or more of income on shelter costs.

- “Renter Households (%)” (ct_percent_renters):
  Percentage of dwellings occupied by renters.

- “Estimated Risk” (optional field):
  Product of the two percentages above, representing households most at risk.

------------------------------------------------
MAP USE TIPS

- Use the legend (☰ button on mobile) to toggle layers.
- Toggle off the “Wards” layer to click and view Census Tract information.
- Click a feature to see key housing indicators.

------------------------------------------------
ATTRIBUTION

© City of Toronto Open Data (2022)
© Statistics Canada, 2021 Census of Population
© OpenStreetMap contributors
Map design and compilation © 2025 Christopher Hoornaert

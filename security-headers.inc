# Baseline security headers for the rejs static SPA. # Included from the SPA location blocks in
nginx.conf. add_header X-Content-Type-Options "nosniff" always; add_header Referrer-Policy
"strict-origin-when-cross-origin" always; add_header X-Frame-Options "DENY" always; add_header
Permissions-Policy "geolocation=(), camera=(), microphone=()" always; # Content-Security-Policy
tuned for a Leaflet + Nominatim app: # - default to self only # - style-src needs 'unsafe-inline'
because Leaflet sets inline styles on # map panes/markers at runtime (it cannot function without
this) # - img-src allows Esri/ArcGIS map tiles, plus data: for bundled Leaflet # marker icons # -
connect-src allows the public Nominatim geocoding API (XHR/fetch) add_header Content-Security-Policy
"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:
https://server.arcgisonline.com; connect-src 'self' https://nominatim.openstreetmap.org; font-src
'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;

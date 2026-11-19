import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Owner, Property, Unit } from '../types';

export type RentalListing = { property: Property; unit: Unit; owner: Owner };
export type MapScope = 'ust' | 'qc';

interface RentalMapProps {
  scope: MapScope;
  listings: RentalListing[];
  onSelect: (listing: RentalListing) => void;
}

export function RentalMap({ scope, listings, onSelect }: RentalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const mappedListings = listings.filter(({ property }) => Number.isFinite(property.latitude) && Number.isFinite(property.longitude));

  useEffect(() => {
    if (!containerRef.current) return;
    const center: L.LatLngTuple = scope === 'ust' ? [14.6099, 120.9894] : [14.6404, 121.061];
    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      // Scope changes replace this map; avoid callbacks from a removed zoom pane.
      zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
    }).setView(center, scope === 'ust' ? 16 : 13);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    tiles.on('tileerror', () => setTilesUnavailable(true));
    tiles.on('tileload', () => setTilesUnavailable(false));
    const groups = new Map<string, RentalListing[]>();
    for (const listing of listings) {
      if (!Number.isFinite(listing.property.latitude) || !Number.isFinite(listing.property.longitude)) continue;
      const group = groups.get(listing.property.id) || [];
      group.push(listing);
      groups.set(listing.property.id, group);
    }
    const bounds = L.latLngBounds([]);
    for (const group of groups.values()) {
      const property = group[0].property;
      const position: L.LatLngTuple = [property.latitude!, property.longitude!];
      bounds.extend(position);
      const price = Math.min(...group.map(({ unit }) => unit.monthlyRent));
      const label = document.createElement('span');
      label.textContent = `₱${price.toLocaleString()}`;
      const marker = L.marker(position, {
        icon: L.divIcon({ className: 'rental-price-marker', html: label, iconSize: [88, 32], iconAnchor: [44, 16] }),
        title: `${property.name}: from ₱${price.toLocaleString()} per month`,
      }).addTo(map);
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = property.name;
      popup.append(title);
      const address = document.createElement('p');
      address.textContent = `${property.type} · ${property.area}`;
      popup.append(address);
      for (const listing of group) {
        const button = document.createElement('button');
        button.className = 'map-listing-link';
        button.textContent = `${listing.unit.unitLabel} · ₱${listing.unit.monthlyRent.toLocaleString()}/mo →`;
        button.addEventListener('click', () => onSelect(listing));
        popup.append(button);
      }
      marker.bindPopup(popup, { maxWidth: 300 });
    }
    if (scope === 'ust') {
      L.circleMarker([14.6099, 120.9894], { radius: 7, color: '#002B66', fillOpacity: 1 }).addTo(map).bindTooltip('University of Santo Tomas');
    }
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.2), { maxZoom: scope === 'ust' ? 16 : 14, padding: [55, 45], animate: false });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [scope, listings, onSelect]);

  return <section className="rental-map-panel" aria-label={`Rental map around ${scope === 'ust' ? 'UST' : 'Quezon City'}`}>
    <div className="rental-map-heading">
      <div><h2>{scope === 'ust' ? 'Around UST, Sampaloc' : 'Around Quezon City'}</h2><p>Example scope · {mappedListings.length} available rentals · Select a price to see rooms and apartments.</p></div>
      <span className="mono-num">Monthly rent in PHP</span>
    </div>
    <div ref={containerRef} className="rental-map" role="region" aria-label="Interactive rental locations" />
    {tilesUnavailable && <p className="map-message" role="status">The street map could not load. Check your connection; rental details remain available below.</p>}
    {listings.length === 0 && <p className="map-message" role="status">No rentals match these filters in this scope. Adjust your filters to see locations.</p>}
    {mappedListings.length < listings.length && <p className="map-message">{listings.length - mappedListings.length} rental(s) have no map coordinates and remain in the results below.</p>}
    <p className="rental-map-caption">Concept prototype - sample properties only. Pins show approximate example locations, not verified property addresses.</p>
  </section>;
}

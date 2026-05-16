// Bounding-box helper. Ports server/app/geocoder.py :: _viewbox_around.
//
// Returns (lon_min, lat_min, lon_max, lat_max) — Nominatim viewbox format.

export type Viewbox = readonly [number, number, number, number];

export function viewboxAround(
  lat: number,
  lng: number,
  deltaDeg: number,
): Viewbox {
  return [lng - deltaDeg, lat - deltaDeg, lng + deltaDeg, lat + deltaDeg];
}

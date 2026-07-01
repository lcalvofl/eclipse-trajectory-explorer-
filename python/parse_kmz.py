import json
import re
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
KMZ_DIR = ROOT / "data" / "kmz"
OUT_DIR = ROOT / "data" / "processed"
OUT_FILE = OUT_DIR / "eclipse_paths.geojson"

NS = {"kml": "http://www.opengis.net/kml/2.2"}

def parse_coordinates(text):
    coords = []
    if not text:
        return coords

    for item in text.strip().split():
        parts = item.split(",")
        if len(parts) >= 2:
            lon = float(parts[0])
            lat = float(parts[1])
            coords.append([lon, lat])
    return coords

def clean_name(name):
    if not name:
        return ""
    return re.sub(r"\s+", " ", name).strip()

def extract_date_from_filename(filename):
    match = re.search(r"(\d{4})[_-](\d{2})[_-](\d{2})", filename)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return None

def extract_features_from_kmz(kmz_path):
    features = []
    eclipse_date = extract_date_from_filename(kmz_path.name)

    with zipfile.ZipFile(kmz_path, "r") as z:
        kml_files = [f for f in z.namelist() if f.endswith(".kml")]
        if not kml_files:
            print(f"No KML found in {kmz_path.name}")
            return []

        kml_content = z.read(kml_files[0])
        root = ET.fromstring(kml_content)

        for placemark in root.findall(".//kml:Placemark", NS):
            name_el = placemark.find("kml:name", NS)
            name = clean_name(name_el.text if name_el is not None else "")

            # Lines
            for line in placemark.findall(".//kml:LineString", NS):
                coord_el = line.find("kml:coordinates", NS)
                coords = parse_coordinates(coord_el.text if coord_el is not None else "")

                if len(coords) >= 2:
                    features.append({
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": coords
                        },
                        "properties": {
                            "date": eclipse_date,
                            "source_file": kmz_path.name,
                            "name": name,
                            "geometry_type": "line",
                            "is_spanish_eclipse": eclipse_date in ["2026-08-12", "2027-08-02", "2028-01-26"]
                        }
                    })

            # Points
            for point in placemark.findall(".//kml:Point", NS):
                coord_el = point.find("kml:coordinates", NS)
                coords = parse_coordinates(coord_el.text if coord_el is not None else "")

                if len(coords) == 1:
                    features.append({
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": coords[0]
                        },
                        "properties": {
                            "date": eclipse_date,
                            "source_file": kmz_path.name,
                            "name": name,
                            "geometry_type": "point",
                            "is_spanish_eclipse": eclipse_date in ["2026-08-12", "2027-08-02", "2028-01-26"]
                        }
                    })

    return features

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    kmz_files = sorted(
    list(KMZ_DIR.glob("*.kmz")) +
    list(KMZ_DIR.glob("*.KMZ")) +
    list(KMZ_DIR.glob("*.kmz.crdownload"))
)
    print("Found {len(kmz_files)} KMZ files")

    all_features = []

    for kmz_path in kmz_files:
        try:
            features = extract_features_from_kmz(kmz_path)
            all_features.extend(features)
            print(f"{kmz_path.name}: {len(features)} features")
        except Exception as e:
            print(f"Error reading {kmz_path.name}: {e}")

    geojson = {
        "type": "FeatureCollection",
        "features": all_features
    }

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f)

    print(f"\nSaved {len(all_features)} features to:")
    print(OUT_FILE)

if __name__ == "__main__":
    main()
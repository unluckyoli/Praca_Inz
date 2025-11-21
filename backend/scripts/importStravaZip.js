import "dotenv/config";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import prisma from "../src/config/database.js";

/* distance between two points*/
function haversine([lat1, lon1], [lat2, lon2]) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}



function parseTime(t) {
  if (!t) return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

/* for out chart, still todo */
function computePacePerKm(points) {
  if (!points || points.length < 2) return null;

  let distances = [0]; // m
  for (let i = 1; i < points.length; i++) {
    const d = haversine(
      [points[i - 1].lat, points[i - 1].lon],
      [points[i].lat, points[i].lon]
    );
    distances[i] = distances[i - 1] + d;
  }

  let kmTimes = {}; 

  let currentKm = 1;
  let lastKmTime = points[0].time;

  for (let i = 1; i < points.length; i++) {
    if (!points[i].time) continue;

    const totalMeters = distances[i];
    const targetMeters = currentKm * 1000;

    if (totalMeters >= targetMeters) {
      const segmentSec =
        (points[i].time - lastKmTime) / 1000; // seconds
      const pace = segmentSec / 60;           // min/km
      kmTimes[`km${currentKm}`] = pace;

      lastKmTime = points[i].time;
      currentKm++;
    }
  }

  // standard race checkpoints
  const standardDistances = {
    km1: kmTimes.km1 || null,
    km5: kmTimes.km5 ? avgPace(kmTimes, 5) : null,
    km10: kmTimes.km10 ? avgPace(kmTimes, 10) : null,
    km21: kmTimes.km21 ? avgPace(kmTimes, 21) : null,
    km42: kmTimes.km42 ? avgPace(kmTimes, 42) : null,
  };

  return { perKm: kmTimes, checkpoints: standardDistances };
}



function avgPace(kmTimes, n) {
  let valid = [];
  for (let i = 1; i <= n; i++) {
    if (kmTimes[`km${i}`]) valid.push(kmTimes[`km${i}`]);
  }
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b) / valid.length;
}




/* activity .gpx */
function extractGPX(gpxObj) {
  const trk = gpxObj.gpx?.trk;
  if (!trk) return null;

  const track = Array.isArray(trk) ? trk[0] : trk;
  const nameRaw = track.name || gpxObj.gpx?.metadata?.name;
  const name = nameRaw ? String(nameRaw) : "Imported activity";

  const segs = track.trkseg;
  const segments = Array.isArray(segs) ? segs : [segs];

  const points = [];

  for (const seg of segments) {
    const trkpts = seg?.trkpt || [];
    const arr = Array.isArray(trkpts) ? trkpts : [trkpts];
    for (const p of arr) {
      const lat = parseFloat(p["@_lat"]);
      const lon = parseFloat(p["@_lon"]);
      const time = parseTime(p.time);
      if (!isNaN(lat) && !isNaN(lon)) points.push({ lat, lon, time });
    }
  }

  if (points.length < 2) return null;

  const start = points[0].time;
  const end = points.at(-1).time;
  const duration = Math.round((end - start) / 1000);

  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    distance += haversine(
      [points[i - 1].lat, points[i - 1].lon],
      [points[i].lat, points[i].lon]
    );
  }

  return {
    name,
    start,
    duration,
    distance: Math.round(distance),
    points,
  };
}

/* parse json api strava format */
function extractJsonActivity(obj) {
  return {
    name: String(obj.name || obj.activity_name || "Imported activity"),
    start: parseTime(obj.start_date_local || obj.start_date),
    duration: obj.moving_time || obj.elapsed_time || null,
    distance: obj.distance || null,
    points: null,                   // no gps in strava .zip
  };
}




async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node importStravaZip.js <path-to-zip> <userId>");
    process.exit(1);
  }

  const zipPath = path.resolve(args[0]);
  const userId = args[1];

  if (!fs.existsSync(zipPath)) {
    console.error("Zip file not found:", zipPath);
    process.exit(1);
  }

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

  let createdCount = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const ext = path.extname(entry.entryName).toLowerCase();
    if (![".gpx", ".tcx", ".json"].includes(ext)) continue; // ignore messaging.json

    try {
      if (ext === ".gpx") {
        const text = entry.getData().toString("utf8");
        const obj = parser.parse(text);
        const data = extractGPX(obj);
        if (!data) continue;

        const pace = computePacePerKm(data.points);

        const created = await prisma.activity.create({
          data: {
            userId,
            source: "STRAVA",
            externalId: entry.entryName,
            name: data.name,
            type: "Run",
            startDate: data.start,
            duration: data.duration,
            distance: data.distance,
            averageSpeed: data.distance / data.duration,
            pacePerKm: pace ? pace.checkpoints : null,
          },
        });

        createdCount++;
        console.log("Imported GPX:", entry.entryName, "->", created.id);
      }

      if (ext === ".json") {
        const text = entry.getData().toString("utf8");
        const obj = JSON.parse(text);
        const data = extractJsonActivity(obj);

        const created = await prisma.activity.create({
          data: {
            userId,
            source: "STRAVA",
            externalId: String(obj.id || entry.entryName),
            name: data.name,
            type: obj.type || "Other",
            startDate: data.start,
            duration: data.duration,
            distance: data.distance,
            averageSpeed:
              data.duration && data.distance
                ? data.distance / data.duration
                : null,
            pacePerKm: null,
          },
        });

        createdCount++;
        console.log("Imported JSON:", entry.entryName, "->", created.id);
      }
    } catch (err) {
      console.error("Error processing", entry.entryName, err.message);
    }
  }

  console.log(`\nImport complete. Created ${createdCount} activities.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Import script error:", err);
  process.exit(1);
});
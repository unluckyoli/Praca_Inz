import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import prisma from '../src/config/database.js';



function haversine([lat1, lon1], [lat2, lon2]) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000; 
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseTime(t) {
  if (!t) return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function extractGPX(gpxObj) {

  const trk = gpxObj.gpx?.trk;
  if (!trk) return null;

  const name = trk.name || gpxObj.gpx?.metadata?.name || 'Imported activity';
  const track = Array.isArray(trk) ? trk[0] : trk;
  const segs = track.trkseg;
  const points = [];

  const segments = Array.isArray(segs) ? segs : [segs];
  for (const seg of segments) {
    const trkpts = seg.trkpt || [];
    const arr = Array.isArray(trkpts) ? trkpts : [trkpts];
    for (const p of arr) {
      const lat = parseFloat(p['@_lat']);
      const lon = parseFloat(p['@_lon']);
      const time = parseTime(p.time);
      if (!isNaN(lat) && !isNaN(lon)) points.push({ lat, lon, time });
    }
  }

  if (points.length === 0) return null;

  const start = points[0].time || null;
  const end = points[points.length - 1].time || null;
  const duration = start && end ? Math.round((end - start) / 1000) : null;

  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    distance += haversine([points[i - 1].lat, points[i - 1].lon], [points[i].lat, points[i].lon]);
  }

  return { name, start, duration, distance: Math.round(distance), points };
}

function extractTCX(tcxObj) {


  const activities = tcxObj.TrainingCenterDatabase?.Activities?.Activity;
  if (!activities) return null;

  const act = Array.isArray(activities) ? activities[0] : activities;
  const name = act?._name || act?.Id || 'Imported activity';

  const laps = act.Lap ? (Array.isArray(act.Lap) ? act.Lap : [act.Lap]) : [];
  const points = [];

  for (const lap of laps) {
    const tracks = lap.Track ? (Array.isArray(lap.Track) ? lap.Track : [lap.Track]) : [];
    for (const track of tracks) {
      const tps = track.Trackpoint ? (Array.isArray(track.Trackpoint) ? track.Trackpoint : [track.Trackpoint]) : [];
      for (const tp of tps) {
        const lat = tp.Position ? parseFloat(tp.Position.LatitudeDegrees) : NaN;
        const lon = tp.Position ? parseFloat(tp.Position.LongitudeDegrees) : NaN;
        const time = parseTime(tp.Time);
        if (!isNaN(lat) && !isNaN(lon)) points.push({ lat, lon, time });
      }
    }
  }

  if (points.length === 0) return null;

  const start = points[0].time || null;
  const end = points[points.length - 1].time || null;
  const duration = start && end ? Math.round((end - start) / 1000) : null;

  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    distance += haversine([points[i - 1].lat, points[i - 1].lon], [points[i].lat, points[i].lon]);
  }

  return { name, start, duration, distance: Math.round(distance), points };
}

function extractJsonActivity(obj) {
  const name = obj.name || obj.activity_name || 'Imported activity';
  const start = parseTime(obj.start_date_local || obj.start_date || obj.start_date_local);
  const duration = obj.moving_time || obj.elapsed_time || null;
  const distance = obj.distance || null;
  const points = null; 
  return { name, start, duration, distance, points };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node importStravaZip.js <path-to-zip> <userId>');
    process.exit(1);
  }

  const zipPath = path.resolve(args[0]);
  const userId = args[1];

  if (!fs.existsSync(zipPath)) {
    console.error('Zip file not found:', zipPath);
    process.exit(1);
  }

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

  let createdCount = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const ext = path.extname(entry.entryName).toLowerCase();
    const base = path.basename(entry.entryName);

    try {
      if (ext === '.gpx') {
        const text = entry.getData().toString('utf8');
        const obj = parser.parse(text);
        const data = extractGPX(obj);
        if (data) {
          const created = await prisma.activity.create({
            data: {
              userId,
              source: 'STRAVA',
              externalId: entry.entryName,
              name: data.name,
              type: 'Other',
              startDate: data.start || new Date(),
              duration: data.duration,
              distance: data.distance,
              averageSpeed: data.duration && data.distance ? data.distance / data.duration : null,
            },
          });







          //gps points but does not work for now
          if (data.points && data.points.length > 0) {
            const gpsPoints = data.points.map((p) => ({
              activityId: created.id,
              latitude: p.lat,
              longitude: p.lon,
              timestamp: p.time || new Date(),
            }));

            for (let i = 0; i < gpsPoints.length; i += 500) {
              const batch = gpsPoints.slice(i, i + 500);
              await prisma.gpsPoint.createMany({ data: batch });
            }
          }

          createdCount++;
          console.log('Imported GPX:', entry.entryName, '-> activity id', created.id);
        }
      } else if (ext === '.tcx') {
        const text = entry.getData().toString('utf8');
        const obj = parser.parse(text);
        const data = extractTCX(obj);
        if (data) {
          const created = await prisma.activity.create({
            data: {
              userId,
              source: 'STRAVA',
              externalId: entry.entryName,
              name: data.name,
              type: 'Other',
              startDate: data.start || new Date(),
              duration: data.duration,
              distance: data.distance,
              averageSpeed: data.duration && data.distance ? data.distance / data.duration : null,
            },
          });

          if (data.points && data.points.length > 0) {
            const gpsPoints = data.points.map((p) => ({
              activityId: created.id,
              latitude: p.lat,
              longitude: p.lon,
              timestamp: p.time || new Date(),
            }));

            for (let i = 0; i < gpsPoints.length; i += 500) {
              const batch = gpsPoints.slice(i, i + 500);
              await prisma.gpsPoint.createMany({ data: batch });
            }
          }

          createdCount++;
          console.log('Imported TCX:', entry.entryName, '-> activity id', created.id);
        }
      } else if (ext === '.json') {
        const text = entry.getData().toString('utf8');
        const obj = JSON.parse(text);


        const data = extractJsonActivity(obj);
        if (data) {
          const created = await prisma.activity.create({
            data: {
              userId,
              source: 'STRAVA',
              externalId: obj.id ? String(obj.id) : entry.entryName,
              name: data.name,
              type: obj.type || 'Other',
              startDate: data.start || new Date(),
              duration: data.duration,
              distance: data.distance,
              averageSpeed: data.duration && data.distance ? data.distance / data.duration : null,
            },
          });

          createdCount++;
          console.log('Imported JSON:', entry.entryName, '-> activity id', created.id);
        }
      } else {
        // ignore
      }
    } catch (err) {
      console.error('Error processing', entry.entryName, err.message || err);
    }
  }

  console.log(`Import complete. Created ${createdCount} activities.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Import script error:', err);
  process.exit(1);
});

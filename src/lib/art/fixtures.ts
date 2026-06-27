import type { ActivityData } from '@/types/map-story'

/** 20km winding trail run — tests long route, elevation */
export const longWindingRouteFixture: ActivityData = {
  id: 'fixture-long',
  type: 'run',
  name: 'Montagna Mattutina',
  date: '2026-06-14T06:30:00Z',
  stats: {
    distance_m: 20140,
    movingTime_s: 7200,
    elapsedTime_s: 7560,
    elevationGain_m: 680,
    avgSpeed_mps: 2.8,
  },
  route: {
    hasGps: true,
    points: [
      [0.5, 0.02],[0.52,0.06],[0.55,0.09],[0.58,0.14],[0.60,0.18],
      [0.62,0.22],[0.64,0.27],[0.62,0.31],[0.60,0.36],[0.57,0.40],
      [0.55,0.44],[0.52,0.47],[0.48,0.50],[0.45,0.53],[0.42,0.57],
      [0.39,0.62],[0.37,0.66],[0.35,0.70],[0.33,0.74],[0.31,0.78],
      [0.30,0.82],[0.29,0.85],[0.28,0.88],[0.27,0.91],[0.26,0.94],
      [0.28,0.96],[0.31,0.97],[0.35,0.98],
    ],
  },
  athlete: { name: 'Andrea Ruggeri', handle: 'andrearuggeri' },
}

/** 5km city run — dense GPS, lots of turns */
export const shortCityRouteFixture: ActivityData = {
  id: 'fixture-city',
  type: 'run',
  name: 'Corsa in Centro',
  date: '2026-06-20T07:15:00Z',
  stats: {
    distance_m: 5230,
    movingTime_s: 1560,
    elapsedTime_s: 1600,
    elevationGain_m: 28,
    avgSpeed_mps: 3.35,
  },
  route: {
    hasGps: true,
    points: [
      [0.5,0.5],[0.55,0.5],[0.55,0.4],[0.6,0.4],[0.6,0.5],
      [0.65,0.5],[0.65,0.6],[0.55,0.6],[0.55,0.7],[0.45,0.7],
      [0.45,0.6],[0.4,0.6],[0.4,0.5],[0.45,0.5],[0.45,0.4],
      [0.5,0.4],[0.5,0.5],
    ],
  },
  athlete: { name: 'Andrea Ruggeri', handle: 'andrearuggeri' },
}

/** 40km road cycling — mostly linear */
export const linearRouteFixture: ActivityData = {
  id: 'fixture-linear',
  type: 'ride',
  name: 'Ciclabile del Naviglio',
  date: '2026-06-22T09:00:00Z',
  stats: {
    distance_m: 40500,
    movingTime_s: 5400,
    elapsedTime_s: 5800,
    elevationGain_m: 85,
    avgSpeed_mps: 7.5,
  },
  route: {
    hasGps: true,
    points: [
      [0.5,0.02],[0.51,0.1],[0.52,0.18],[0.51,0.26],[0.52,0.34],
      [0.51,0.42],[0.52,0.50],[0.51,0.58],[0.52,0.66],[0.51,0.74],
      [0.52,0.82],[0.51,0.90],[0.5,0.98],
    ],
  },
  athlete: { name: 'Andrea Ruggeri', handle: 'andrearuggeri' },
}

/** Indoor treadmill — no GPS */
export const noGpsFixture: ActivityData = {
  id: 'fixture-nogps',
  type: 'run',
  name: 'Tapis Roulant',
  date: '2026-06-25T18:00:00Z',
  stats: {
    distance_m: 8000,
    movingTime_s: 2400,
    elapsedTime_s: 2400,
    elevationGain_m: 0,
    avgSpeed_mps: 3.33,
  },
  route: { hasGps: false, points: [] },
  athlete: { name: 'Andrea Ruggeri', handle: 'andrearuggeri' },
}

export const ALL_FIXTURES = [
  longWindingRouteFixture,
  shortCityRouteFixture,
  linearRouteFixture,
  noGpsFixture,
] as const

/** Alias for longWindingRouteFixture — used in EditorCanvas tests and stories. */
export const longTrailFixture = longWindingRouteFixture

# Dashboard Performance Benchmark

Measured with `./node_modules/.bin/tsx scripts/benchmark-dashboard.tsx` on the dashboard route using generated workspaces with 100, 500, and 1,000 documents. The harness wraps the real app route in React Profiler and times a status-filter interaction from click to settled dashboard count.

## Optimization

The expensive surfaces were the repeated document lists: the sidebar document list, board columns, and list view. These now use fixed-row virtual windows so large workspaces render only the visible items plus overscan.

## React Profiler Results

| Documents | Initial commit total before | Initial commit total after | Initial max before | Initial max after | Filter latency before | Filter latency after | Filter commit total before | Filter commit total after |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 262.48 ms | 221.94 ms | 176.71 ms | 177.32 ms | 66.92 ms | 56.27 ms | 29.18 ms | 27.21 ms |
| 500 | 798.36 ms | 68.81 ms | 559.70 ms | 52.26 ms | 265.59 ms | 20.39 ms | 123.59 ms | 9.88 ms |
| 1,000 | 1,225.39 ms | 61.42 ms | 831.57 ms | 45.47 ms | 464.15 ms | 20.29 ms | 183.12 ms | 9.69 ms |

## Production Bundle Size

Measured with `npm run build`.

| Asset | Before | Before gzip | After | After gzip |
| --- | ---: | ---: | ---: | ---: |
| Main CSS | 39.36 kB | 7.37 kB | 39.54 kB | 7.43 kB |
| Main JS | 399.71 kB | 121.77 kB | 401.68 kB | 122.40 kB |
| Document page JS | 521.20 kB | 163.55 kB | 521.20 kB | 163.55 kB |

The optimization adds about 1.97 kB minified JS to the main bundle and keeps the existing large DocumentPage chunk unchanged.

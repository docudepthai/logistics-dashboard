'use client';

import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { provinceCoordinates, normalizeProvinceName, provinceIdMap } from './turkey-paths';
import { TURKEY_SVG } from './turkey-svg';

interface RouteData {
  origin: string;
  destination: string;
  count: number;
}

interface ProvinceActivity {
  name: string;
  origins: number;
  destinations: number;
  total: number;
}

interface MapData {
  routes: RouteData[];
  provinces: ProvinceActivity[];
  totalRoutes: number;
}

// Memoized SVG container - only re-renders when svgContent changes
const SvgContainer = memo(function SvgContainer({
  svgContent,
  svgRef
}: {
  svgContent: string | null;
  svgRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={svgRef}
      className="relative w-full [&>svg]:w-full [&>svg]:h-auto"
      dangerouslySetInnerHTML={svgContent ? { __html: svgContent } : undefined}
    />
  );
});

export default function MapPage() {
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [mapSetup, setMapSetup] = useState(false);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const selectedRouteRef = useRef<RouteData | null>(null);

  // Fetch route data
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const res = await fetch('/api/routes');
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    };
    fetchRoutes();
    const interval = setInterval(fetchRoutes, 30000);
    return () => clearInterval(interval);
  }, []);

  // Set SVG content from embedded file
  useEffect(() => {
    // Remove XML declaration and comments from embedded SVG
    let svg = TURKEY_SVG;
    svg = svg.replace(/<\?xml[^?]*\?>/g, '');
    svg = svg.replace(/<!--[\s\S]*?-->/g, '');
    setSvgContent(svg);
  }, []);

  // Style SVG provinces and add routes
  const setupMap = useCallback(() => {
    if (!svgContainerRef.current || !data || !svgContent) return;

    const svg = svgContainerRef.current.querySelector('svg');
    if (!svg) return;

    // Build activity map
    const activityMap = new Map<string, ProvinceActivity>();
    data.provinces.forEach(p => {
      activityMap.set(normalizeProvinceName(p.name), p);
    });

    // Get or create tooltip element
    let tooltip = document.getElementById('map-tooltip') as HTMLDivElement;
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'map-tooltip';
      tooltip.className = 'absolute pointer-events-none bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 shadow-lg z-20 opacity-0 transition-opacity';
      tooltip.style.transform = 'translate(-50%, -120%)';
      svgContainerRef.current.appendChild(tooltip);
    }

    // Style all province paths
    const paths = svg.querySelectorAll('path[id^="TR-"]');
    paths.forEach((path) => {
      const pathEl = path as SVGPathElement;
      const id = pathEl.getAttribute('id') || '';
      const title = pathEl.getAttribute('title') || '';
      const provinceName = provinceIdMap[id] || normalizeProvinceName(title);
      const activity = activityMap.get(normalizeProvinceName(provinceName));
      const isActive = activity && activity.total > 0;
      const intensity = activity ? Math.min(activity.total / 100, 1) : 0;

      // Set base styles
      pathEl.style.fill = isActive
        ? `rgba(255, 255, 255, ${0.06 + intensity * 0.18})`
        : '#131313';
      pathEl.style.stroke = isActive ? '#3a3a3a' : '#252525';
      pathEl.style.strokeWidth = '0.5';
      pathEl.style.cursor = 'pointer';
      pathEl.style.transition = 'all 0.2s ease';

      // Add hover events - update DOM directly, no React state
      pathEl.onmouseenter = () => {
        pathEl.style.stroke = '#fff';
        pathEl.style.strokeWidth = '1.5';
        pathEl.style.filter = 'drop-shadow(0 0 6px rgba(255,255,255,0.4))';

        // Update tooltip directly
        const coords = provinceCoordinates[normalizeProvinceName(provinceName)] || provinceCoordinates[provinceName];
        if (coords && tooltip) {
          const svgRect = svg.getBoundingClientRect();
          const xPercent = coords.x / 792.5976;
          const yPercent = coords.y / 334.55841;
          tooltip.style.left = `${xPercent * svgRect.width}px`;
          tooltip.style.top = `${yPercent * svgRect.height}px`;
          tooltip.innerHTML = `
            <div class="text-white text-sm font-medium">${title || provinceName}</div>
            <div class="text-neutral-400 text-xs">${activity ? `${activity.origins} origins · ${activity.destinations} destinations` : 'No activity'}</div>
          `;
          tooltip.style.opacity = '1';
        }
      };

      pathEl.onmouseleave = () => {
        pathEl.style.stroke = isActive ? '#3a3a3a' : '#252525';
        pathEl.style.strokeWidth = '0.5';
        pathEl.style.filter = 'none';
        if (tooltip) {
          tooltip.style.opacity = '0';
        }
      };
    });

    // Remove existing overlays
    const existingOverlay = svg.querySelector('#routes-overlay');
    if (existingOverlay) existingOverlay.remove();

    // Create overlay group for routes and dots
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    overlay.id = 'routes-overlay';

    // Add defs for filters and animations
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <filter id="routeGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <style>
        @keyframes dashFlow {
          0% { stroke-dashoffset: 18; }
          100% { stroke-dashoffset: 0; }
        }
        .route-selected {
          stroke-dasharray: 12 6;
          animation: dashFlow 0.8s linear infinite;
        }
      </style>
    `;
    overlay.appendChild(defs);

    const maxRouteCount = Math.max(...data.routes.map(r => r.count), 1);

    // Add routes
    const routesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    routesGroup.id = 'routes-layer';

    data.routes.slice(0, 50).forEach((route) => {
      const startCoords = provinceCoordinates[normalizeProvinceName(route.origin)] || provinceCoordinates[route.origin];
      const endCoords = provinceCoordinates[normalizeProvinceName(route.destination)] || provinceCoordinates[route.destination];
      if (!startCoords || !endCoords) return;

      const opacity = 0.3 + (route.count / maxRouteCount) * 0.5;
      const strokeWidth = 1 + (route.count / maxRouteCount) * 2;

      const dx = endCoords.x - startCoords.x;
      const dy = endCoords.y - startCoords.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const curveHeight = Math.min(distance * 0.2, 40);
      const midX = (startCoords.x + endCoords.x) / 2;
      const midY = (startCoords.y + endCoords.y) / 2 - curveHeight;

      const pathD = `M ${startCoords.x} ${startCoords.y} Q ${midX} ${midY} ${endCoords.x} ${endCoords.y}`;
      const pathId = `route-${route.origin}-${route.destination}`.replace(/\s+/g, '-');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('id', pathId);
      path.setAttribute('d', pathD);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#777');
      path.setAttribute('stroke-width', String(strokeWidth));
      path.setAttribute('opacity', String(opacity));
      path.style.cursor = 'pointer';
      path.style.transition = 'all 0.3s ease';

      path.setAttribute('data-origin', route.origin);
      path.setAttribute('data-destination', route.destination);
      path.setAttribute('data-count', String(route.count));
      path.onclick = () => {
        const isSame = selectedRouteRef.current?.origin === route.origin &&
                       selectedRouteRef.current?.destination === route.destination;
        const newSelection = isSame ? null : route;
        selectedRouteRef.current = newSelection;
        setSelectedRoute(newSelection);
      };

      routesGroup.appendChild(path);
    });

    overlay.appendChild(routesGroup);

    // Add province dots
    const dotsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dotsGroup.id = 'province-dots';

    Object.entries(provinceCoordinates).forEach(([name, coords]) => {
      const activity = activityMap.get(normalizeProvinceName(name));
      if (!activity || activity.total === 0) return;

      const size = 3 + Math.min(activity.total / 15, 6);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(coords.x));
      circle.setAttribute('cy', String(coords.y));
      circle.setAttribute('r', String(size));
      circle.setAttribute('fill', '#888');
      circle.style.transition = 'all 0.2s ease';

      dotsGroup.appendChild(circle);
    });

    overlay.appendChild(dotsGroup);

    // Append overlay to SVG
    svg.appendChild(overlay);
    setMapSetup(true);
  }, [data, svgContent]);

  // Apply setup when SVG and data are loaded
  useEffect(() => {
    if (svgContent && data && !mapSetup) {
      // Small delay to ensure DOM is ready after dangerouslySetInnerHTML
      const timer = setTimeout(setupMap, 50);
      return () => clearTimeout(timer);
    }
  }, [svgContent, data, mapSetup, setupMap]);

  // Update selected route styling
  useEffect(() => {
    if (!svgContainerRef.current || !data) return;
    const svg = svgContainerRef.current.querySelector('svg');
    if (!svg) return;

    const routesLayer = svg.querySelector('#routes-layer');
    if (!routesLayer) return;

    // Remove any existing animated arrows
    const existingArrows = svg.querySelectorAll('.traveling-arrow');
    existingArrows.forEach(a => a.remove());

    const paths = routesLayer.querySelectorAll('path');
    const maxRouteCount = Math.max(...data.routes.map(r => r.count), 1);

    paths.forEach((path) => {
      const origin = path.getAttribute('data-origin');
      const destination = path.getAttribute('data-destination');
      const countAttr = path.getAttribute('data-count');
      const count = countAttr ? parseInt(countAttr, 10) : 1;
      const pathId = path.getAttribute('id');

      const isSelected = selectedRoute?.origin === origin &&
                        selectedRoute?.destination === destination;
      const strokeWidth = 1 + (count / maxRouteCount) * 2;
      const opacity = 0.3 + (count / maxRouteCount) * 0.5;

      if (isSelected && pathId) {
        path.setAttribute('stroke', '#fff');
        path.setAttribute('stroke-width', String(strokeWidth + 2));
        path.setAttribute('opacity', '1');
        path.setAttribute('filter', 'url(#routeGlow)');
        path.classList.add('route-selected');

        // Create traveling arrow
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', '0,-3 6,0 0,3');
        arrow.setAttribute('fill', '#fff');
        arrow.setAttribute('class', 'traveling-arrow');

        // Create animation
        const animateMotion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
        animateMotion.setAttribute('dur', '2s');
        animateMotion.setAttribute('repeatCount', 'indefinite');
        animateMotion.setAttribute('rotate', 'auto');

        const mpath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
        mpath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${pathId}`);
        animateMotion.appendChild(mpath);
        arrow.appendChild(animateMotion);

        svg.appendChild(arrow);
      } else {
        path.setAttribute('stroke', '#777');
        path.setAttribute('stroke-width', String(strokeWidth));
        path.setAttribute('opacity', String(opacity));
        path.setAttribute('filter', '');
        path.classList.remove('route-selected');
      }
    });
  }, [selectedRoute, data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <div className="text-neutral-500 text-center py-20">Failed to load</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Routes</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {data.routes.length} active routes · {data.provinces.filter(p => p.total > 0).length} cities
          </p>
        </div>
        {selectedRoute && (
          <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg px-4 py-2">
            <span className="text-white">{selectedRoute.origin}</span>
            <span className="text-neutral-500 mx-2">→</span>
            <span className="text-neutral-300">{selectedRoute.destination}</span>
            <span className="text-neutral-500 ml-3 font-mono">{selectedRoute.count} jobs</span>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="bg-neutral-950 border border-neutral-800/50 rounded-lg overflow-hidden p-4">
        <div className="relative" style={{ background: '#0a0a0a' }}>
          {/* Memoized SVG container - won't re-render on state changes */}
          <SvgContainer svgContent={svgContent} svgRef={svgContainerRef} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 items-start">
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-4 self-start">
          <h3 className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Top Origins</h3>
          <div className="space-y-2">
            {data.provinces
              .filter(p => p.origins > 0)
              .sort((a, b) => b.origins - a.origins)
              .slice(0, 5)
              .map((p) => (
                <div key={p.name} className="flex items-center justify-between">
                  <span className="text-neutral-400 text-sm">{p.name}</span>
                  <span className="text-white font-mono text-sm">{p.origins}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-4 self-start">
          <h3 className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Top Destinations</h3>
          <div className="space-y-2">
            {data.provinces
              .filter(p => p.destinations > 0)
              .sort((a, b) => b.destinations - a.destinations)
              .slice(0, 5)
              .map((p) => (
                <div key={p.name} className="flex items-center justify-between">
                  <span className="text-neutral-400 text-sm">{p.name}</span>
                  <span className="text-white font-mono text-sm">{p.destinations}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="col-span-2 bg-neutral-900/50 border border-neutral-800/50 rounded-lg px-3 py-4 flex flex-col self-start overflow-hidden">
          <h3 className="text-xs text-neutral-500 uppercase tracking-wider mb-3 px-1">Busiest Routes</h3>
          <div className="space-y-1 flex-1 overflow-y-auto overflow-x-hidden" style={{ maxHeight: showAllRoutes ? '300px' : 'none' }}>
            {data.routes.slice(0, showAllRoutes ? 50 : 5).map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between cursor-pointer hover:bg-neutral-800/50 px-1 py-1 rounded transition-colors ${
                  selectedRoute?.origin === r.origin && selectedRoute?.destination === r.destination
                    ? 'bg-neutral-800 ring-1 ring-neutral-600'
                    : ''
                }`}
                onClick={() => {
                  const isSame = selectedRoute?.origin === r.origin && selectedRoute?.destination === r.destination;
                  const newSelection = isSame ? null : r;
                  selectedRouteRef.current = newSelection;
                  setSelectedRoute(newSelection);
                }}
              >
                <div className="flex items-center space-x-2 text-sm min-w-0">
                  <span className="text-neutral-400 truncate">{r.origin}</span>
                  <span className="text-neutral-600 flex-shrink-0">→</span>
                  <span className="text-neutral-500 truncate">{r.destination}</span>
                </div>
                <span className="text-white font-mono text-sm ml-2 flex-shrink-0">{r.count}</span>
              </div>
            ))}
          </div>
          {data.routes.length > 5 && (
            <button
              onClick={() => setShowAllRoutes(!showAllRoutes)}
              className="mt-3 text-xs text-neutral-400 hover:text-white transition-colors text-center py-1 border-t border-neutral-800"
            >
              {showAllRoutes ? 'Show Less' : `Show All (${data.routes.length})`}
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-neutral-600 text-xs">
        Click routes to highlight · Hover provinces for details
      </p>
    </div>
  );
}

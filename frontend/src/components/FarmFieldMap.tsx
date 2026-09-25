import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import * as turf from '@turf/turf';
import {
  Search, Crosshair, Undo2, RotateCcw, Check, MapPin,
  AlertCircle, Loader2, HelpCircle, AlertTriangle, RefreshCw, WifiOff,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export interface FarmLocationData {
  latitude: number;
  longitude: number;
  area_hectares: number;
  boundary_geojson: {
    type: 'Polygon' | 'Feature';
    coordinates?: number[][][];
    geometry?: {
      type: 'Polygon';
      coordinates: number[][][];
    };
    properties?: Record<string, any>;
  };
  isValidBoundary?: boolean;
  validationError?: string | null;
}

interface FarmFieldMapProps {
  initialData?: Partial<FarmLocationData> | null;
  onChange: (data: FarmLocationData) => void;
  height?: number | string;
  readOnly?: boolean;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export const FarmFieldMap: React.FC<FarmFieldMapProps> = ({
  initialData,
  onChange,
  height = 420,
  readOnly = false,
}) => {
  const { t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const lowZoomMarkerRef = useRef<L.Marker | null>(null);

  // Drawing state
  const [points, setPoints] = useState<[number, number][]>(() => {
    if (initialData?.boundary_geojson) {
      try {
        const geo: any = initialData.boundary_geojson;
        const coords = geo.type === 'Feature' ? geo.geometry.coordinates[0] : geo.coordinates[0];
        if (Array.isArray(coords) && coords.length >= 3) {
          // GeoJSON is [lng, lat], leaflet is [lat, lng]
          const pts: [number, number][] = coords.slice(0, coords.length - 1).map((c: any) => [c[1], c[0]]);
          return pts;
        }
      } catch (e) {
        console.warn('Error parsing initial boundary GeoJSON:', e);
      }
    }
    return [];
  });

  const [isClosed, setIsClosed] = useState<boolean>(() => {
    return !!initialData?.boundary_geojson;
  });

  const [drawMode, setDrawMode] = useState<'polygon' | 'radius'>('polygon');
  const [radiusMeters, setRadiusMeters] = useState<number>(120);
  const [centerPin, setCenterPin] = useState<[number, number] | null>(() => {
    if (initialData?.latitude && initialData?.longitude) {
      return [initialData.latitude, initialData.longitude];
    }
    return null;
  });

  const [calculatedArea, setCalculatedArea] = useState<number>(initialData?.area_hectares || 0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(16);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  // 'idle' | 'no_results' | 'network_error'
  const [searchStatus, setSearchStatus] = useState<'idle' | 'no_results' | 'network_error'>('idle');

  // Debounce timer ref for autocomplete
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // AbortController ref to cancel stale in-flight requests
  const searchAbortRef = useRef<AbortController | null>(null);

  // GPS state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Helper to compute polygon center
  const getCenter = useCallback((pts: [number, number][]): [number, number] => {
    if (pts.length === 0) return [17.7265, 78.2916];
    const avgLat = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const avgLng = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    return [avgLat, avgLng];
  }, []);

  // Compute Turf.js geodesic area in hectares
  const computeArea = useCallback((pts: [number, number][]): number => {
    if (pts.length < 3) return 0;
    try {
      const ring = pts.map((p) => [p[1], p[0]]);
      ring.push([pts[0][1], pts[0][0]]);
      const poly = turf.polygon([ring]);
      const sqMeters = turf.area(poly);
      const hectares = Math.round((sqMeters / 10000) * 10000) / 10000;
      return hectares;
    } catch (err) {
      console.warn('Area calculation error:', err);
      return 0;
    }
  }, []);

  // Validate boundary geometry using Turf.js kinks and area threshold
  const validateBoundary = useCallback((pts: [number, number][]): { isValid: boolean; error: string | null } => {
    if (pts.length < 3) {
      return { isValid: false, error: 'Place at least 3 points around your field perimeter.' };
    }
    try {
      const ring = pts.map((p) => [p[1], p[0]]);
      ring.push([pts[0][1], pts[0][0]]);
      const poly = turf.polygon([ring]);

      // Check for self-intersecting polygon (figure-8 / crossed lines)
      const kinks = turf.kinks(poly);
      if (kinks && kinks.features && kinks.features.length > 0) {
        return {
          isValid: false,
          error: 'Boundary lines cross each other. Drag the white vertex markers to uncross lines.',
        };
      }

      const sqMeters = turf.area(poly);
      const hectares = sqMeters / 10000;
      if (hectares < 0.005) {
        return {
          isValid: false,
          error: 'Field area is too small (< 0.01 ha). Please outline your actual field perimeter.',
        };
      }

      return { isValid: true, error: null };
    } catch {
      return { isValid: false, error: 'Invalid field boundary geometry.' };
    }
  }, []);

  // Update parent with latest location data
  const emitUpdate = useCallback(
    (pts: [number, number][], closed: boolean) => {
      if (pts.length < 3 || !closed) {
        return;
      }
      const area = computeArea(pts);
      setCalculatedArea(area);

      const validation = validateBoundary(pts);
      setValidationError(validation.error);

      const ring = pts.map((p) => [p[1], p[0]]);
      ring.push([pts[0][1], pts[0][0]]);
      const center = getCenter(pts);

      onChange({
        latitude: Math.round(center[0] * 1000000) / 1000000,
        longitude: Math.round(center[1] * 1000000) / 1000000,
        area_hectares: area,
        boundary_geojson: {
          type: 'Polygon',
          coordinates: [ring],
        },
        isValidBoundary: validation.isValid,
        validationError: validation.error,
      });
    },
    [computeArea, validateBoundary, getCenter, onChange]
  );

  // Generate circle polygon from center and radius
  const applyRadiusCircle = useCallback(
    (center: [number, number], radius: number) => {
      try {
        const turfPoint = turf.point([center[1], center[0]]);
        const circle = turf.circle(turfPoint, radius, { units: 'meters', steps: 32 });
        const coords = circle.geometry.coordinates[0];
        const pts: [number, number][] = coords.slice(0, coords.length - 1).map((c) => [c[1], c[0]]);
        setPoints(pts);
        setIsClosed(true);
        emitUpdate(pts, true);
      } catch (e) {
        console.error('Failed to create radius circle:', e);
      }
    },
    [emitUpdate]
  );

  // ── Initialize Map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      setMapLoading(true);
      setMapError(null);
      const initialCenter: [number, number] =
        initialData?.latitude && initialData?.longitude
          ? [initialData.latitude, initialData.longitude]
          : points.length >= 3
          ? getCenter(points)
          : [17.7265, 78.2916]; // Default to Telangana Agricultural Zone

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 16,
        zoomControl: true,
        attributionControl: false,
      });

      // Explicit Layer Panes for strict visual ordering:
      // TilePane (200) < FarmBoundaryPane (620) < FarmMarkerPane (650)
      if (!map.getPane('farmBoundaryPane')) {
        const boundaryPane = map.createPane('farmBoundaryPane');
        boundaryPane.style.zIndex = '620';
        boundaryPane.style.pointerEvents = 'auto';
      }
      if (!map.getPane('farmMarkerPane')) {
        const markerPane = map.createPane('farmMarkerPane');
        markerPane.style.zIndex = '650';
        markerPane.style.pointerEvents = 'auto';
      }

      // ArcGIS World Imagery Satellite Tiles
      const satelliteTiles = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          subdomains: ['server', 'services'],
        }
      );

      satelliteTiles.on('load', () => setMapLoading(false));
      satelliteTiles.on('tileerror', () => {
        // Soft tile error handling — avoid blocking the whole canvas
        console.warn('Tile load issue for satellite layer');
      });
      satelliteTiles.addTo(map);

      // Markers & Overlay group inside farmMarkerPane
      const markersGroup = L.layerGroup([], { pane: 'farmMarkerPane' }).addTo(map);
      markersGroupRef.current = markersGroup;

      map.on('zoomend', () => {
        const z = map.getZoom();
        setCurrentZoom(z);
      });

      // Map click handler for drawing
      if (!readOnly) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          const lat = e.latlng.lat;
          const lng = e.latlng.lng;

          if (drawMode === 'radius') {
            setCenterPin([lat, lng]);
            applyRadiusCircle([lat, lng], radiusMeters);
            return;
          }

          // Polygon mode
          setPoints((prev) => {
            if (isClosed) {
              // Clicking when closed starts a fresh polygon from this new point
              setIsClosed(false);
              setValidationError(null);
              return [[lat, lng]];
            }
            const updated = [...prev, [lat, lng] as [number, number]];
            if (updated.length >= 3) {
              const area = computeArea(updated);
              setCalculatedArea(area);
            }
            return updated;
          });
        });
      }

      mapInstanceRef.current = map;
      setMapLoading(false);
    } catch (err: any) {
      console.error('Leaflet initialization error:', err);
      setMapError('Failed to initialize map service. Please check network connectivity.');
      setMapLoading(false);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Invalidate Leaflet map size on window resize and orientation change
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ animate: false });
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    screen.orientation?.addEventListener('change', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      screen.orientation?.removeEventListener('change', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Dynamic boundary styling
  const getFieldBoundaryStyle = useCallback(
    (zoom: number, hasError: boolean) => {
      let weight = 2.8;
      let opacity = 0.95;
      let fillOpacity = 0.25;

      if (zoom <= 10) {
        weight = 1.5;
        opacity = 0.85;
        fillOpacity = 0.35;
      } else if (zoom <= 13) {
        weight = 2.0;
        opacity = 0.9;
        fillOpacity = 0.3;
      } else if (zoom <= 16) {
        weight = 2.8;
        opacity = 0.95;
        fillOpacity = 0.25;
      } else if (zoom <= 18) {
        weight = 3.5;
        opacity = 1.0;
        fillOpacity = 0.2;
      } else {
        weight = 4.0;
        opacity = 1.0;
        fillOpacity = 0.18;
      }

      const color = hasError ? '#ef4444' : '#10b981';

      return {
        pane: 'farmBoundaryPane',
        smoothFactor: 0,
        color,
        weight,
        opacity,
        lineCap: 'round' as const,
        lineJoin: 'round' as const,
        fillColor: color,
        fillOpacity,
      };
    },
    []
  );

  // ── Render Points / Polygon / Interactive Draggable Handles ──────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }
    if (polylineLayerRef.current) {
      map.removeLayer(polylineLayerRef.current);
      polylineLayerRef.current = null;
    }
    if (lowZoomMarkerRef.current) {
      map.removeLayer(lowZoomMarkerRef.current);
      lowZoomMarkerRef.current = null;
    }

    if (points.length === 0) return;

    const center = getCenter(points);

    // Zoom-Aware Rendering (< 14: Badge pin)
    if (currentZoom < 14) {
      const areaText = calculatedArea > 0 ? `${calculatedArea.toFixed(2)} ha` : 'Farm Field';
      const lowZoomIcon = L.divIcon({
        html: `
          <div class="flex flex-col items-center select-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]" style="transform: translate(-50%, -100%);">
            <div class="px-2.5 py-1 rounded-lg bg-emerald-950/95 border border-emerald-400 text-emerald-300 font-extrabold text-[10px] shadow-[0_0_15px_rgba(16,185,129,0.35)] whitespace-nowrap flex items-center gap-1 backdrop-blur-md">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>${areaText}</span>
            </div>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" class="-mt-[1px]">
              <path d="M5 6L0 0H10L5 6Z" fill="#064e3b" stroke="#34d399" stroke-width="1.2" />
            </svg>
          </div>
        `,
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const badgeMarker = L.marker(center, { icon: lowZoomIcon, pane: 'farmMarkerPane' }).addTo(map);
      lowZoomMarkerRef.current = badgeMarker;
    }

    const hasError = !!validationError;
    const boundaryStyle = getFieldBoundaryStyle(currentZoom, hasError);

    // ── Render Closed Polygon with Draggable Handles ─────────────────────────
    if (points.length >= 3 && isClosed) {
      const poly = L.polygon(points, boundaryStyle).addTo(map);
      polygonLayerRef.current = poly;

      if (!readOnly) {
        points.forEach((pt, idx) => {
          // 28px touch container with center 14px dot for comfortable mobile touch
          const vertexIcon = L.divIcon({
            html: `
              <div class="w-7 h-7 flex items-center justify-center cursor-grab active:cursor-grabbing select-none" style="transform: translate(-50%, -50%);">
                <div class="w-3.5 h-3.5 rounded-full bg-white border-2 ${
                  hasError ? 'border-red-500 shadow-[0_0_8px_#ef4444]' : 'border-emerald-600 shadow-[0_0_8px_#10b981]'
                } transition-transform hover:scale-125"></div>
              </div>
            `,
            className: '',
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });

          const marker = L.marker(pt, {
            icon: vertexIcon,
            draggable: true,
            pane: 'farmMarkerPane',
          }).addTo(markersGroup);

          marker.on('drag', (e: L.LeafletEvent) => {
            const newLatLng = (e.target as L.Marker).getLatLng();
            setPoints((prev) => {
              const next = [...prev];
              next[idx] = [newLatLng.lat, newLatLng.lng];
              if (polygonLayerRef.current) {
                polygonLayerRef.current.setLatLngs(next);
              }
              return next;
            });
          });

          marker.on('dragend', () => {
            setPoints((latest) => {
              emitUpdate(latest, true);
              return latest;
            });
          });
        });
      }
    } else if (points.length >= 2) {
      // ── Render In-Progress Polyline with Draggable Handles & Tap-to-Finish ─
      const polyline = L.polyline(points, {
        pane: 'farmBoundaryPane',
        smoothFactor: 0,
        color: '#34d399',
        weight: boundaryStyle.weight,
        dashArray: '6, 6',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(markersGroup);
      polylineLayerRef.current = polyline;

      points.forEach((pt, idx) => {
        const isFirst = idx === 0;
        const canSeal = isFirst && points.length >= 3;

        const vertexIcon = L.divIcon({
          html: `
            <div class="w-7 h-7 flex items-center justify-center ${
              canSeal ? 'cursor-pointer animate-pulse' : 'cursor-grab'
            } select-none" style="transform: translate(-50%, -50%);">
              <div style="
                width: ${isFirst ? 16 : 11}px;
                height: ${isFirst ? 16 : 11}px;
                background: ${isFirst ? '#10b981' : '#ffffff'};
                border: 2px solid ${isFirst ? '#ffffff' : '#059669'};
                border-radius: 50%;
                box-shadow: ${isFirst ? '0 0 12px rgba(16,185,129,0.9)' : '0 0 6px rgba(0,0,0,0.5)'};
              "></div>
            </div>
          `,
          className: '',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker(pt, {
          icon: vertexIcon,
          draggable: !readOnly,
          pane: 'farmMarkerPane',
        }).addTo(markersGroup);

        // Tap the first point to finish/close boundary
        if (canSeal && !readOnly) {
          marker.on('click', (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e);
            handleCloseBoundary();
          });
          marker.bindTooltip('Tap to close field boundary', { direction: 'top', offset: [0, -10] });
        }

        if (!readOnly) {
          marker.on('drag', (e: L.LeafletEvent) => {
            const newLatLng = (e.target as L.Marker).getLatLng();
            setPoints((prev) => {
              const next = [...prev];
              next[idx] = [newLatLng.lat, newLatLng.lng];
              if (polylineLayerRef.current) {
                polylineLayerRef.current.setLatLngs(next);
              }
              return next;
            });
          });

          marker.on('dragend', () => {
            setPoints((latest) => {
              if (latest.length >= 3) {
                setCalculatedArea(computeArea(latest));
              }
              return latest;
            });
          });
        }
      });
    } else if (points.length === 1) {
      // Single starting point
      const startIcon = L.divIcon({
        html: `
          <div class="w-7 h-7 flex items-center justify-center select-none" style="transform: translate(-50%, -50%);">
            <div style="width: 16px; height: 16px; background: #10b981; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 14px rgba(16,185,129,0.9); animation: pulse 1.5s infinite;"></div>
          </div>
        `,
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(points[0], { icon: startIcon, pane: 'farmMarkerPane' }).addTo(markersGroup);
    }
  }, [points, isClosed, currentZoom, calculatedArea, validationError, getCenter, readOnly, emitUpdate, computeArea]);

  // Handle closing boundary
  const handleCloseBoundary = () => {
    if (points.length < 3) return;
    setIsClosed(true);
    emitUpdate(points, true);

    if (mapInstanceRef.current) {
      const bounds = L.latLngBounds(points);
      mapInstanceRef.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 18 });
    }
  };

  // Handle Undo Last Point
  const handleUndoPoint = () => {
    if (points.length === 0) return;
    const nextPoints = points.slice(0, -1);
    setPoints(nextPoints);
    setIsClosed(false);
    setValidationError(null);
    if (nextPoints.length >= 3) {
      setCalculatedArea(computeArea(nextPoints));
    } else {
      setCalculatedArea(0);
    }
  };

  // Handle Clear & Redraw
  const handleClearAll = () => {
    setPoints([]);
    setIsClosed(false);
    setCenterPin(null);
    setCalculatedArea(0);
    setValidationError(null);
  };

  // Handle Device GPS Geolocation with error resilience
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device or browser.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const { latitude, longitude, accuracy } = pos.coords;
        const map = mapInstanceRef.current;
        if (map) {
          map.flyTo([latitude, longitude], 17, { duration: 1.5 });

          const locIcon = L.divIcon({
            html: `
              <div style="width: 24px; height: 24px; background: rgba(59, 130, 246, 0.35); border: 2px solid #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">
                <div style="width: 10px; height: 10px; background: #3b82f6; border: 2px solid #ffffff; border-radius: 50%;"></div>
              </div>
            `,
            className: '',
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          const locMarker = L.marker([latitude, longitude], { icon: locIcon }).addTo(map);
          locMarker.bindPopup(`<b>Your Location</b><br>Accuracy: ~${Math.round(accuracy)}m`).openPopup();
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('GPS permission was denied. You can search your village or district using the search bar above.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError('GPS position unavailable. Please search for your village name or pan the map manually.');
        } else {
          setGpsError('GPS signal timed out. Please tap "Try Again" or search by place name.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  };

  // ── Real Location Search via OpenStreetMap Nominatim ────────────────────────
  // Uses debounced autocomplete (300ms) with AbortController to prevent stale
  // results overwriting a newer search response.
  const executeSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchStatus('idle');
      return;
    }

    // Cancel any in-flight request before starting a new one
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);
    setShowSearchResults(true);
    setSearchStatus('idle');

    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?format=json` +
        `&q=${encodeURIComponent(query.trim())}` +
        `&limit=6` +
        `&countrycodes=in` +
        `&addressdetails=1`;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'AgriGuard-GIS/1.0 (farm boundary tool)' },
      });

      if (!res.ok) {
        throw new Error(`Nominatim HTTP ${res.status}`);
      }

      const data: SearchResult[] = await res.json();
      setSearchResults(data || []);
      setSearchStatus(data && data.length > 0 ? 'idle' : 'no_results');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Request was intentionally cancelled — not an error
        return;
      }
      console.warn('Place search error:', err);
      setSearchResults([]);
      setSearchStatus('network_error');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Form submit — run immediately (user pressed Enter or Search button)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Clear any pending debounce and fire immediately
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    executeSearch(searchQuery);
  };

  // Retry after network error
  const handleSearchRetry = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    executeSearch(searchQuery);
  };

  // Input change — debounced autocomplete (300ms)
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (!val.trim()) {
      // Clear immediately when input is emptied
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (searchAbortRef.current) searchAbortRef.current.abort();
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchStatus('idle');
      return;
    }

    // Debounce: wait 300ms of typing idle before firing request
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      executeSearch(val);
    }, 300);
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    if (!isNaN(lat) && !isNaN(lon) && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lon], 16, { duration: 1.5 });
      // Collapse dropdown and set input to the first segment of the place name
      setShowSearchResults(false);
      setSearchStatus('idle');
      setSearchQuery(result.display_name.split(',')[0]);
      // Cancel any pending debounced call to avoid re-opening the dropdown
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 text-left select-none">
      {/* Search Bar & GPS Controls */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Place / Address */}
          <div className="relative flex-1">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/80 pointer-events-none" />
              <input
                id="farm-location-search"
                type="text"
                value={searchQuery}
                onChange={handleSearchInputChange}
                onFocus={() => {
                  if (searchResults.length > 0 || searchStatus !== 'idle') setShowSearchResults(true);
                }}
                placeholder={t('library.searchPlaceholder', undefined, 'Search village, mandal, district, or address...')}
                className="glass-input pl-10 pr-20 text-xs font-medium py-2 w-full"
                autoComplete="off"
                aria-label="Location search"
                aria-autocomplete="list"
                aria-expanded={showSearchResults}
              />
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-black text-[11px] transition cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
              >
                {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : t('common.search', undefined, 'Search')}
              </button>
            </form>

            {/* Search Results Dropdown — real suggestions, no-results, or network error */}
            {showSearchResults && (
              <div
                role="listbox"
                className="absolute top-full left-0 right-0 mt-1 z-[1000] rounded-xl bg-emerald-950/97 border border-emerald-400/40 shadow-2xl backdrop-blur-xl overflow-hidden"
              >
                {/* Loading state */}
                {isSearching && (
                  <div className="px-3 py-3 flex items-center gap-2 text-xs text-emerald-300/60">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Searching locations...</span>
                  </div>
                )}

                {/* Real suggestions */}
                {!isSearching && searchResults.length > 0 && (
                  <div className="max-h-52 overflow-y-auto divide-y divide-emerald-500/20">
                    {searchResults.map((res) => (
                      <button
                        key={res.place_id}
                        type="button"
                        role="option"
                        onClick={() => handleSelectSearchResult(res)}
                        className="w-full px-3 py-2.5 text-left text-xs text-emerald-100 hover:bg-emerald-900/60 active:bg-emerald-900/80 transition flex items-start gap-2"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-relaxed">{res.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* No results state */}
                {!isSearching && searchStatus === 'no_results' && (
                  <div className="px-3 py-3 flex items-center gap-2 text-xs text-emerald-300/50">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400/40 shrink-0" />
                    <span>No matching location found. Try another city, village, or place name.</span>
                  </div>
                )}

                {/* Network error state */}
                {!isSearching && searchStatus === 'network_error' && (
                  <div className="px-3 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-amber-300/80">
                      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Unable to search locations right now. Please check your connection and try again.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSearchRetry}
                      className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 text-[10px] font-bold hover:bg-amber-500/40 shrink-0 cursor-pointer transition"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* GPS Location Button */}
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={gpsLoading}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/60 border border-emerald-400/40 text-emerald-300 hover:text-white text-xs font-bold transition cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Locate using device GPS"
          >
            {gpsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <Crosshair className="w-4 h-4 text-emerald-400" />
            )}
            <span>{t('satellite.farmBoundary', undefined, 'My Location (GPS)')}</span>
          </button>
        </div>
      )}

      {/* GPS Error Alert */}
      {gpsError && (
        <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">{gpsError}</span>
          </div>
          <button
            type="button"
            onClick={handleGetLocation}
            className="px-2 py-0.5 rounded bg-amber-500/30 text-amber-100 text-[10px] font-bold hover:bg-amber-500/50 shrink-0 cursor-pointer"
          >
            {t('common.retry', undefined, 'Try Again')}
          </button>
        </div>
      )}

      {/* Boundary Self-Intersection or Area Warning Banner */}
      {validationError && (
        <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="font-semibold">{validationError}</span>
        </div>
      )}

      {/* Drawing Toolbar Controls */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/25">
          {/* Mode Selector */}
          <div className="flex items-center gap-1 bg-emerald-900/40 p-1 rounded-lg border border-emerald-500/30">
            <button
              type="button"
              onClick={() => {
                setDrawMode('polygon');
                handleClearAll();
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                drawMode === 'polygon'
                  ? 'bg-emerald-500 text-emerald-950 shadow-sm'
                  : 'text-emerald-300 hover:text-white'
              }`}
            >
              {t('satellite.farmBoundary', undefined, 'Polygon Boundary')}
            </button>
            <button
              type="button"
              onClick={() => {
                setDrawMode('radius');
                handleClearAll();
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                drawMode === 'radius'
                  ? 'bg-emerald-500 text-emerald-950 shadow-sm'
                  : 'text-emerald-300 hover:text-white'
              }`}
            >
              Pin + Radius
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {drawMode === 'polygon' ? (
              <>
                <button
                  type="button"
                  onClick={handleCloseBoundary}
                  disabled={points.length < 3 || isClosed}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-emerald-950 font-black text-[11px] transition shadow cursor-pointer disabled:cursor-not-allowed"
                  title="Close and complete boundary polygon"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('common.save', undefined, 'Close Field')} ({points.length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleUndoPoint}
                  disabled={points.length === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  title="Undo last placed point"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>{t('common.back', undefined, 'Undo')}</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-200">
                <span className="text-[11px] font-bold text-emerald-300">Radius:</span>
                <input
                  type="range"
                  min={50}
                  max={500}
                  step={10}
                  value={radiusMeters}
                  onChange={(e) => {
                    const r = parseInt(e.target.value, 10);
                    setRadiusMeters(r);
                    if (centerPin) applyRadiusCircle(centerPin, r);
                  }}
                  className="w-24 accent-emerald-400 cursor-pointer"
                />
                <span className="font-extrabold text-[11px] text-emerald-300">{radiusMeters}m</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleClearAll}
              disabled={points.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-[11px] font-semibold transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title="Clear all points and redraw"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('common.delete', undefined, 'Clear')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Map Display Container */}
      <div
        className="farm-field-map-wrapper"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Live Area Pill Overlay — Top Left of Map */}
        <div className="absolute top-3 left-3 z-[400] pointer-events-none">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/90 border border-emerald-400/50 shadow-xl backdrop-blur-md flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                validationError ? 'bg-red-400 shadow-[0_0_8px_#ef4444]' : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
              }`}
            ></span>
            <span className="text-xs font-bold text-white">
              {calculatedArea > 0 ? (
                <>
                  Field Area: <span className="font-black text-emerald-400">{calculatedArea.toFixed(2)} ha</span>
                </>
              ) : (
                <span className="text-emerald-300/80">
                  {drawMode === 'polygon'
                    ? points.length === 0
                      ? 'Tap map to start drawing boundary'
                      : points.length < 3
                      ? `Tap to place points (${points.length}/3+ pts)`
                      : 'Tap first point or click "Close Field"'
                    : 'Tap map to place farm center pin'}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Floating Hint Overlay — Top Right of Map */}
        {!readOnly && points.length > 0 && !isClosed && (
          <div className="absolute top-3 right-3 z-[400] pointer-events-none hidden sm:block">
            <div className="px-2.5 py-1 rounded-lg bg-black/70 border border-white/15 text-[11px] font-medium text-emerald-300 backdrop-blur-md">
              {points.length >= 3 ? 'Tap green point to seal' : 'Add at least 3 points'}
            </div>
          </div>
        )}

        {/* Satellite Imagery Tag — Bottom Right */}
        <div className="absolute bottom-2 right-2 z-[400] pointer-events-none">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/60 text-emerald-300/80 border border-white/10 backdrop-blur-sm">
            ArcGIS World Imagery
          </span>
        </div>

        {/* Loading Overlay */}
        {mapLoading && (
          <div className="absolute inset-0 z-[500] bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <span className="text-xs font-bold text-emerald-200">Loading satellite GIS map...</span>
          </div>
        )}

        {/* Error Overlay */}
        {mapError && (
          <div className="absolute inset-0 z-[500] bg-emerald-950/90 flex flex-col items-center justify-center p-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-xs text-red-200 mb-3">{mapError}</p>
            <button
              type="button"
              onClick={() => {
                setMapError(null);
                setMapLoading(true);
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.invalidateSize();
                }
              }}
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Map</span>
            </button>
          </div>
        )}
      </div>

      {/* Helpful Instructions */}
      {!readOnly && (
        <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-[11px] text-emerald-300/80 leading-relaxed flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-200">
              {drawMode === 'polygon'
                ? 'Tap points around your field perimeter. Tap the first point (or "Close Field") to seal. Drag any vertex point to fine-tune boundaries.'
                : 'Tap to place the farm center pin, then adjust the radius slider to match your field.'}
            </p>
            <p className="text-emerald-400/60 mt-0.5 text-[10px]">
              Tip: Points are fully draggable on touchscreens and desktops. To adjust a corner, simply grab and drag the white marker circle.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

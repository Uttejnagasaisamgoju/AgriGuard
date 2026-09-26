import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Search, MapPin, ChevronRight, X, Sprout, Building2 } from 'lucide-react';
import { farmsApi } from '../services/api';
import { Farm } from '../types';
import { useAuth } from '../context/AuthContext';

interface FarmsManagementViewProps {
  onBack?: () => void;
  onSelectFarm?: (farm: Farm) => void;
}

export const FarmsManagementView: React.FC<FarmsManagementViewProps> = ({ onBack, onSelectFarm }) => {
  const { user } = useAuth();
  const role = (user?.role || '').toUpperCase();
  const canAddFarm = role === 'FARMER' || role === 'ADMIN';

  const [farms, setFarms] = useState<Farm[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New farm form
  const [name, setName] = useState('');
  const [cropType, setCropType] = useState('Rice');
  const [areaHectares, setAreaHectares] = useState('2.5');
  const [village, setVillage] = useState('Narsapur');
  const [district, setDistrict] = useState('Medak');

  useEffect(() => {
    loadFarms();
  }, []);

  const loadFarms = async () => {
    try {
      const data = await farmsApi.getFarms();
      setFarms(data.farms || []);
    } catch {
      // Fallback
    }
  };

  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAddError(null);
    setIsSubmitting(true);
    try {
      const newFarm = {
        name: name.trim(),
        crop_type: cropType,
        area_hectares: parseFloat(areaHectares) || 2.0,
        village,
        district,
        state: 'Telangana',
        latitude: 17.7265,
        longitude: 78.2916,
      };
      await farmsApi.createFarm(newFarm);
      await loadFarms();
      setIsAddModalOpen(false);
      setName('');
    } catch (err: any) {
      console.error('Failed to create farm:', err);
      const detail = err?.response?.data?.detail || err?.message || 'Failed to create farm. Please try again.';
      setAddError(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCropThumb = (crop?: string) => {
    switch ((crop || '').toLowerCase()) {
      case 'rice':
        return 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=200&auto=format&fit=crop&q=80';
      case 'tomato':
        return 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=200&auto=format&fit=crop&q=80';
      case 'maize':
        return 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=200&auto=format&fit=crop&q=80';
      default:
        return 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=200&auto=format&fit=crop&q=80';
    }
  };

  const filteredFarms = farms.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.crop_type || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 -mt-2 py-3 bg-[#031c15]/95 backdrop-blur-xl border-b border-emerald-500/20 -mx-3 sm:-mx-6 px-3 sm:px-6 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="page-title font-bold text-white font-heading">
              Registered Farm Parcels
            </h1>
            <p className="caption-text text-emerald-300/75">
              GPS boundaries, satellite NDVI health tracking & crop inventories
            </p>
          </div>
        </div>

        {canAddFarm && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary py-2 px-4 text-xs font-bold shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span className="hidden sm:inline">Add New Farm</span>
          </button>
        )}
      </div>

      {/* Search and Filter */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search farms by name, crop, or district..."
          className="w-full py-2.5 pl-10 pr-4 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-xs text-white placeholder-emerald-400/50 outline-none focus:border-emerald-400 transition shadow-lg"
        />
        <Search className="w-4 h-4 text-emerald-400/70 absolute left-3.5 top-3" />
      </div>

      {/* Farms List: Responsive 2-column grid on desktop, 1-column on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFarms.map((farm, idx) => (
          <div
            key={farm.id}
            onClick={() => onSelectFarm?.(farm)}
            className="glass-panel p-4 flex items-center justify-between cursor-pointer hover:border-emerald-400/60 hover:-translate-y-0.5 transition duration-200 group"
          >
            <div className="flex items-center gap-3.5">
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-emerald-500/30 flex-shrink-0">
                <img
                  src={getCropThumb(farm.crop_type)}
                  alt={farm.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div>
                <h3 className="card-title font-bold text-white group-hover:text-emerald-300 transition">
                  {farm.name}
                </h3>
                <p className="caption-text text-emerald-300/80 mt-0.5">
                  {farm.area_hectares} hectares • {farm.crop_type}
                </p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-400/70 mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>
                    {farm.village}, {farm.district}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <span
                className={`font-bold ${
                  idx === 1 ? 'badge-risk-medium' : 'badge-risk-low'
                }`}
              >
                {idx === 1 ? 'Moderate' : 'Healthy'}
              </span>
              <div className="p-1.5 rounded-full bg-emerald-900/40 text-emerald-400 group-hover:translate-x-1 transition-transform">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Farm Modal (Farmer / Admin only) */}
      {canAddFarm && isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md p-6 border-emerald-500/40 shadow-2xl relative space-y-4">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-emerald-950/80 text-emerald-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white font-heading">
                Register New Farm Parcel
              </h2>
            </div>

            <form onSubmit={handleAddFarm} className="space-y-3 pt-2">
              {addError && (
                <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-200">
                  {addError}
                </div>
              )}
              <div>
                <label className="caption-text text-emerald-300/80 block mb-1 font-semibold">
                  Farm Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. North Field Paddy"
                  className="input-glass"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="caption-text text-emerald-300/80 block mb-1 font-semibold">
                    Crop Type
                  </label>
                  <select
                    value={cropType}
                    onChange={(e) => setCropType(e.target.value)}
                    className="input-glass bg-[#06261e]"
                  >
                    <option value="Rice">Rice (Paddy)</option>
                    <option value="Wheat">Wheat</option>
                    <option value="Maize">Maize (Corn)</option>
                    <option value="Tomato">Tomato</option>
                    <option value="Cotton">Cotton</option>
                  </select>
                </div>

                <div>
                  <label className="caption-text text-emerald-300/80 block mb-1 font-semibold">
                    Area (Hectares)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={areaHectares}
                    onChange={(e) => setAreaHectares(e.target.value)}
                    className="input-glass"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="caption-text text-emerald-300/80 block mb-1 font-semibold">
                    Village
                  </label>
                  <input
                    type="text"
                    required
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="input-glass"
                  />
                </div>

                <div>
                  <label className="caption-text text-emerald-300/80 block mb-1 font-semibold">
                    District
                  </label>
                  <input
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="input-glass"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-secondary py-2 px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary py-2 px-5 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : 'Save Farm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

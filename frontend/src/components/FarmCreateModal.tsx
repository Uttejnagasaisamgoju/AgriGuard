import React, { useState, useEffect } from 'react';
import { X, Sprout, Check, AlertCircle, Loader2, MapPin, Layers, Droplets } from 'lucide-react';
import { Farm } from '../types';
import { farmsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { FarmFieldMap, FarmLocationData } from './FarmFieldMap';

interface FarmCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedFarm: Farm) => void;
  farmToEdit?: Farm | null;
}

const CROP_OPTIONS = [
  'Rice',
  'Wheat',
  'Maize',
  'Tomato',
  'Potato',
  'Cotton',
  'Cucumber',
  'Soybean',
  'Sugarcane',
  'Chilli',
  'Other',
];

const SOIL_OPTIONS = [
  { value: 'alluvial', label: 'Alluvial' },
  { value: 'black', label: 'Black (Regur)' },
  { value: 'red', label: 'Red' },
  { value: 'laterite', label: 'Laterite' },
  { value: 'clayey', label: 'Clayey' },
  { value: 'sandy', label: 'Sandy' },
  { value: 'loamy', label: 'Loamy' },
  { value: 'other', label: 'Other' },
];

const IRRIGATION_OPTIONS = [
  { value: 'drip', label: 'Drip' },
  { value: 'sprinkler', label: 'Sprinkler' },
  { value: 'flood', label: 'Flood / Basin' },
  { value: 'furrow', label: 'Furrow' },
  { value: 'rain_fed', label: 'Rain-fed' },
  { value: 'other', label: 'Other' },
];

export const FarmCreateModal: React.FC<FarmCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  farmToEdit,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const role = (user?.role || '').toUpperCase();
  const canAddFarm = role === 'FARMER' || role === 'ADMIN';

  const isEditing = !!farmToEdit;

  // Block modal from opening if an Officer or Expert attempts to create a farm
  if (!isOpen || (!isEditing && !canAddFarm)) return null;

  const [name, setName] = useState('');
  const [cropType, setCropType] = useState('Rice');
  const [cropVariety, setCropVariety] = useState('');
  const [sowingDate, setSowingDate] = useState('');
  const [district, setDistrict] = useState('');
  const [soilType, setSoilType] = useState('loamy');
  const [irrigationType, setIrrigationType] = useState('drip');
  const [locationData, setLocationData] = useState<FarmLocationData | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  // Initialize or reset form on open / farmToEdit change
  useEffect(() => {
    if (!isOpen) return;

    if (farmToEdit) {
      setName(farmToEdit.name || '');
      setCropType(farmToEdit.crop_type || 'Rice');
      setCropVariety(farmToEdit.crop_variety || '');
      setSowingDate(farmToEdit.sowing_date || farmToEdit.planting_date || farmToEdit.sowingDate || '');
      setDistrict(farmToEdit.district || '');
      setSoilType(farmToEdit.soil_type || 'loamy');
      setIrrigationType(farmToEdit.irrigation_type || 'drip');

      if (farmToEdit.latitude && farmToEdit.longitude) {
        setLocationData({
          latitude: farmToEdit.latitude,
          longitude: farmToEdit.longitude,
          area_hectares: farmToEdit.area_hectares || 0,
          boundary_geojson: farmToEdit.boundary_geojson as any,
        });
      } else {
        setLocationData(null);
      }
    } else {
      setName('');
      setCropType('Rice');
      setCropVariety('');
      setSowingDate('');
      setDistrict('');
      setSoilType('loamy');
      setIrrigationType('drip');
      setLocationData(null);
    }
    setError(null);
    setValidationMsg(null);
  }, [isOpen, farmToEdit]);

  if (!isOpen) return null;

  const handleMapChange = (data: FarmLocationData) => {
    setLocationData(data);
    setValidationMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationMsg(null);

    if (!isEditing && !canAddFarm) {
      setError('Unauthorized: Officer and Expert roles are not permitted to register farms.');
      return;
    }

    if (!name.trim()) {
      setValidationMsg('Please enter a name for your farm.');
      return;
    }

    if (!locationData || !locationData.boundary_geojson || locationData.area_hectares <= 0) {
      setValidationMsg('Please draw and close your field boundary on the map before saving.');
      return;
    }

    if (locationData.isValidBoundary === false) {
      setValidationMsg(
        locationData.validationError ||
          'Boundary lines cross each other or area is invalid. Please drag the white vertex markers to adjust before saving.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const payload: Partial<Farm> = {
        name: name.trim(),
        crop_type: cropType,
        crop_variety: cropVariety.trim() || undefined,
        sowing_date: sowingDate || undefined,
        sowingDate: sowingDate || undefined,
        planting_date: sowingDate || undefined,
        district: district.trim() || undefined,
        soil_type: soilType,
        irrigation_type: irrigationType,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        area_hectares: locationData.area_hectares,
        boundary_geojson: locationData.boundary_geojson,
      };

      let resultFarm: Farm;
      if (isEditing && farmToEdit) {
        const res = await farmsApi.updateFarm(farmToEdit.id, payload);
        resultFarm = res.farm || { ...farmToEdit, ...payload };
      } else {
        const res = await farmsApi.createFarm(payload);
        resultFarm = res.farm;
      }

      // Dispatch global event for instant cross-screen synchronization
      window.dispatchEvent(
        new CustomEvent('farm-data-changed', {
          detail: { action: isEditing ? 'update' : 'create', farm: resultFarm },
        })
      );

      onSuccess(resultFarm);
      onClose();
    } catch (err: any) {
      console.error('Failed to save farm:', err);
      const detail =
        err?.response?.data?.detail ||
        'Failed to save farm to the server. Please check your connection and try again.';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl glass-panel border border-emerald-400/40 shadow-[0_20px_70px_rgba(0,0,0,0.8)] overflow-hidden text-left">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-500/20 bg-emerald-950/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white font-heading">
                {isEditing ? t('farm.editFarm', undefined, 'Edit Farm Field') : t('farm.addFarm', undefined, 'Define & Add New Farm')}
              </h2>
              <p className="text-[11px] text-emerald-300/70">
                {isEditing
                  ? t('farm.location', undefined, 'Update boundary geometry or farm crop details')
                  : t('farm.location', undefined, 'Draw your field boundary and set crop specifics')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-400/70 hover:text-white hover:bg-emerald-900/40 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Validation or Error Alert */}
          {(validationMsg || error) && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p>{validationMsg || error}</p>
              </div>
            </div>
          )}

          {/* Section 1: Map Boundary Drawing */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Field Location &amp; Boundary</span>
              </label>
              <span className="text-[11px] text-emerald-400/80 font-semibold">
                {locationData && locationData.area_hectares > 0
                  ? `Calculated: ${locationData.area_hectares.toFixed(2)} ha`
                  : 'Draw on map'}
              </span>
            </div>

            <FarmFieldMap
              initialData={locationData || undefined}
              onChange={handleMapChange}
              height="clamp(220px, 45dvh, 380px)"
            />
          </div>

          {/* Section 2: Farm Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-emerald-500/20">
            {/* Farm Name */}
            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                {t('farm.farmName', undefined, 'Farm Name')} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Green Valley Farm"
                className="glass-input text-xs font-medium"
                required
              />
            </div>

            {/* Crop Type */}
            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                Primary Crop <span className="text-red-400">*</span>
              </label>
              <select
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                className="glass-input text-xs font-medium cursor-pointer"
              >
                {CROP_OPTIONS.map((crop) => (
                  <option key={crop} value={crop} className="bg-emerald-950 text-white">
                    {crop}
                  </option>
                ))}
              </select>
            </div>

            {/* Crop Variety */}
            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                Crop Variety (Optional)
              </label>
              <input
                type="text"
                value={cropVariety}
                onChange={(e) => setCropVariety(e.target.value)}
                placeholder="e.g. Basmati 370, Pusa 1121"
                className="glass-input text-xs font-medium"
              />
            </div>

            {/* Crop Sowing Date */}
            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1 flex items-center justify-between">
                <span>Crop Sowing Date</span>
                <span className="text-[10px] text-emerald-400/70 font-normal">Optional</span>
              </label>
              <input
                type="date"
                value={sowingDate}
                onChange={(e) => setSowingDate(e.target.value)}
                className="glass-input text-xs font-medium cursor-pointer"
                title="Crop Sowing Date"
              />
            </div>

            {/* Auto-Calculated Area (Read-Only) */}
            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                Auto-Calculated Area (Turf.js)
              </label>
              <div className="glass-input text-xs font-bold flex items-center justify-between bg-emerald-950/70 border-emerald-500/40 text-emerald-300">
                <span>{locationData?.area_hectares ? `${locationData.area_hectares.toFixed(2)} Hectares` : '0.00 ha'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live GIS
                </span>
              </div>
            </div>

            {/* District / Region */}
            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                District / Region
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Nizamabad, Telangana"
                className="glass-input text-xs font-medium"
              />
            </div>

            {/* Soil Type */}
            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                Soil Type
              </label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
                className="glass-input text-xs font-medium cursor-pointer"
              >
                {SOIL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-emerald-950 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Irrigation Type */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                Irrigation System
              </label>
              <select
                value={irrigationType}
                onChange={(e) => setIrrigationType(e.target.value)}
                className="glass-input text-xs font-medium cursor-pointer"
              >
                {IRRIGATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-emerald-950 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-emerald-500/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-emerald-300 hover:text-white hover:bg-emerald-900/30 transition cursor-pointer"
            >
              {t('common.cancel', undefined, 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary px-6 py-2.5 text-xs font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.35)] cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-950" />
                  <span>{t('common.loading', undefined, 'Saving...')}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-emerald-950" />
                  <span>{isEditing ? t('common.save', undefined, 'Save Changes') : t('farm.addFarm', undefined, 'Create Farm Field')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Farm } from '../types';
import { farmsApi } from '../services/api';
import { useAuth } from './AuthContext';

interface FarmContextType {
  farms: Farm[];
  selectedFarm: Farm | null;
  selectedFarmId: string | null;
  loadingFarms: boolean;
  farmsError: string | null;
  selectFarm: (farmOrId: Farm | string | null) => void;
  refreshFarms: () => Promise<void>;
  // Global modal state for farm creation / editing
  isModalOpen: boolean;
  farmToEdit: Farm | null;
  openAddFarmModal: () => void;
  openEditFarmModal: (farm: Farm) => void;
  closeModal: () => void;
  handleFarmSaved: (savedFarm: Farm) => void;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

const STORAGE_KEY = 'agriguard_selected_farm_id';

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });
  const [loadingFarms, setLoadingFarms] = useState<boolean>(true);
  const [farmsError, setFarmsError] = useState<string | null>(null);

  // Global modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [farmToEdit, setFarmToEdit] = useState<Farm | null>(null);

  const farmsRef = useRef<Farm[]>(farms);
  farmsRef.current = farms;

  const loadFarms = useCallback(async () => {
    if (!isAuthenticated) {
      setFarms([]);
      setSelectedFarmId(null);
      setLoadingFarms(false);
      return;
    }
    setLoadingFarms(true);
    setFarmsError(null);
    try {
      const res = await farmsApi.getFarms();
      const list = res.farms || [];
      setFarms(list);

      // Verify or auto-select active farm
      setSelectedFarmId((prev) => {
        if (prev && list.some((f) => f.id === prev)) {
          return prev;
        }
        if (list.length > 0) {
          const firstId = list[0].id;
          localStorage.setItem(STORAGE_KEY, firstId);
          return firstId;
        }
        localStorage.removeItem(STORAGE_KEY);
        return null;
      });
    } catch (err: any) {
      console.error('Failed to load farms from API:', err);
      setFarmsError(err?.response?.data?.detail || 'Failed to load farms.');
    } finally {
      setLoadingFarms(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  const selectFarm = useCallback((farmOrId: Farm | string | null) => {
    if (!farmOrId) {
      setSelectedFarmId(null);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const id = typeof farmOrId === 'string' ? farmOrId : farmOrId.id;
    const exists = farmsRef.current.some((f) => f.id === id);
    if (exists || farmsRef.current.length === 0) {
      setSelectedFarmId(id);
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const openAddFarmModal = useCallback(() => {
    const userRole = (user?.role || '').toUpperCase();
    if (userRole === 'OFFICER' || userRole === 'EXPERT') {
      console.warn(`[FarmContext] Add Farm action blocked for role: ${userRole}`);
      return;
    }
    setFarmToEdit(null);
    setIsModalOpen(true);
  }, [user?.role]);

  const openEditFarmModal = useCallback((farm: Farm) => {
    setFarmToEdit(farm);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setFarmToEdit(null);
  }, []);

  const handleFarmSaved = useCallback((savedFarm: Farm) => {
    selectFarm(savedFarm);
    loadFarms();
  }, [selectFarm, loadFarms]);

  const selectedFarm = farms.find((f) => f.id === selectedFarmId) || (farms.length > 0 ? farms[0] : null);

  return (
    <FarmContext.Provider
      value={{
        farms,
        selectedFarm,
        selectedFarmId: selectedFarm?.id || null,
        loadingFarms,
        farmsError,
        selectFarm,
        refreshFarms: loadFarms,
        isModalOpen,
        farmToEdit,
        openAddFarmModal,
        openEditFarmModal,
        closeModal,
        handleFarmSaved,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export const useFarm = (): FarmContextType => {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error('useFarm must be used within a FarmProvider');
  }
  return context;
};

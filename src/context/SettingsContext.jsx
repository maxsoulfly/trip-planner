import { createContext, useContext, useEffect, useState } from 'react';
import { getAllPlaceTypes, getAllVenueTraits } from '../db/repo.js';

// Provides the editable place-type / venue-trait vocabulary (db.js v5) to the
// whole app, so TypesTraitsModal edits show up everywhere without a reload.

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [placeTypes,  setPlaceTypes]  = useState([]);
  const [venueTraits, setVenueTraits] = useState([]);
  const [loaded, setLoaded] = useState(false);

  async function reload() {
    const [types, traits] = await Promise.all([
      getAllPlaceTypes(),
      getAllVenueTraits(),
    ]);
    setPlaceTypes(types);
    setVenueTraits(traits);
    setLoaded(true);
  }

  useEffect(() => { reload(); }, []);

  return (
    <SettingsContext.Provider value={{ placeTypes, venueTraits, loaded, reload }}>
      {loaded ? children : null}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

// Shared lookup used everywhere a place's type emoji/label is displayed —
// replaces the old static typeMeta() from constants.js. Falls back to the
// "other" type, then to a bare pin, so a missing/deleted key never crashes render.
export function typeMetaFrom(placeTypes, key) {
  return placeTypes.find(t => t.key === key)
    || placeTypes.find(t => t.key === 'other')
    || { key: 'other', label: 'Other', emoji: '📍' };
}

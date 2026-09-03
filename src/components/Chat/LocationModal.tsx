import React, { useState } from 'react';
import { X, MapPin, Navigation, Compass, Check } from 'lucide-react';
import type { MessageLocation } from '../../types';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (location: MessageLocation) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');

  if (!isOpen) return null;

  const presets = [
    { name: 'Home Sweet Home', address: 'Family Home Base' },
    { name: 'School Pickup Area', address: 'Main School Gate / Parent Line' },
    { name: 'Grocery Store', address: 'Supermarket / Running Errands' },
    { name: 'Sports Field', address: 'Soccer / Basketball Practice' },
    { name: 'On My Way Home', address: 'In transit / Commuting' }
  ];

  const handleSelectPreset = (p: { name: string; address: string }) => {
    setName(p.name);
    setAddress(p.address);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocateError('Geolocation is not supported by your browser');
      return;
    }

    setLocating(true);
    setLocateError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        if (!name) setName('Current GPS Location');
        if (!address) {
          setAddress(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        }
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocateError('Could not retrieve GPS coordinates. You can type the location name below.');
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const locName = name.trim();
    if (!locName) return;

    const loc: MessageLocation = {
      name: locName,
      address: address.trim() || undefined,
      latitude,
      longitude
    };

    onSubmit(loc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Share Family Location</h3>
              <p className="text-[11px] text-stone-400">Let everyone know where you are or coordinate meetups</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GPS Quick detect button */}
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={locating}
          className="w-full flex items-center justify-center space-x-2 p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60 transition-colors"
        >
          <Navigation className={`w-4 h-4 ${locating ? 'animate-spin' : ''}`} />
          <span>{locating ? 'Detecting GPS coordinates...' : 'Use Current Device Location'}</span>
        </button>

        {locateError && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">{locateError}</p>
        )}

        {/* Quick Presets */}
        <div>
          <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5 uppercase tracking-wider">
            Quick Family Presets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`px-2.5 py-1.5 text-xs rounded-xl border transition-all ${
                  name === p.name
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold'
                    : 'border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Location Name / Label
            </label>
            <input
              type="text"
              placeholder="e.g. Grandma's House, Soccer Field, Downtown..."
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Details or Address (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 742 Evergreen Terrace, or Gate 3"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-500 hover:text-stone-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Share Location</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

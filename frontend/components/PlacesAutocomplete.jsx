'use client';
import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '@/lib/maps';

/**
 * Google Places address autocomplete. Falls back to a plain text input if the
 * Google key is missing/fails — the caller can still capture coords via GPS.
 *
 * onSelect({ address, lat, lng }) fires when a place is chosen.
 */
export default function PlacesAutocomplete({ defaultValue = '', onSelect, onText, placeholder }) {
  const inputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps()
      .then((google) => {
        if (!mounted || !inputRef.current) return;
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'in' },
          fields: ['formatted_address', 'geometry'],
        });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (place.geometry?.location) {
            onSelect?.({
              address: place.formatted_address,
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          }
        });
      })
      .catch(() => {
        /* no key — degrade to a plain input */
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      ref={inputRef}
      className="input"
      placeholder={placeholder || 'Search your delivery address'}
      defaultValue={defaultValue}
      onChange={(e) => onText?.(e.target.value)}
    />
  );
}

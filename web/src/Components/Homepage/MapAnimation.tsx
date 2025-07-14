import React, { useEffect, useRef, useState } from 'react';
import styles from './MapAnimation.module.scss';
import { ReactComponent as MapSVG } from '../../Assets/Images/animated-map-updated.svg';

const MapAnimation = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const countries = [
    { name: 'Namibia', id: 'namibia' },
    { name: 'Vietnam', id: 'vietnam' },
    { name: 'Sri Lanka', id: 'sri-lanka' },
    { name: "Côte D'Ivoire", id: 'cote-divoire' },
    { name: 'Nigeria', id: 'nigeria' },
    { name: 'Zimbabwe', id: 'zimbabwe' },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated && mapRef.current) {
          const targetElements = mapRef.current.querySelectorAll('.animate-target');
          const textElements = mapRef.current.querySelectorAll('text');

          targetElements.forEach((el, i) => {
            if (el instanceof HTMLElement) {
              el.style.animationDelay = `${i * 0.1}s`;
              el.classList.add(styles.mapElement);
            }
          });

          textElements.forEach((el, i) => {
            el.style.animationDelay = `${1 + i * 0.2}s`;
            el.classList.add(styles.textLabel);
          });

          setHasAnimated(true); // Prevent retriggering
          if (containerRef.current) {
            observer.unobserve(containerRef.current); // Optional: stop observing once triggered
          }
        }
      },
      {
        threshold: 0.05, // Trigger when 5% is visible
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect(); // Cleanup on unmount
  }, [hasAnimated]);

  return (
    <div>
      <div className="global-impact-container">
        <h2 className="global-impact-title">Global Impact</h2>
        <div className="global-impact-content">
          <p className="global-impact-description">
            The following are some of the countries currently working with UNDP to adapt and scale
            the open-source carbon registry to their national contexts. UNDP welcomes partners
            worldwide to collaborate in adopting, scaling, and enhancing the platform.
          </p>

          <div className="countries-grid">
            {countries.map((country, index) => (
              <div key={country.id} className="country-item">
                <span className="country-bullet">•</span>
                <span className="country-name">{country.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div ref={containerRef} className={styles.mapContainer}>
        <div ref={mapRef}>
          <MapSVG className={styles.animatedMap} />
        </div>
      </div>
    </div>
  );
};

export default MapAnimation;

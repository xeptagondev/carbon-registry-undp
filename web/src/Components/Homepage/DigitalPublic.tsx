import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import './Dashboard.scss';
import allAbout from '../../Assets/Images/allAbout.webp';
import { Trans, useTranslation } from 'react-i18next';

const DigitalPublicGood = () => {
  const { i18n, t } = useTranslation(['common', 'homepage']);

  // Stats animation state
  const [isVisible, setIsVisible] = useState(false);
  const [counts, setCounts] = useState({
    projects: 200,
    co2: 200,
    value: 0,
  });

  const statsRef = useRef(null);

  const targetValues = {
    projects: 404,
    co2: 407,
    value: 60.1,
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const duration = 1500; // 2 seconds
    const steps = 40;
    const stepDuration = duration / steps;

    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setCounts({
        projects: Math.floor(targetValues.projects * progress),
        co2: Math.floor(targetValues.co2 * progress),
        value: Number((targetValues.value * progress).toFixed(1)),
      });

      if (currentStep >= steps) {
        clearInterval(timer);
        setCounts(targetValues); // Ensure final values are exact
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [isVisible]);

  return (
    <div className="digital-public-good">
      <h2 className="header-title">{t('homepage:allAboutImpact')}</h2>

      <div className="image-containers">
        <img src={allAbout} alt="A Digital Public Good" className="main-image" />

        <motion.div
          ref={statsRef}
          className="stats-card-overlay"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          viewport={{ once: true }}
        >
          <div className="stats-overlay">
            <div className="stat-item">
              <div className="stat-number">{counts.projects}</div>
              <div className="stat-label">Projects</div>
              <div className="stat-subtitle">117 Countries</div>
            </div>

            <div className="stat-item">
              <div className="stat-number">{counts.co2}</div>
              <div className="stat-label">Million</div>
              <div className="stat-subtitle">Tonnes Of CO2EQ Reduced/Removed</div>
            </div>

            <div className="stat-item">
              <div className="stat-number">{counts.value}</div>
              <div className="stat-label">Billion</div>
              <div className="stat-subtitle">$ Shared Value Created</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DigitalPublicGood;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trans, useTranslation } from 'react-i18next';
import './Dashboard.scss';
import allAbout from '../../Assets/Images/allAbout.webp';

const CarbonDashboard = () => {
  const { i18n, t } = useTranslation(['common', 'homep age']);
  const [projectCount, setProjectCount] = useState(0);
  const [creditCount, setCreditCount] = useState(300000);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const statsRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [counts, setCounts] = useState({
    projects: 200,
    co2: 200,
    value: 0,
  });

  const targetValues = {
    projects: 4044,
    co2: 407,
    value: 60.1,
  };

  const animateCounters = useCallback(() => {
    const targetProjectCount = 228;
    const targetCreditCount = 345890;
    const startingCreditCount = 300000;
    const duration = 1500;
    const startTime = Date.now();

    const updateCounters = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeOutQuart = 1 - Math.pow(1 - progress, 4);

      // Update project count
      const currentProjectCount = Math.floor(easeOutQuart * targetProjectCount);
      setProjectCount(currentProjectCount);

      // Update credit count
      const creditDifference = targetCreditCount - startingCreditCount;
      const currentCreditCount = Math.floor(startingCreditCount + easeOutQuart * creditDifference);
      setCreditCount(currentCreditCount);

      setIsAnimating(progress < 1);

      if (progress < 1) {
        requestAnimationFrame(updateCounters);
      } else {
        setProjectCount(targetProjectCount);
        setCreditCount(targetCreditCount);
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(updateCounters);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            animateCounters();
          }
        });
      },
      {
        threshold: 0.5,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => {
      if (statsRef.current) {
        observer.unobserve(statsRef.current);
      }
    };
  }, [animateCounters, hasAnimated]);

  const projectData = [
    { value: 43250, title: t('homepage:issued') },
    { value: 18302, title: t('homepage:transferred') },
    { value: 19508, title: t('homepage:rejected') },
  ];

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
    <div className="carbon-dashboard">
      <div className="dashboard-container">
        <h2 className="header-title">All in one Global Carbon Management Platform and Dashboard</h2>
        <div className="digital-public-good">
          <div className="image-containers">
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
                  <div className="stat-subtitle">in 117 Countries</div>
                </div>

                <div className="stat-item">
                  <div className="stat-number">{counts.co2}</div>
                  <div className="stat-label">Million</div>
                  <div className="stat-subtitle">tCO2EQ Reduced/Removed</div>
                </div>

                <div className="stat-item">
                  <div className="stat-number">$ {counts.value}</div>
                  <div className="stat-label">Billion</div>
                  <div className="stat-subtitle">Shared Value Created</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Header */}

        {/* Main Card with Title and Statistics */}

        {/* Project Distribution Section */}
        <div className="section">
          <h3 className="section-title">{t('homepage:projectdistribution')}</h3>
          <motion.div
            className="cards-grid cards-grid-3"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 0.8, y: 0 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            viewport={{ once: true }}
          >
            {projectData.map((item, index) => (
              <div key={index} className="project-card">
                <div className="project-statistic">
                  <div className="project-value">{item.value.toLocaleString('en-US')}</div>
                  <div className="project-title">{item.title}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default CarbonDashboard;

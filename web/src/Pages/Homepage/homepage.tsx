import { Button, Col, Collapse, CollapseProps, Row } from 'antd';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import logo_Gold from '../../Assets/Images/logo_Gold_White.png';
import LayoutFooter from '../../Components/Footer/layout.footer';
// import { ImgWithFallback } from '@undp/carbon-library';
import './homepage.scss';
import ProcessFlow from '../../Components/Homepage/Howdoesitwork';
import PartnershipBanner from '../../Components/Homepage/Partners';
import FAQ from '../../Components/Homepage/Faq';
import { ImgWithFallback } from '../../Components/ImgwithFallback/imgWithFallback';
import CollapsePanel from 'antd/lib/collapse/CollapsePanel';
import { ROUTES } from '../../Config/uiRoutingConfig';
import CarbonDashboard from '../../Components/Homepage/CarbonDashboard';
import DemoSite from '../../Components/Homepage/DemoSite';
import FeatureCards from '../../Components/Homepage/Keyfeatures';
// import NeonCursor from "../../Components/Homepage/NeonCursor";
import Timeline from '../../Components/Homepage/Timeline';

const Homepage = () => {
  const { i18n, t } = useTranslation(['common', 'homepage']);
  // const countryName = import.meta.env.VITE_APP_COUNTRY_NAME || "Gold Standard";
  const navigate = useNavigate();
  const [Visible, setVisible] = useState(true);

  const controlDownArrow = () => {
    if (window.scrollY > 150) {
      setVisible(false);
    } else {
      setVisible(true);
    }
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };
  const handleClickScroll = () => {
    const element = document.getElementById('vision');
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start', // ensures it scrolls the element to the top of the viewport
      });
    }
  };

  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 });

  useEffect(() => {
    if (localStorage.getItem('i18nextLng')!.length > 2) {
      i18next.changeLanguage('en');
    }
    window.addEventListener('scroll', controlDownArrow);
    return () => {
      window.removeEventListener('scroll', controlDownArrow);
    };
  }, []);
  return (
    <div className="homepage-container">
      <Row>
        <Col md={24} lg={24} flex="auto">
          <div className="homepage-img-container image-container">
            {/* <div className="homepage-img-container mobile-image-container"> */}

            <Row>
              <Col md={18} lg={21} xs={17} flex="auto">
                <div className="homepage-header-container">
                  <div className="logo">
                    <img src={logo_Gold} alt="slider-logo" />
                  </div>
                  <div>
                    <div style={{ display: 'flex' }}>
                      <div className="title">{'IMPACT REGISTRY'}</div>
                      {/* <div className="title-sub">{'REGISTRY'}</div> */}
                    </div>
                    <div className="country-name">Gold Standard</div>
                  </div>
                </div>
              </Col>
              <Col md={6} lg={3} xs={7} flex="auto">
                <div className="homepage-button-container">
                  <div className="SignInbtn">
                    <Button type="primary" onClick={() => navigate(ROUTES.LOGIN)}>
                      SIGN IN
                    </Button>
                  </div>
                </div>
              </Col>
            </Row>
            <Row>
              <div className="text-ctn">
                {/* <NeonCursor /> */}
                <span>
                  <Trans
                    i18nKey="homepage:heading"
                    components={{
                      br: <br />,
                    }}
                  />
                </span>
                <div className="subhome">{t('homepage:subHeading')}</div>
                <div className="subhometxt">{t('homepage:subHeadingtext')}</div>
                <div className="explorebutton">
                  <Button type="default" onClick={handleClickScroll}>
                    Explore More
                  </Button>
                </div>
              </div>
            </Row>
            {/* </div> */}
          </div>
        </Col>
      </Row>
      <div className="parent-title">
        <section className="title-section" id="vision" ref={ref}>
          <h1 className="header-title">
            We are all About Impact for Planet,
            <br /> People and Nature
          </h1>
          <p>
            Established in 2003, Gold Standard sets the benchmark for climate projects that reduce
            carbon emissions while upholding the highest environmental integrity. The Gold Standard
            Impact Registry offers a transparent, public view of certified projects, providing
            access to key documentation and progress updates. As the “source of truth” for Gold
            Standard products, including carbon credits, it tracks issuance, transfers, and
            retirements with unique serial numbers. This ensures full traceability and verified
            impact, enabling stakeholders to make informed decisions while advancing Net-Zero
            targets and broader Sustainable Development Goals.
          </p>
        </section>
      </div>

      <CarbonDashboard />
      <div className="TimelineSect">
        <Timeline />
      </div>
      <FeatureCards />
      <FAQ />
      <LayoutFooter />
    </div>
  );
};

export default Homepage;

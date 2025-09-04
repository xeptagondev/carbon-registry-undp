import { Col, Divider, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import logo_Gold from '../../Assets/Images/logo_Gold.png';
import './layout.footer.scss';
import { CcCircle } from 'react-bootstrap-icons';
import footlogo from '../../Assets/Images/FooterLogo.png';

const LayoutFooter = () => {
  const { i18n, t } = useTranslation(['common', 'homepage']);
  // const countryName = import.meta.env.VITE_APP_COUNTRY_NAME || 'Gold Standard';

  return (
    <div className="homepage-footer-container">
      <Row>
        <Col md={24} lg={24}>
          <div className="logocontainer">
            <div className="logo">
              <img src={footlogo} alt="slider-logo" />
            </div>
            <div className="logo-text">
              <div style={{ display: 'flex' }}>
                <div className="title">
                  {'IMPACT'} <span>REGISTRY</span>
                </div>
                {/* <div className="title-sub">{'REGISTRY'}</div> */}
              </div>
              <div className="footer-country-name">Gold Standard</div>
            </div>
          </div>
        </Col>
      </Row>
      <Divider className="divider" style={{ backgroundColor: '#FFFF' }} />
      <Row>
        <Col md={24} lg={24}>
          <div className="footertext">{t('homepage:footertext1')}</div>
        </Col>
      </Row>
    </div>
  );
};

export default LayoutFooter;

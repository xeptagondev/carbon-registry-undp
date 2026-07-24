import { useTranslation } from 'react-i18next';
import { CreditIssuanceTableComponent } from './Components/creditIssuanceTable';
import './creditPageStyles.scss';

export const CreditIssuancePage = () => {
  const { t } = useTranslation(['creditPages']);

  return (
    <div className="content-container credit-management">
      <div className="credit-title-bar">
        <div className="title-bar">
          <div className="body-title" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {t('creditIssuance')}
          </div>
          <CreditIssuanceTableComponent t={t} />
        </div>
      </div>
    </div>
  );
};

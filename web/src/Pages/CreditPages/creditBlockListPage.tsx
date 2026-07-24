import { useTranslation } from 'react-i18next';
import { CreditBlockListTableComponent } from './Components/creditBlockList';
import './creditPageStyles.scss';

export const CreditBlockListPage = () => {
  const { t } = useTranslation(['creditPages']);

  return (
    <div className="content-container credit-management">
      <div className="credit-title-bar">
        <div className="title-bar">
          <div className="body-title" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {t('creditBlockList')}
          </div>
          <CreditBlockListTableComponent t={t} />
        </div>
      </div>
    </div>
  );
};

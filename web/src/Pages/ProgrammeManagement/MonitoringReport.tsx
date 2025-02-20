import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SLCFMonitoringReportComponent } from '../../Components/MonitoringReport/SLCFMonitoringReportComponent';

const MonitoringReport = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation(['common', 'monitoringReport']);

  const onNavigateToProgrammeManagementView = () => {
    navigate('/programmeManagement/viewAll');
  };

  return (
    <SLCFMonitoringReportComponent
      translator={i18n}
      useLocation={useLocation}
      onNavigateToProgrammeView={onNavigateToProgrammeManagementView}
    ></SLCFMonitoringReportComponent>
  );
};

export default MonitoringReport;

import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SLCFProjectDetailsViewComponent from '../../Components/ProjectDetailsView/SLCFProjectDetailsViewComponent';

const ProjectDetailsView = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation(['common', 'projectDetailsView']);

  const onNavigateToProgrammeManagementView = () => {
    navigate('/programmeManagement/viewAll');
  };

  return (
    <SLCFProjectDetailsViewComponent
      translator={i18n}
      onNavigateToProgrammeView={onNavigateToProgrammeManagementView}
    ></SLCFProjectDetailsViewComponent>
  );
};

export default ProjectDetailsView;

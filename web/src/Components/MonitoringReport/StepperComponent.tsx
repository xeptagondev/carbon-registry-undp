import { useEffect, useRef, useState } from 'react';
import { Steps, message } from 'antd';
import { BasicInformationStep } from './BasicInformation';
import './MonitoringReport.scss';
import { ProjectActivityStep } from './ProjectActivityStep';
import { ImplementationOfProjectActivityStep } from './ImplementationOfProjectActivity';
import { DescriptionOfMSStep } from './DescriptionOfMonitoringSystemStep';
import { DataAndParametersStep } from './DataAndParametersStep';
import { CalcEmissionReductionStep } from './CalcOfEmissionReductionStep';
import { AnnexureStep } from './AppendixStep';
import { useForm } from 'antd/lib/form/Form';
import { useConnection } from '../../Context/ConnectionContext/connectionContext';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import moment from 'moment';
import { DocumentTypeEnum } from '../../Definitions/Enums/document.type.enum';
import { DocumentEnum } from '../../Definitions/Enums/document.enum';
import { FormMode } from '../../Definitions/Enums/formMode.enum';
import { extractFilePropertiesFromLink, fileUploadValueExtract } from '../../Utils/utilityHelper';
import { SlcfFormActionModel } from '../Models/SlcfFormActionModel';
import { PopupInfo } from '../../Definitions/Definitions/ndcDetails.definitions';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { API_PATHS } from '../../Config/apiConfig';
import { ROUTES } from '../../Config/uiRoutingConfig';
import { DocType } from '../../Definitions/Enums/document.type';
import ProjectDetails from '../PDD/BasicInformation';
import { CustomStepsProps } from './StepProps';
import { Loading } from '../Loading/loading';

const StepperComponent = (props: CustomStepsProps) => {
  const navigate = useNavigate();
  const { translator, t } = props;
  const [current, setCurrent] = useState(0);
  const [reportId, setReportId] = useState(0);
  const [status, setStatus] = useState(null);
  const { get, post } = useConnection();
  const { id, verificationRequestId } = useParams();
  const navigationLocation = useLocation();
  const [projectCategory, setProjectCategory] = useState<string>('');
  const { mode, docId } = navigationLocation.state || {};
  const [popupInfo, setPopupInfo] = useState<PopupInfo>();
  const [slcfActionModalVisible, setSlcfActioModalVisible] = useState<boolean>(false);
  const [versions, setVersions] = useState<number[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>();
  const [documentStatus, setDocumentStatus] = useState('');

  const [loading, setLoading] = useState<boolean>(false);

  const { state } = useLocation();
  const isView = !!state?.isView;
  const isEdit = !!state?.isEdit;

  // const [loading, setLoading] = useState<boolean>(isView || isEdit);

  const scrollSection = useRef({} as any);

  const [disableFields, setDisableFields] = useState<boolean>(false);
  const [values, setValues] = useState({
    projectRefId: id,
    name: 'monitoringReport',
    companyId: undefined,
    documentType: DocumentEnum.MONITORING,
    data: {},
  });

  const scrollToDiv = () => {
    if (scrollSection.current) {
      scrollSection.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  const navigateToDetailsPage = () => {
    navigate(ROUTES.PROGRAMME_DETAILS_BY_ID(String(id)));
  };

  // const [values, setValues] = useState({
  //   projectRefId: Number(id),
  //   name: 'MonitoringReport',
  //   companyId: undefined,
  //   documentType: DocumentEnum.MONITORING,
  //   data: {},
  // });

  const next = () => {
    setCurrent(current + 1);
    scrollToDiv();
  };

  const prev = () => {
    setCurrent(current - 1);
    scrollToDiv();
  };

  const submitForm = async (appendixVals: any) => {
    try {
      console.log('----form vals-----', appendixVals);
      setLoading(true);
      const tempValues = {
        ...values,
        data: {
          ...values.data,
          appendix: appendixVals,
        },
      };

      const res = await post(API_PATHS.ADD_DOCUMENT, tempValues);
      if (res?.statusText === 'SUCCESS') {
        message.open({
          type: 'success',
          content: isEdit
            ? 'Monitoring Report has been edited successfully'
            : 'Monitoring Report has been submitted successfully',
          duration: 4,
          style: { textAlign: 'right', marginRight: 15, marginTop: 10 },
        });
        navigateToDetailsPage();
      }
    } catch (error: any) {
      message.open({
        type: 'error',
        content: 'Something went wrong',
        duration: 4,
        style: { textAlign: 'right', marginRight: 15, marginTop: 10 },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValuesUpdate = (val: any) => {
    // console.log('----------temp vals stepper-------------', val);
    setValues((prevVal: any) => {
      const tempContent = {
        ...prevVal.data,
        ...val,
      };
      return { ...prevVal, data: tempContent };
    });
  };
  // const showModalOnAction = (info: PopupInfo) => {
  //   setSlcfActioModalVisible(true);
  //   setPopupInfo(info);
  // };

  // const approveOrReject = async (verify: boolean, remark?: string) => {
  //   const body = {
  //     verify: verify,
  //     verificationRequestId: Number(verificationRequestId),
  //     reportId: reportId,
  //     remark,
  //   };
  //   try {
  //     const res = await post(API_PATHS.VERIFY_MONITORING_REPORT, body);
  //     if (res?.statusText === 'SUCCESS') {
  //       message.open({
  //         type: 'success',
  //         content: verify
  //           ? t('monitoringReport:monitoringReportApproveSuccess')
  //           : t('monitoringReport:monitoringReportRejectSuccess'),
  //         duration: 4,
  //         style: { textAlign: 'right', marginRight: 15, marginTop: 10 },
  //       });
  //       navigate(ROUTES.PROGRAMME_DETAILS_BY_ID(String(id)));
  //     }
  //   } catch (error: any) {
  //     if (error && error.errors && error.errors.length > 0) {
  //       error.errors.forEach((err: any) => {
  //         Object.keys(err).forEach((field) => {
  //           console.log(`Error in ${field}: ${err[field].join(', ')}`);
  //           message.open({
  //             type: 'error',
  //             content: err[field].join(', '),
  //             duration: 4,
  //             style: { textAlign: 'right', marginRight: 15, marginTop: 10 },
  //           });
  //         });
  //       });
  //     } else {
  //       message.open({
  //         type: 'error',
  //         content: error?.message,
  //         duration: 4,
  //         style: { textAlign: 'right', marginRight: 15, marginTop: 10 },
  //       });
  //     }
  //   }
  // };

  // const [countries, setCountries] = useState<[]>([]);

  // const getCountryList = async () => {
  //   try {
  //     const response = await get(API_PATHS.COUNTRY_LIST);
  //     if (response.data) {
  //       const alpha2Names = response.data.map((item: any) => {
  //         return item.alpha2;
  //       });
  //       setCountries(alpha2Names);
  //     }
  //   } catch (error) {
  //     console.log(error);
  //   }
  // };

  // const getProgrammeDetailsById = async () => {
  //   try {
  //     setLoading(true);
  //     const { data } = await post(API_PATHS.PROJECT_BY_ID, {
  //       programmeId: id,
  //     });

  //     const {
  //       data: { user },
  //     } = await get(API_PATHS.USER_PROFILE);

  //     setProjectCategory(data?.projectCategory);
  //   } catch (error) {
  //     console.log('error');
  //   }
  // };

  // const onFinish = async (newValues: any) => {
  //   setFormValues((prevValues) => ({
  //     ...prevValues,
  //     ...newValues,
  //   }));
  //   if (FormMode.VIEW === mode) {
  //     navigateToDetailsPage();
  //   } else {
  //     const content = { ...formValues, ...newValues };

  //     content.projectActivity.creditingPeriodFromDate = moment(
  //       content?.projectActivity?.creditingPeriodFromDate
  //     )
  //       .startOf('day')
  //       .valueOf();
  //     content.projectActivity.creditingPeriodToDate = moment(
  //       content?.projectActivity?.creditingPeriodToDate
  //     )
  //       .startOf('day')
  //       .valueOf();
  //     content.projectActivity.registrationDateOfTheActivity = moment(
  //       content?.projectActivity?.registrationDateOfTheActivity
  //     )
  //       .startOf('day')
  //       .valueOf();
  //     await content.projectActivity?.projectActivityLocationsList?.forEach(async (val: any) => {
  //       val.projectStartDate = moment(val?.projectStartDate).startOf('day').valueOf();
  //       val.optionalDocuments = await fileUploadValueExtract(val, 'optionalDocuments');
  //     });

  //     content.projectDetails.dateOfIssue = moment(content?.projectDetails?.dateOfIssue)
  //       .startOf('day')
  //       .valueOf();

  //     content?.quantification?.emissionReductionsRemovalsList?.forEach((val: any) => {
  //       val.startDate = moment(content?.quantification?.startDate).startOf('day').valueOf();
  //       val.endDate = moment(content?.quantification?.endDate).startOf('day').valueOf();
  //     });
  //     content.quantifications.optionalDocuments = await fileUploadValueExtract(
  //       content?.quantifications,
  //       'optionalDocuments'
  //     );

  //     content.annexures.optionalDocuments = await fileUploadValueExtract(
  //       content?.annexures,
  //       'optionalDocuments'
  //     );
  //     const body = { content: JSON.stringify(content), programmeId: id };
  //     try {
  //       const res = await post(API_PATHS.CREATE_MONITORING_REPORT, body);
  //       if (res?.statusText === 'SUCCESS') {
  //         message.open({
  //           type: 'success',
  //           content: t('monitoringReport:uploadMonitoringReportSuccess'),
  //           duration: 4,
  //           style: { textAlign: 'right', marginRight: 15, marginTop: 10 },
  //         });
  //         navigateToDetailsPage();
  //       }
  //     } catch (error: any) {
  //       if (error && error.errors && error.errors.length > 0) {
  //         error.errors.forEach((err: any) => {
  //           Object.keys(err).forEach((field) => {
  //             console.log(`Error in ${field}: ${err[field].join(', ')}`);
  //             message.open({
  //               type: 'error',
  //               content: err[field].join(', '),
  //               duration: 4,
  //               style: { textAlign: 'right', marginRight: 15, marginTop: 10 },
  //             });
  //           });
  //         });
  //       } else {
  //         message.open({
  //           type: 'error',
  //           content: error?.message,
  //           duration: 4,
  //           style: { textAlign: 'right', marginRight: 15, marginTop: 10 },
  //         });
  //       }
  //     }
  //   }
  // };

  const [projectDetailsForm] = useForm();
  const [projectActivityForm] = useForm();
  const [implementationStatusForm] = useForm();
  const [safeguardsForm] = useForm();
  const [dataAndParametersForm] = useForm();
  const [qualificationForm] = useForm();
  const [annexuresForm] = useForm();

  // const getLatestReports = async (programId: any) => {
  //   try {
  //     // if (docId === null) {
  //     if (mode === FormMode.CREATE) {
  //       const { data } = await post(API_PATHS.LAST_DOC_VERSION, {
  //         programmeId: programId,
  //         docType: DocumentTypeEnum.CMA,
  //       });
  //       const { data: projectDetails } = await post(API_PATHS.PROJECT_BY_ID, {
  //         programmeId: id,
  //       });

  //       if (data && data?.content && projectDetails) {
  //         const cmaData = JSON.parse(data?.content);

  //         projectDetailsForm.setFieldsValue({
  //           title: cmaData?.projectDetails?.title,
  //           projectProponent: cmaData?.projectDetails?.projectProponent,
  //           dateOfIssue: moment(Date.now()),
  //           physicalAddress: cmaData?.projectDetails?.physicalAddress,
  //           email: cmaData?.projectDetails?.email,
  //           telephone: cmaData?.projectDetails?.telephone,
  //           website: cmaData?.projectDetails?.website,
  //           preparedBy: cmaData?.projectDetails?.preparedBy,
  //         });

  //         projectActivityForm.setFieldsValue({
  //           pp_organizationName: cmaData?.projectActivity?.projectProponent?.organizationName,
  //           pp_contactPerson: cmaData?.projectActivity?.projectProponent?.contactPerson,
  //           pp_telephone: cmaData?.projectActivity?.projectProponent?.telephone,
  //           pp_email: cmaData?.projectActivity?.projectProponent?.email,
  //           pp_address: cmaData?.projectActivity?.projectProponent?.address,
  //           projectProponentsList: cmaData?.projectActivity.otherEntities.map((entity: any) => {
  //             return {
  //               ...entity,
  //               organizationName: entity?.orgainzationName,
  //               roleInTheProject: entity?.role,
  //             };
  //           }),
  //           creditingPeriodFromDate: moment(
  //             cmaData?.projectActivity?.creditingPeriodStartDate * 1000
  //           ),
  //           creditingPeriodToDate: moment(cmaData?.projectActivity?.creditingPeriodEndDate * 1000),
  //           creditingPeriodComment: cmaData?.projectActivity?.creditingPeriodDescription,
  //           registrationDateOfTheActivity: moment(projectDetails?.authorisedCreditUpdatedTime),
  //           projectTrackAndCreditUse: cmaData?.projectActivity?.projectTrack,
  //           projectActivityLocationsList: cmaData?.projectActivity?.locationsOfProjectActivity?.map(
  //             (location: any) => {
  //               return {
  //                 ...location,
  //                 optionalDocuments:
  //                   location.additionalDocuments && location.additionalDocuments?.length > 0
  //                     ? location.additionalDocuments?.map((document: string, index: number) => {
  //                         return {
  //                           uid: index,
  //                           name: extractFilePropertiesFromLink(document).fileName,
  //                           status: 'done',
  //                           url: document,
  //                         };
  //                       })
  //                     : [],
  //                 location: location?.geographicalLocationCoordinates,
  //                 projectStartDate: moment(location?.startDate * 1000),
  //               };
  //             }
  //           ),
  //         });
  //       }

  //       qualificationForm.setFieldsValue({
  //         estimatedNetEmissionReductions: [
  //           {
  //             startDate: '',
  //             endDate: '',
  //             baselineEmissionReductions: '',
  //             projectEmissionReductions: '',
  //             leakageEmissionReductions: '',
  //             netEmissionReductions: '',
  //           },
  //         ],
  //       });
  //     } else if (mode === FormMode.VIEW || mode === FormMode.EDIT) {
  //       const { data } =
  //         mode === FormMode.VIEW && selectedVersion
  //           ? await post(API_PATHS.VERIFICATION_DOC_BY_VERSION, {
  //               programmeId: id,
  //               docType: DocumentTypeEnum.MONITORING_REPORT,
  //               version: selectedVersion,
  //               verificationRequestId: Number(verificationRequestId),
  //             })
  //           : await post(API_PATHS.VERIFICATION_DOC_LAST_VERSION, {
  //               programmeId: id,
  //               docType: DocumentTypeEnum.MONITORING_REPORT,
  //               verificationRequestId: Number(verificationRequestId),
  //             });

  //       if (mode === FormMode.VIEW) {
  //         handleDocumentStatus(data.status);
  //       }
  //       if (data && data?.content) {
  //         setReportId(data?.id);
  //         setStatus(data?.status);
  //         projectDetailsForm.setFieldsValue({
  //           ...data?.content?.projectDetails,
  //           dateOfIssue: moment(data?.content?.projectDetails?.dateOfIssue),
  //           reportID: data?.content?.projectDetails?.reportID,
  //         });

  //         projectActivityForm.setFieldsValue({
  //           ...data?.content?.projectActivity,
  //           creditingPeriodFromDate: moment(
  //             data?.content?.projectActivity?.creditingPeriodFromDate
  //           ),
  //           creditingPeriodToDate: moment(data?.content?.projectActivity?.creditingPeriodToDate),
  //           registrationDateOfTheActivity: moment(
  //             data?.content?.projectActivity?.registrationDateOfTheActivity
  //           ),
  //           projectActivityLocationsList:
  //             data?.content?.projectActivity?.projectActivityLocationsList?.map((val: any) => {
  //               return {
  //                 ...val,
  //                 projectStartDate: moment(val?.projectStartDate),
  //                 optionalDocuments: val?.optionalDocuments?.map(
  //                   (document: string, index: number) => {
  //                     return {
  //                       uid: index,
  //                       name: extractFilePropertiesFromLink(document).fileName,
  //                       status: 'done',
  //                       url: document,
  //                     };
  //                   }
  //                 ),
  //               };
  //             }),
  //         });
  //         qualificationForm.setFieldsValue({
  //           ...data?.content?.quantifications,
  //           optionalDocuments: data?.content?.quantifications?.optionalDocuments?.map(
  //             (document: string, index: number) => {
  //               return {
  //                 uid: index,
  //                 name: extractFilePropertiesFromLink(document).fileName,
  //                 status: 'done',
  //                 url: document,
  //               };
  //             }
  //           ),

  //           estimatedNetEmissionReductions:
  //             data?.content?.quantifications?.estimatedNetEmissionReductions?.map(
  //               (netEmission: any) => {
  //                 return {
  //                   ...netEmission,
  //                   startDate: moment(netEmission.startDate),
  //                   endDate: moment(netEmission.endDate),
  //                 };
  //               }
  //             ),
  //         });
  //         implementationStatusForm.setFieldsValue({
  //           ...data?.content?.implementationStatus,
  //         });
  //         safeguardsForm.setFieldsValue({
  //           ...data?.content?.safeguards,
  //         });
  //         dataAndParametersForm.setFieldsValue({
  //           ...data?.content?.dataAndParameters,
  //         });
  //         annexuresForm.setFieldsValue({
  //           ...data?.content?.annexures,
  //           optionalDocuments: data?.content?.annexures?.optionalDocuments?.map(
  //             (document: string, index: number) => {
  //               return {
  //                 uid: index,
  //                 name: extractFilePropertiesFromLink(document).fileName,
  //                 status: 'done',
  //                 url: document,
  //               };
  //             }
  //           ),
  //         });
  //       }
  //     }
  //   } catch (error) {
  //     console.log('error');
  //   }
  // };

  // useEffect(() => {
  //   // getLatestReports(id);
  //   const getViewData = async () => {
  //     if (isView || isEdit) {
  //       setLoading(true);
  //       let res;
  //       try {
  //         if (isView && selectedVersion) {
  //           res = await post(API_PATHS.DOC_BY_VERSION, {
  //             programmeId: id,
  //             docType: 'MonitoringReport',
  //             version: selectedVersion,
  //           });
  //         } else {
  //           res = await post(API_PATHS.LAST_DOC_VERSION, {
  //             programmeId: id,
  //             DocType: 'Monitoring Report',
  //           });
  //         }
  //         if (isView) {
  //           //handleDocumentStatus(res.data.status);
  //         }
  //         if (res?.statusText === 'SUCCESS') {
  //           const content = JSON.parse(res?.data.content);

  //           // Mapping retrieved data to form fields
  //         }
  //       } catch (error) {
  //         console.log('error', error);
  //       } finally {
  //         setLoading(false);
  //       }
  //     }
  //   };
  //   getViewData();

  //   if (isView) {
  //     setDisableFields(true);
  //   }
  // }, [selectedVersion]);

  useEffect(() => {
    // getLatestReports(id);
    // getCountryList();
    // getProgrammeDetailsById();
    projectActivityForm.setFieldValue('projectParticipants', [
      { partiesInvolved: '', projectParticipants: [{ participant: '' }] },
    ]);
  }, []);

  const steps = [
    {
      title: (
        <div ref={scrollSection} className="stepper-title-container">
          <div className="title">{t('monitoringReport:title01')}</div>
        </div>
      ),
      description: (
        <BasicInformationStep
          translator={translator}
          t={t}
          current={current}
          form={projectDetailsForm}
          formMode={mode}
          next={next}
          prev={navigateToDetailsPage}
          handleValuesUpdate={handleValuesUpdate}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">01</div>
          <div className="title">{t('monitoringReport:title02')}</div>
        </div>
      ),
      description: (
        <ProjectActivityStep
          translator={translator}
          t={t}
          current={current}
          form={projectActivityForm}
          formMode={mode}
          next={next}
          prev={prev}
          handleValuesUpdate={handleValuesUpdate}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">02</div>
          <div className="title">{t('monitoringReport:title03')}</div>
        </div>
      ),
      description: (
        <ImplementationOfProjectActivityStep
          translator={translator}
          t={t}
          current={current}
          form={implementationStatusForm}
          formMode={mode}
          next={next}
          prev={prev}
          handleValuesUpdate={handleValuesUpdate}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">03</div>
          <div className="title">{t('monitoringReport:title04')}</div>
        </div>
      ),
      description: (
        <DescriptionOfMSStep
          translator={translator}
          t={t}
          current={current}
          form={safeguardsForm}
          formMode={mode}
          next={next}
          prev={prev}
          handleValuesUpdate={handleValuesUpdate}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">04</div>
          <div className="title">{t('monitoringReport:title05')}</div>
        </div>
      ),
      description: (
        <DataAndParametersStep
          translator={translator}
          t={t}
          current={current}
          form={dataAndParametersForm}
          formMode={mode}
          next={next}
          prev={prev}
          handleValuesUpdate={handleValuesUpdate}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">05</div>
          <div className="title">{t('monitoringReport:title06')}</div>
        </div>
      ),
      description: (
        <CalcEmissionReductionStep
          translator={translator}
          t={t}
          current={current}
          form={qualificationForm}
          formMode={mode}
          next={next}
          prev={prev}
          // projectCategory={projectCategory}
          handleValuesUpdate={handleValuesUpdate}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">06</div>
          <div className="title">{t('monitoringReport:title07')}</div>
        </div>
      ),
      description: (
        <AnnexureStep
          t={t}
          current={current}
          translator={translator}
          form={annexuresForm}
          formMode={mode}
          prev={prev}
          next={navigateToDetailsPage}
          handleValuesUpdate={submitForm}
          // approve={() => {
          //   showModalOnAction({
          //     actionBtnText: t('monitoringReport:btnApprove'),
          //     icon: <CheckCircleOutlined />,
          //     title: t('monitoringReport:approveMonitoringModalTitle'),
          //     okAction: () => {
          //       approveOrReject(true);
          //     },
          //     remarkRequired: false,
          //     type: 'primary',
          //   });
          // }}
          // reject={() => {
          //   showModalOnAction({
          //     actionBtnText: t('monitoringReport:btnReject'),
          //     icon: <CloseCircleOutlined />,
          //     title: t('monitoringReport:rejectMonitoringModalTitle'),
          //     okAction: (remark: string) => {
          //       approveOrReject(false, remark);
          //     },
          //     remarkRequired: true,
          //     type: 'danger',
          //   });
          // }}
          //submitForm={submitForm}
          // onFinish={onFinish}
        />
      ),
    },
  ];

  return (
    <>
      {loading && <Loading />}
      <Steps
        progressDot
        direction="vertical"
        current={current}
        items={steps.map((step) => ({
          title: step.title,
          description: step.description,
        }))}
      />
      {/* {popupInfo && (
        <SlcfFormActionModel
          onCancel={() => {
            setSlcfActioModalVisible(false);
          }}
          actionBtnText={popupInfo!.actionBtnText}
          onFinish={popupInfo!.okAction}
          subText={''}
          openModal={slcfActionModalVisible}
          icon={popupInfo!.icon}
          title={popupInfo!.title}
          type={popupInfo!.type}
          remarkRequired={popupInfo!.remarkRequired}
          t={t}
        />
      )} */}
    </>
  );
};

export default StepperComponent;

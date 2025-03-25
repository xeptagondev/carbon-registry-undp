import { Steps, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import './ValidationReport.scss';
// import './SLCFMonitoringReportComponent.scss';

import { useForm } from 'antd/lib/form/Form';
import { useConnection } from '../../Context/ConnectionContext/connectionContext';

import moment from 'moment';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import DataValidationProcess from './DataValidationProcess';
import ValidationReportIntroduction from './ValidationReportIntroduction';
// import Reference from './Reference';
// import ValicationReportGHGDescriptionOfProjectActivity from './ValicationReportGHGDescriptionOfProjectActivity';
import ValidationMethodology from './ValidationMethodology';
import ValidationOpinion from './ValidationOpinion';
import ValidationReportAppendix from './ValidationReportAppendix';
import { projectScopeList } from './validationReportHelper';
import { extractFilePropertiesFromLink } from '../../Utils/utilityHelper';
import { FormMode } from '../../Definitions/Enums/formMode.enum';
import { API_PATHS } from '../../Config/apiConfig';
import { ROUTES } from '../../Config/uiRoutingConfig';
import BasicInformation from './BasicInformation';
import ExecutiveSummary from './ExecutiveSummary';
import InternalQualityControl from './InternalQualityControl';
import GHGProjectDescription from './GHGProjectDescription';
import MeansOfValidation from './MeansOfValidation';
import ValidationFindings from './ValidationFindings';
import { DocumentEnum } from '../../Definitions/Enums/document.enum';
import { Loading } from '../Loading/loading';
import {
  basicInformationMapDataToFields,
  executiveSummaryMapDataToFields,
  ghgProjectDescriptionMapDataToFields,
  internalQualityControlMapDataToFields,
  meansOfValidationMapDataToFields,
  validationFindingsMapDataToFields,
  validationMethodologyMapDataToFields,
  validationOpinionMapDataToFields,
  validationReportAppendixMapDataToFields,
} from './viewDataMap';
import { mapBase64ToFields } from '../../Utils/mapBase64ToFields';

export enum ProcessSteps {
  VR_PROJECT_DETAILS = 'VR_PROJECT_DETAILS',
  VR_INTRODUCTION = 'VR_INTRODUCTION',
  VR_GHG_PROJECT_DESCRIPTION = 'VR_GHG_PROJECT_DESCRIPTION',
  VR_VALIDATION_METHODOLOGY = 'VR_VALIDATION_METHODOLOGY',
  VR_VALIDATION_PROCESS = 'VR_VALIDATION_PROCESS',
  VR_VALIDATION_OPINION = 'VR_VALIDATION_OPINION',
  VR_REFERENCE = 'VR_REFERENCE',
  VR_APPENDIX = 'VR_APPENDIX',
}

const StepperComponent = (props: any) => {
  const { t, selectedVersion, handleDocumentStatus } = props;

  const [current, setCurrent] = useState(0);

  const navigate = useNavigate();
  const { id } = useParams();
  const { get, post } = useConnection();
  const navigationLocation = useLocation();
  const scrollSection = useRef({} as any);
  const { state } = useLocation();
  console.log('----------state-------------', state);
  const isEdit = true;
  const countryName = process.env.REACT_APP_COUNTRY_NAME || 'CountryX';
  const registryName = process.env.REACT_APP_COUNTRY_NAME || 'RegistryX';

  const [documentId, setDocumentId] = useState<string>();
  const [loading, setLoading] = useState<boolean>(false);
  const [disableFields, setDisableFields] = useState<boolean>(false);

  const handleLoading = (val: boolean) => {
    setLoading(val);
  };

  const [existingFormValues, setExistingFormValues] = useState({
    projectRefId: id,
    documentType: DocumentEnum.VALIDATION,
    name: 'Validation',
    data: {},
  });

  const navigateToDetailsPage = () => {
    navigate(ROUTES.PROGRAMME_DETAILS_BY_ID(String(id)));
  };

  const scrollToDiv = () => {
    if (scrollSection.current) {
      scrollSection.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  const submitForm = async (appendixVals: any) => {
    setLoading(true);

    const tempValues = {
      ...existingFormValues,
      data: {
        ...existingFormValues.data,
        appendix: appendixVals,
      },
    };
    console.log('--------adding form-values------', tempValues);

    try {
      const res = await post(API_PATHS.ADD_DOCUMENT, tempValues);
      console.log('res', res);
      if (res?.statusText === 'SUCCESS') {
        message.open({
          type: 'success',
          content: 'Validation report has been submitted successfully',
          duration: 4,
          style: { textAlign: 'right', marginRight: 15, marginTop: 10 },
        });
        navigateToDetailsPage();
      }
    } catch (error: any) {
      console.log('----------error----------', error);
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

  const next = () => {
    if (current === 8 && (state?.mode === FormMode.VIEW || state?.mode === FormMode.VERIFY)) {
      navigateToDetailsPage();
      return;
    }
    setCurrent(current + 1);
    setTimeout(() => {
      scrollToDiv();
    }, 300);
  };

  const prev = () => {
    if (current === 0) {
      navigateToDetailsPage();
      return;
    }
    setCurrent(current - 1);
  };

  const [countries, setCountries] = useState<[]>([]);
  const [projectCategory, setProjectCategory] = useState<string>('');

  const [form1] = useForm();
  const [form2] = useForm();
  const [form3] = useForm();
  const [form4] = useForm();
  const [form5] = useForm();
  const [form6] = useForm();
  const [form7] = useForm();
  const [form8] = useForm();
  const [form9] = useForm();

  const getProgrammeDetailsById = async (programId: any) => {
    try {
      setLoading(true);
      const { data } = await post(API_PATHS.PROGRAMME_BY_ID, {
        programmeId: programId,
      });
      // const {
      //   data: { user },
      // } = await get(API_PATHS.USER_PROFILE);
      if (state?.mode === FormMode?.CREATE) {
        console.log('-------data INF ---------', data);
        form1.setFieldsValue({
          titleOfTheProjectActivity: data?.title,
          mandatarySectoralScopes: data?.sectoralScope,
        });
      }
      setExistingFormValues((prevVal) => ({
        ...prevVal,
        // companyId: data?.company?.companyId,
      }));
    } catch (error) {
      console.log('error', error);
    } finally {
      setLoading(false);
    }
  };

  const getPDDData = async () => {
    try {
      const { data } = await post(API_PATHS.QUERY_DOCUMENT, {
        refId: state?.documentRefId,
        documentType: DocumentEnum.PDD,
      });
      console.log('-----------data----------', data);
      if (state?.mode === FormMode?.CREATE) {
        console.log('-----data.data---------', data?.data);
        const participants =
          data?.data?.projectActivity?.projectParticipants?.map((participantObj: any) =>
            participantObj.projectParticipants?.map((p: any) => p.participant)
          ) || [];

        form1.setFieldsValue({
          versionNumberPDD: data?.version,
          projectParticipants: participants.join(', '),
          hostParty: data?.data?.projectDetails?.hostParty,
          creditingPeriod: data?.data?.startDateCreditingPeriod?.projectCreditingPeriodDuration,
          creditingPeriodStart: moment.unix(
            data?.data?.startDateCreditingPeriod?.projectCreditingPeriodStartDate
          ),
          creditingPeriodEnd: moment.unix(
            data?.data?.startDateCreditingPeriod?.projectCreditingPeriodEndDate
          ),
          locationOfProjectActivity:
            data?.data?.projectActivity?.locationsOfProjectActivity?.[0]?.locationOfProjectActivity,
          siteNo: data?.data?.projectActivity?.locationsOfProjectActivity?.[0]?.siteNo,
          province: data?.data?.projectActivity?.locationsOfProjectActivity?.[0]?.province,
          district: data?.data?.projectActivity?.locationsOfProjectActivity?.[0]?.district,
          city: data?.data?.projectActivity?.locationsOfProjectActivity?.[0]?.city,
          community: data?.data?.projectActivity?.locationsOfProjectActivity?.[0]?.community,
          geographicalLocationCoordinates:
            data?.data?.projectActivity?.locationsOfProjectActivity?.[0]
              ?.geographicalLocationCoordinates,
          optionalImages: mapBase64ToFields(
            data?.data?.projectActivity?.locationsOfProjectActivity?.[0]?.additionalDocuments
          ),
          extraLocations: data?.data?.projectActivity?.locationsOfProjectActivity
            ?.slice(1)
            ?.map((location: any) => ({
              ...location,
              optionalImages: mapBase64ToFields(location?.additionalDocuments),
            })),
        });
      }
    } catch (error) {
      console.log('error', error);
    }
  };

  // const getProgrammeDetailsById = async (id: string) => {
  //   try {
  //     const { data } = await post(API_PATHS.PROJECT_BY_ID, {
  //       programmeId: id,
  //     });

  //     const {
  //       data: { user },
  //     } = await get(API_PATHS.USER_PROFILE);

  //     form1.setFieldsValue({
  //       projectTitle: data?.title,
  //       dateOfIssue: moment(),
  //       client: data.title,
  //     });

  //     setProjectCategory(data?.projectCategory);

  //     setExistingFormValues((prevVal) => ({
  //       ...prevVal,
  //       companyId: data?.company?.companyId,
  //     }));
  //   } catch (error) {
  //     console.log('error');
  //   }
  // };

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

  // const getCMALastVersion = async (id: string) => {
  //   try {
  //     const {
  //       data: { content },
  //     } = await post(API_PATHS.LAST_DOC_VERSION, {
  //       programmeId: id,
  //       docType: 'cma',
  //     });

  //     const projectContent = JSON.parse(content);

  //     form1.setFieldsValue({
  //       telephone: projectContent?.projectDetails?.telephone,
  //       email: projectContent?.projectDetails?.email,
  //       address: projectContent?.projectDetails?.physicalAddress,
  //       website: projectContent?.projectDetails?.website,
  //       reportNo: `SLCCS/VDR/${new Date().getFullYear()}/${id}`,
  //       workCarriedOutBy: `Validation Division - ${registryName}`,
  //     });

  //     form2.setFieldsValue({
  //       titleOfProjectActivity: projectContent?.projectDetails?.title,
  //       projectParticipant: projectContent?.projectActivity?.projectProponent?.organizationName,
  //     });

  //     form3.setFieldsValue({
  //       creditingPeriod: Number(projectContent?.projectActivity?.totalCreditingYears),
  //       startDateCreditingPeriod: moment(
  //         projectContent?.projectActivity?.creditingPeriodStartDate * 1000
  //       ),
  //       locationsOfProjectActivity: projectContent?.projectActivity.locationsOfProjectActivity.map(
  //         (location: any) => {
  //           return {
  //             ...location,
  //             additionalDocuments:
  //               location.additionalDocuments && location.additionalDocuments?.length > 0
  //                 ? location.additionalDocuments?.map((document: string, index: number) => {
  //                     return {
  //                       uid: index,
  //                       name: extractFilePropertiesFromLink(document).fileName,
  //                       status: 'done',
  //                       url: document,
  //                     };
  //                   })
  //                 : [],
  //             technicalProjectDescriptionItems: [
  //               {
  //                 item: '',
  //                 parameterValue: [
  //                   {
  //                     parameter: '',
  //                     value: '',
  //                   },
  //                 ],
  //               },
  //             ],
  //           };
  //         }
  //       ),
  //     });

  //     form4.setFieldsValue({
  //       validationReportFinding: [
  //         {
  //           typeOfFinding: '',
  //           findingNo: '',
  //           rfToCMA: '',
  //           actionRequestsByValidationTeam: '',
  //           summaryOfProjectOwnerResponse: '',
  //           validationTeamAssessment: '',
  //           conclusion: [],
  //         },
  //       ],
  //       teamMembers: [
  //         {
  //           name: '',
  //           company: `${t('validationReport:ClimateFund', { countryName: countryName })}`,
  //           function: '',
  //           taskPerformed: '',
  //         },
  //       ],
  //       followupInterviews: [
  //         {
  //           name: '',
  //           designation: '',
  //           organization: '',
  //         },
  //       ],
  //     });

  //     form5.setFieldsValue({
  //       employedTechnologies: projectContent?.projectActivity.locationsOfProjectActivity.map(
  //         (location: any, index: number) => {
  //           return {
  //             siteNo: index + 1,
  //             location: location.locationOfProjectActivity,
  //             capacity: '',
  //           };
  //         }
  //       ),
  //       gridEmissionFactorUnit: 'tCO2e/MWh',
  //       gridEmissionFactorValueGlobal: 0.72222,
  //       baselineEmissions: [
  //         ...projectContent?.projectActivity.locationsOfProjectActivity.map(
  //           (location: any, index: number) => {
  //             return {
  //               type: 'value',
  //               location: location.locationOfProjectActivity,
  //               projectCapacityValue: '',
  //               plantFactorValue: '',
  //               avgEnergyOutputValue: '',
  //               gridEmissionFactorValue: '',
  //               emissionReductionValue: '',
  //             };
  //           }
  //         ),
  //       ],
  //       estimatedNetEmissionReductions:
  //         projectContent?.quantificationOfGHG?.netGHGEmissionReductions?.yearlyGHGEmissionReductions.map(
  //           (emissionData: any) => {
  //             return {
  //               startDate: moment(emissionData.startDate * 1000),
  //               endDate: moment(emissionData.endDate * 1000),
  //               baselineEmissionReductions: emissionData.baselineEmissionReductions,
  //               projectEmissionReductions: emissionData.projectEmissionReductions,
  //               leakageEmissionReductions: emissionData.leakageEmissionReductions,
  //               netEmissionReductions: emissionData.netEmissionReductions,
  //             };
  //           }
  //         ),
  //       totalBaselineEmissionReductions:
  //         projectContent?.quantificationOfGHG?.netGHGEmissionReductions
  //           ?.totalBaselineEmissionReductions,
  //       totalProjectEmissionReductions:
  //         projectContent?.quantificationOfGHG?.netGHGEmissionReductions
  //           ?.totalProjectEmissionReductions,
  //       totalLeakageEmissionReductions:
  //         projectContent?.quantificationOfGHG?.netGHGEmissionReductions
  //           ?.totalLeakageEmissionReductions,
  //       totalNetEmissionReductions:
  //         projectContent?.quantificationOfGHG?.netGHGEmissionReductions?.totalNetEmissionReductions,
  //       avgBaselineEmissionReductions:
  //         projectContent?.quantificationOfGHG?.netGHGEmissionReductions
  //           ?.avgBaselineEmissionReductions,
  //       avgProjectEmissionReductions:
  //         projectContent?.quantificationOfGHG?.netGHGEmissionReductions
  //           ?.avgProjectEmissionReductions,
  //       avgLeakageEmissionReductions:
  //         projectContent?.quantificationOfGHG?.netGHGEmissionReductions
  //           ?.avgLeakageEmissionReductions,
  //       avgNetEmissionReductions:
  //         projectContent?.quantificationOfGHG?.netGHGEmissionReductions?.avgNetEmissionReductions,
  //       totalNumberOfCredingYears:
  //         projectContent?.quantificationOfGHG?.netGHGEmissionReductions?.totalNumberOfCredingYears,
  //     });
  //   } catch (error) {
  //     console.log('error');
  //   }
  // };

  const handleValuesUpdate = (val: any) => {
    setExistingFormValues((prevVal: any) => {
      const tempContent = {
        ...prevVal.data,
        ...val,
      };
      return { ...prevVal, data: tempContent };
    });
  };

  useEffect(() => {
    if (id) {
      getProgrammeDetailsById(id);
      getPDDData();
    }
  }, [id]);

  useEffect(() => {
    const getViewData = async () => {
      if (
        state?.mode === FormMode?.EDIT ||
        state?.mode === FormMode?.VERIFY ||
        state?.mode === FormMode?.VIEW
      ) {
        setLoading(true);
        let res;
        try {
          res = await post(API_PATHS.QUERY_DOCUMENT, {
            refId: state?.documentRefId,
            DocumentEnum: DocumentEnum.VALIDATION,
          });

          if (res?.statusText === 'SUCCESS') {
            const data = res?.data;
            setDocumentId(data?.refId);
            console.log(
              '---------validation------------',
              data?.data,
              data?.data?.basicInformation
            );
            const basicInformation = basicInformationMapDataToFields(data.data?.basicInformation);
            form1.setFieldsValue(basicInformation);

            const ghgProjectDescription = ghgProjectDescriptionMapDataToFields(
              data.data?.ghgProjectDescription
            );
            form2.setFieldsValue(ghgProjectDescription);

            const executiveSummary = executiveSummaryMapDataToFields(data.data?.executiveSummary);
            form3.setFieldsValue(executiveSummary);

            const validationMethdology = validationMethodologyMapDataToFields(
              data.data?.validationMethdology
            );
            form4.setFieldsValue(validationMethdology);

            const meansOfValidation = meansOfValidationMapDataToFields(
              data.data?.meansOfValidation
            );
            form5.setFieldsValue(meansOfValidation);

            const validationFindings = validationFindingsMapDataToFields(
              data.data?.validationFindings
            );
            form6.setFieldsValue(validationFindings);

            const internalQualityControl = internalQualityControlMapDataToFields(
              data.data?.internalQualityControl
            );
            form7.setFieldsValue(internalQualityControl);

            const validationOpinion = validationOpinionMapDataToFields(
              data.data?.validationOpinion
            );
            form8.setFieldsValue(validationOpinion);

            const appendix = validationReportAppendixMapDataToFields(data.data?.appendix);
            console.log('---------appendix-----------', appendix);
            form9.setFieldsValue(appendix);
          }

          if (state?.mode === FormMode.VERIFY || state?.mode === FormMode.VIEW) {
            setDisableFields(true);
          }
        } catch (error) {
          console.log('error', error);
        } finally {
          setLoading(false);
        }
      }
    };

    getViewData();
  }, [selectedVersion]);

  const steps = [
    {
      title: (
        <div ref={scrollSection} className="stepper-title-container project-detail-title">
          <div className="title">{t('validationReport:form01Title')}</div>
        </div>
      ),
      description: (
        <BasicInformation
          next={next}
          prev={prev}
          form={form1}
          current={current}
          t={t}
          countries={countries}
          handleValuesUpdate={handleValuesUpdate}
          // existingFormValues={existingFormValues.content[ProcessSteps.VR_PROJECT_DETAILS]}
          formMode={state?.mode}
          disableFields={disableFields}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          {/* <div className="step-count">01</div> */}
          <div className="title">{t('validationReport:form02Title')}</div>
        </div>
      ),
      description: (
        <GHGProjectDescription
          next={next}
          prev={prev}
          form={form2}
          current={current}
          t={t}
          countries={countries}
          handleValuesUpdate={handleValuesUpdate}
          // existingFormValues={existingFormValues.content[ProcessSteps.VR_INTRODUCTION]}
          formMode={state?.mode}
          disableFields={disableFields}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">01</div>
          <div className="title">{t('validationReport:form03Title')}</div>
        </div>
      ),
      description: (
        <ExecutiveSummary
          next={next}
          prev={prev}
          form={form3}
          current={current}
          t={t}
          handleValuesUpdate={handleValuesUpdate}
          // existingFormValues={existingFormValues.content[ProcessSteps.VR_GHG_PROJECT_DESCRIPTION]}
          formMode={state?.mode}
          disableFields={disableFields}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">02</div>
          <div className="title">{t('validationReport:form04Title')}</div>
        </div>
      ),
      description: (
        <ValidationMethodology
          next={next}
          prev={prev}
          form={form4}
          current={current}
          t={t}
          handleValuesUpdate={handleValuesUpdate}
          // existingFormValues={existingFormValues.content[ProcessSteps.VR_VALIDATION_METHODOLOGY]}
          formMode={state?.mode}
          disableFields={disableFields}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">03</div>
          <div className="title">{t('validationReport:form05Title')}</div>
        </div>
      ),
      description: (
        <MeansOfValidation
          next={next}
          prev={prev}
          form={form5}
          current={current}
          t={t}
          handleValuesUpdate={handleValuesUpdate}
          // existingFormValues={existingFormValues.content[ProcessSteps.VR_VALIDATION_PROCESS]}
          projectCategory={projectCategory}
          disableFields={disableFields}
          formMode={state?.mode}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">04</div>
          <div className="title">{t('validationReport:form06Title')}</div>
        </div>
      ),
      description: (
        <ValidationFindings
          next={next}
          prev={prev}
          form={form6}
          current={current}
          t={t}
          handleValuesUpdate={handleValuesUpdate}
          // existingFormValues={existingFormValues.content[ProcessSteps.VR_VALIDATION_PROCESS]}
          projectCategory={projectCategory}
          disableFields={disableFields}
          formMode={state?.mode}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">05</div>
          <div className="title">{t('validationReport:form07Title')}</div>
        </div>
      ),
      description: (
        <InternalQualityControl
          next={next}
          prev={prev}
          form={form7}
          current={current}
          t={t}
          handleValuesUpdate={handleValuesUpdate}
          disableFields={disableFields}
          // existingFormValues={existingFormValues.content[ProcessSteps.VR_REFERENCE]}
          formMode={state?.mode}
        />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">06</div>
          <div className="title">{t('validationReport:form08Title')}</div>
        </div>
      ),
      description: (
        <ValidationOpinion
          next={next}
          prev={prev}
          form={form8}
          current={current}
          t={t}
          handleValuesUpdate={handleValuesUpdate}
          disableFields={disableFields}
          // existingFormValues={existingFormValues.content[ProcessSteps.VR_VALIDATION_OPINION]}
          formMode={state?.mode}
        />
        // <ValidationReportAppendix
        //   next={next}
        //   prev={prev}
        //   form={form8}
        //   current={current}
        //   t={t}
        //   handleValuesUpdate={handleValuesUpdate}
        //   existingFormValues={existingFormValues.content[ProcessSteps.VR_APPENDIX]}
        //   formMode={state?.mode}
        // />
      ),
    },
    {
      title: (
        <div className="stepper-title-container">
          <div className="step-count">07</div>
          <div className="title">{t('validationReport:form09Title')}</div>
        </div>
      ),
      description: (
        <ValidationReportAppendix
          next={next}
          prev={prev}
          form={form9}
          current={current}
          documentId={documentId}
          t={t}
          handleValuesUpdate={submitForm}
          // existingFormValues={existingFormValues.content[ProcessSteps.VR_APPENDIX]}
          disableFields={disableFields}
          formMode={state?.mode}
          handleLoading={handleLoading}
        />
      ),
    },
  ];

  if (loading) {
    return <Loading />;
  }
  return (
    <>
      <Steps
        progressDot
        direction="vertical"
        current={current}
        items={steps.map((step) => ({
          title: step.title,
          description: step.description,
        }))}
      />
    </>
  );
};

export default StepperComponent;

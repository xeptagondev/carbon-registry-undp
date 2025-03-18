import { MinusOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Checkbox, Col, DatePicker, Form, Input, Row, Select, Upload } from 'antd';
import TextArea from 'antd/lib/input/TextArea';
import moment from 'moment';
import { FormMode } from '../../Definitions/Enums/formMode.enum';
import { VerificationStepProps } from './StepProps';

export const VerificationFindingStep = (props: VerificationStepProps) => {
  const { t, current, form, formMode, next, prev, handleValuesUpdate } = props;
  const maximumImageSize = process.env.REACT_APP_MAXIMUM_FILE_SIZE
    ? parseInt(process.env.REACT_APP_MAXIMUM_FILE_SIZE)
    : 5000000;

  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  const onFinish = (values: any) => {
    // console.log('--------values-----------', values);
    const body = { ...values };
    handleValuesUpdate({
      verificationFindingsFormDetails: body,
    });
  };

  return (
    <>
      {current === 6 && (
        <div>
          <div className="step-form-container">
            <Form
              labelCol={{ span: 20 }}
              wrapperCol={{ span: 24 }}
              className="step-form"
              layout="vertical"
              requiredMark={true}
              form={form}
              disabled={FormMode.VIEW === formMode}
              onFinish={(values: any) => {
                onFinish(values);
                if (next) {
                  next();
                }
              }}
            >
              {/* Demonstration of prior consideration of the CDM start */}
              <>
                <h4 className="verificationReport-findings-heading">
                  {t('verificationReport:demonstrationPriorCDM')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="cdmeansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="cdm_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="cdm_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Demonstration of prior consideration of the CDM end */}

              {/* Identification of project type start */}
              <>
                <h4 className="verificationReport-findings-heading">
                  {t('verificationReport:identificationOfProjectType')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="projectType_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="projectType_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="projectType_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Identification of project type end */}

              {/* Description of project activity start */}
              <>
                <h4 className="verificationReport-findings-heading">
                  {t('verificationReport:descriptionOfProjectActivity')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="projectActivity_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="projectActivity_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="projectActivity_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Description of project activity end */}

              {/* Application Methodologies main section */}
              <h3 className="verificationReport-findings-heading">
                {t('verificationReport:applicationMethodologiesSectionHeading')}
              </h3>
              {/* Application and selection of methodologies and standardized baselines start */}
              <>
                <h4 className="verificationReport-findings-subHeading">
                  {t('verificationReport:applicationMethodologiesBaselines')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="applicationMethodologies_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="applicationMethodologies_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="applicationMethodologies_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Application and selection of methodologies and standardized baselines end */}

              {/* Deviation from methodology and/or methodological tool start */}

              <>
                <h4 className="verificationReport-findings-subHeading">
                  {t('verificationReport:deviationMethodology')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="deviationMethodology_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="deviationMethodology_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="deviationMethodology_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Deviation from methodology and/or methodological tool end */}

              {/* Clarification on applicability of methodology, tool and/or standardized baseline start */}
              <>
                <h4 className="verificationReport-findings-subHeading">
                  {t('verificationReport:clarificationOnMethodology')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="clarificationOnMethodology_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="clarificationOnMethodology_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="clarificationOnMethodology_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Clarification on applicability of methodology, tool and/or standardized baseline end */}

              {/* Project boundary, sources and GHGs start */}
              <>
                <h4 className="verificationReport-findings-subHeading">
                  {t('verificationReport:projectBoundarySources')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="projectBoundarySources_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="projectBoundarySources_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="projectBoundarySources_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Project boundary, sources and GHGs end */}

              {/* Baseline scenario start */}
              <>
                <h4 className="verificationReport-findings-subHeading">
                  {t('verificationReport:baselineScenario')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="baselineScenario_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="baselineScenario_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="baselineScenario_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Baseline scenario end */}

              {/* Demonstration Of Additionality start */}
              <>
                <h4 className="verificationReport-findings-subHeading">
                  {t('verificationReport:demonstrationOfAdditionality')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="demonstrationOfAdditionality_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="demonstrationOfAdditionality_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="demonstrationOfAdditionality_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Demonstration Of Additionality end */}

              {/* Estimation of emission reductions or net anthropogenic removals start */}
              <>
                <h4 className="verificationReport-findings-subHeading">
                  {t('verificationReport:estimationOfEmissionReduction')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="estimationOfEmissionReduction_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="estimationOfEmissionReduction_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="estimationOfEmissionReduction_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Estimation of emission reductions or net anthropogenic removals end */}

              {/* Monitoring Plan start */}
              <>
                <h4 className="verificationReport-findings-subHeading">
                  {t('verificationReport:monitoringPlan')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="monitoringPlan_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="monitoringPlan_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="monitoringPlan_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Monitoring Plan end */}

              {/* Start date, crediting period type and duration start */}
              <>
                <h4 className="verificationReport-findings-heading">
                  {t('verificationReport:startDateCreditingPeriod')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="startDateCreditingPeriod_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="startDateCreditingPeriod_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="startDateCreditingPeriod_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Start date, crediting period type and duration end */}

              {/* Environmental impacts start */}
              <>
                <h4 className="verificationReport-findings-heading">
                  {t('verificationReport:environmentImpacts')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="environmentImpacts_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="environmentImpacts_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="environmentImpacts_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Environmental impacts end */}

              {/* Local Stakeholder Consultation start */}
              <>
                <h4 className="verificationReport-findings-heading">
                  {t('verificationReport:localStakeholderConsultation')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="localStakeholderConsultation_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="localStakeholderConsultation_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="localStakeholderConsultation_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Local Stakeholder Consultation end */}

              {/* Sustainable development co-benefits start */}
              <>
                <h4 className="verificationReport-findings-heading">
                  {t('verificationReport:sustainableDevelopment')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="sustainableDevelopment_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="sustainableDevelopment_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="sustainableDevelopment_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Sustainable development co-benefits end */}

              {/* Approval start */}
              <>
                <h4 className="verificationReport-findings-heading">
                  {t('verificationReport:approval')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="approval_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="approval_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="approval_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Approval end */}

              {/* Authorization start */}
              <>
                <h4 className="verificationReport-findings-heading">
                  {t('verificationReport:authorization')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="authorization_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="authorization_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="authorization_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Authorization end */}

              {/* Modalities of communication start */}
              <>
                <h4 className="verificationReport-findings-heading">
                  {t('verificationReport:modalitiesOfCommunication')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="modalitiesOfCommunication_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="modalitiesOfCommunication_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="modalitiesOfCommunication_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Modalities of communication end */}

              {/* Global stakeholder consultation start */}
              <>
                <h4 className="verificationReport-findings-heading">
                  {t('verificationReport:globalStakeholderConsultation')}
                </h4>
                <section className="verificationReport-findings-section">
                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:meansOfVerification')}`}
                    name="globalStakeholderConsultation_meansOfVerification"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:meansOfVerification')} ${t(
                          'isRequired'
                        )}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:findings')}`}
                    name="globalStakeholderConsultation_findings"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:findings')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>

                  <Form.Item
                    className="full-width-form-item"
                    label={`${t('verificationReport:conclusions')}`}
                    name="globalStakeholderConsultation_conclusions"
                    rules={[
                      {
                        required: true,
                        message: `${t('verificationReport:conclusions')} ${t('isRequired')}`,
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      // disabled={FormMode.VIEW === formMode}
                    />
                  </Form.Item>
                </section>
              </>
              {/* Global stakeholder consultation end */}

              <Row justify={'end'} className="step-actions-end">
                <Button style={{ margin: '0 8px' }} onClick={prev} disabled={false}>
                  {t('verificationReport:back')}
                </Button>
                <Button type="primary" htmlType="submit" disabled={false}>
                  {t('verificationReport:next')}
                </Button>
              </Row>
            </Form>
          </div>
        </div>
      )}
    </>
  );
};

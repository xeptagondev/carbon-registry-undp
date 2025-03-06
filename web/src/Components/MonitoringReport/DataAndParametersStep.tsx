import { Button, Col, Form, Input, Row } from 'antd';

import TextArea from 'antd/lib/input/TextArea';
import { FormMode } from '../../Definitions/Enums/formMode.enum';

export const DataAndParametersStep = (props: any) => {
  const { useLocation, translator, current, form, formMode, next, countries, prev, onValueChange } =
    props;

  const t = translator.t;
  return (
    <>
      {current === 4 && (
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
                onValueChange({ dataAndParameters: values });
                next();
              }}
            >
              <h3 className="form-section-title">{`${t('monitoringReport:dp_title')}`}</h3>
              <Row justify={'space-between'} gutter={[40, 16]} className="form-section">
                <Row className="row" gutter={[40, 16]}>
                  <Col xl={12} md={24}>
                    <div className="step-form-left-col">
                      <Form.Item
                        label={t('monitoringReport:dp_dataParameter')}
                        name="dp_dataParameter"
                        rules={[
                          {
                            required: true,
                            message: '',
                          },
                          {
                            validator: async (rule, value) => {
                              if (
                                String(value).trim() === '' ||
                                String(value).trim() === undefined ||
                                value === null ||
                                value === undefined
                              ) {
                                throw new Error(
                                  `${t('monitoringReport:dp_dataParameter')} ${t('isRequired')}`
                                );
                              }
                            },
                          },
                        ]}
                      >
                        <Input size="large" />
                      </Form.Item>
                    </div>
                  </Col>
                  <Col xl={12} md={24}>
                    <div className="step-form-right-col">
                      <Form.Item
                        label={t('monitoringReport:dp_dataUnit')}
                        name="dp_dataUnit"
                        rules={[
                          {
                            required: true,
                            message: '',
                          },
                          {
                            validator: async (rule, value) => {
                              if (
                                String(value).trim() === '' ||
                                String(value).trim() === undefined ||
                                value === null ||
                                value === undefined
                              ) {
                                throw new Error(
                                  `${t('monitoringReport:dp_dataUnit')} ${t('isRequired')}`
                                );
                              }
                            },
                          },
                        ]}
                      >
                        <Input size="large" />
                      </Form.Item>
                    </div>
                  </Col>
                </Row>
                <Row className="row" gutter={[40, 16]}>
                  <Col xl={24} md={24}>
                    <div className="step-form-left-col">
                      <Form.Item
                        label={t('monitoringReport:dp_description')}
                        name="dp_description"
                        rules={[
                          {
                            required: true,
                            message: `${t('monitoringReport:dp_description')} ${t('isRequired')}`,
                          },
                        ]}
                      >
                        <TextArea
                          rows={3}
                          disabled={FormMode.VIEW === formMode}
                          placeholder={`${t('monitoringReport:dp_descriptionPlaceholder')}`}
                        />
                      </Form.Item>
                    </div>
                  </Col>
                </Row>
                <Row className="row" gutter={[40, 16]}>
                  <Col xl={24} md={24}>
                    <div className="step-form-left-col">
                      <Form.Item
                        label={t('monitoringReport:dp_sourceOfData')}
                        name="dp_sourceOfData"
                        rules={[
                          {
                            required: true,
                            message: `${t('monitoringReport:dp_sourceOfData')} ${t('isRequired')}`,
                          },
                        ]}
                      >
                        <TextArea
                          rows={3}
                          disabled={FormMode.VIEW === formMode}
                          placeholder={`${t('monitoringReport:dp_sourceOfDataPlaceholder')}`}
                        />
                      </Form.Item>
                    </div>
                  </Col>
                </Row>
                <Row className="row" gutter={[40, 16]}>
                  <Col xl={24} md={24}>
                    <div className="step-form-left-col">
                      <Form.Item
                        label={t('monitoringReport:dp_valueApplied')}
                        name="dp_valueApplied"
                        rules={[
                          {
                            required: true,
                            message: `${t('monitoringReport:dp_valueApplied')} ${t('isRequired')}`,
                          },
                        ]}
                      >
                        <TextArea
                          rows={3}
                          disabled={FormMode.VIEW === formMode}
                          placeholder={`${t('monitoringReport:dp_valueAppliedPlaceholder')}`}
                        />
                      </Form.Item>
                    </div>
                  </Col>
                </Row>
                <Row className="row" gutter={[40, 16]}>
                  <Col xl={24} md={24}>
                    <div className="step-form-left-col">
                      <Form.Item
                        label={t('monitoringReport:dp_choiceOfDataOrMeasurement')}
                        name="dp_choiceOfDataOrMeasurement"
                        rules={[
                          {
                            required: true,
                            message: '',
                          },
                          {
                            validator: async (rule, value) => {
                              if (
                                String(value).trim() === '' ||
                                String(value).trim() === undefined ||
                                value === null ||
                                value === undefined
                              ) {
                                throw new Error(
                                  `${t('monitoringReport:dp_choiceOfDataOrMeasurement')} ${t(
                                    'isRequired'
                                  )}`
                                );
                              }
                            },
                          },
                        ]}
                      >
                        <TextArea
                          rows={6}
                          disabled={FormMode.VIEW === formMode}
                          placeholder={`${t(
                            'monitoringReport:dp_choiceOfDataOrMeasurementPlaceholder'
                          )}`}
                        />
                      </Form.Item>
                    </div>
                  </Col>
                </Row>
                <Row className="row" gutter={[40, 16]}>
                  <Col xl={24} md={24}>
                    <div className="step-form-right-col">
                      <Form.Item
                        label={t('monitoringReport:dp_purposeOfData')}
                        name="dp_purposeOfData"
                        rules={[
                          {
                            required: true,
                            message: '',
                          },
                          {
                            validator: async (rule, value) => {
                              if (
                                String(value).trim() === '' ||
                                String(value).trim() === undefined ||
                                value === null ||
                                value === undefined
                              ) {
                                throw new Error(
                                  `${t('monitoringReport:dp_purposeOfData')} ${t('isRequired')}`
                                );
                              }
                            },
                          },
                        ]}
                      >
                        <TextArea
                          rows={3}
                          disabled={FormMode.VIEW === formMode}
                          placeholder={`${t('monitoringReport:dp_purposeOfDataPlaceholder')}`}
                        />
                      </Form.Item>
                    </div>
                  </Col>
                </Row>
                <Row className="row" gutter={[40, 16]}>
                  <Col xl={24} md={24}>
                    <div className="step-form-left-col">
                      <Form.Item
                        label={t('monitoringReport:dp_comments')}
                        name="dp_comments"
                        rules={[
                          {
                            required: true,
                            message: `${t('monitoringReport:dp_comments')} ${t('isRequired')}`,
                          },
                        ]}
                      >
                        <TextArea
                          rows={3}
                          disabled={FormMode.VIEW === formMode}
                          placeholder={`${t('monitoringReport:dp_commentsPlaceholder')}`}
                        />
                      </Form.Item>
                    </div>
                  </Col>
                </Row>
              </Row>

              <Row className="row" gutter={[40, 16]}>
                <Col xl={24} md={24}>
                  <div className="step-form-left-col">
                    <Form.Item
                      label={t('monitoringReport:dp_implementationOfSamplingPlan')}
                      name="dp_implementationOfSamplingPlan"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:dp_implementationOfSamplingPlan')} ${t(
                            'isRequired'
                          )}`,
                        },
                      ]}
                    >
                      <TextArea
                        disabled={FormMode.VIEW === formMode}
                        rows={6}
                        // placeholder={t('monitoringReport:dpm_descriptionPlaceholder')}
                      />
                    </Form.Item>
                  </div>
                </Col>
              </Row>
              <Row justify={'end'} className="step-actions-end">
                <Button style={{ margin: '0 8px' }} onClick={prev} disabled={false}>
                  {t('monitoringReport:back')}
                </Button>
                <Button type="primary" htmlType="submit" disabled={false}>
                  {t('monitoringReport:next')}
                </Button>
              </Row>
            </Form>
          </div>
        </div>
      )}
    </>
  );
};

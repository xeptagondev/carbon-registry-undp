import { useState } from 'react';
import { Button, Col, DatePicker, Form, Input, Row } from 'antd';
import PhoneInput, {
  formatPhoneNumber,
  formatPhoneNumberIntl,
  isPossiblePhoneNumber,
} from 'react-phone-number-input';

import moment from 'moment';
import { FormMode } from '../../Definitions/Enums/formMode.enum';

export const ProjectDetailsStep = (props: any) => {
  const {
    useLocation,
    translator,
    current,
    form,
    formMode,
    next,
    cancel,
    countries,
    onValueChange,
  } = props;

  const [contactNoInput] = useState<any>();

  const t = translator.t;
  return (
    <>
      {current === 0 && (
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
                onValueChange({ projectDetails: values });
                next();
              }}
            >
              <Row className="row" gutter={[40, 16]}>
                <Col xl={12} md={24}>
                  <div className="step-form-left-col">
                    <Form.Item
                      label={t('monitoringReport:bi_projectTitle')}
                      name="bi_projectTitle"
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
                                `${t('monitoringReport:bi_projectTitle')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('monitoringReport:bi_applicablePDDVersionNo')}
                      name="bi_applicablePDDVersionNo"
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
                                `${t('monitoringReport:bi_applicablePDDVersionNo')} ${t(
                                  'isRequired'
                                )}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>
                    <Form.Item
                      label={t('monitoringReport:bi_completionDate')}
                      name="bi_completionDate"
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
                                `${t('monitoringReport:bi_completionDate')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <DatePicker
                        size="large"
                        disabledDate={(currentDate: any) => currentDate < moment().startOf('day')}
                      />
                    </Form.Item>
                    <Form.Item
                      label={t('monitoringReport:bi_duration')}
                      name="bi_duration"
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
                                `${t('monitoringReport:bi_duration')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('monitoringReport:bi_projectParticipants')}
                      name="bi_projectParticipants"
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
                                `${t('monitoringReport:bi_projectParticipants')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('monitoringReport:bi_appliedMethodologies')}
                      name="bi_appliedMethodologies"
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
                                `${t('monitoringReport:bi_appliedMethodologies')} ${t(
                                  'isRequired'
                                )}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('monitoringReport:bi_achievedGHGReductions')}
                      name="bi_achievedGHGReductions"
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
                                `${t('monitoringReport:bi_achievedGHGReductions')} ${t(
                                  'isRequired'
                                )}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>
                  </div>
                </Col>

                <Col xl={12} md={24}>
                  <div className="step-form-right-col">
                    <Form.Item
                      label={t('monitoringReport:bi_unfccRefNo')}
                      name="bi_unfccRefNo"
                      rules={[
                        {
                          validator: async (rule, value) => {
                            if (
                              String(value).trim() === '' ||
                              String(value).trim() === undefined ||
                              value === null ||
                              value === undefined
                            ) {
                              throw new Error(`${t('monitoringReport:bi_unfccRefNo')}`);
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('monitoringReport:bi_versionNoOfMR')}
                      name="bi_versionNoOfMR"
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
                                `${t('monitoringReport:bi_versionNoOfMR')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('monitoringReport:bi_monitoringPeriodNo')}
                      name="bi_monitoringPeriodNo"
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
                                `${t('monitoringReport:bi_monitoringPeriodNo')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('monitoringReport:bi_monitoringNoForMonitoringPeriod')}
                      name="bi_monitoringNoForMonitoringPeriod"
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
                                `${t('monitoringReport:bi_monitoringNoForMonitoringPeriod')} ${t(
                                  'isRequired'
                                )}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('monitoringReport:bi_hostParty')}
                      name="bi_hostParty"
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
                                `${t('monitoringReport:bi_hostParty')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('monitoringReport:bi_sectoralScope')}
                      name="bi_sectoralScope"
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
                                `${t('monitoringReport:bi_sectoralScope')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('monitoringReport:bi_projectedGHGReductions')}
                      name="bi_projectedGHGReductions"
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
                                `${t('monitoringReport:bi_projectedGHGReductions')} ${t(
                                  'isRequired'
                                )}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        // disabled
                      />
                    </Form.Item>

                    {/* <Form.Item
                      name="telephone"
                      label={t('monitoringReport:pd_telephone')}
                      initialValue={useLocation?.record?.phoneNo}
                      rules={[
                        {
                          required: true,
                          message: '',
                        },
                        {
                          validator: async (rule: any, value: any) => {
                            if (
                              String(value).trim() === '' ||
                              String(value).trim() === undefined ||
                              value === null ||
                              value === undefined
                            ) {
                              throw new Error(
                                `${t('monitoringReport:pd_telephone')} ${t('isRequired')}`
                              );
                            } else {
                              const phoneNo = formatPhoneNumber(String(value));
                              if (String(value).trim() !== '') {
                                if (phoneNo === null || phoneNo === '' || phoneNo === undefined) {
                                  throw new Error(
                                    `${t('monitoringReport:pd_telephone')} ${t('isRequired')}`
                                  );
                                } else {
                                  if (!isPossiblePhoneNumber(String(value))) {
                                    throw new Error(
                                      `${t('monitoringReport:pd_telephone')} ${t('isInvalid')}`
                                    );
                                  }
                                }
                              }
                            }
                          },
                        },
                      ]}
                    >
                      <PhoneInput
                        disabled
                        placeholder={t('monitoringReport:pd_telephone')}
                        international
                        value={formatPhoneNumberIntl(contactNoInput)}
                        defaultCountry="LK"
                        countryCallingCodeEditable={false}
                        onChange={(v) => {}}
                        countries={countries}
                      />
                    </Form.Item> */}
                    {FormMode.VIEW === formMode ? (
                      <Form.Item label={t('monitoringReport:reportID')} name="reportID">
                        <Input size={'large'} disabled />
                      </Form.Item>
                    ) : (
                      ''
                    )}
                  </div>
                </Col>
              </Row>
              <Row justify={'end'} className="step-actions-end">
                <Button danger size={'large'} onClick={cancel} disabled={false}>
                  {t('monitoringReport:cancel')}
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

import { useEffect, useState } from 'react';
import { Button, Col, DatePicker, Form, Input, Row, Select, Upload } from 'antd';
import PhoneInput, {
  formatPhoneNumber,
  formatPhoneNumberIntl,
  isPossiblePhoneNumber,
} from 'react-phone-number-input';

import moment from 'moment';
import { useConnection } from '../../Context/ConnectionContext/connectionContext';
import { useLocation } from 'react-router-dom';
import TextArea from 'antd/lib/input/TextArea';
import { FormMode } from '../../Definitions/Enums/formMode.enum';
import { API_PATHS } from '../../Config/apiConfig';
import i18n from '../Internationalization/i18n';
import { VerificationStepProps } from './StepProps';
import { UploadOutlined } from '@ant-design/icons';

export const BasicInformationStep = (props: VerificationStepProps) => {
  const {
    current,
    form,
    formMode,
    next,
    prev,
    countries,
    disableFields,
    handleValuesUpdate,
    // verifiedScer,
    // onValueChange,
  } = props;
  const t = i18n.t;
  const { get, post } = useConnection();
  const [contactNoInput] = useState<any>();
  const [countryList, setCountryList] = useState<[]>([]);
  const accessToken = process.env.REACT_APP_MAPBOXGL_ACCESS_TOKEN
    ? process.env.REACT_APP_MAPBOXGL_ACCESS_TOKEN
    : 'pk.eyJ1IjoicGFsaW5kYSIsImEiOiJjbGMyNTdqcWEwZHBoM3FxdHhlYTN4ZmF6In0.KBvFaMTjzzvoRCr1Z1dN_g';

  const maximumImageSize = process.env.REACT_APP_MAXIMUM_FILE_SIZE
    ? parseInt(process.env.REACT_APP_MAXIMUM_FILE_SIZE)
    : 5000000;

  //get validation report details
  // const fetchValidationData = async () => {
  //   const response = await get (API_PATHS.VERIFICATION_DOC_LAST_VERSION);
  //   if (response.data){

  //   }
  // };

  // useEffect (()=>{
  //   fetchValidationData();
  // },[])

  const onFinish = (values: any) => {
    // const tempValues: any = {
    //   basicInfoDetails: {
    //     projectTitle: values?.b_projectTitle,
    //     scaleOfProject: values?.b_scaleOfProject,
    //     completionDate: values?.b_completionDate,
    //     versionNoOfMonitoringReport: values?.b_versionNoOfMonitoringReport,
    //     projectParticipants: values?.b_projectParticipants,
    //     appliedMethodologies: values?.b_appliedMethodologies,
    //     conditionalSectoralScopes: values?.b_conditionalSectoralScopes,
    //     certfiedGHGReductions: values?.b_certfiedGHGReductions,
    //     unfccRefNo: values?.b_unfccRefNo,
    //     versionNoOfVerificationReport: values?.b_versionNoOfVerificationReport,
    //     monitoringPeriodNoAndDuration: values?.b_monitoringPeriodNoAndDuration,
    //     creditingPeriod: values?.b_creditingPeriod,
    //     hostParty: values?.b_hostParty,
    //     mandatorySectoralScopes: values?.b_mandatorySectoralScopes,
    //     estimatedGHGEmissionReduction: values?.b_estimatedGHGEmissionReduction,
    //     name: values?.b_name,
    //     position: values?.b_position,
    //     signature: values?.b_signature,
    //   },
    // };
    console.log('--------values-----------', values);
    const body = { ...values };
    handleValuesUpdate({
      basicDetailsFormValues: body,
    });
  };

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
                onFinish(values);
                if (next) {
                  next();
                }
              }}
            >
              <Row className="row" gutter={[40, 16]}>
                <Col xl={12} md={24}>
                  <div className="step-form-left-col">
                    <Form.Item
                      label={t('verificationReport:b_projectTitle')}
                      name="b_projectTitle"
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
                                `${t('verificationReport:b_projectTitle')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input size="large" disabled={disableFields} />
                    </Form.Item>

                    <Form.Item
                      label={t('verificationReport:b_scaleOfProject')}
                      name="b_scaleOfProject"
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
                                `${t('verificationReport:b_scaleOfProject')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Select
                        showSearch
                        size="large"
                        disabled={disableFields}
                        placeholder="Select"
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLocaleString().includes(input.toLowerCase())
                        }
                        options={[
                          { value: '1', label: 'Large Scale' },
                          { value: '2', label: 'Small Scale' },
                        ]}
                      />
                    </Form.Item>

                    {/* <Form.Item
                      name="telephone"
                      label={t('verificationReport:telephone')}
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
                                `${t('verificationReport:telephone')} ${t('isRequired')}`
                              );
                            } else {
                              const phoneNo = formatPhoneNumber(String(value));
                              if (String(value).trim() !== '') {
                                if (phoneNo === null || phoneNo === '' || phoneNo === undefined) {
                                  throw new Error(
                                    `${t('verificationReport:telephone')} ${t('isRequired')}`
                                  );
                                } else {
                                  if (!isPossiblePhoneNumber(String(value))) {
                                    throw new Error(
                                      `${t('verificationReport:telephone')} ${t('isInvalid')}`
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
                        placeholder={t('verificationReport:telephone')}
                        international
                        value={formatPhoneNumberIntl(contactNoInput)}
                        defaultCountry="LK"
                        disabled
                        countryCallingCodeEditable={false}
                        onChange={(v) => {}}
                        countries={countries}
                      />
                    </Form.Item> */}
                    <Form.Item
                      label={t('verificationReport:b_completionDate')}
                      name="b_completionDate"
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
                                `${t('verificationReport:b_completionDate')} ${t('isRequired')}`
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
                      label={t('verificationReport:b_versionNoOfMonitoringReport')}
                      name={'b_versionNoOfMonitoringReport'}
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
                                `${t('verificationReport:b_versionNoOfMonitoringReport')} ${t(
                                  'isRequired'
                                )}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input size="large" disabled={disableFields} />
                    </Form.Item>
                    <Form.Item
                      label={t('verificationReport:b_projectParticipants')}
                      name={'b_projectParticipants'}
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
                                `${t('verificationReport:b_projectParticipants')} ${t(
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
                        placeholder="Add Project Participants"
                        disabled={disableFields}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('verificationReport:b_appliedMethodologies')}
                      name={'b_appliedMethodologies'}
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
                                `${t('verificationReport:b_appliedMethodologies')} ${t(
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
                        // placeholder="Add Project Participants"
                        disabled={disableFields}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('verificationReport:b_conditionalSectoralScopes')}
                      name={'b_conditionalSectoralScopes'}
                      // rules={[
                      //   {
                      //     required: true,
                      //     message: '',
                      //   },
                      //   {
                      //     validator: async (rule, value) => {
                      //       if (
                      //         String(value).trim() === '' ||
                      //         String(value).trim() === undefined ||
                      //         value === null ||
                      //         value === undefined
                      //       ) {
                      //         throw new Error(
                      //           `${t('verificationReport:b_conditionalSectoralScopes')} ${t(
                      //             'isRequired'
                      //           )}`
                      //         );
                      //       }
                      //     },
                      //   },
                      // ]}
                    >
                      <Input
                        size="large"
                        // placeholder="Add Project Participants"
                        disabled={disableFields}
                      />
                    </Form.Item>

                    <Form.Item
                      label={t('verificationReport:b_certfiedGHGReductions')}
                      name="b_certfiedGHGReductions"
                      rules={[
                        {
                          required: true,
                          message: `${t('verificationReport:b_certfiedGHGReductions')} ${t(
                            'isRequired'
                          )}`,
                        },
                      ]}
                    >
                      <Input size="large" disabled={disableFields} />
                    </Form.Item>
                  </div>
                </Col>

                <Col xl={12} md={24}>
                  <div className="step-form-right-col">
                    <Form.Item
                      label={t('verificationReport:b_unfccRefNo')}
                      name="b_unfccRefNo"
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
                                `${t('verificationReport:b_unfccRefNo')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input size="large" disabled={disableFields} />
                    </Form.Item>

                    <Form.Item
                      label={t('verificationReport:b_versionNoOfVerificationReport')}
                      name="b_versionNoOfVerificationReport"
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
                                `${t('verificationReport:b_versionNoOfVerificationReport')} ${t(
                                  'isRequired'
                                )}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input size="large" disabled={disableFields} />
                    </Form.Item>

                    <Form.Item
                      label={t('verificationReport:b_monitoringPeriodNoAndDuration')}
                      name="b_monitoringPeriodNoAndDuration"
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
                                `${t('verificationReport:b_monitoringPeriodNoAndDuration')} ${t(
                                  'isRequired'
                                )}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input size="large" disabled={disableFields} />
                    </Form.Item>

                    <Form.Item
                      label={t('verificationReport:b_creditingPeriod')}
                      name="b_creditingPeriod"
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
                                `${t('verificationReport:b_creditingPeriod')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input size="large" disabled={disableFields} />
                    </Form.Item>

                    <Form.Item
                      label={t('verificationReport:b_hostParty')}
                      name="b_hostParty"
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
                                `${t('verificationReport:b_hostParty')} ${t('isRequired')}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input size="large" disabled={disableFields} />
                    </Form.Item>

                    <Form.Item
                      label={t('verificationReport:b_mandatorySectoralScopes')}
                      name="b_mandatorySectoralScopes"
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
                                `${t('verificationReport:b_mandatorySectoralScopes')} ${t(
                                  'isRequired'
                                )}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input size="large" disabled={disableFields} />
                    </Form.Item>

                    <Form.Item
                      label={t('verificationReport:b_estimatedGHGEmissionReduction')}
                      name="b_estimatedGHGEmissionReduction"
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
                                `${t('verificationReport:b_estimatedGHGEmissionReduction')} ${t(
                                  'isRequired'
                                )}`
                              );
                            }
                          },
                        },
                      ]}
                    >
                      <Input size="large" disabled={disableFields} />
                    </Form.Item>
                  </div>
                </Col>
              </Row>

              <Row className="row" gutter={[40, 16]}>
                <Col xl={12} md={24}>
                  <h2 className="form-section-title">{`${t('verificationReport:b_approver')}`}</h2>

                  <div className="step-form-left-col">
                    <Form.Item
                      label={t('verificationReport:b_name')}
                      name="b_name"
                      rules={[
                        {
                          required: true,
                          message: `${t('verificationReport:b_name')} ${t('isRequired')}`,
                        },
                      ]}
                    >
                      <Input size="large" disabled={disableFields} />
                    </Form.Item>

                    <Form.Item
                      label={t('verificationReport:b_position')}
                      name="b_position"
                      rules={[
                        {
                          required: true,
                          message: `${t('verificationReport:b_position')} ${t('isRequired')}`,
                        },
                      ]}
                    >
                      <Input size="large" disabled={disableFields} />
                    </Form.Item>

                    <Form.Item
                      label={t('verificationReport:b_signature')}
                      name="b_signature"
                      rules={[
                        {
                          required: true,
                          message: `${t('verificationReport:b_signature')} ${t('isRequired')}`,
                        },
                        {
                          validator: async (rule, file) => {
                            if (file?.length > 0) {
                              if (file[0]?.size > maximumImageSize) {
                                // default size format of files would be in bytes -> 1MB = 1000000bytes
                                throw new Error(`${t('common:maxSizeVal')}`);
                              }
                            }
                          },
                        },
                      ]}
                    >
                      <Upload
                        accept=".doc, .docx, .pdf, .png, .jpg"
                        beforeUpload={(file: any) => {
                          return false;
                        }}
                        className="design-upload-section"
                        name="design"
                        action="/upload.do"
                        listType="picture"
                        multiple={false}
                        maxCount={1}
                      >
                        <Button className="upload-doc" size="large" icon={<UploadOutlined />}>
                          {t('validationReport:upload')}
                        </Button>
                      </Upload>
                    </Form.Item>

                    {/* {FormMode.VIEW === formMode ? (
                      <Form.Item label={t('verificationReport:reportID')} name="reportID">
                        <Input size="large" />
                      </Form.Item>
                    ) : (
                      ''
                    )} */}
                  </div>
                </Col>
              </Row>
              <Row justify={'end'} className="step-actions-end">
                <Button danger size={'large'} onClick={prev} disabled={false}>
                  {t('verificationReport:cancel')}
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

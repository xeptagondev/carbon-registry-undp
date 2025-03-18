import { Button, Col, Form, Input, Row, Upload, DatePicker } from 'antd';
import moment from 'moment';
import TextArea from 'antd/lib/input/TextArea';
import { MinusOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { FormMode } from '../../Definitions/Enums/formMode.enum';
import { useUserContext } from '../../Context/UserInformationContext/userInformationContext';
import { CompanyRole } from '../../Definitions/Enums/company.role.enum';
import { DocumentStatus } from '../../Definitions/Enums/document.status';
import { fileUploadValueExtract } from '../../Utils/utilityHelper';
import { VerificationStepProps } from './StepProps';
import { useEffect } from 'react';

export const AppendixStep = (props: VerificationStepProps) => {
  const { t, current, form, formMode, prev, handleValuesUpdate, next } = props;
  const { userInfoState } = useUserContext();
  const maximumImageSize = process.env.REACT_APP_MAXIMUM_FILE_SIZE
    ? parseInt(process.env.REACT_APP_MAXIMUM_FILE_SIZE)
    : 5000000;
  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  useEffect(() => {
    form.setFieldValue('appendix-documents-reviewed-table', [{ author: '' }]);
  }, []);

  // const onFinish = (values: any) => {
  //   // console.log('--------values-----------', values);
  //   const body = { ...values };
  //   handleValuesUpdate({
  //     certificationStatement: body,
  //   });
  // };

  const onFinish = async (values: any) => {
    const appendixFormValues: any = {
      ...values,
      appendix1Documents: (await fileUploadValueExtract(values, 'appendix1Documents'))[0],
    };

    handleValuesUpdate({ appendix: appendixFormValues });
  };

  return (
    <>
      {current === 10 && (
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
                <Col xl={24} md={24}>
                  <div className="step-form-left-col">
                    {/* appendix 1 start */}
                    <>
                      <h4 className="appendix-title">
                        <i>{t('verificationReport:appendix')} 1 </i>:{' '}
                        {t('verificationReport:appendixTitle1')}
                      </h4>
                      <Form.Item
                        // label={`${t('PDD:additionalComments')}`}
                        name="appendix1Comments"
                        rules={[
                          {
                            required: true,
                            message: ``,
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
                                  `${t('verificationReport:additionalComments')} ${t('isRequired')}`
                                );
                              }
                            },
                          },
                        ]}
                      >
                        <TextArea rows={6} />
                      </Form.Item>

                      <Form.Item
                        label={t('verificationReport:appendix1Documents')}
                        name="appendix1Documents"
                        valuePropName="fileList"
                        getValueFromEvent={normFile}
                        required={false}
                        rules={[
                          {
                            validator: async (rule, file) => {
                              // if (disableFields) return;
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
                          multiple={true}
                          // disabled={disableFields}
                          // maxCount={1}
                        >
                          <Button
                            className="upload-doc"
                            size="large"
                            icon={<UploadOutlined />}
                            // disabled={disableFields}
                          >
                            {t('verificationReport:upload')}
                          </Button>
                        </Upload>
                      </Form.Item>
                    </>
                    {/* appendix 1 end */}

                    {/* appendix 2 starts */}
                    <h4 className="appendix-title">
                      <i>{t('verificationReport:appendix')} 2 </i>:{' '}
                      {t('verificationReport:appendixTitle2')}
                    </h4>
                    {/* document reviewd table */}
                    <div className="appendix-documents-reviewed-table">
                      <Row className="header">
                        <Col xl={1} className="col col-1">
                          No
                        </Col>
                        <Col xl={5} className="col other-cols">
                          Author
                        </Col>
                        <Col xl={5} className="col other-cols">
                          Title
                        </Col>
                        <Col xl={5} className="col other-cols">
                          Reference to the document
                        </Col>
                        <Col xl={5} className="col other-cols">
                          Provider
                        </Col>
                        <Col xl={2}></Col>
                      </Row>

                      <Row className="body">
                        <Form.List name="appendix-documents-reviewed-table">
                          {(fields, { add, remove }) => (
                            <>
                              {fields.map(({ key, name, ...restFields }) => (
                                <>
                                  <Col xl={1} className="col-1 col">
                                    {name + 1 < 10 && '0'}
                                    {name + 1}
                                  </Col>

                                  <Col xl={5} className="col other-cols ">
                                    <Form.Item
                                      name={[name, 'author']}
                                      rules={[
                                        {
                                          required: true,
                                          message: ``,
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
                                                `${t('verificationReport:required')}`
                                              );
                                            }
                                          },
                                        },
                                      ]}
                                    >
                                      <Input className="ant-input" />
                                    </Form.Item>
                                  </Col>

                                  <Col xl={5} className="col other-cols">
                                    <Form.Item
                                      name={[name, 'title']}
                                      rules={[
                                        {
                                          required: true,
                                          message: ``,
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
                                                `${t('verificationReport:required')}`
                                              );
                                            }
                                          },
                                        },
                                      ]}
                                    >
                                      <Input className="ant-input" />
                                    </Form.Item>
                                  </Col>
                                  <Col xl={5} className=" col other-cols">
                                    <Form.Item
                                      name={[name, 'referenceToTheDoc']}
                                      rules={[
                                        {
                                          required: true,
                                          message: ``,
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
                                                `${t('verificationReport:required')}`
                                              );
                                            }
                                          },
                                        },
                                      ]}
                                    >
                                      <Input className="ant-input" />
                                    </Form.Item>
                                  </Col>

                                  <Col xl={5} className="col other-cols ">
                                    <Form.Item
                                      name={[name, 'provider']}
                                      rules={[
                                        {
                                          required: true,
                                          message: ``,
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
                                                `${t('verificationReport:required')}`
                                              );
                                            }
                                          },
                                        },
                                      ]}
                                    >
                                      <Input className="ant-input" />
                                    </Form.Item>
                                  </Col>
                                  <Col xl={3} className="action-col">
                                    <Form.Item>
                                      <Button
                                        onClick={add}
                                        size="small"
                                        className="addMinusBtn"
                                        icon={<PlusOutlined />}
                                      ></Button>
                                    </Form.Item>
                                    {name > 0 && (
                                      <Form.Item>
                                        <Button
                                          // type="dashed"
                                          onClick={() => {
                                            // removeParticipants(name2);
                                            remove(name);
                                          }}
                                          size="small"
                                          className="addMinusBtn"
                                          // block
                                          icon={<MinusOutlined />}
                                          // disabled={disableFields}
                                        >
                                          {/* Minus Participant */}
                                        </Button>
                                      </Form.Item>
                                    )}
                                  </Col>
                                </>
                              ))}
                            </>
                          )}
                        </Form.List>
                      </Row>
                    </div>
                    {/* appendix 2 ends */}
                  </div>
                </Col>
              </Row>

              {/* appendix 3 starts */}
              <Row className="row" gutter={[40, 16]}>
                <Col xl={24} md={24}>
                  <div className="step-form-left-col">
                    <h4 className="appendix-title">
                      <i>{t('verificationReport:appendix')} 3 </i>:{' '}
                      {t('verificationReport:appendixTitle3')}
                    </h4>

                    <h3 className="appendix-title">{t('verificationReport:appendixTitle3.1')}</h3>

                    <div className="form-section">
                      <Row className="row" gutter={[40, 16]}>
                        <Col xl={12} md={24}>
                          <Form.Item
                            label={`${t('verificationReport:farId')}`}
                            name="farId"
                            // rules={[
                            //   {
                            //     required: true,
                            //     message: `${t('verificationReport:farId')} ${t('isRequired')}`,
                            //   },
                            // ]}
                          >
                            <Input
                              size="large"
                              // disabled={FormMode.VIEW === formMode}
                            />
                          </Form.Item>

                          <Form.Item
                            label={`${t('verificationReport:farIdDate')}`}
                            name="farIdDate"
                            // rules={[
                            //   {
                            //     required: true,
                            //     message: `${t('verificationReport:farIdDate')} ${t('isRequired')}`,
                            //   },
                            // ]}
                          >
                            <DatePicker
                              size="large"
                              disabledDate={(currentDate: any) =>
                                currentDate < moment().startOf('day')
                              }
                            />
                          </Form.Item>
                        </Col>
                        <Col xl={12} md={24}>
                          <Form.Item
                            label={`${t('verificationReport:sectionNo')}`}
                            name="sectionNo"
                            // rules={[
                            //   {
                            //     required: true,
                            //     message: `${t('verificationReport:sectionNo')} ${t('isRequired')}`,
                            //   },
                            // ]}
                          >
                            <Input
                              size="large"
                              // disabled={FormMode.VIEW === formMode}
                            />
                          </Form.Item>
                        </Col>
                        <Col xl={24} md={24}>
                          <Form.Item
                            label={`${t('verificationReport:descriptionOfFAR')}`}
                            name="descriptionOfFAR"
                            // rules={[
                            //   {
                            //     required: true,
                            //     message: `${t('verificationReport:descriptionOfFAR')} ${t('isRequired')}`,
                            //   },
                            // ]}
                          >
                            <TextArea
                              rows={4}
                              // disabled={FormMode.VIEW === formMode}
                            />
                          </Form.Item>
                        </Col>
                        <Col xl={12} md={24}>
                          <Form.Item
                            label={`${t('verificationReport:projectParticipantResponse')}`}
                            name="projectParticipantResponse"
                            // rules={[
                            //   {
                            //     required: true,
                            //     message: `${t('verificationReport:projectParticipantResponse')} ${t('isRequired')}`,
                            //   },
                            // ]}
                          >
                            <TextArea
                              rows={4}
                              // disabled={FormMode.VIEW === formMode}
                            />
                          </Form.Item>
                        </Col>
                        <Col xl={12} md={24}>
                          <Form.Item
                            label={`${t('verificationReport:responseDate')}`}
                            name="responseDate"
                            // rules={[
                            //   {
                            //     required: true,
                            //     message: `${t('verificationReport:responseDate')} ${t('isRequired')}`,
                            //   },
                            // ]}
                          >
                            <DatePicker
                              size="large"
                              disabledDate={(currentDate: any) =>
                                currentDate < moment().startOf('day')
                              }
                            />
                          </Form.Item>
                        </Col>
                        <Col xl={24} md={24}>
                          <Form.Item
                            label={`${t('verificationReport:documentationProvided')}`}
                            name="documentationProvided"
                            // rules={[
                            //   {
                            //     required: true,
                            //     message: `${t('verificationReport:documentationProvided')} ${t('isRequired')}`,
                            //   },
                            // ]}
                          >
                            <TextArea
                              rows={4}
                              // disabled={FormMode.VIEW === formMode}
                            />
                          </Form.Item>
                        </Col>
                        <Col xl={12} md={24}>
                          <Form.Item
                            label={`${t('verificationReport:doeAssesment')}`}
                            name="doeAssesment"
                            // rules={[
                            //   {
                            //     required: true,
                            //     message: `${t('verificationReport:doeAssesment')} ${t('isRequired')}`,
                            //   },
                            // ]}
                          >
                            <TextArea
                              rows={4}
                              // disabled={FormMode.VIEW === formMode}
                            />
                          </Form.Item>
                        </Col>
                        <Col xl={12} md={24}>
                          <Form.Item
                            label={`${t('verificationReport:doeDate')}`}
                            name="doeDate"
                            // rules={[
                            //   {
                            //     required: true,
                            //     message: `${t('verificationReport:doeDate')} ${t('isRequired')}`,
                            //   },
                            // ]}
                          >
                            <DatePicker
                              size="large"
                              disabledDate={(currentDate: any) =>
                                currentDate < moment().startOf('day')
                              }
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  </div>
                </Col>
              </Row>

              <Row justify={'end'} className="step-actions-end">
                <Button danger size={'large'} onClick={prev} disabled={false}>
                  {t('verificationReport:back')}
                </Button>
                {FormMode.VIEW !== formMode && (
                  <Button type="primary" size={'large'} htmlType="submit" disabled={false}>
                    {t('verificationReport:submit')}
                  </Button>
                )}
                {FormMode.VIEW === formMode && (
                  <Button type="primary" size={'large'} disabled={false} onClick={next}>
                    {t('verificationReport:backtoProjectDetails')}
                  </Button>
                )}
              </Row>
            </Form>
          </div>
        </div>
      )}
    </>
  );
};

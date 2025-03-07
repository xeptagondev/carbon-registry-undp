import { Button, Col, Form, Row, Upload } from 'antd';

import TextArea from 'antd/lib/input/TextArea';
import { UploadOutlined } from '@ant-design/icons';
import { FormMode } from '../../Definitions/Enums/formMode.enum';
import { CompanyRole } from '../../Definitions/Enums/company.role.enum';
import { useUserContext } from '../../Context/UserInformationContext/userInformationContext';
import { DocumentStatus } from '../../Definitions/Enums/document.status';
import { useState } from 'react';
export const AnnexureStep = (props: any) => {
  const {
    useLocation,
    translator,
    current,
    form,
    formMode,
    prev,
    cancel,
    approve,
    reject,
    onFinish,
    status,
  } = props;
  const [loading, setLoading] = useState(false);
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
  const t = translator.t;

  const handleFormSubmit = async (values: any) => {
    setLoading(true);
    try {
      await onFinish({ annexures: values });
    } finally {
      setLoading(false);
    }
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
              onFinish={handleFormSubmit}
            >
              <h4 className="appendix-title">
                <i>{`${t('monitoringReport:a_appendix')}`}</i>
              </h4>
              <Row className="row" gutter={[40, 16]}>
                <Col xl={24} md={24}>
                  <div className="step-form-left-col">
                    <Form.Item>
                      <TextArea rows={8} disabled={FormMode.VIEW === formMode} />
                    </Form.Item>

                    <Form.Item
                      label={t('monitoringReport:a_uploadDoc')}
                      name="a_uploadDoc"
                      valuePropName="fileList"
                      getValueFromEvent={normFile}
                      required={false}
                      rules={[
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
                      >
                        <Button className="upload-doc" size="large" icon={<UploadOutlined />}>
                          {t('monitoringReport:upload')}
                        </Button>
                      </Upload>
                    </Form.Item>
                  </div>
                </Col>
              </Row>
              <Row className="step-actions-end">
                <Col>
                  <Button onClick={prev} disabled={false}>
                    {t('monitoringReport:back')}
                  </Button>
                </Col>
                <Col offset={20}>
                  <Button danger onClick={cancel} disabled={false}>
                    {t('monitoringReport:cancel')}
                  </Button>
                </Col>
                <Col>
                  <Button type="primary" htmlType="submit" disabled={loading}>
                    <span>{t('monitoringReport:submit')}</span>
                  </Button>
                </Col>
                {/* {userInfoState?.companyRole === CompanyRole.PROGRAMME_DEVELOPER &&
                  FormMode.VIEW !== formMode && (
                    <Button type="primary" htmlType="submit" disabled={loading}>
                      <span>{t('monitoringReport:submit')}</span>
                    </Button>
                  )} */}

                {/* {userInfoState?.companyRole === CompanyRole.CLIMATE_FUND &&
                  status === DocumentStatus.PENDING && (
                    <Button danger onClick={reject} disabled={false}>
                      <span>{t('monitoringReport:reject')}</span>
                    </Button>
                  )}
                {userInfoState?.companyRole === CompanyRole.CLIMATE_FUND &&
                  status === DocumentStatus.PENDING && (
                    <Button type="primary" onClick={approve} disabled={false}>
                      <span>{t('monitoringReport:approve')}</span>
                    </Button>
                  )} */}
              </Row>
            </Form>
          </div>
        </div>
      )}
    </>
  );
};

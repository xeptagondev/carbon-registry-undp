import { Button, Col, Form, Row } from 'antd';

import TextArea from 'antd/lib/input/TextArea';
import { FormMode } from '../../Definitions/Enums/formMode.enum';

export const ImplementationOfProjectActivityStep = (props: any) => {
  const { useLocation, translator, current, form, formMode, next, prev, onValueChange } = props;

  const t = translator.t;
  return (
    <>
      {current === 2 && (
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
                onValueChange({ implementationStatus: values });
                next();
              }}
            >
              <Row className="row" gutter={[40, 16]}>
                <Col xl={24} md={24}>
                  <div className="step-form-left-col">
                    <Form.Item
                      label={`${t('monitoringReport:io_descriptionOfPA')}`}
                      name="io_descriptionOfPA"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:io_descriptionOfPA')} ${t('isRequired')}`,
                        },
                      ]}
                    >
                      <TextArea rows={5} disabled={FormMode.VIEW === formMode} />
                    </Form.Item>

                    <Form.Item
                      label={`${t('monitoringReport:io_postRegistrationChanges')}`}
                      name="io_postRegistrationChanges"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:io_postRegistrationChanges')} ${t(
                            'isRequired'
                          )}`,
                        },
                      ]}
                    >
                      <TextArea rows={5} disabled={FormMode.VIEW === formMode} />
                    </Form.Item>

                    <Form.Item
                      label={`${t('monitoringReport:io_tempDeviations')}`}
                      name="io_tempDeviations"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:io_tempDeviations')} ${t('isRequired')}`,
                        },
                      ]}
                    >
                      <TextArea rows={5} disabled={FormMode.VIEW === formMode} />
                    </Form.Item>

                    <Form.Item
                      label={`${t('monitoringReport:io_corrections')}`}
                      name="io_corrections"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:io_corrections')} ${t('isRequired')}`,
                        },
                      ]}
                    >
                      <TextArea rows={5} disabled={FormMode.VIEW === formMode} />
                    </Form.Item>

                    <Form.Item
                      label={`${t('monitoringReport:io_changesToTheStartDate')}`}
                      name="io_changesToTheStartDate"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:io_changesToTheStartDate')} ${t(
                            'isRequired'
                          )}`,
                        },
                      ]}
                    >
                      <TextArea rows={5} disabled={FormMode.VIEW === formMode} />
                    </Form.Item>

                    <Form.Item
                      label={`${t('monitoringReport:io_inclusionOfMP')}`}
                      name="io_inclusionOfMP"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:io_inclusionOfMP')} ${t('isRequired')}`,
                        },
                      ]}
                    >
                      <TextArea rows={5} disabled={FormMode.VIEW === formMode} />
                    </Form.Item>

                    <Form.Item
                      label={`${t('monitoringReport:io_changesToProjectDesign')}`}
                      name="io_changesToProjectDesign"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:io_changesToProjectDesign')} ${t(
                            'isRequired'
                          )}`,
                        },
                      ]}
                    >
                      <TextArea rows={5} disabled={FormMode.VIEW === formMode} />
                    </Form.Item>

                    <Form.Item
                      label={`${t(
                        'monitoringReport:io_changesSpecificToAfforestrationOrReforestration'
                      )}`}
                      name="io_changesSpecificToAfforestrationOrReforestration"
                      rules={[
                        {
                          required: true,
                          message: `${t(
                            'monitoringReport:io_changesSpecificToAfforestrationOrReforestration'
                          )} ${t('isRequired')}`,
                        },
                      ]}
                    >
                      <TextArea rows={5} disabled={FormMode.VIEW === formMode} />
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

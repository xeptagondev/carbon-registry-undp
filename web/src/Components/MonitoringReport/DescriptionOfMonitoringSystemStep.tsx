import { Button, Col, Form, Row } from 'antd';

import TextArea from 'antd/lib/input/TextArea';
import { FormMode } from '../../Definitions/Enums/formMode.enum';
import LabelWithTooltip, { TooltipPostion } from '../LabelWithTooltip/LabelWithTooltip';

export const DescriptionOfMSStep = (props: any) => {
  const { useLocation, translator, current, form, formMode, next, prev, onValueChange } = props;

  const t = translator.t;
  return (
    <>
      {current === 3 && (
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
                onValueChange({ safeguards: values });
                next();
              }}
            >
              <Row className="row" gutter={[40, 16]}>
                <Col xl={24} md={24}>
                  <div className="step-form-left-col">
                    <Form.Item
                      label={`${t('monitoringReport:do_descriptionOfMonitoringSystem')}`}
                      name="do_descriptionOfMonitoringSystem"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:do_descriptionOfMonitoringSystem')} ${t(
                            'isRequired'
                          )}`,
                        },
                      ]}
                    >
                      <TextArea rows={6} disabled={FormMode.VIEW === formMode} />
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

import React, { FC, useContext, useEffect, useState } from 'react';
import './login.scss';
import { Button, Col, Form, Input, Row, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useConnection } from '../../Context/ConnectionContext/connectionContext';
import { API_PATHS } from '../../Config/apiConfig';
import { ROUTES } from '../../Config/uiRoutingConfig';

// eslint-disable-next-line no-duplicate-imports
import { Tooltip } from 'antd';
import { InfoCircle } from 'react-bootstrap-icons';

export interface ResetPasswordPageProps {
  forgotPassword?: boolean;
}

// Hedera password validation function
const validateHederaPassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must include at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const ResetPassword: FC<ResetPasswordPageProps> = (props: ResetPasswordPageProps) => {
  const { i18n, t } = useTranslation(['common', 'resetPassword']);
  const [resetPasswordForm] = Form.useForm();
  const { put } = useConnection();
  const navigate = useNavigate();
  const { requestid } = useParams();
  const queryParameters = new URLSearchParams(window.location.search);
  const [loading, setLoading] = useState<boolean>(false);
  const [disable, setDisable] = useState<boolean>(false);
  const [resetError, setResetError] = useState<boolean>(false);
  const [passwordValidationErrors, setPasswordValidationErrors] = useState<string[]>([]);

  const onSubmit = async (values: any) => {
    try {
      setLoading(true);
      setResetError(false);

      if (!requestid) {
        throw new Error('Request ID is missing');
      }
      // Double-check password validation before submission
      const passwordValidation = validateHederaPassword(values.password);
      if (!passwordValidation.isValid) {
        setPasswordValidationErrors(passwordValidation.errors);
        message.error('Please fix password validation errors before submitting');
        return;
      }

      const response: any = await put(API_PATHS.RESET_PW(requestid), {
        newPassword: values.password,
      });

      if (response.status === 200 || response.status === 201) {
        message.open({
          type: 'success',
          content: response.message,
          duration: 3,
          style: { textAlign: 'right', marginRight: 15, marginTop: 10 },
        });
        navigate(ROUTES.LOGIN);
      } else {
        setResetError(true);
      }
    } catch (exception: any) {
      setResetError(true);
      console.log('error while resetting password -- ', exception);

      // Check if the error is related to password validation from backend
      if (exception.response?.data?.message?.includes('password')) {
        message.error('Password does not meet security requirements');
      }
    } finally {
      setLoading(false);
    }
  };

  const onClickBacktoSignIn = () => {
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const passwordRequirementsTooltip = (
    <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Password must contain:</div>
      <ul style={{ margin: 0, paddingLeft: '16px' }}>
        <li>At least 8 characters</li>
        <li>At least one uppercase letter</li>
        <li>At least one lowercase letter</li>
        <li>At least one number</li>
      </ul>
    </div>
  );

  return (
    <div className="reset-password-container">
      <Row>
        <Col lg={{ span: 18, offset: 3 }} md={24} flex="auto">
          <div className="login-text-contents">
            <span className="login-text-signin">{t('resetPassword:reset-pwd-title')}</span>
          </div>
        </Col>
      </Row>
      <Row>
        <Col lg={{ span: 18, offset: 3 }} md={{ span: 18 }} flex="fill">
          <div className="login-input-fields-container login-input-fields">
            <Form
              form={resetPasswordForm}
              layout="vertical"
              onFinish={onSubmit}
              name="login-details"
              requiredMark={false}
            >
              <Form.Item
                name="password"
                label={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{t('resetPassword:newPwd')}</span>
                    <Tooltip
                      title={passwordRequirementsTooltip}
                      placement="topRight"
                      trigger="hover"
                      overlayStyle={{ maxWidth: '300px' }}
                    >
                      <InfoCircle color="#1890ff" size={16} style={{ cursor: 'help' }} />
                    </Tooltip>
                  </div>
                }
                rules={[
                  {
                    required: true,
                    message: `New Password ${t('common:isRequired')}`,
                  },
                  {
                    validator: async (rule, value) => {
                      const validation = validateHederaPassword(value);
                      if (!validation.isValid) {
                        setPasswordValidationErrors(validation.errors);
                        throw new Error('');
                      } else {
                        setPasswordValidationErrors([]);
                      }
                    },
                  },
                ]}
              >
                <div className="login-input-password">
                  <Input.Password type="password" />
                </div>
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                className="confirm-password"
                label={`${t('resetPassword:confirmNewPwd')}`}
                rules={[
                  {
                    validator: async (rule, value) => {
                      if (!value || String(value).trim() === '') {
                        throw new Error(`Confirm New Password ${t('common:isRequired')}`);
                      }

                      const password = resetPasswordForm.getFieldValue('password');
                      if (password && password !== value) {
                        throw new Error(`${t('resetPassword:passwordNotMatch')}`);
                      }
                    },
                  },
                ]}
              >
                <div className="login-input-password">
                  <Input.Password type="password" />
                </div>
              </Form.Item>
              {passwordValidationErrors.length > 0 && (
                <div
                  className="password-validation-errors"
                  style={{
                    backgroundColor: '#fff2f0',
                    border: '1px solid #ffccc7',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ color: '#ff4d4f', fontWeight: 'bold', marginBottom: '4px' }}>
                    Password Requirements Not Met:
                  </div>
                  {passwordValidationErrors.map((error, index) => (
                    <div key={index} style={{ color: '#ff4d4f', fontSize: '12px' }}>
                      • {error}
                    </div>
                  ))}
                </div>
              )}
              <Form.Item>
                <div className="login-submit-btn-container">
                  <Button
                    type="primary"
                    size="large"
                    htmlType="submit"
                    block
                    loading={loading || disable}
                  >
                    {t('resetPassword:submit')}
                  </Button>
                </div>
              </Form.Item>
              {resetError && (
                <div className="logged-out-section">
                  <div className="info-icon">
                    <ExclamationCircleOutlined
                      style={{
                        color: 'rgba(255, 77, 79, 0.8)',
                        marginRight: '0.5rem',
                        fontSize: '1.1rem',
                      }}
                    />
                  </div>
                  <div className="msg">{t('resetPassword:passwordResetNotWorked')}</div>
                </div>
              )}

              <div className="bottom-forgot-password-section">
                {t('common:backto')}&nbsp;
                <span onClick={() => onClickBacktoSignIn()} className="backto-signin-txt">
                  {t('common:signIn')}
                </span>
              </div>
            </Form>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default ResetPassword;

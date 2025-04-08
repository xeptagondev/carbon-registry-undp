import { Row, Col, Card, Button, Skeleton, Tooltip } from 'antd';
import { UserOutlined, BankOutlined } from '@ant-design/icons';
import * as Icon from 'react-bootstrap-icons';
import './userProfileComponent.scss';
import { useEffect, useState } from 'react';
import { useConnection } from '../../../Context/ConnectionContext/connectionContext';
import { useUserContext } from '../../../Context/UserInformationContext/userInformationContext';
import LanguageSelection from '../../LanguageSelection/languageSelection';
import { UserRoleIcon } from '../../IconComponents/UserRoleIcon/userRoleIcon';
import { CompanyDetailsComponent } from '../../Company/CompanyDetails/companyDetailsComponent';
import { API_PATHS } from '../../../Config/apiConfig';
import { thousandBasedFormatterWithDecimalPlaces } from '../../../Utils/utilityHelper';

export const UserProfileComponent = (props: any) => {
  const { t, i18n, onNavigateUpdateUser, onNavigateLogin } = props;
  const { get } = useConnection();
  const { userInfoState } = useUserContext();
  const [organisationDetails, setOrganisationDetails] = useState<any>(undefined);
  const [userDetails, setUserDetails] = useState<any>(undefined);
  const { updateToken, updateRefreshToken } = useConnection();
  const { removeUserInfo } = useUserContext();
  const [isLoading, setIsLoading] = useState(false);
  const [orgHederaBalance, setOrgHederaBalance] = useState<string>('0.00');
  const [userHederaBalance, setUserHederaBalance] = useState<string>('0.00');

  const signOut = (): void => {
    updateToken();
    updateRefreshToken();
    removeUserInfo();
    onNavigateLogin();
  };

  const getUserProfileDetails = async () => {
    try {
      setIsLoading(true);
      const [orgBalanceResponse, userBalanceResponse, response] = await Promise.all([
        get(API_PATHS.ORGANIZATION_HBAR_BALANCE),
        get(API_PATHS.USER_HBAR_BALANCE),
        get(API_PATHS.USER_PROFILE_DETAILS),
      ]);

      if (response.data) {
        setOrganisationDetails(response.data.Organisation);
        setUserDetails(response.data.user);
        setIsLoading(false);
      }

      if (orgBalanceResponse && userBalanceResponse) {
        const formattedOrgBalance = thousandBasedFormatterWithDecimalPlaces(
          2,
          Number(orgBalanceResponse.data)
        );
        const formattedUserBalance = thousandBasedFormatterWithDecimalPlaces(
          2,
          Number(userBalanceResponse.data)
        );

        setOrgHederaBalance(`${formattedOrgBalance.number}${formattedOrgBalance.suffix}`);
        setUserHederaBalance(`${formattedUserBalance.number}${formattedUserBalance.suffix}`);
      }
      //console.log('---------profile details--------', response);
    } catch (exception) {}
  };
  useEffect(() => {
    getUserProfileDetails();
  }, []);

  return (
    <div className="content-container user-profile">
      <Row>
        <Col md={24} lg={8}>
          <div className="title-bar">
            <div>
              <div className="body-title">{t('userProfile:title')}</div>
            </div>
          </div>
        </Col>
        <Col md={24} lg={16}>
          <Row justify="end">
            <Button className="mg-left-1 btn-danger mg-bottom-1" onClick={() => signOut()}>
              {t('userProfile:logOut')}
            </Button>
            {userDetails && organisationDetails && (
              <Button
                className="mg-left-1 mg-bottom-1"
                type="primary"
                onClick={() => {
                  onNavigateUpdateUser(organisationDetails, userDetails);
                }}
              >
                {t('userProfile:edit')}
              </Button>
            )}
            <LanguageSelection i18n={i18n}></LanguageSelection>
          </Row>
        </Col>
      </Row>

      {(!userDetails || !organisationDetails) && (
        <div className="content-body">
          <Skeleton active loading={true}></Skeleton>
        </div>
      )}
      {userDetails && organisationDetails && (
        <div className="content-body">
          <Row gutter={16}>
            <Col md={24} lg={8}>
              <Card className="card-container">
                <Row justify="center">
                  <Skeleton loading={isLoading} active>
                    <img className="profile-img" alt="profile-img" src={organisationDetails.logo} />
                  </Skeleton>
                </Row>
                <Row justify="center">
                  <div className=" company-name mg-top-1">{organisationDetails.name}</div>
                </Row>
              </Card>
            </Col>
            <Col md={24} lg={16}>
              <Card className="card-container">
                <div className="info-view">
                  <div className="title">
                    <span className="title-icon">
                      <UserOutlined />
                    </span>
                    <span className="title-text">{t('userProfile:userDetailsHeading')}</span>
                  </div>
                  <Skeleton loading={isLoading} active>
                    <Row className="field">
                      <Col span={12} className="field-key">
                        {t('userProfile:name')}
                      </Col>
                      <Col span={12} className="field-value">
                        {userDetails.name ? userDetails.name : '-'}
                      </Col>
                    </Row>
                    <Row className="field">
                      <Col span={12} className="field-key">
                        {t('userProfile:email')}
                      </Col>
                      <Col span={12} className="field-value nextline-overflow">
                        {userDetails.email ? userDetails.email : '-'}
                      </Col>
                    </Row>
                    <Row className="field">
                      <Col span={12} className="field-key">
                        {t('userProfile:role')}
                      </Col>
                      <Col span={12} className="field-value">
                        <UserRoleIcon role={userDetails.role} />
                      </Col>
                    </Row>
                    <Row className="field">
                      <Col span={12} className="field-key">
                        {t('userProfile:phoneNo')}
                      </Col>
                      <Col span={12} className="field-value">
                        {userDetails.phoneNo ? userDetails.phoneNo : '-'}
                      </Col>
                    </Row>
                  </Skeleton>
                </div>
              </Card>
              <CompanyDetailsComponent
                t={t}
                companyDetails={organisationDetails}
                userDetails={userDetails}
                isLoading={isLoading}
                regionField
              />
              <Card className="card-container">
                <Col className="info-view">
                  <div className="title">
                    <span className="title-icon">
                      <Icon.CreditCard />
                    </span>
                    <span className="title-text">{t('hbarCredits')}</span>
                  </div>
                  <Row className="field">
                    <Tooltip
                      placement="topLeft"
                      title={`Account ID: ${userInfoState?.organizationHederaAccount || 'N/A'}`}
                    >
                      <Col span={12} className="field-key">
                        {t('organizationRemaining')}
                      </Col>
                    </Tooltip>
                    <Col span={12} className="field-value">
                      {orgHederaBalance} Hbar
                    </Col>
                  </Row>
                  <Row className="field">
                    <Tooltip
                      placement="topLeft"
                      title={`Account ID: ${userInfoState?.userHederaAccount || 'N/A'}`}
                    >
                      <Col span={12} className="field-key">
                        {t('userRemaining')}
                      </Col>
                    </Tooltip>
                    <Col span={12} className="field-value">
                      {userHederaBalance} Hbar
                    </Col>
                  </Row>
                </Col>
              </Card>
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
};

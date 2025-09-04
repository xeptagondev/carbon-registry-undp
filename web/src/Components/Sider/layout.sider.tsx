import { useEffect, useState } from 'react';
import { Menu, Layout, MenuProps, Col, Row, Tooltip } from 'antd';
import logo from '../../Assets/Images/logo_Gold.png';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './layout.sider.scss';
import * as Icon from 'react-bootstrap-icons';
import {
  AppstoreOutlined,
  DashboardOutlined,
  SettingOutlined,
  ShopOutlined,
  SplitCellsOutlined,
  UnorderedListOutlined,
  UserOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { LayoutSiderProps } from '../../Definitions/Definitions/layout.sider.definitions';
import { useUserContext } from '../../Context/UserInformationContext/userInformationContext';
import { CompanyRole } from '../../Definitions/Enums/company.role.enum';
import { ROUTES } from '../../Config/uiRoutingConfig';
import { COLOR_CONFIGS } from '../../Config/colorConfigs';
import { thousandBasedFormatterWithDecimalPlaces } from '../../Utils/utilityHelper';
import { useConnection } from '../../Context/ConnectionContext/connectionContext';
import { API_PATHS } from '../../Config/apiConfig';
import { Role } from '../../Definitions/Enums/role.enum';

const { Sider } = Layout;

type MenuItem = {
  key: React.Key;
  icon?: React.ReactNode;
  label: React.ReactNode;
  children?: MenuItem[];
} | null;

function getItem(
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[]
): MenuItem {
  return {
    key,
    icon,
    children,
    label,
  } as MenuItem;
}

const LayoutSider = (props: LayoutSiderProps) => {
  const { selectedKey } = props;
  const navigate = useNavigate();
  const { get } = useConnection();
  const { userInfoState } = useUserContext();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [selectKey, setSelectKey] = useState<any>(selectedKey);
  const { t } = useTranslation(['nav']);
  const [orgHederaBalance, setOrgHederaBalance] = useState<string>('0.00');
  const [userHederaBalance, setUserHederaBalance] = useState<string>('0.00');
  const currentPage = location.pathname.replace(/^\/|\/$/g, '');

  const items: MenuItem[] = [
    getItem(t('nav:dashboard'), 'dashboard', <DashboardOutlined />),
    getItem(t('nav:projectList'), 'programmeManagement/viewAll', <UnorderedListOutlined />),
    // getItem(t('nav:programmes'), 'programmeManagement/viewAll', <AppstoreOutlined />),
    // getItem(t('nav:cdmTransitionProjects'), 'cdmManagement/viewAll', <UnorderedListOutlined />),
    // getItem(t('nav:verra'), 'verraManagement/viewAll', <AppstoreOutlined />),
    // getItem(t('nav:goldStandards'), 'goldStandardManagement/viewAll', <AppstoreOutlined />),
    // getItem(t('nav:ndcActions'), 'ndcManagement/viewAll', <Icon.Clipboard2Data />),
    // getItem(t('nav:investments'), 'investmentManagement/viewAll', <Icon.Cash />),
    // getItem(t('nav:transfers'), 'creditTransfers/viewAll', <Icon.ArrowLeftRight />),
    // getItem(t('nav:companies'), 'companyManagement/viewAll', <ShopOutlined />),
    // getItem(t('nav:users'), 'userManagement/viewAll', <UserOutlined />),
  ];
  if (
    userInfoState?.companyRole === CompanyRole.DESIGNATED_NATIONAL_AUTHORITY ||
    userInfoState?.companyRole === CompanyRole.PROJECT_DEVELOPER
  ) {
    items.splice(
      3,
      0,
      getItem(t('nav:credits'), 'credits', <AppstoreOutlined />, [
        getItem(t('nav:creditBalance'), 'credits/balance', <Icon.Wallet2 />),
        getItem(t('nav:transfers'), 'credits/transfers', <SwapOutlined />),
        getItem(t('nav:retirements'), 'credits/retirements', <Icon.ClockHistory />),
      ])
    );
  }
  if (
    userInfoState?.companyRole === CompanyRole.DESIGNATED_NATIONAL_AUTHORITY &&
    (userInfoState?.userRole === Role.Admin || userInfoState?.userRole === Role.Root)
  ) {
    items.splice(3, 0, getItem(t('nav:reports'), 'reports', <Icon.ClipboardData />));
  }
  {
    items.push(getItem(t('nav:companies'), 'companyManagement/viewAll', <ShopOutlined />));
  }
  {
    items.push(getItem(t('nav:users'), 'userManagement/viewAll', <UserOutlined />));
  }

  useEffect(() => {
    let isCancelled = false;
    let timeoutId: any;

    const fetchData = async () => {
      try {
        const [orgBalanceResponse, userBalanceResponse] = await Promise.all([
          get(API_PATHS.ORGANIZATION_HBAR_BALANCE),
          get(API_PATHS.USER_HBAR_BALANCE),
        ]);

        if (orgBalanceResponse && userBalanceResponse) {
          const formattedOrgBalance = thousandBasedFormatterWithDecimalPlaces(
            2,
            Number(orgBalanceResponse.data)
          );
          const formattedUserBalance = thousandBasedFormatterWithDecimalPlaces(
            2,
            Number(userBalanceResponse.data)
          );

          if (!isCancelled) {
            setOrgHederaBalance(`${formattedOrgBalance.number}${formattedOrgBalance.suffix}`);
            setUserHederaBalance(`${formattedUserBalance.number}${formattedUserBalance.suffix}`);
          }
        } else if (!isCancelled) {
          setOrgHederaBalance('0.00');
          setUserHederaBalance('0.00');
        }
      } catch (error) {
        if (!isCancelled) {
          setOrgHederaBalance('0.00');
          setUserHederaBalance('0.00');
        }
      } finally {
        if (!isCancelled) {
          timeoutId = setTimeout(fetchData, 10000);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    setSelectKey(currentPage);
  }, [currentPage]);

  // if (
  //   userInfoState?.userRole === Role.Root ||
  //   (userInfoState?.companyRole === CompanyRole.GOVERNMENT &&
  //     userInfoState?.userRole === Role.Admin)
  // ) {
  //   items.splice(
  //     1,
  //     0,
  //     getItem(t('nav:nationalAccounting'), 'nationalAccounting', <Icon.GraphUpArrow />)
  //   );
  // }

  // if (userInfoState?.companyRole !== CompanyRole.PROGRAMME_DEVELOPER) {
  //   items.splice(
  //     4,
  //     0,
  //     getItem(t('nav:programmes'), 'programmeManagement/viewAll', <AppstoreOutlined />),
  //     getItem(t('nav:cdmTransitionProjects'), 'cdmManagement/viewAll', <UnorderedListOutlined />),
  //     getItem(t('nav:verra'), 'verraManagement/viewAll', <AppstoreOutlined />),
  //     getItem(t('nav:goldStandards'), 'goldStandardManagement/viewAll', <AppstoreOutlined />)
  //   );
  // }

  // if (userInfoState?.userRole === Role.Root) {
  //   items.push(getItem(t('nav:settings'), 'settings', <SettingOutlined />));
  // }

  const onClick: MenuProps['onClick'] = (e: { key: string }) => {
    navigate('/' + e.key);
  };
  return (
    <Sider
      width={240}
      className="layout-sider-container"
      breakpoint={collapsed ? undefined : 'lg'}
      collapsed={collapsed}
    >
      <div className="layout-sider-div-container">
        <div
          className="layout-sider-heading-container"
          onClick={() => navigate(ROUTES.DASHBOARD, { replace: true })}
        >
          <div className="logo">
            <img src={logo} alt="slider-logo" />
          </div>
          {!collapsed && (
            <div>
              <div>
                <div className="title">{collapsed ? '' : 'IMPACT REGISTRY'}</div>
              </div>
              <div className="country-name">
                {'Gold Standard'}
                {/* {process.env.REACT_APP_COUNTRY_NAME || 'Gold Standard'} */}
              </div>
            </div>
          )}
        </div>
        <div className="layout-sider-menu-container">
          <Menu
            theme="light"
            selectedKeys={[
              selectedKey ? selectedKey : !selectedKey && selectKey ? selectKey : 'dashboard',
            ]}
            mode="inline"
            onClick={onClick}
          >
            {items.map((item) =>
              item?.children ? (
                <Menu.SubMenu key={item.key} icon={item.icon} title={item.label}>
                  {item.children.map((child) => (
                    <Menu.Item key={child?.key} icon={child?.icon}>
                      <Link to={`/${child?.key}`}>{child?.label}</Link>
                    </Menu.Item>
                  ))}
                </Menu.SubMenu>
              ) : (
                <Menu.Item
                  key={item?.key}
                  icon={item?.icon}
                  className={
                    item?.key === 'ndcManagement/viewAll' ||
                    item?.key === 'investmentManagement/viewAll' ||
                    item?.key === 'retirementManagement/viewAll' ||
                    item?.key === 'creditTransfers/viewAll'
                      ? 'custom-padding-left'
                      : item?.key === 'cdmManagement/viewAll'
                      ? 'custom-padding-left wrap-content-overflow'
                      : ''
                  }
                  disabled={
                    // item?.key === 'programmeManagement/viewAll' ||
                    item?.key === 'cdmManagement/viewAll' ||
                    item?.key === 'goldStandardManagement/viewAll' ||
                    item?.key === 'verraManagement/viewAll'
                  }
                >
                  <Link to={`/${item?.key}`}>{item?.label}</Link>
                </Menu.Item>
              )
            )}
          </Menu>
        </div>
      </div>
      {/* Removing the Toggle Bar */}
      {/* <div
        className="toggle-nav-btn"
        onClick={() => {
          setCollapsed(!collapsed);
        }}
      >
        {collapsed ? <Icon.ArrowRight /> : <Icon.ArrowLeft />}
      </div> */}
      <Col style={{ marginLeft: 23 }} className="hedera-balance">
        <Row style={{ marginBottom: 10 }} justify={'start'} align={'middle'}>
          <Icon.CreditCard size={17} color="black" />
          <span style={{ marginLeft: 10, fontWeight: 500 }}>{t('hbarCreditsBalance')}</span>
        </Row>
        <Row
          style={{ marginLeft: 30, marginBottom: 10, paddingRight: 10 }}
          justify={'space-between'}
          align={'middle'}
        >
          <Tooltip
            placement="topLeft"
            title={`Account ID: ${userInfoState?.organizationHederaAccount || 'N/A'}`}
          >
            <span style={{ cursor: 'pointer' }}>{t('organization')}</span>
          </Tooltip>
          <span style={{ color: `${COLOR_CONFIGS.PRIMARY_THEME_COLOR}` }}>
            {orgHederaBalance} Hbar
          </span>
        </Row>
        <Row
          style={{ marginLeft: 30, marginBottom: 10, paddingRight: 10 }}
          justify={'space-between'}
          align={'middle'}
        >
          <Tooltip
            placement="topLeft"
            title={`Account ID: ${userInfoState?.userHederaAccount || 'N/A'}`}
          >
            <span style={{ cursor: 'pointer' }}>{t('user')}</span>
          </Tooltip>
          <span style={{ color: `${COLOR_CONFIGS.PRIMARY_THEME_COLOR}` }}>
            {userHederaBalance} Hbar
          </span>
        </Row>
      </Col>
    </Sider>
  );
};

export default LayoutSider;

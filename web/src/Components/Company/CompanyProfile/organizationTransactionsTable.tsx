import { SwapOutlined } from '@ant-design/icons';
import { Card, Empty, Row, Table, Tag, Tooltip } from 'antd';
import moment from 'moment';
import { useMemo } from 'react';
import '../../../Styles/common.table.scss';
import { addCommSep } from '../../../Definitions/Definitions/programme.definitions';
import { ProfileIcon } from '../../IconComponents/ProfileIcon/profile.icon';

export enum OrganizationTransactionStatus {
  ISSUED = 'Issued',
  TRANSFERRED = 'Transferred',
  RECEIVED = 'Received',
  RETIRED = 'Retired',
}

export interface OrganizationTransactionInterface {
  id: number;
  projectName: string;
  serialNumber: string;
  currentStatus: OrganizationTransactionStatus;
  senderName?: string | null;
  senderLogo?: string | null;
  receiverName?: string | null;
  receiverLogo?: string | null;
  updatedDate: string;
  creditAmount: number;
}

const compareStrings = (a?: string | null, b?: string | null) => (a ?? '').localeCompare(b ?? '');
const compareNumbers = (a?: number | null, b?: number | null) => (a ?? 0) - (b ?? 0);

const getTransactionStatusTagColor = (status: OrganizationTransactionStatus) => {
  switch (status) {
    case OrganizationTransactionStatus.ISSUED:
      return 'processing';
    case OrganizationTransactionStatus.TRANSFERRED:
      return 'purple';
    case OrganizationTransactionStatus.RECEIVED:
      return 'success';
    case OrganizationTransactionStatus.RETIRED:
      return 'warning';
    default:
      return 'default';
  }
};

// TODO: remove once the organisation-transactions backend endpoint returns data.
const DUMMY_ORGANIZATION_TRANSACTIONS: OrganizationTransactionInterface[] = [
  {
    id: 1,
    projectName: 'Solar Mini-Grid Rollout',
    serialNumber: 'CA0001-NG-CH-101-1-1000-2024',
    currentStatus: OrganizationTransactionStatus.ISSUED,
    senderName: null,
    senderLogo: null,
    receiverName: null,
    receiverLogo: null,
    updatedDate: String(moment('2023-11-02 10:15').valueOf()),
    creditAmount: 1000,
  },
  {
    id: 2,
    projectName: 'Reforestation Programme',
    serialNumber: 'CA0002-NG-CH-102-1-500-2024',
    currentStatus: OrganizationTransactionStatus.TRANSFERRED,
    senderName: 'EcoForest Corp',
    senderLogo: null,
    receiverName: 'Buyer Co',
    receiverLogo: null,
    updatedDate: String(moment('2024-01-20 08:30').valueOf()),
    creditAmount: 200,
  },
  {
    id: 3,
    projectName: 'Clean Cookstove Initiative',
    serialNumber: 'CA0003-NG-CH-103-1501-2500-2024',
    currentStatus: OrganizationTransactionStatus.RECEIVED,
    senderName: 'Origin Developer',
    senderLogo: null,
    receiverName: null,
    receiverLogo: null,
    updatedDate: String(moment('2023-10-11 09:05').valueOf()),
    creditAmount: 1000,
  },
  {
    id: 4,
    projectName: 'Wind Farm Expansion',
    serialNumber: 'CA0004-NG-CH-104-401-750-2024',
    currentStatus: OrganizationTransactionStatus.RETIRED,
    senderName: 'Windward Energy',
    senderLogo: null,
    receiverName: null,
    receiverLogo: null,
    updatedDate: String(moment('2023-09-30 15:12').valueOf()),
    creditAmount: 350,
  },
  {
    id: 5,
    projectName: 'Hydro Micro-Grid Cluster',
    serialNumber: 'CA0005-NG-CH-105-1-1000-2024',
    currentStatus: OrganizationTransactionStatus.ISSUED,
    senderName: null,
    senderLogo: null,
    receiverName: null,
    receiverLogo: null,
    updatedDate: String(moment('2024-01-05 09:12').valueOf()),
    creditAmount: 1000,
  },
  {
    id: 6,
    projectName: 'Hydro Micro-Grid Cluster',
    serialNumber: 'CA0005-NG-CH-105-1-1000-2024',
    currentStatus: OrganizationTransactionStatus.TRANSFERRED,
    senderName: 'Riverbend Power',
    senderLogo: null,
    receiverName: 'Project Developer 1',
    receiverLogo: null,
    updatedDate: String(moment('2024-02-10 14:30').valueOf()),
    creditAmount: 400,
  },
];

interface OrganizationTransactionsTableProps {
  t: (key: string) => string;
}

export const OrganizationTransactionsTable = ({ t }: OrganizationTransactionsTableProps) => {
  // TODO: no organisation-transactions backend endpoint exists yet — sorting
  // the dummy data client-side (latest first) so the table renders the
  // expected order until this is swapped for a real API_PATHS query
  // (page/size/sort by updatedDate DESC, filtered by the current companyId).
  const tableData = useMemo(
    () =>
      [...DUMMY_ORGANIZATION_TRANSACTIONS].sort(
        (a, b) => Number(b.updatedDate) - Number(a.updatedDate)
      ),
    []
  );

  const renderOrganization = (name?: string | null, logo?: string | null) => {
    if (!name) {
      return <span>-</span>;
    }
    return (
      <Row justify="center" align="middle">
        <Tooltip title={name}>
          <span>
            <ProfileIcon icon={logo ?? null} bg={'rgba(185, 226, 244, 0.56)'} name={name} />
          </span>
        </Tooltip>
      </Row>
    );
  };

  const columns = [
    {
      title: t('companyProfile:projectName'),
      key: 'projectName',
      sorter: (a: OrganizationTransactionInterface, b: OrganizationTransactionInterface) =>
        compareStrings(a.projectName, b.projectName),
      align: 'left' as const,
      render: (record: OrganizationTransactionInterface) => <span>{record.projectName}</span>,
    },
    {
      title: t('companyProfile:serialNo'),
      key: 'serialNumber',
      align: 'left' as const,
      render: (record: OrganizationTransactionInterface) => <span>{record.serialNumber}</span>,
    },
    {
      title: t('companyProfile:currentStatus'),
      key: 'currentStatus',
      align: 'center' as const,
      render: (record: OrganizationTransactionInterface) => (
        <Tag color={getTransactionStatusTagColor(record.currentStatus)}>
          {t(record.currentStatus)}
        </Tag>
      ),
    },
    {
      title: t('companyProfile:sender'),
      key: 'senderName',
      align: 'center' as const,
      render: (record: OrganizationTransactionInterface) =>
        renderOrganization(record.senderName, record.senderLogo),
    },
    {
      title: t('companyProfile:receiver'),
      key: 'receiverName',
      align: 'center' as const,
      render: (record: OrganizationTransactionInterface) =>
        renderOrganization(record.receiverName, record.receiverLogo),
    },
    {
      title: t('companyProfile:updatedDateTime'),
      key: 'updatedDate',
      sorter: (a: OrganizationTransactionInterface, b: OrganizationTransactionInterface) =>
        compareNumbers(Number(a.updatedDate), Number(b.updatedDate)),
      defaultSortOrder: 'descend' as const,
      align: 'left' as const,
      render: (record: OrganizationTransactionInterface) => (
        <span>{moment(Number(record.updatedDate)).format('YYYY-MM-DD HH:mm:ss')}</span>
      ),
    },
    {
      title: t('companyProfile:noOfCredits'),
      key: 'creditAmount',
      sorter: (a: OrganizationTransactionInterface, b: OrganizationTransactionInterface) =>
        compareNumbers(a.creditAmount, b.creditAmount),
      align: 'left' as const,
      render: (record: OrganizationTransactionInterface) => (
        <span style={{ marginLeft: '20px' }}>{addCommSep(record.creditAmount)}</span>
      ),
    },
  ];

  return (
    <Card className="card-container">
      <div className="info-view">
        <div className="title">
          <span className="title-icon">
            <SwapOutlined />
          </span>
          <span className="title-text">{t('companyProfile:transactions')}</span>
        </div>
      </div>
      <div className="credit-table-container">
        <Table
          dataSource={tableData}
          columns={columns}
          className="common-table-class"
          rowKey="id"
          pagination={{ pageSize: 10, showQuickJumper: true, showSizeChanger: true }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={tableData.length === 0 ? t('companyProfile:noTransactions') : null}
              />
            ),
          }}
        />
      </div>
    </Card>
  );
};

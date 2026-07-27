import { Empty, message, Table } from 'antd';
import type { ColumnsType } from 'antd/lib/table';
import { useEffect, useRef, useState } from 'react';
import { ProfileIcon } from '../../../Components/IconComponents/ProfileIcon/profile.icon';
import { API_PATHS } from '../../../Config/apiConfig';
import { useConnection } from '../../../Context/ConnectionContext/connectionContext';
import '../creditPageStyles.scss';

interface OrganizationBalance {
  id: string;
  name: string;
  logo: string;
  avatarColor: string;
  balance: number;
  reserved: number;
  updatedAt: string;
}

export interface CreditBalanceByOrganizationTableProps {
  selectedOrganizations: string[];
  onFilterOptionsChange?: (organizations: string[]) => void;
}

interface OrganizationBalanceApiRow {
  organizationId: string;
  organizationName: string;
  organizationLogo: string | null;
  creditBalance: string | number;
  reservedCredits: string | number;
  updatedTime: string | number;
}

interface ConnectionResponse<T> {
  data?: T;
  response?: { data?: { total?: number } };
}

interface OrganizationBalanceQuery {
  page: number;
  size: number;
  filterAnd?: Array<{
    key: 'organizationName';
    operation: 'in';
    value: string[];
  }>;
  sort: {
    key: 'updatedTime';
    order: 'DESC';
    nullFirst: false;
  };
}

const formatCredits = (value: number) => new Intl.NumberFormat('en-US').format(value);

const formatTimestamp = (value: string | number) => {
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('sv-SE', { hour12: false });
};

const avatarColor = (name: string) => {
  const colors = ['#dbeafe', '#fce7f3', '#fef9c3', '#dcfce7', '#ede9fe'];
  const hash = Array.from(name).reduce((total, character) => total + character.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

const columns: ColumnsType<OrganizationBalance> = [
  {
    title: 'Credit Owner',
    dataIndex: 'name',
    key: 'name',
    align: 'left',
    sorter: (a, b) => a.name.localeCompare(b.name),
    render: (name, row) => (
      <div className="credit-balance-organization-cell">
        <ProfileIcon icon={row.logo} bg={row.avatarColor} name={name} />
        <span>{name}</span>
      </div>
    ),
  },
  { title: 'Credit Balance', dataIndex: 'balance', key: 'balance', align: 'left', sorter: (a, b) => a.balance - b.balance, render: formatCredits },
  { title: 'Credits Reserved', dataIndex: 'reserved', key: 'reserved', align: 'left', sorter: (a, b) => a.reserved - b.reserved, render: formatCredits },
  { title: 'Updated Date & Time', dataIndex: 'updatedAt', key: 'updatedAt', align: 'left', sorter: (a, b) => a.updatedAt.localeCompare(b.updatedAt) },
];

export const CreditBalanceByOrganizationTable = ({
  selectedOrganizations,
  onFilterOptionsChange,
}: CreditBalanceByOrganizationTableProps) => {
  const { post } = useConnection();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rows, setRows] = useState<OrganizationBalance[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const requestGenerationRef = useRef(0);
  const selectedOrganizationsKey = selectedOrganizations.join('\u0000');

  useEffect(() => setCurrentPage(1), [selectedOrganizationsKey]);

  useEffect(() => {
    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;
    const organizations = selectedOrganizationsKey
      ? selectedOrganizationsKey.split('\u0000')
      : [];
    const request: OrganizationBalanceQuery = {
      page: currentPage,
      size: pageSize,
      filterAnd: organizations.length > 0
        ? [{
          key: 'organizationName',
          operation: 'in',
          value: organizations,
        }]
        : undefined,
      sort: { key: 'updatedTime', order: 'DESC', nullFirst: false },
    };

    setLoading(true);
    void (post(
      API_PATHS.CREDIT_BALANCE_BY_ORGANIZATION_QUERY,
      request,
    ) as Promise<ConnectionResponse<OrganizationBalanceApiRow[]>>)
      .then((response) => {
        if (requestGenerationRef.current !== requestGeneration) return;
        const mappedRows = (response.data ?? []).map((row): OrganizationBalance => ({
          id: row.organizationId,
          name: row.organizationName,
          logo: row.organizationLogo ?? '',
          avatarColor: avatarColor(row.organizationName),
          balance: Number(row.creditBalance) || 0,
          reserved: Number(row.reservedCredits) || 0,
          updatedAt: formatTimestamp(row.updatedTime),
        }));
        setRows(mappedRows);
        setTotal(response.response?.data?.total ?? mappedRows.length);
        onFilterOptionsChange?.(mappedRows.map(({ name }) => name));
      })
      .catch((error: { message?: string }) => {
        if (requestGenerationRef.current !== requestGeneration) return;
        setRows([]);
        setTotal(0);
        message.error(error.message ?? 'Unable to load organization credit balances');
      })
      .finally(() => {
        if (requestGenerationRef.current === requestGeneration) setLoading(false);
      });

    return () => {
      if (requestGenerationRef.current === requestGeneration) {
        requestGenerationRef.current += 1;
      }
    };
  }, [
    currentPage,
    onFilterOptionsChange,
    pageSize,
    post,
    selectedOrganizationsKey,
  ]);

  return (
    <div className="credit-table-container credit-balance-organization-table">
      <Table<OrganizationBalance>
        className="common-table-class"
        rowKey="id"
        dataSource={rows}
        columns={columns}
        loading={loading}
        scroll={{ x: 760 }}
        pagination={{
          current: currentPage,
          pageSize,
          total,
          showQuickJumper: true,
          showSizeChanger: true,
          pageSizeOptions: ['5', '10', '20'],
          onChange: (page, size) => {
            setCurrentPage(size !== pageSize ? 1 : page);
            setPageSize(size);
          },
        }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No organization credit balances match the selected filters" /> }}
      />
    </div>
  );
};

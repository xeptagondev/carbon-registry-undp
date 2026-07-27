import { Empty, Table } from 'antd';
import type { ColumnsType } from 'antd/lib/table';
import { useEffect, useMemo, useState } from 'react';
import { ProfileIcon } from '../../../Components/IconComponents/ProfileIcon/profile.icon';
import '../creditPageStyles.scss';

interface OrganizationBalance {
  id: string;
  name: string;
  avatarColor: string;
  balance: number;
  reserved: number;
  updatedAt: string;
}

export interface CreditBalanceByOrganizationTableProps {
  selectedOrganizations: string[];
}

export const CREDIT_BALANCE_ORGANIZATION_OPTIONS = [
  'Sample Developer',
  'Project Developer 1',
  'Project Developer',
];

const organizationBalances: OrganizationBalance[] = [
  { id: 'sample-developer', name: CREDIT_BALANCE_ORGANIZATION_OPTIONS[0], avatarColor: '#dbeafe', balance: 4900, reserved: 1200, updatedAt: '2026-04-23 14:11:54' },
  { id: 'project-developer-1', name: CREDIT_BALANCE_ORGANIZATION_OPTIONS[1], avatarColor: '#fce7f3', balance: 200, reserved: 200, updatedAt: '2026-04-23 13:57:58' },
  { id: 'project-developer', name: CREDIT_BALANCE_ORGANIZATION_OPTIONS[2], avatarColor: '#fef9c3', balance: 45, reserved: 5, updatedAt: '2025-07-23 16:48:02' },
];

const formatCredits = (value: number) => new Intl.NumberFormat('en-US').format(value);

const columns: ColumnsType<OrganizationBalance> = [
  {
    title: 'Credit Owner',
    dataIndex: 'name',
    key: 'name',
    align: 'left',
    sorter: (a, b) => a.name.localeCompare(b.name),
    render: (name, row) => (
      <div className="credit-balance-organization-cell">
        <ProfileIcon icon="" bg={row.avatarColor} name={name} />
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
}: CreditBalanceByOrganizationTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filteredRows = useMemo(
    () => selectedOrganizations.length === 0
      ? organizationBalances
      : organizationBalances.filter(({ name }) => selectedOrganizations.includes(name)),
    [selectedOrganizations],
  );

  useEffect(() => setCurrentPage(1), [selectedOrganizations]);

  return (
    <div className="credit-table-container credit-balance-organization-table">
      <Table<OrganizationBalance>
        className="common-table-class"
        rowKey="id"
        dataSource={filteredRows}
        columns={columns}
        scroll={{ x: 760 }}
        pagination={{
          current: currentPage,
          pageSize,
          total: filteredRows.length,
          showQuickJumper: true,
          showSizeChanger: true,
          pageSizeOptions: ['5', '10', '20'],
          onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
        }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No organization credit balances match the selected filters" /> }}
      />
    </div>
  );
};

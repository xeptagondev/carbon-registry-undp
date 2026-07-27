import { MoreOutlined } from '@ant-design/icons';
import { Empty, List, message, Popover, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/lib/table';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Icon from 'react-bootstrap-icons';
import { useTranslation } from 'react-i18next';
import { ProfileIcon } from '../../../Components/IconComponents/ProfileIcon/profile.icon';
import { COLOR_CONFIGS } from '../../../Config/colorConfigs';
import { CreditActionType } from '../Enums/creditActionType.enum';
import { IssuedOrReceivedOptions } from '../Enums/creditEventEnum';
import { CreditRetirementProceedAction } from '../Enums/creditRetirementProceedType.enum';
import type { CreditBalanceInterface } from '../Interfaces/creditBalance.interface';
import { CreditActionModal } from './creditActionModal';
import '../creditPageStyles.scss';

interface CreditSerialBalance {
  id: number;
  serialNumber: string;
  organization: string;
  organizationColor: string;
  updatedAt: string;
  balance: number;
  reserved: number;
  type: IssuedOrReceivedOptions;
}

interface CreditSerialBalancePage {
  rows: CreditSerialBalance[];
  total: number;
  hasMore: boolean;
}

const SERIAL_PAGE_SIZE = 8;
const SERIAL_VISIBLE_ROW_COUNT = 5;
const SERIAL_ROW_HEIGHT = 50;
const SERIAL_BODY_HEIGHT = SERIAL_VISIBLE_ROW_COUNT * SERIAL_ROW_HEIGHT;

const expandDummySerialBalances = (
  seedRows: CreditSerialBalance[],
  projectCode: string,
): CreditSerialBalance[] => Array.from({ length: 24 }, (_, index) => {
  if (seedRows[index]) return seedRows[index];
  const seed = seedRows[index % seedRows.length];
  const updatedAt = new Date(seed.updatedAt.replace(' ', 'T'));
  updatedAt.setMinutes(updatedAt.getMinutes() - index * 7);
  return {
    ...seed,
    id: seedRows[0].id - index,
    serialNumber: `CA0NNN-${projectCode}-${String(index + 1).padStart(4, '0')}-${2023 + (index % 3)}`,
    updatedAt: updatedAt.toISOString().slice(0, 19).replace('T', ' '),
    balance: index % 4 === 0 ? 500 : 1000,
    reserved: index % 5 === 0 ? 500 : 0,
    type: index % 3 === 0
      ? IssuedOrReceivedOptions.ISSUED
      : IssuedOrReceivedOptions.RECEIVED,
  };
});

interface ProjectBalance {
  id: string;
  name: string;
  owner: string;
  ownerColor: string;
  balance: number;
  reserved: number;
  updatedAt: string;
  serialBalances: CreditSerialBalance[];
}

export interface CreditBalanceByProjectTableProps {
  selectedOrganizations: string[];
  selectedProjects: string[];
}

export const CREDIT_BALANCE_PROJECT_OPTIONS = [
  'Philippines Rainforest Conservation & Recovery Project - Stage 11',
  'Mongolia Wind & Solar Expansion Project - Phase 5',
  'Philippines Rural Livestock Empowerment Initiative',
];

const projectBalances: ProjectBalance[] = [
  {
    id: 'rainforest-stage-11',
    name: CREDIT_BALANCE_PROJECT_OPTIONS[0],
    owner: 'Sample Developer',
    ownerColor: '#dbeafe',
    balance: 3000,
    reserved: 1000,
    updatedAt: '2026-04-23 14:11:54',
    serialBalances: expandDummySerialBalances([
      { id: 3203, serialNumber: 'CA0NNN-NG-XX-32-3001-4000-2023', organization: 'Sample Developer', organizationColor: '#dbeafe', updatedAt: '2026-04-23 14:11:54', balance: 1000, reserved: 0, type: IssuedOrReceivedOptions.RECEIVED },
      { id: 3202, serialNumber: 'CA0NNN-NG-XX-32-2001-3000-2022', organization: 'Sample Developer', organizationColor: '#dbeafe', updatedAt: '2026-04-23 14:11:53', balance: 1000, reserved: 1000, type: IssuedOrReceivedOptions.RECEIVED },
      { id: 3201, serialNumber: 'CA0NNN-NG-XX-32-1001-2000-2025', organization: 'Sample Developer', organizationColor: '#dbeafe', updatedAt: '2026-04-23 14:11:53', balance: 1000, reserved: 0, type: IssuedOrReceivedOptions.ISSUED },
    ], 'NG-XX-32'),
  },
  {
    id: 'wind-solar-phase-5',
    name: CREDIT_BALANCE_PROJECT_OPTIONS[1],
    owner: 'Project Developer 1',
    ownerColor: '#fce7f3',
    balance: 900,
    reserved: 200,
    updatedAt: '2026-04-23 13:57:58',
    serialBalances: expandDummySerialBalances([
      { id: 2238, serialNumber: 'CA0NNN-NG-XX-22-3801-4000-2023', organization: 'Project Developer 1', organizationColor: '#fce7f3', updatedAt: '2026-04-23 13:57:58', balance: 200, reserved: 200, type: IssuedOrReceivedOptions.RECEIVED },
      { id: 2230, serialNumber: 'CA0NNN-NG-XX-22-3001-3700-2023', organization: 'Sample Developer', organizationColor: '#dbeafe', updatedAt: '2026-04-23 13:45:06', balance: 700, reserved: 0, type: IssuedOrReceivedOptions.ISSUED },
    ], 'NG-XX-22'),
  },
  {
    id: 'rural-livestock',
    name: CREDIT_BALANCE_PROJECT_OPTIONS[2],
    owner: 'Sample Developer',
    ownerColor: '#dbeafe',
    balance: 1200,
    reserved: 0,
    updatedAt: '2025-06-02 10:11:45',
    serialBalances: expandDummySerialBalances([
      { id: 1901, serialNumber: 'CA0NNN-NG-XX-19-1-1200-2024', organization: 'Sample Developer', organizationColor: '#dbeafe', updatedAt: '2025-06-02 10:11:45', balance: 1200, reserved: 0, type: IssuedOrReceivedOptions.ISSUED },
    ], 'NG-XX-19'),
  },
];

const fetchSerialBalances = (
  projectId: string,
  offset: number,
  limit: number,
): Promise<CreditSerialBalancePage> => new Promise((resolve) => {
  window.setTimeout(() => {
    const allRows = projectBalances.find(({ id }) => id === projectId)?.serialBalances ?? [];
    const rows = allRows.slice(offset, offset + limit);
    resolve({
      rows,
      total: allRows.length,
      hasMore: offset + rows.length < allRows.length,
    });
  }, 450);
});

const formatCredits = (value: number) => new Intl.NumberFormat('en-US').format(value);

const OrganizationCell = ({ name, color }: { name: string; color: string }) => (
  <div className="credit-balance-organization-cell">
    <ProfileIcon icon="" bg={color} name={name} />
    <span>{name}</span>
  </div>
);

const getSerialColumns = (
  openActions: (row: CreditSerialBalance) => ReactNode,
): ColumnsType<CreditSerialBalance> => [
  { title: 'Serial Number', dataIndex: 'serialNumber', key: 'serialNumber', align: 'left', width: 280, render: (value) => <span className="credit-balance-serial-number">{value}</span> },
  { title: 'Organization', key: 'organization', align: 'left', render: (_, row) => <OrganizationCell name={row.organization} color={row.organizationColor} /> },
  { title: 'Updated Date & Time', dataIndex: 'updatedAt', key: 'updatedAt', align: 'left', width: 180, render: (value) => <span className="credit-balance-detail-date">{value}</span> },
  { title: 'Credit Balance', dataIndex: 'balance', key: 'balance', align: 'right', render: (value) => <span className="credit-balance-detail-number">{formatCredits(value)}</span> },
  { title: 'Reserved Credits', dataIndex: 'reserved', key: 'reserved', align: 'right', render: (value) => <span className="credit-balance-detail-number">{formatCredits(value)}</span> },
  {
    title: 'Issue or Received',
    dataIndex: 'type',
    key: 'type',
    align: 'center',
    render: (value: IssuedOrReceivedOptions) => (
      <Tag color={value === IssuedOrReceivedOptions.RECEIVED ? 'success' : 'processing'}>
        {value === IssuedOrReceivedOptions.RECEIVED ? 'Received' : 'Issued'}
      </Tag>
    ),
  },
  {
    title: 'Action',
    key: 'action',
    align: 'center',
    width: 90,
    render: (_, row) => openActions(row),
  },
];

interface CreditBalanceSerialTableProps {
  project: ProjectBalance;
  openActions: (row: CreditSerialBalance) => ReactNode;
}

const CreditBalanceSerialTable = ({
  project,
  openActions,
}: CreditBalanceSerialTableProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const requestInFlightRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const [rows, setRows] = useState<CreditSerialBalance[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const requestGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = requestGeneration;
    mountedRef.current = true;
    requestInFlightRef.current = true;
    setRows([]);
    setPage(0);
    setHasMore(true);
    setTotal(0);
    setLoading(true);

    void fetchSerialBalances(project.id, 0, SERIAL_PAGE_SIZE).then((page) => {
      if (!mountedRef.current || requestGenerationRef.current !== requestGeneration) return;
      setRows(page.rows);
      setPage(1);
      setHasMore(page.hasMore);
      setTotal(page.total);
      setLoading(false);
      requestInFlightRef.current = false;
    });

    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
      requestInFlightRef.current = false;
    };
  }, [project.id]);

  const loadNextPage = useCallback(() => {
    if (requestInFlightRef.current || !hasMore) return;
    requestInFlightRef.current = true;
    setLoading(true);
    const requestGeneration = requestGenerationRef.current;
    const offset = page * SERIAL_PAGE_SIZE;

    void fetchSerialBalances(project.id, offset, SERIAL_PAGE_SIZE).then((nextPage) => {
      if (!mountedRef.current || requestGenerationRef.current !== requestGeneration) return;
      setRows((current) => [
        ...current,
        ...nextPage.rows.filter((nextRow) =>
          !current.some((currentRow) => currentRow.id === nextRow.id)),
      ]);
      setPage((current) => current + 1);
      setHasMore(nextPage.hasMore);
      setTotal(nextPage.total);
      setLoading(false);
      requestInFlightRef.current = false;
    });
  }, [hasMore, page, project.id]);

  useEffect(() => {
    const scrollBody = containerRef.current?.querySelector<HTMLElement>('.ant-table-body');
    if (!scrollBody) return undefined;

    const isAtEnd = () => (
      scrollBody.scrollHeight - scrollBody.clientHeight - scrollBody.scrollTop <= 2
    );
    const onScroll = () => {
      if (isAtEnd()) loadNextPage();
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > 0 && isAtEnd()) loadNextPage();
    };

    scrollBody.addEventListener('scroll', onScroll, { passive: true });
    scrollBody.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      scrollBody.removeEventListener('scroll', onScroll);
      scrollBody.removeEventListener('wheel', onWheel);
    };
  }, [loadNextPage, rows.length]);

  return (
    <div className="credit-balance-serial-scroll" ref={containerRef}>
      <Table<CreditSerialBalance>
        className="common-table-class credit-balance-serial-table"
        rowKey="serialNumber"
        dataSource={rows}
        columns={getSerialColumns(openActions)}
        pagination={false}
        tableLayout="fixed"
        loading={loading && rows.length === 0}
        scroll={{ x: 1050, y: SERIAL_BODY_HEIGHT }}
      />
      {loading && rows.length > 0 && (
        <div className="credit-balance-serial-loading" aria-label="Loading more credit balances">
          <Spin size="small" />
        </div>
      )}
      <div className="credit-balance-serial-footer" aria-live="polite">
        {rows.length} of {total} records available
      </div>
    </div>
  );
};

const columns: ColumnsType<ProjectBalance> = [
  { title: 'Project Name', dataIndex: 'name', key: 'name', align: 'left', sorter: (a, b) => a.name.localeCompare(b.name) },
  { title: 'Project Owner', key: 'owner', align: 'left', sorter: (a, b) => a.owner.localeCompare(b.owner), render: (_, row) => <OrganizationCell name={row.owner} color={row.ownerColor} /> },
  { title: 'Total Credit Balance', dataIndex: 'balance', key: 'balance', align: 'left', sorter: (a, b) => a.balance - b.balance, render: formatCredits },
  { title: 'Total Reserved Credits', dataIndex: 'reserved', key: 'reserved', align: 'left', sorter: (a, b) => a.reserved - b.reserved, render: formatCredits },
  { title: 'Updated Date & Time', dataIndex: 'updatedAt', key: 'updatedAt', align: 'left', sorter: (a, b) => a.updatedAt.localeCompare(b.updatedAt) },
];

export const CreditBalanceByProjectTable = ({
  selectedOrganizations,
  selectedProjects,
}: CreditBalanceByProjectTableProps) => {
  const { t } = useTranslation(['creditPages']);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedProjectId, setExpandedProjectId] = useState<string>();
  const [collapsingProjectId, setCollapsingProjectId] = useState<string>();
  const collapseTimer = useRef<ReturnType<typeof setTimeout>>();
  const [modalActionVisible, setModalActionVisible] = useState(false);
  const [modalActionLoading, setModalActionLoading] = useState(false);
  const [modalActionData, setModalActionData] = useState<{
    icon: ReactNode;
    title: string;
    type: CreditActionType;
    actionBtnText: string;
    data: CreditBalanceInterface;
  }>();
  const filteredRows = useMemo(
    () => projectBalances.filter(({ owner, name }) => {
      const matchesOrganization = selectedOrganizations.length === 0
        || selectedOrganizations.includes(owner);
      const matchesProject = selectedProjects.length === 0
        || selectedProjects.includes(name);
      return matchesOrganization && matchesProject;
    }),
    [selectedOrganizations, selectedProjects],
  );

  useEffect(() => setCurrentPage(1), [selectedOrganizations, selectedProjects]);

  useEffect(() => () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
  }, []);

  const toggleExpandedProject = (projectId: string, expanded: boolean) => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = undefined;
      setCollapsingProjectId(undefined);
    }

    if (!expanded) {
      setExpandedProjectId(projectId);
      return;
    }

    setCollapsingProjectId(projectId);
    collapseTimer.current = setTimeout(() => {
      setExpandedProjectId((current) => (current === projectId ? undefined : current));
      setCollapsingProjectId(undefined);
      collapseTimer.current = undefined;
    }, 220);
  };

  const toCreditBalanceRecord = (
    serial: CreditSerialBalance,
    project: ProjectBalance,
  ): CreditBalanceInterface => ({
    id: serial.id,
    serialNumber: serial.serialNumber,
    creditAmount: serial.balance,
    createdDate: String(new Date(serial.updatedAt.replace(' ', 'T')).getTime()),
    projectId: Number(serial.id),
    projectName: project.name,
    receiverId: serial.id,
    receiverName: serial.organization,
    receiverLogo: '',
    senderId: null,
    senderName: serial.organization,
    senderLogo: null,
    type: serial.type,
  });

  const openActionModal = (
    serial: CreditSerialBalance,
    project: ProjectBalance,
    type: CreditActionType,
  ) => {
    const transfer = type === CreditActionType.TRANSFER;
    setModalActionData({
      icon: transfer
        ? <Icon.BoxArrowRight color={COLOR_CONFIGS.PRIMARY_THEME_COLOR} />
        : <Icon.BoxArrowDown color={COLOR_CONFIGS.PRIMARY_THEME_COLOR} />,
      title: t(transfer ? 'tranferCredit' : 'areYouWantToRetireCredit'),
      type,
      actionBtnText: t(transfer ? 'transfer' : 'retire'),
      data: toCreditBalanceRecord(serial, project),
    });
    setModalActionVisible(true);
  };

  const actionMenu = (serial: CreditSerialBalance, project: ProjectBalance) => (
    <List
      className="action-menu"
      size="small"
      dataSource={[
        { text: t('transfer'), icon: <Icon.ArrowLeftRight color={COLOR_CONFIGS.PRIMARY_THEME_COLOR} />, type: CreditActionType.TRANSFER },
        { text: t('retire'), icon: <Icon.ClockHistory color="#FF4D4F" />, type: CreditActionType.RETIREMENT },
      ]}
      renderItem={(item) => (
        <List.Item onClick={() => openActionModal(serial, project, item.type)}>
          <Typography.Text className="action-icon color-primary">{item.icon}</Typography.Text>
          <span>{item.text}</span>
        </List.Item>
      )}
    />
  );

  const actionButton = (serial: CreditSerialBalance, project: ProjectBalance) => (
    <Popover placement="bottomRight" content={actionMenu(serial, project)} trigger="click">
      <button type="button" className="credit-balance-detail-action" aria-label={`Actions for ${serial.serialNumber}`}>
        <MoreOutlined />
      </button>
    </Popover>
  );

  const onFinishAction = () => {
    setModalActionLoading(true);
    window.setTimeout(() => {
      message.success(t(modalActionData?.type === CreditActionType.TRANSFER
        ? 'creditTransferInitiated'
        : 'creditRetirementSubmitted'));
      setModalActionLoading(false);
      setModalActionVisible(false);
    }, 350);
  };

  return (
    <div className="credit-table-container credit-balance-project-table">
      <Table<ProjectBalance>
        className="common-table-class"
        rowKey="id"
        dataSource={filteredRows}
        columns={columns}
        tableLayout="fixed"
        scroll={{ x: 1050 }}
        expandable={{
          expandedRowRender: (row) => (
            <div className={`credit-balance-detail-panel${collapsingProjectId === row.id ? ' credit-balance-detail-panel--collapsing' : ''}`}>
              <CreditBalanceSerialTable
                project={row}
                openActions={(serial) => actionButton(serial, row)}
              />
            </div>
          ),
          expandedRowKeys: expandedProjectId ? [expandedProjectId] : [],
          expandRowByClick: false,
          expandIcon: ({ expanded, record }) => (
            <button
              type="button"
              className="credit-balance-expand-button"
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${record.name}`}
              aria-expanded={expanded}
              onClick={() => toggleExpandedProject(record.id, expanded)}
            >
              {expanded ? <Icon.DashLg aria-hidden="true" /> : <Icon.PlusLg aria-hidden="true" />}
            </button>
          ),
          columnTitle: 'Action',
          columnWidth: 80,
          expandIconColumnIndex: 5,
          fixed: false,
        }}
        pagination={{
          current: currentPage,
          pageSize,
          total: filteredRows.length,
          showQuickJumper: true,
          showSizeChanger: true,
          pageSizeOptions: ['5', '10', '20'],
          onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
        }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No project credit balances match the selected filters" /> }}
      />
      <CreditActionModal
        onFinish={onFinishAction}
        onCancel={() => setModalActionVisible(false)}
        t={t}
        actionBtnText={modalActionData?.actionBtnText}
        openModal={modalActionVisible}
        loading={modalActionLoading}
        icon={modalActionData?.icon}
        title={modalActionData?.title}
        isProceed={false}
        type={modalActionData?.type}
        remarkRequired={false}
        proceedAction={CreditRetirementProceedAction.ACCEPT}
        data={modalActionData?.data}
      />
    </div>
  );
};

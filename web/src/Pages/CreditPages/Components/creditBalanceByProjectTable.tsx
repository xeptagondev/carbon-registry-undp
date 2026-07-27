import { MoreOutlined } from '@ant-design/icons';
import { Empty, List, message, Popover, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/lib/table';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as Icon from 'react-bootstrap-icons';
import { useTranslation } from 'react-i18next';
import { ProfileIcon } from '../../../Components/IconComponents/ProfileIcon/profile.icon';
import { COLOR_CONFIGS } from '../../../Config/colorConfigs';
import { API_PATHS } from '../../../Config/apiConfig';
import { useConnection } from '../../../Context/ConnectionContext/connectionContext';
import { CreditActionType } from '../Enums/creditActionType.enum';
import { IssuedOrReceivedOptions } from '../Enums/creditEventEnum';
import { CreditRetirementProceedAction } from '../Enums/creditRetirementProceedType.enum';
import { CreditRetirementTypeEmnum } from '../Enums/creditRetirementType.enum';
import type { CreditBalanceInterface } from '../Interfaces/creditBalance.interface';
import { CreditActionModal } from './creditActionModal';
import '../creditPageStyles.scss';

interface CreditSerialBalance {
  id: string;
  serialNumber: string;
  organization: string;
  organizationLogo: string;
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

interface ProjectBalance {
  id: string;
  name: string;
  owner: string;
  ownerLogo: string;
  ownerColor: string;
  balance: number;
  reserved: number;
  updatedAt: string;
}

export interface CreditBalanceByProjectTableProps {
  selectedOrganizations: string[];
  selectedProjects: string[];
  onFilterOptionsChange?: (options: {
    organizations: string[];
    projects: string[];
  }) => void;
}

interface ProjectBalanceApiRow {
  projectId: string;
  projectName: string;
  projectOwnerId: string | number;
  projectOwnerName: string;
  projectOwnerLogo: string | null;
  creditBalance: string | number;
  reservedCredits: string | number;
  updatedTime: string | number;
}

interface CreditBalanceApiRow {
  id: string | number;
  serialNumber: string;
  creditAmount: string | number;
  reservedCredits: string | number;
  updatedTime: string | number;
  receiverName: string;
  receiverLogo: string | null;
  type: IssuedOrReceivedOptions;
}

interface ConnectionResponse<T> {
  status?: number;
  data?: T;
  response?: { data?: { total?: number } };
}

interface BalanceQueryFilter {
  key: string;
  operation: '=' | 'in';
  value: string | string[];
}

interface BalanceQueryRequest {
  page: number;
  size: number;
  filterAnd?: BalanceQueryFilter[];
  sort: {
    key: string;
    order: 'DESC';
    nullFirst: false;
  };
}

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

const formatCredits = (value: number) => new Intl.NumberFormat('en-US').format(value);

const OrganizationCell = ({
  name,
  color,
  logo = '',
}: { name: string; color: string; logo?: string }) => (
  <div className="credit-balance-organization-cell">
    <ProfileIcon icon={logo} bg={color} name={name} />
    <span>{name}</span>
  </div>
);

const getSerialColumns = (
  openActions: (row: CreditSerialBalance) => ReactNode,
): ColumnsType<CreditSerialBalance> => [
  { title: 'Serial Number', dataIndex: 'serialNumber', key: 'serialNumber', align: 'left', width: 280, render: (value) => <span className="credit-balance-serial-number">{value}</span> },
  { title: 'Organization', key: 'organization', align: 'left', render: (_, row) => <OrganizationCell name={row.organization} color={row.organizationColor} logo={row.organizationLogo} /> },
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
  refreshGeneration: number;
}

const CreditBalanceSerialTable = ({
  project,
  openActions,
  refreshGeneration,
}: CreditBalanceSerialTableProps) => {
  const { post } = useConnection();
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const requestInFlightRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const [rows, setRows] = useState<CreditSerialBalance[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchSerialBalances = useCallback(async (
    pageNumber: number,
  ): Promise<CreditSerialBalancePage> => {
    const request: BalanceQueryRequest = {
      page: pageNumber,
      size: SERIAL_PAGE_SIZE,
      filterAnd: [{
        key: 'projectId',
        operation: '=',
        value: project.id,
      }],
      sort: { key: 'updatedTime', order: 'DESC', nullFirst: false },
    };
    const response = await post(
      API_PATHS.CREDIT_BALANCE_QUERY,
      request,
    ) as ConnectionResponse<CreditBalanceApiRow[]>;
    const apiRows = response.data ?? [];
    const responseTotal = response.response?.data?.total ?? apiRows.length;
    return {
      rows: apiRows.map((row) => ({
        id: String(row.id),
        serialNumber: row.serialNumber,
        organization: row.receiverName,
        organizationLogo: row.receiverLogo ?? '',
        organizationColor: avatarColor(row.receiverName),
        updatedAt: formatTimestamp(row.updatedTime),
        balance: Number(row.creditAmount) || 0,
        reserved: Number(row.reservedCredits) || 0,
        type: row.type,
      })),
      total: responseTotal,
      hasMore: pageNumber * SERIAL_PAGE_SIZE < responseTotal,
    };
  }, [post, project.id]);

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

    void fetchSerialBalances(1).then((page) => {
      if (!mountedRef.current || requestGenerationRef.current !== requestGeneration) return;
      setRows(page.rows);
      setPage(1);
      setHasMore(page.hasMore);
      setTotal(page.total);
      setLoading(false);
      requestInFlightRef.current = false;
    }).catch((error: { message?: string }) => {
      if (!mountedRef.current || requestGenerationRef.current !== requestGeneration) return;
      setLoading(false);
      requestInFlightRef.current = false;
      message.error(error.message ?? 'Unable to load project credit balances');
    });

    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
      requestInFlightRef.current = false;
    };
  }, [fetchSerialBalances, project.id, refreshGeneration]);

  const loadNextPage = useCallback(() => {
    if (requestInFlightRef.current || !hasMore) return;
    requestInFlightRef.current = true;
    setLoading(true);
    const requestGeneration = requestGenerationRef.current;

    void fetchSerialBalances(page + 1).then((nextPage) => {
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
    }).catch((error: { message?: string }) => {
      if (!mountedRef.current || requestGenerationRef.current !== requestGeneration) return;
      setLoading(false);
      requestInFlightRef.current = false;
      message.error(error.message ?? 'Unable to load more project credit balances');
    });
  }, [fetchSerialBalances, hasMore, page]);

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
  { title: 'Project Owner', key: 'owner', align: 'left', sorter: (a, b) => a.owner.localeCompare(b.owner), render: (_, row) => <OrganizationCell name={row.owner} color={row.ownerColor} logo={row.ownerLogo} /> },
  { title: 'Total Credit Balance', dataIndex: 'balance', key: 'balance', align: 'left', sorter: (a, b) => a.balance - b.balance, render: formatCredits },
  { title: 'Total Reserved Credits', dataIndex: 'reserved', key: 'reserved', align: 'left', sorter: (a, b) => a.reserved - b.reserved, render: formatCredits },
  { title: 'Updated Date & Time', dataIndex: 'updatedAt', key: 'updatedAt', align: 'left', sorter: (a, b) => a.updatedAt.localeCompare(b.updatedAt) },
];

export const CreditBalanceByProjectTable = ({
  selectedOrganizations,
  selectedProjects,
  onFilterOptionsChange,
}: CreditBalanceByProjectTableProps) => {
  const { t } = useTranslation(['creditPages']);
  const { post } = useConnection();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rows, setRows] = useState<ProjectBalance[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const projectRequestGeneration = useRef(0);
  const selectedOrganizationsKey = selectedOrganizations.join('\u0000');
  const selectedProjectsKey = selectedProjects.join('\u0000');
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
  useEffect(() => setCurrentPage(1), [selectedOrganizationsKey, selectedProjectsKey]);

  useEffect(() => {
    const requestGeneration = projectRequestGeneration.current + 1;
    projectRequestGeneration.current = requestGeneration;
    const filterAnd: BalanceQueryFilter[] = [];
    const organizations = selectedOrganizationsKey
      ? selectedOrganizationsKey.split('\u0000')
      : [];
    const projects = selectedProjectsKey ? selectedProjectsKey.split('\u0000') : [];

    if (organizations.length > 0) {
      filterAnd.push({
        key: 'projectOwnerName',
        operation: 'in',
        value: organizations,
      });
    }
    if (projects.length > 0) {
      filterAnd.push({
        key: 'projectName',
        operation: 'in',
        value: projects,
      });
    }

    setLoading(true);
    const request: BalanceQueryRequest = {
      page: currentPage,
      size: pageSize,
      filterAnd: filterAnd.length > 0 ? filterAnd : undefined,
      sort: { key: 'updatedTime', order: 'DESC', nullFirst: false },
    };
    void (post(
      API_PATHS.CREDIT_BALANCE_BY_PROJECT_QUERY,
      request,
    ) as Promise<ConnectionResponse<ProjectBalanceApiRow[]>>)
      .then((response) => {
        if (projectRequestGeneration.current !== requestGeneration) return;
        const apiRows = response.data ?? [];
        const mappedRows = apiRows.map((row): ProjectBalance => ({
          id: row.projectId,
          name: row.projectName,
          owner: row.projectOwnerName,
          ownerLogo: row.projectOwnerLogo ?? '',
          ownerColor: avatarColor(row.projectOwnerName),
          balance: Number(row.creditBalance) || 0,
          reserved: Number(row.reservedCredits) || 0,
          updatedAt: formatTimestamp(row.updatedTime),
        }));
        setRows(mappedRows);
        setTotal(response.response?.data?.total ?? mappedRows.length);
        onFilterOptionsChange?.({
          organizations: mappedRows.map(({ owner }) => owner),
          projects: mappedRows.map(({ name }) => name),
        });
      })
      .catch((error: { message?: string }) => {
        if (projectRequestGeneration.current !== requestGeneration) return;
        setRows([]);
        setTotal(0);
        message.error(error.message ?? 'Unable to load project credit balances');
      })
      .finally(() => {
        if (projectRequestGeneration.current === requestGeneration) setLoading(false);
      });

    return () => {
      if (projectRequestGeneration.current === requestGeneration) {
        projectRequestGeneration.current += 1;
      }
    };
  }, [
    currentPage,
    onFilterOptionsChange,
    pageSize,
    post,
    refreshGeneration,
    selectedOrganizationsKey,
    selectedProjectsKey,
  ]);

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
    projectId: Number(project.id) || 0,
    projectName: project.name,
    receiverId: Number(serial.id) || 0,
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

  const onFinishAction = async (
    receiveParty: string | { country?: string; organization?: string },
    blockId: string,
    creditAmount: number,
    remark?: string,
    retirementType?: CreditRetirementTypeEmnum,
  ) => {
    setModalActionLoading(true);
    try {
      let response: ConnectionResponse<unknown>;
      if (modalActionData?.type === CreditActionType.TRANSFER) {
        response = await post(API_PATHS.CREDIT_TRANSFER_REQUEST, {
          receiverOrgId: receiveParty,
          blockId,
          amount: Number(creditAmount),
          remarks: remark,
        }) as ConnectionResponse<unknown>;
      } else {
        const crossBorderParty = typeof receiveParty === 'object'
          ? receiveParty
          : undefined;
        response = await post(API_PATHS.CREDIT_RETIREMENT_REQUEST, {
          blockId,
          remarks: remark,
          retirementType,
          ...(retirementType === CreditRetirementTypeEmnum.CROSS_BORDER_TRANSACTIONS
            ? {
              country: crossBorderParty?.country,
              organizationName: crossBorderParty?.organization?.trim(),
            }
            : {}),
          amount: Number(creditAmount),
        }) as ConnectionResponse<unknown>;
      }

      if (response.status !== 201) {
        throw new Error(t('somethingWentWrong'));
      }

      message.success(t(modalActionData?.type === CreditActionType.TRANSFER
        ? 'creditTransferInitiated'
        : 'creditRetirementSubmitted'));
      setModalActionVisible(false);
      setRefreshGeneration((current) => current + 1);
    } catch (error: unknown) {
      const errorMessage = typeof error === 'object'
        && error !== null
        && 'message' in error
        && typeof error.message === 'string'
        ? error.message
        : t('somethingWentWrong');
      message.error(errorMessage);
    } finally {
      setModalActionLoading(false);
    }
  };

  return (
    <div className="credit-table-container credit-balance-project-table">
      <Table<ProjectBalance>
        className="common-table-class"
        rowKey="id"
        dataSource={rows}
        columns={columns}
        loading={loading}
        tableLayout="fixed"
        scroll={{ x: 1050 }}
        expandable={{
          expandedRowRender: (row) => (
            <div className={`credit-balance-detail-panel${collapsingProjectId === row.id ? ' credit-balance-detail-panel--collapsing' : ''}`}>
              <CreditBalanceSerialTable
                project={row}
                openActions={(serial) => actionButton(serial, row)}
                refreshGeneration={refreshGeneration}
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
          total,
          showQuickJumper: true,
          showSizeChanger: true,
          pageSizeOptions: ['5', '10', '20'],
          onChange: (page, size) => {
            setCurrentPage(size !== pageSize ? 1 : page);
            setPageSize(size);
          },
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

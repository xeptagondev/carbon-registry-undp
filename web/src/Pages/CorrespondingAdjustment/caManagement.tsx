import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConnection } from "../../Context/ConnectionContext/connectionContext";
import { useUserContext } from "../../Context/UserInformationContext/userInformationContext";
import {
  Button,
  Row,
  Col,
  Table,
  Tag,
  message,
  Card,
  Statistic,
  Alert,
  Popconfirm,
} from "antd";
import { PlusOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { CompanyRole } from "../../Definitions/Enums/company.role.enum";
import { Role } from "../../Definitions/Enums/role.enum";

const statusColors: Record<string, string> = {
  Draft: "default",
  Submitted: "blue",
  Approved: "green",
};

interface ReconciliationSummary {
  totalFirstTransferredItmos: number;
  totalAcquiredItmos: number;
  totalRecordedCAdj: number;
  outstandingGap: number;
}

const CaManagement = () => {
  const navigate = useNavigate();
  const { post, get, put } = useConnection();
  const { userInfoState } = useUserContext();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reconciliation, setReconciliation] =
    useState<ReconciliationSummary | null>(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Corresponding adjustments are managed by government (DNA) Admin/Root
  // only — mirrors the backend service check.
  const canManage = useMemo(
    () =>
      userInfoState?.companyRole ===
        CompanyRole.DESIGNATED_NATIONAL_AUTHORITY &&
      (userInfoState?.userRole === Role.Admin ||
        userInfoState?.userRole === Role.Root),
    [userInfoState]
  );

  const fetchReconciliation = async () => {
    setReconciliationLoading(true);
    try {
      const response = await get("national/correspondingAdjustment/reconciliation");
      if (response?.data) {
        setReconciliation(response.data);
      }
    } catch {
      // secondary information panel — a load failure shouldn't block the page
    } finally {
      setReconciliationLoading(false);
    }
  };

  const fetchData = async (page: number, size: number) => {
    setLoading(true);
    try {
      const response = await post("national/correspondingAdjustment/query", {
        page,
        size,
        sort: { key: "createdTime", order: "DESC" },
      });
      if (response?.data) {
        setData(response.data);
        setTotalRecords(response.response?.data?.total || response.data.length);
      }
    } catch {
      message.error("Failed to load corresponding adjustments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage, pageSize);
    fetchReconciliation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  const handleApprove = async (caId: string) => {
    setApprovingId(caId);
    try {
      await put(`national/correspondingAdjustment/approve?id=${caId}`, {});
      message.success("Corresponding adjustment approved");
      fetchData(currentPage, pageSize);
      fetchReconciliation();
    } catch (error) {
      const serverMsg = (error as any)?.message;
      message.error(
        serverMsg && typeof serverMsg === "string"
          ? serverMsg
          : "Failed to approve corresponding adjustment"
      );
    } finally {
      setApprovingId(null);
    }
  };

  const fmt = (val: number | undefined) =>
    val !== undefined && val !== null ? Number(val).toFixed(2) : "0.00";

  const columns = [
    { title: "ID", dataIndex: "caId", key: "caId" },
    { title: "Year", dataIndex: "year", key: "year", sorter: true },
    {
      title: "Cooperative Approach",
      dataIndex: "cooperativeApproachId",
      key: "cooperativeApproachId",
      render: (v: string) => v || "—",
    },
    { title: "NDC Type", dataIndex: "ndcType", key: "ndcType" },
    { title: "CA Method", dataIndex: "caMethod", key: "caMethod" },
    {
      title: "Emissions Balance",
      dataIndex: "emissionsBalance",
      key: "emissionsBalance",
      render: (val: number) => fmt(val),
    },
    {
      title: "Safeguard",
      dataIndex: "safeguardCheckPassed",
      key: "safeguardCheckPassed",
      render: (passed: boolean) => (
        <Tag color={passed ? "green" : "red"}>
          {passed ? "Passed" : "Failed"}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={statusColors[status] || "default"}>{status}</Tag>
      ),
    },
    ...(canManage
      ? [
          {
            title: "",
            key: "action",
            render: (record: any) =>
              record.status === "Submitted" ? (
                <Popconfirm
                  title="Approve this corresponding adjustment?"
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    handleApprove(record.caId);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    loading={approvingId === record.caId}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Approve
                  </Button>
                </Popconfirm>
              ) : null,
          },
        ]
      : []),
  ];

  const gap = reconciliation?.outstandingGap ?? 0;

  return (
    <div style={{ padding: "0 24px" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>
          Corresponding Adjustments
        </div>
        <div style={{ fontSize: "0.875rem", color: "rgba(58,53,65,0.6)" }}>
          Article 6.2 corresponding adjustment calculations per Decision
          2/CMA.3 para. 7-10
        </div>
      </div>

      <Card style={{ marginBottom: 24 }} loading={reconciliationLoading}>
        <Row gutter={24}>
          <Col span={6}>
            <Statistic
              title="First Transferred ITMOs (all-time)"
              value={fmt(reconciliation?.totalFirstTransferredItmos)}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Acquired ITMOs (all-time)"
              value={fmt(reconciliation?.totalAcquiredItmos)}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Recorded Corresponding Adjustments"
              value={fmt(reconciliation?.totalRecordedCAdj)}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Outstanding Gap"
              value={fmt(gap)}
              valueStyle={{ color: gap === 0 ? "#3f8600" : "#cf1322" }}
            />
          </Col>
        </Row>
        {reconciliation && gap !== 0 && (
          <Alert
            style={{ marginTop: 16 }}
            type={gap > 0 ? "warning" : "error"}
            showIcon
            message={
              gap > 0
                ? `${fmt(gap)} tCO2e of first-transferred ITMOs still need a corresponding adjustment recorded.`
                : `${fmt(Math.abs(gap))} tCO2e of corresponding adjustments have been over-recorded relative to actual first-transfer/acquire activity — review the records above.`
            }
          />
        )}
        {reconciliation && gap === 0 && (
          <Alert
            style={{ marginTop: 16 }}
            type="success"
            showIcon
            message="Fully reconciled — every first-transferred ITMO (net of acquired) has a recorded corresponding adjustment."
          />
        )}
      </Card>

      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 24,
          boxShadow:
            "0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px rgba(0,0,0,0.14), 0px 1px 3px rgba(0,0,0,0.12)",
        }}
      >
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <div style={{ fontSize: "1rem", fontWeight: 600 }}>
              All CA Records
            </div>
          </Col>
          <Col>
            {canManage && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate("/correspondingAdjustments/calculate")}
              >
                Calculate CA
              </Button>
            )}
          </Col>
        </Row>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="caId"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize,
            total: totalRecords,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
          }}
          onRow={(record) => ({
            onClick: () =>
              navigate(
                `/correspondingAdjustments/view/${record.caId}`
              ),
            style: { cursor: "pointer" },
          })}
        />
      </div>
    </div>
  );
};

export default CaManagement;

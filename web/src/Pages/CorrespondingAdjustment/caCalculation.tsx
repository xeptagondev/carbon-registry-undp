import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConnection } from "../../Context/ConnectionContext/connectionContext";
import { TimedPageInfoTitle } from "../../Components/Common/TimedPageInfoTitle/TimedPageInfoTitle";
import {
  Alert,
  Button,
  Col,
  Form,
  InputNumber,
  Row,
  Select,
  Tooltip,
  message,
} from "antd";
import { NdcType, NDC_TYPE_LABELS } from "../../Definitions/Enums/ndcType.enum";
import {
  CaMethod,
  CA_METHOD_LABELS,
  getCompatibleCaMethods,
} from "../../Definitions/Enums/caMethod.enum";
import CaPeriodTable, { CaPeriodYearRow } from "./caPeriodTable";
import "./caManagement.scss";

interface PeriodContext {
  hasNdcTarget: boolean;
  ndcStartYear: number | null;
  ndcEndYear: number | null;
  ndcType: NdcType | null;
  caMethod: CaMethod | null;
  caMethodResolved: boolean;
  years: CaPeriodYearRow[];
}

const CaCalculation = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "correspondingAdjust"]);
  const { get, post } = useConnection();
  const [form] = Form.useForm();

  const [year, setYear] = useState<number | null>(null);
  const [context, setContext] = useState<PeriodContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [rows, setRows] = useState<CaPeriodYearRow[]>([]);
  const [result, setResult] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // NDC Type and CA Method are derived from whichever NDC period covers
  // the reporting year — never picked by hand — so the calculation can
  // never disagree with what was actually filed in the initial report.
  const loadContext = async (y: number) => {
    setContextLoading(true);
    try {
      const response = await get(
        `national/correspondingAdjustment/periodSummary?year=${y}`
      );
      const data: PeriodContext = response?.data;
      setContext(data);
      setRows(data?.years ?? []);
      form.setFieldsValue({
        ndcType: data?.ndcType ?? undefined,
        caMethod: data?.caMethod ?? undefined,
      });
    } catch {
      setContext(null);
      setRows([]);
    } finally {
      setContextLoading(false);
    }
  };

  useEffect(() => {
    if (year == null) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadContext(year), 400);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const hasPeriod = context?.hasNdcTarget === true;
  const isAveraging = context?.caMethod === CaMethod.AVERAGING;
  // Trajectory finalizes per year; Averaging per NDC period, via the
  // list page's Finalize action rather than a per-year submit here.
  const gateYear = isAveraging ? context?.ndcEndYear ?? year : year;
  const gateOpen =
    gateYear != null && new Date().getUTCFullYear() > Number(gateYear);

  const onCalculate = async (values: any) => {
    setCalculating(true);
    setResult(null);
    try {
      const response = await post("national/correspondingAdjustment/preview", {
        year: values.year,
        reportingYearEmission: values.reportingYearEmission,
        ...(context && !context.caMethodResolved
          ? { caMethodOverride: values.caMethod }
          : {}),
      });
      if (response?.data) {
        setResult(response.data);
        setRows(response.data.years ?? []);
        message.success(t("correspondingAdjust:calculationComplete"));
      }
    } catch (error) {
      const serverMsg = (error as any)?.message;
      message.error(
        typeof serverMsg === "string"
          ? serverMsg
          : t("correspondingAdjust:calculateFailed")
      );
    } finally {
      setCalculating(false);
    }
  };

  const onSave = async (submit: boolean) => {
    const values = form.getFieldsValue();
    setSaving(submit ? "submit" : "draft");
    try {
      const response = await post("national/correspondingAdjustment/save", {
        year: values.year,
        reportingYearEmission: values.reportingYearEmission,
        submit,
        ...(context && !context.caMethodResolved
          ? { caMethodOverride: values.caMethod }
          : {}),
      });
      message.success(
        submit
          ? t("correspondingAdjust:adjustmentSubmitted")
          : t("correspondingAdjust:draftSaved")
      );
      const caId = response?.data?.caId;
      navigate(
        caId
          ? `/correspondingAdjustments/view/${caId}`
          : "/correspondingAdjustments/viewAll"
      );
    } catch (error) {
      const serverMsg = (error as any)?.message;
      message.error(
        typeof serverMsg === "string"
          ? serverMsg
          : t("correspondingAdjust:saveFailed")
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="corresponding-adjustment-container">
      <div className="title-bar">
        <TimedPageInfoTitle
          title={t("correspondingAdjust:calculateCorrespondingAdjustment")}
          description={t(
            "correspondingAdjust:calculateCorrespondingAdjustmentDesc"
          )}
          infoButtonLabel={t(
            "correspondingAdjust:showCalculateCorrespondingAdjustmentDesc"
          )}
        />
      </div>
      <div className="content-card">
        <Form form={form} layout="vertical" onFinish={onCalculate}>
          <Row gutter={24}>
            <Col span={6}>
              <Form.Item
                name="year"
                label={t("correspondingAdjust:reportingYear")}
                rules={[
                  { required: true, message: t("correspondingAdjust:yearRequired") },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={1990}
                  max={2100}
                  placeholder={t("correspondingAdjust:reportingYearPlaceholder")}
                  onChange={(v) => setYear(v == null ? null : Number(v))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="reportingYearEmission"
                label={t("correspondingAdjust:reportingYearEmission")}
                rules={[
                  {
                    required: true,
                    message: t(
                      "correspondingAdjust:reportingYearEmissionRequired"
                    ),
                  },
                ]}
                tooltip={t("correspondingAdjust:reportingYearTooltip")}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  addonAfter="tCO2e"
                  placeholder={t(
                    "correspondingAdjust:reportingYearEmissionPlaceholder"
                  )}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="ndcType"
                label={t("correspondingAdjust:columnNdcType")}
                extra={t("correspondingAdjust:ndcTypeDerivedHint")}
              >
                <Select
                  disabled
                  loading={contextLoading}
                  placeholder="—"
                  options={Object.values(NdcType).map((value) => ({
                    value,
                    label: NDC_TYPE_LABELS[value],
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="caMethod"
                label={t("correspondingAdjust:columnCaMethod")}
                extra={
                  context && !context.caMethodResolved
                    ? t("correspondingAdjust:caMethodOverrideHint")
                    : t("correspondingAdjust:caMethodDerivedHint")
                }
              >
                <Select
                  disabled={!context || context.caMethodResolved}
                  loading={contextLoading}
                  placeholder="—"
                  options={getCompatibleCaMethods(
                    context?.ndcType ?? undefined
                  ).map((value) => ({
                    value,
                    label: CA_METHOD_LABELS[value],
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {year != null && !contextLoading && context && !hasPeriod && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={t("correspondingAdjust:noNdcTargetTitle", { year })}
              description={t("correspondingAdjust:noNdcTargetDescription")}
            />
          )}

          <Row justify="end" gutter={16}>
            <Col>
              <Button onClick={() => navigate("/correspondingAdjustments/viewAll")}>
                {t("correspondingAdjust:cancel")}
              </Button>
            </Col>
            <Col>
              <Button
                type="primary"
                htmlType="submit"
                loading={calculating}
                disabled={!hasPeriod}
              >
                {t("correspondingAdjust:calculate")}
              </Button>
            </Col>
          </Row>
        </Form>

        {hasPeriod && rows.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div className="table-title" style={{ marginBottom: 12 }}>
              {t("correspondingAdjust:ndcPeriodLabel", {
                start: context?.ndcStartYear,
                end: context?.ndcEndYear,
              })}
            </div>
            <CaPeriodTable
              rows={rows}
              reportingYear={year ?? undefined}
              loading={contextLoading}
              isAveraging={isAveraging}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
              {t("correspondingAdjust:periodTableFootnotePrefix")}{" "}
              {isAveraging
                ? t("correspondingAdjust:periodTableFootnoteAveraging")
                : t("correspondingAdjust:periodTableFootnoteTrajectory")}
            </div>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 24 }}>
            <Alert
              type={result.safeguardCheckPassed ? "success" : "warning"}
              message={
                result.safeguardCheckPassed
                  ? t("correspondingAdjust:safeguardCheckPassedTitle")
                  : t("correspondingAdjust:safeguardCheckFailedTitle")
              }
              description={result.safeguardNotes}
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Row justify="end" gutter={16}>
              <Col>
                <Button
                  loading={saving === "draft"}
                  disabled={saving !== null}
                  onClick={() => onSave(false)}
                >
                  {t("correspondingAdjust:saveDraft")}
                </Button>
              </Col>
              <Col>
                <Tooltip
                  title={
                    gateOpen
                      ? undefined
                      : isAveraging
                      ? t("correspondingAdjust:submitBlockedPeriod", {
                          nextYear: Number(context?.ndcEndYear) + 1,
                        })
                      : t("correspondingAdjust:submitBlockedYear", {
                          year,
                          nextYear: Number(year) + 1,
                        })
                  }
                >
                  <span>
                    <Button
                      type="primary"
                      loading={saving === "submit"}
                      disabled={saving !== null || !gateOpen}
                      onClick={() => onSave(true)}
                    >
                      {t("correspondingAdjust:submit")}
                    </Button>
                  </span>
                </Tooltip>
              </Col>
            </Row>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaCalculation;

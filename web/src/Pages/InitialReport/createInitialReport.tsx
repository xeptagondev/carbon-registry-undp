import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConnection } from "../../Context/ConnectionContext/connectionContext";
import { TimedPageInfoTitle } from "../../Components/Common/TimedPageInfoTitle/TimedPageInfoTitle";
import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Tooltip,
  message,
} from "antd";
import { NdcType, NDC_TYPE_LABELS } from "../../Definitions/Enums/ndcType.enum";
import {
  CA_METHOD_LABELS,
  getCompatibleCaMethods,
} from "../../Definitions/Enums/caMethod.enum";
import { Sector } from "../../Definitions/Enums/sector.enum";
import "./initialReports.scss";

const { TextArea } = Input;

// The initial report is filed for an NDC implementation period, not for
// a single cooperative approach — approaches are attached afterwards
// from the report's detail page (Add Cooperative Approach), the same
// way authorized entities are attached to a cooperative approach. A
// draft with no approach cannot be submitted, but it can be created and
// saved with just the general fields below.
const CreateInitialReport = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "InitialReport"]);
  const { post } = useConnection();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const sectors: string[] = (values.sectors ?? []).filter(
        (s: string) => s && s.trim().length > 0
      );
      const response = await post("national/initialReport/generate", {
        ndcStartYear: values.ndcStartYear,
        ndcEndYear: values.ndcEndYear,
        ndcType: values.ndcType,
        baseYear: values.baseYear,
        baseYearEmission:
          values.baseYearEmission !== undefined && values.baseYearEmission !== null
            ? Number(values.baseYearEmission)
            : undefined,
        ndcTarget:
          values.ndcTarget !== undefined && values.ndcTarget !== null
            ? Number(values.ndcTarget)
            : undefined,
        caMethod: values.caMethod,
        caMethodDescription: values.caMethodDescription || "",
        sectors,
        environmentalIntegrity: {
          noNetIncrease: values.environmentalIntegrityAssessment ?? "",
          conservativeBaselines: "",
          nonPermanenceRisk: "",
          leakageRisk: "",
        },
      });
      message.success("Initial report draft generated");
      const reportNumber = response?.data?.reportNumber;
      // Land on the detail page so the user can attach cooperative
      // approaches straight away — that's the very next step and the
      // report cannot be submitted without at least one.
      navigate(
        reportNumber
          ? `/initialReports/view/${reportNumber}`
          : "/initialReports/viewAll"
      );
    } catch (error: any) {
      const serverMsg = error?.message;
      message.error(
        serverMsg && typeof serverMsg === "string"
          ? serverMsg
          : "Failed to generate initial report"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="initial-reports-container">
      <div className="title-bar">
        <TimedPageInfoTitle
          title={t("InitialReport:generateReport")}
          description={t("InitialReport:generateInitialReportDescription")}
          infoButtonLabel={t(
            "InitialReport:showGenerateInitialReportDescription"
          )}
        />
      </div>
      <div className="content-card">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <div className="section-title">NDC Information</div>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                name="ndcStartYear"
                label="NDC Start Year"
                rules={[
                  { required: true, message: "NDC start year is required" },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={1900}
                  max={2100}
                  placeholder="e.g. 2021"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="ndcEndYear"
                label="NDC End Year"
                dependencies={["ndcStartYear"]}
                rules={[
                  { required: true, message: "NDC end year is required" },
                  {
                    validator: (_r, v) => {
                      if (v === undefined || v === null || v === "")
                        return Promise.resolve();
                      const start = form.getFieldValue("ndcStartYear");
                      if (
                        start !== undefined &&
                        start !== null &&
                        start !== "" &&
                        Number(start) > Number(v)
                      )
                        return Promise.reject(
                          "NDC end year must be on or after the start year"
                        );
                      return Promise.resolve();
                    },
                  },
                  {
                    // Preflight for the "no two reports may cover
                    // overlapping NDC periods" guarantee — the backend
                    // enforces this for real (a partial GIST exclusion
                    // constraint, checked from generate onwards, not
                    // just at submit), this just surfaces the conflict
                    // before the user finishes the form. Two inclusive
                    // ranges [a,b] and [c,d] overlap iff a <= d AND c <=
                    // b, so an existing report overlaps the one being
                    // entered iff its start is <= this end AND its end
                    // is >= this start.
                    validator: async (_r, v) => {
                      const start = form.getFieldValue("ndcStartYear");
                      if (
                        v === undefined || v === null || v === "" ||
                        start === undefined || start === null || start === ""
                      )
                        return Promise.resolve();
                      try {
                        const existing = await post("national/initialReport/query", {
                          page: 1,
                          size: 1,
                          filterAnd: [
                            { key: "ndcStartYear", operation: "<=", value: Number(v) },
                            { key: "ndcEndYear", operation: ">=", value: Number(start) },
                          ],
                        });
                        const rows = existing?.data ?? [];
                        if (rows.length > 0) {
                          throw new Error(
                            `NDC period ${start}–${v} overlaps initial report ${rows[0].reportNumber}'s period (${rows[0].ndcStartYear}–${rows[0].ndcEndYear}).`
                          );
                        }
                      } catch (err: any) {
                        if (err instanceof Error) throw err;
                        // network/auth issues surface via the submit-time
                        // error path; don't block validation because the
                        // preflight itself failed.
                      }
                    },
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={1900}
                  max={2100}
                  placeholder="e.g. 2030"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="ndcType"
                label="NDC Type"
                rules={[{ required: true, message: "NDC type is required" }]}
                initialValue={NdcType.SINGLE_YEAR}
              >
                {/* MultiYear NDCs are not supported yet — kept
                    selectable-but-disabled rather than hidden so the
                    option's existence (and why it can't be picked) is
                    visible. The backend rejects it at submit too. */}
                <Select
                  onChange={() => {
                    // The CA Method options depend on NDC Type
                    // (SingleYear -> Trajectory/Averaging, MultiYear ->
                    // MultiYear); a method valid under the old type may
                    // not be valid under the new one, so clear it.
                    form.setFieldValue("caMethod", undefined);
                  }}
                >
                  <Select.Option value={NdcType.SINGLE_YEAR}>
                    {NDC_TYPE_LABELS[NdcType.SINGLE_YEAR]}
                  </Select.Option>
                  <Select.Option value={NdcType.MULTI_YEAR} disabled>
                    <Tooltip title="Multi-year NDCs are not supported yet">
                      {NDC_TYPE_LABELS[NdcType.MULTI_YEAR]}
                    </Tooltip>
                  </Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                name="baseYear"
                label="Base Year"
                dependencies={["ndcEndYear"]}
                rules={[
                  { required: true, message: "Base year is required" },
                  {
                    validator: (_r, v) => {
                      if (v === undefined || v === null || v === "")
                        return Promise.resolve();
                      const n = Number(v);
                      if (!Number.isInteger(n) || n < 1900 || n > 2100)
                        return Promise.reject(
                          "Base year must be between 1900 and 2100"
                        );
                      const end = form.getFieldValue("ndcEndYear");
                      if (end !== undefined && end !== null && end !== "" && n >= Number(end))
                        return Promise.reject(
                          "Base year must be before the NDC end year"
                        );
                      return Promise.resolve();
                    },
                  },
                ]}
                tooltip="The emission trajectory's origin year."
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={1900}
                  max={2100}
                  placeholder="e.g. 2015"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="baseYearEmission"
                label="Base Year Emission (tCO2eq)"
                rules={[
                  { required: true, message: "Base year emission is required" },
                  {
                    validator: (_r, v) => {
                      if (v === undefined || v === null || v === "")
                        return Promise.resolve();
                      const n = Number(v);
                      if (Number.isNaN(n) || n < 0)
                        return Promise.reject(
                          "Base year emission must be a non-negative number"
                        );
                      return Promise.resolve();
                    },
                  },
                ]}
                tooltip="The country's emissions in the base year — the trajectory's starting point."
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="e.g. 100000"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="ndcTarget"
                label="NDC Target (tCO2eq)"
                rules={[
                  { required: true, message: "NDC target is required" },
                  {
                    validator: (_r, v) => {
                      if (v === undefined || v === null || v === "")
                        return Promise.resolve();
                      const n = Number(v);
                      if (Number.isNaN(n) || n < 0)
                        return Promise.reject(
                          "NDC target must be a non-negative number"
                        );
                      return Promise.resolve();
                    },
                  },
                ]}
                tooltip="The value at the NDC end year — the trajectory interpolates a straight line to it from the base year's emissions."
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  placeholder="e.g. 500000"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="sectors"
                label="Sectors"
                rules={[
                  {
                    validator: (_r, v) => {
                      const arr: string[] = Array.isArray(v) ? v : [];
                      if (arr.length === 0)
                        return Promise.reject("Add at least one sector");
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Select
                  mode="multiple"
                  placeholder="Select sectors"
                  options={Object.values(Sector).map((s) => ({
                    value: s,
                    label: s,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                name="environmentalIntegrityAssessment"
                label="Environmental Integrity Assessment"
              >
                <TextArea
                  rows={3}
                  placeholder="Conservative baselines; no double counting; additionality demonstrated."
                />
              </Form.Item>
            </Col>
          </Row>
          <div className="section-title">Corresponding Adjustment Method</div>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.ndcType !== curr.ndcType}>
                {() => {
                  const ndcType = form.getFieldValue("ndcType");
                  const allowedMethods = getCompatibleCaMethods(ndcType);
                  return (
                    <Form.Item
                      name="caMethod"
                      label="CA Method"
                      rules={[{ required: true, message: "CA method is required" }]}
                      // SingleYear -> Trajectory/Averaging, MultiYear ->
                      // MultiYear (isNdcMethodCompatible, mirrored in
                      // caMethod.enum.ts's getCompatibleCaMethods).
                      tooltip={
                        ndcType === NdcType.MULTI_YEAR
                          ? "Multi-Year NDCs require the Multi-Year method"
                          : "Trajectory and Averaging are computed identically for a Single-Year NDC target"
                      }
                    >
                      <Select
                        options={allowedMethods.map((value) => ({
                          value,
                          label: CA_METHOD_LABELS[value],
                        }))}
                      />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                name="caMethodDescription"
                label="Corresponding Adjustment Method Description"
              >
                <TextArea
                  rows={4}
                  placeholder="Describe the chosen CA method (trajectory, averaging, or multi-year) and rationale"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row justify="end" gutter={16} style={{ marginTop: 16 }}>
            <Col>
              <Button onClick={() => navigate("/initialReports/viewAll")}>
                Cancel
              </Button>
            </Col>
            <Col>
              <Button type="primary" htmlType="submit" loading={loading}>
                Generate Draft
              </Button>
            </Col>
          </Row>
        </Form>
      </div>
    </div>
  );
};

export default CreateInitialReport;

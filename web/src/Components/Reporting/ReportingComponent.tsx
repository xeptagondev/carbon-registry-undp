import { i18n } from "i18next";
import { useEffect, useMemo, useState } from "react";
import "./ReportingComponent.scss";
import { Checkbox, DatePicker, Empty, Row } from "antd";
import moment, { Moment } from "moment";
import ReportCard from "./ReportCard";
import SubmitAefModal from "./SubmitAefModal";
import {
  getActionsReportColumns,
  getAuthorizationsReportColumns,
  getAuthorizedEntitiesReportColumns,
  getHoldingsReportColumns,
  getSubmissionReportColumns,
  Translate,
} from "./reportingColumns";
import {
  FILE_TYPES,
  REPORT_TYPES,
  SELECTABLE_REPORT_TYPES,
  SUBMISSION_STATUS,
  TABULAR_REPORT_TYPES,
} from "./reportTypes";
import { useConnection } from "../../Context/ConnectionContext/connectionContext";
import { API_PATHS } from "../../Config/apiConfig";
import { Loading } from "../Loading/loading";
import { TimedPageInfoTitle } from "../Common/TimedPageInfoTitle/TimedPageInfoTitle";

/**
 * AEF V2 reporting — the five tables of Decision 4/CMA.6, Annex II.
 *
 * Replaces the V1 Actions/Holdings pair. The V1 backend is untouched; nothing
 * here points at it.
 *
 * State is one record keyed by table rather than a `useState` triple per report:
 * at five tables the old shape would have meant fifteen state hooks and ten
 * near-identical fetch/download functions.
 */

type TableState = {
  loading: boolean;
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
};

const initialTableState = (): Record<string, TableState> =>
  TABULAR_REPORT_TYPES.reduce(
    (acc, type) => ({
      ...acc,
      [type]: { loading: false, data: [], total: 0, page: 1, pageSize: 10 },
    }),
    {} as Record<string, TableState>
  );

/**
 * Submission takes an extra argument — the row-action handler — so it is built
 * at the call site rather than through this map.
 */
const COLUMN_BUILDERS: Record<string, (t: Translate) => Record<string, unknown>[]> = {
  [REPORT_TYPES.AUTHORIZATIONS]: getAuthorizationsReportColumns,
  [REPORT_TYPES.ACTIONS]: getActionsReportColumns,
  [REPORT_TYPES.HOLDINGS]: getHoldingsReportColumns,
  [REPORT_TYPES.AUTHORIZED_ENTITIES]: getAuthorizedEntitiesReportColumns,
};

const ReportingComponent = (props: { translator: i18n }) => {
  const { translator } = props;
  const t = translator.t;

  const { get, post } = useConnection();

  const [selectedYear, setSelectedYear] = useState<Moment>(moment());
  const [selectedReports, setSelectedReports] = useState<REPORT_TYPES[]>([
    ...SELECTABLE_REPORT_TYPES,
  ]);
  const [tableState, setTableState] = useState<Record<string, TableState>>(initialTableState);
  const [submitTarget, setSubmitTarget] = useState<Record<string, unknown> | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [partyName, setPartyName] = useState<string>();

  const reportedYear = selectedYear.year();

  /**
   * The reporting Party's display name, e.g. `"Nigeria"` for host party `NG`.
   * Read from the cooperative approach host party rather than an env var, so
   * it reflects this deployment's actual registry data.
   */
  useEffect(() => {
    (async () => {
      try {
        const response = await get(API_PATHS.AEF_HOST_PARTY);
        setPartyName(response?.data?.name);
      } catch (error) {
        console.error("Failed to load AEF host party", error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Holdings for a year that has not been snapshotted are live and still
   * moving. They must not be presented identically to a filed snapshot — that
   * is how a half-year balance gets mistaken for a year-end one.
   *
   * TODO: read this off the AEF V2 Holdings response (`provisional`) once the
   * backend lands. Until then, the current year is the only one assumed open.
   */
  const holdingsProvisional = reportedYear >= moment().year();

  const setTable = (type: REPORT_TYPES, patch: Partial<TableState>) =>
    setTableState((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  const handlePaginationInfoChange = (page: number, pageSize: number, type: REPORT_TYPES) =>
    setTable(type, { page, pageSize });

  /**
   * TODO: replace with the AEF V2 query endpoint once the backend lands.
   *
   * Tables are empty until then — there is no live data source yet for any of
   * the five.
   */
  const rowsFor = (type: REPORT_TYPES): Record<string, unknown>[] => {
    switch (type) {
      case REPORT_TYPES.SUBMISSION:
      case REPORT_TYPES.AUTHORIZATIONS:
      case REPORT_TYPES.ACTIONS:
      case REPORT_TYPES.HOLDINGS:
      case REPORT_TYPES.AUTHORIZED_ENTITIES:
      default:
        return [];
    }
  };

  /** One fetcher for every table; the V1 pair differed only in two literals. */
  const fetchTable = async (type: REPORT_TYPES) => {
    setTable(type, { loading: true });
    try {
      const rows = rowsFor(type);
      setTable(type, { data: rows, total: rows.length });
    } finally {
      setTable(type, { loading: false });
    }
  };

  /**
   * Files the AEF: sets the status to SUBMITTED and stamps the submission date,
   * which is deliberately empty until this point.
   *
   * TODO: call the backend's markSubmitted once the API lands. Until then the
   * change is local so the flow is reviewable end to end.
   */
  const confirmSubmit = async (submissionDate: Moment) => {
    if (!submitTarget) {
      return;
    }
    setSubmitting(true);
    try {
      const updated = {
        ...submitTarget,
        status: SUBMISSION_STATUS.SUBMITTED,
        aefT1SubmissionSubmissionDate: submissionDate.format("DD/MM/YYYY"),
      };
      setTable(REPORT_TYPES.SUBMISSION, { data: [updated], total: 1 });
      setSubmitTarget(undefined);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    TABULAR_REPORT_TYPES.forEach((type) => fetchTable(type));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  /**
   * Exports the **whole** submission — all five tables for the reporting year —
   * as one file. XLSX gets a sheet per table; CSV stacks them with section
   * titles, the same layout `AEF_CMA6_second_iteration.csv` uses.
   *
   * There is deliberately no per-table export: a CARP submission is the five
   * tables together, so a single table's file was never the deliverable.
   *
   * Still wired to the existing endpoint, which serves V1 shapes — so this will
   * fail until the V2 API wiring follow-up. Left wired rather than stubbed, so
   * that follow-up cannot quietly forget to restore it.
   */
  const downloadSubmission = async (fileType: FILE_TYPES) => {
    setTable(REPORT_TYPES.SUBMISSION, { loading: true });
    try {
      const res = await post(API_PATHS.DOWNLOAD_AEF_RECORDS, {
        fileType,
        reportedYear,
      });

      if (res?.statusText === "SUCCESS") {
        const url = res.data.url;
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = res.data.outputFileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("AEF export failed", error);
    } finally {
      setTable(REPORT_TYPES.SUBMISSION, { loading: false });
    }
  };

  const anyLoading = useMemo(
    () => TABULAR_REPORT_TYPES.some((type) => tableState[type]?.loading),
    [tableState]
  );

  const allSelected = selectedReports.length === SELECTABLE_REPORT_TYPES.length;
  /** Drives the "All" checkbox's indeterminate dash when the selection is partial. */
  const someSelected = selectedReports.length > 0 && !allSelected;

  const disabledDate = (current: Moment) => current && current.year() < 1970;

  /**
   * One card renderer for all five tables.
   *
   * Extracted because Submission renders above the table-picker checkboxes and
   * the rest below it, so the two groups can no longer share a single `map`.
   */
  const renderCard = (type: REPORT_TYPES) => (
    <ReportCard
      key={type}
      t={t}
      title={t(`reporting:${type}`)}
      reportType={type}
      /* Submission carries Party and Reported year as columns already. */
      party={type === REPORT_TYPES.SUBMISSION ? undefined : partyName ?? "-"}
      year={type === REPORT_TYPES.SUBMISSION ? undefined : reportedYear}
      provisional={type === REPORT_TYPES.HOLDINGS && holdingsProvisional}
      columns={
        type === REPORT_TYPES.SUBMISSION
          ? getSubmissionReportColumns(t, setSubmitTarget)
          : COLUMN_BUILDERS[type](t)
      }
      data={tableState[type]?.data ?? []}
      handlePaginationChange={handlePaginationInfoChange}
      pagination={{
        total: tableState[type]?.total ?? 0,
        current: tableState[type]?.page ?? 1,
        pageSize: tableState[type]?.pageSize ?? 10,
        pageSizeOptions: [10, 20, 30],
      }}
      downloadCSV={
        type === REPORT_TYPES.SUBMISSION ? () => downloadSubmission(FILE_TYPES.csv) : undefined
      }
      downloadExcel={
        type === REPORT_TYPES.SUBMISSION ? () => downloadSubmission(FILE_TYPES.xlsx) : undefined
      }
    />
  );

  return (
    <div className="reporting-container">
      <div className="title-container">
        <Row justify="space-between">
          <TimedPageInfoTitle
            title={t("reporting:reportsTitle")}
            description={t("reporting:reportsPageDescription")}
            infoButtonLabel={t("reporting:showReportsPageDescription")}
            titleClassName="main"
          />
        </Row>

        <Row justify="end">
          <DatePicker
            size="large"
            picker="year"
            allowClear={false}
            value={selectedYear}
            disabledDate={disabledDate}
            onChange={(value) => setSelectedYear(moment(value).local())}
          />
        </Row>

      </div>

      {anyLoading && <Loading />}

      {renderCard(REPORT_TYPES.SUBMISSION)}

      {/*
        The picker sits between Submission and the four it controls, so it reads
        as a control for what follows rather than for the whole page — Submission
        is always on screen and is not one of its options.
      */}
      <Row className="report-type-checkboxes">
        <Checkbox
          className="all-check"
          indeterminate={someSelected}
          checked={allSelected}
          onChange={(e) =>
            setSelectedReports(e.target.checked ? [...SELECTABLE_REPORT_TYPES] : [])
          }
        >
          {t("reporting:allReports")}
        </Checkbox>

        <Checkbox.Group
          value={selectedReports}
          onChange={(values) => setSelectedReports(values as REPORT_TYPES[])}
          options={SELECTABLE_REPORT_TYPES.map((type) => ({
            label: t(`reporting:${type}`),
            value: type,
          }))}
        />
      </Row>

      {SELECTABLE_REPORT_TYPES.filter((type) => selectedReports.includes(type)).map(renderCard)}

      {/* Submission is still on screen above, so this reads as "the four are hidden". */}
      {selectedReports.length === 0 && (
        <div className="no-reports">
          <Empty description={<span className="description">{t("reporting:noReports")}</span>} />
        </div>
      )}

      <SubmitAefModal
        t={t}
        open={submitTarget !== undefined}
        submission={submitTarget}
        confirming={submitting}
        onCancel={() => setSubmitTarget(undefined)}
        onConfirm={confirmSubmit}
      />
    </div>
  );
};

export default ReportingComponent;

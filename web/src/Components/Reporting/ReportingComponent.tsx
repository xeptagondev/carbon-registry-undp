import { i18n } from 'i18next';
import React, { useState } from 'react';
import './ReportingComponent.scss';
import { DatePicker, Empty, Row, Select } from 'antd';
import moment from 'moment';
import ReportCard from './ReportCard';
import { getActionsReportColumns, getHoldingsReportColumns } from './reportingColumns';
import { ReportTypes } from './reportTypes';

const ReportingComponent = (props: { translator: i18n }) => {
  const { translator } = props;

  const t = translator.t;

  const [selectedReports, setSelectedReports] = useState<{
    [ReportTypes.ACTIONS]: boolean;
    [ReportTypes.HOLDINGS]: boolean;
  }>({
    [ReportTypes.ACTIONS]: false,
    [ReportTypes.HOLDINGS]: false,
  });

  const [paginationInfo, setPaginationInfo] = useState<
    Partial<Record<keyof typeof ReportTypes, { page: number; pageSize: number }>>
  >({
    [ReportTypes.ACTIONS]: {
      page: 0,
      pageSize: 10,
    },
    [ReportTypes.HOLDINGS]: {
      page: 0,
      pageSize: 10,
    },
  });

  const handlePaginationInfoChange = (page: number, pageSize: number, reportType: ReportTypes) => {
    setPaginationInfo((prev) => ({
      ...prev,
      [reportType]: {
        page: page,
        pageSize: pageSize,
      },
    }));

    console.log('-----paginationInfo--------', paginationInfo);
  };

  const [selectedYear, setSelectedYear] = useState<any>();

  const checkIfAnyReportIsSelected = () => {
    const isReportSelected = Object.values(selectedReports).some(Boolean);
    console.log('---------isReportSelected---------', isReportSelected);
    return isReportSelected;
  };

  return (
    <div className="reporting-container">
      <div className="title-container">
        <Row justify={'space-between'}>
          <div className="main">{t('reporting:reportsTitle')}</div>
        </Row>
        <Row justify={'end'}>
          <DatePicker
            size="large"
            picker="year"
            onChange={(value: any) => {
              console.log('---------value-----------', value);
              const date = moment(value).local();
              setSelectedYear(date);
            }}
          />
        </Row>

        <Row className="mg-top-2">
          <Select
            size="large"
            placeholder="click to select the Reports to display"
            mode={'multiple'}
            className="report-type-selector"
            onSelect={(value) =>
              setSelectedReports((prev) => ({
                ...prev,
                [value]: true,
              }))
            }
            onDeselect={(value) =>
              setSelectedReports((prev) => ({
                ...prev,
                [value]: false,
              }))
            }
          >
            {Object.keys(ReportTypes).map((type: any) => (
              <Select.Option value={type}>{t(`reporting:${type}`)}</Select.Option>
            ))}
          </Select>
        </Row>
      </div>

      {selectedReports[ReportTypes.ACTIONS] && (
        <ReportCard
          title={'Actions Report'}
          reportType={ReportTypes.ACTIONS}
          host={'Sri lanka'}
          year="2025"
          columns={getActionsReportColumns(t)}
          handlePaginationChange={handlePaginationInfoChange}
          pagination={{
            total: 10,
            current: paginationInfo[ReportTypes.ACTIONS]?.page || 1,
            pageSize: paginationInfo[ReportTypes.ACTIONS]?.pageSize || 1,
            pageSizeOptions: [10, 20, 30],
          }}
          data={[]}
          downloadCSV={() => {}}
          downloadExcel={() => {}}
        />
      )}

      {selectedReports[ReportTypes.HOLDINGS] && (
        <ReportCard
          title={'Holdings Report'}
          reportType={ReportTypes.ACTIONS}
          host={'Sri lanka'}
          year="2025"
          columns={getHoldingsReportColumns(t)}
          handlePaginationChange={handlePaginationInfoChange}
          pagination={{
            total: 10,
            current: paginationInfo[ReportTypes.HOLDINGS]?.page || 1,
            pageSize: paginationInfo[ReportTypes.HOLDINGS]?.pageSize || 1,
            pageSizeOptions: [10, 20, 30],
          }}
          data={[]}
          downloadCSV={() => {}}
          downloadExcel={() => {}}
        />
      )}

      {!checkIfAnyReportIsSelected() && (
        <div className="no-reports">
          <Empty description={<span className="description">No report found !</span>} />
        </div>
      )}
    </div>
  );
};

export default ReportingComponent;

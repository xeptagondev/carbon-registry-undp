import { i18n } from 'i18next';
import React, { useEffect, useState } from 'react';
import './ReportingComponent.scss';
import { DatePicker, Empty, Row, Select } from 'antd';
import moment, { Moment } from 'moment';
import ReportCard from './ReportCard';
import { getActionsReportColumns, getHoldingsReportColumns } from './reportingColumns';
import { FileTypes, ReportTypes } from './reportTypes';
import { useConnection } from '../../Context/ConnectionContext/connectionContext';
import { API_PATHS } from '../../Config/apiConfig';
import { Loading } from '../Loading/loading';

const ReportingComponent = (props: { translator: i18n }) => {
  const { translator } = props;

  const t = translator.t;

  const { post } = useConnection();

  const [actionsLoading, setActionsLoading] = useState<boolean>(false);
  const [holdingsLoading, setHoldingsLoading] = useState<boolean>(false);

  const [actionsCount, setActionsCount] = useState<number>(0);
  const [holdingsCount, setHoldingsCount] = useState<number>(0);

  const [selectedYearsArr, setSelectedYearsArr] = useState([
    ReportTypes.ACTIONS,
    ReportTypes.HOLDINGS,
  ]);

  const [selectedReports, setSelectedReports] = useState<{
    [ReportTypes.ACTIONS]: boolean;
    [ReportTypes.HOLDINGS]: boolean;
  }>({
    [ReportTypes.ACTIONS]: true,
    [ReportTypes.HOLDINGS]: true,
  });

  const [actionsData, setActionsData] = useState<any[]>([]);
  const [holdingsData, setHoldingsData] = useState<any[]>([]);

  const [paginationInfo, setPaginationInfo] = useState<
    Partial<Record<keyof typeof ReportTypes, { page: number; pageSize: number }>>
  >({
    [ReportTypes.ACTIONS]: {
      page: 1,
      pageSize: 10,
    },
    [ReportTypes.HOLDINGS]: {
      page: 1,
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
  };

  const [selectedYear, setSelectedYear] = useState<Moment>(moment());

  const getActionsReports = async () => {
    try {
      setActionsLoading(true);
      const res = await post(API_PATHS.QUERY_AEF_RECORDS, {
        page: paginationInfo[ReportTypes.ACTIONS]?.page,
        size: paginationInfo[ReportTypes.ACTIONS]?.pageSize,
        filterAnd: [
          {
            key: 'actionTime',
            operation: '>',
            value: selectedYear.startOf('year').valueOf(),
          },
          {
            key: 'actionTime',
            operation: '<',
            value: selectedYear.endOf('year').valueOf(),
          },
        ],
        sort: {
          key: 'createdTime',
          order: 'DESC',
        },
      });

      if (res?.statusText === 'SUCCESS') {
        setActionsData(res?.data);
        setActionsCount(res?.response?.data?.total);
      }
    } catch (error: any) {
      console.log('error:', error);
    } finally {
      setActionsLoading(false);
    }
  };

  const getHoldingReports = async () => {
    try {
      setHoldingsLoading(true);
      const res = await post(API_PATHS.QUERY_AEF_RECORDS, {
        page: paginationInfo[ReportTypes.HOLDINGS]?.page,
        size: paginationInfo[ReportTypes.HOLDINGS]?.pageSize,
        filterAnd: [
          {
            key: 'actionTime',
            operation: '>',
            value: selectedYear.startOf('year').valueOf(),
          },
          {
            key: 'actionTime',
            operation: '<',
            value: selectedYear.endOf('year').valueOf(),
          },
          {
            key: 'actionType',
            operation: '=',
            value: 'authorization',
          },
        ],
        sort: {
          key: 'createdTime',
          order: 'DESC',
        },
      });

      console.log('---------------res--------------', res);
      if (res?.statusText === 'SUCCESS') {
        setHoldingsData(res?.data);
        setHoldingsCount(res?.response?.data?.total);
      }
    } catch (error) {
      console.log('error:', error);
    } finally {
      setHoldingsLoading(false);
    }
  };

  useEffect(() => {
    getActionsReports();
    getHoldingReports();
  }, [selectedYear, paginationInfo]);

  const checkIfAnyReportIsSelected = () => {
    const isReportSelected = Object.values(selectedReports).some(Boolean);
    return isReportSelected;
  };

  const downloadActionCSV = async () => {
    try {
      setActionsLoading(true);
      const res = await post(API_PATHS.DOWNLOAD_AEF_RECORDS, {
        reportType: ReportTypes.ACTIONS,
        fileType: FileTypes.csv,
      });

      console.log('--------res--------', res);

      if (res?.statusText === 'SUCCESS') {
        const url = res.data.url;
        const a = document.createElement('a');
        a.href = url;
        a.download = res.data.outputFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.log('error:', error);
    } finally {
      setActionsLoading(false);
    }
  };

  const downloadActionExcell = async () => {
    try {
      setActionsLoading(true);
      const res = await post(API_PATHS.DOWNLOAD_AEF_RECORDS, {
        reportType: ReportTypes.ACTIONS,
        fileType: FileTypes.xlsx,
      });

      console.log('--------res--------', res);

      if (res?.statusText === 'SUCCESS') {
        const url = res.data.url;
        const a = document.createElement('a');
        a.href = url;
        a.download = res.data.outputFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.log('error:', error);
    } finally {
      setActionsLoading(false);
    }
  };

  const downloadHoldingsCSV = async () => {
    try {
      setHoldingsLoading(true);
      const res = await post(API_PATHS.DOWNLOAD_AEF_RECORDS, {
        reportType: ReportTypes.HOLDINGS,
        fileType: FileTypes.csv,
      });

      console.log('--------res--------', res);

      if (res?.statusText === 'SUCCESS') {
        const url = res.data.url;
        const a = document.createElement('a');
        a.href = url;
        a.download = res.data.outputFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.log('error:', error);
    } finally {
      setHoldingsLoading(false);
    }
  };

  const downloadHoldingsExcell = async () => {
    try {
      setHoldingsLoading(true);
      const res = await post(API_PATHS.DOWNLOAD_AEF_RECORDS, {
        reportType: ReportTypes.HOLDINGS,
        fileType: FileTypes.xlsx,
      });

      console.log('--------res--------', res);

      if (res?.statusText === 'SUCCESS') {
        const url = res.data.url;
        const a = document.createElement('a');
        a.href = url;
        a.download = res.data.outputFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.log('error:', error);
    } finally {
      setHoldingsLoading(false);
    }
  };
  const disabledDate = (current: any) => {
    return current && current.year() < 1970;
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
            allowClear={false}
            value={selectedYear}
            disabledDate={disabledDate}
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
            placeholder="Click to select the Reports to display"
            mode={'multiple'}
            value={[...selectedYearsArr]}
            className="report-type-selector"
            onSelect={(value) => {
              setSelectedYearsArr((prev) => [...prev, value]);
              setSelectedReports((prev) => ({
                ...prev,
                [value]: true,
              }));
            }}
            onDeselect={(value) => {
              setSelectedYearsArr((prev) => [...prev.filter((item) => item !== value)]);
              setSelectedReports((prev) => ({
                ...prev,
                [value]: false,
              }));
            }}
          >
            {Object.keys(ReportTypes).map((type: any) => (
              <Select.Option value={type}>{t(`reporting:${String(type)}`)}</Select.Option>
            ))}
          </Select>
        </Row>
      </div>

      {(actionsLoading || holdingsLoading) && <Loading />}

      {selectedReports[ReportTypes.ACTIONS] && (
        <ReportCard
          title={'ACTIONS REPORT'}
          reportType={ReportTypes.ACTIONS}
          host={'Sri Lanka'}
          year={String(selectedYear.year())}
          columns={getActionsReportColumns(t)}
          handlePaginationChange={handlePaginationInfoChange}
          pagination={{
            total: actionsCount,
            current: paginationInfo[ReportTypes.ACTIONS]?.page || 1,
            pageSize: paginationInfo[ReportTypes.ACTIONS]?.pageSize || 1,
            pageSizeOptions: [10, 20, 30],
          }}
          data={actionsData || []}
          downloadCSV={downloadActionCSV}
          downloadExcel={downloadActionExcell}
        />
      )}

      {selectedReports[ReportTypes.HOLDINGS] && (
        <ReportCard
          title={'HOLDINGS REPORT'}
          reportType={ReportTypes.HOLDINGS}
          host={'Sri Lanka'}
          year={String(selectedYear.year())}
          columns={getHoldingsReportColumns(t)}
          handlePaginationChange={handlePaginationInfoChange}
          pagination={{
            total: holdingsCount,
            current: paginationInfo[ReportTypes.HOLDINGS]?.page || 1,
            pageSize: paginationInfo[ReportTypes.HOLDINGS]?.pageSize || 1,
            pageSizeOptions: [10, 20, 30],
          }}
          data={holdingsData || []}
          downloadCSV={downloadHoldingsCSV}
          downloadExcel={downloadHoldingsExcell}
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

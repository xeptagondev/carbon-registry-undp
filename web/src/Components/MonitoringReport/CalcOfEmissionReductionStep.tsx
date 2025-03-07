import { UploadOutlined } from '@ant-design/icons';
import { Button, Col, Form, Input, Row, Upload, DatePicker } from 'antd';
import TextArea from 'antd/lib/input/TextArea';
import { FormMode } from '../../Definitions/Enums/formMode.enum';
import LabelWithTooltip, { TooltipPostion } from '../LabelWithTooltip/LabelWithTooltip';
// import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import NetEmissionReduction from '../Common/NetEmissonReduction';
import { formatNumberWithDecimalPlaces } from '../../Utils/utilityHelper';
import moment from 'moment';

const EMISSION_CATEGORY_AVG_MAP: { [key: string]: string } = {
  baselineEmissionReductions: 'avgBaselineEmissionReductions',
  projectEmissionReductions: 'avgProjectEmissionReductions',
  leakageEmissionReductions: 'avgLeakageEmissionReductions',
  netEmissionReductions: 'avgNetEmissionReductions',
};

export const CalcEmissionReductionStep = (props: any) => {
  const {
    useLocation,
    translator,
    current,
    form,
    formMode,
    next,
    prev,
    onValueChange,
    projectCategory,
    disableFields,
    handleValuesUpdate,
  } = props;
  const maximumImageSize = process.env.REACT_APP_MAXIMUM_FILE_SIZE
    ? parseInt(process.env.REACT_APP_MAXIMUM_FILE_SIZE)
    : 5000000;
  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };
  const t = translator.t;

  // const calculateAnnualAverage = () => {
  //   const years = form.getFieldValue('yearsTotal');

  //   const beTotal = form.getFieldValue('baselineEmissionsTotal') || 0;
  //   const beAvg = Number(beTotal) / Number(years);
  //   form.setFieldValue('baselineEmissionsAverage', beAvg.toFixed(2));

  //   const peTotal = form.getFieldValue('projectEmissionsTotal') || 0;
  //   const peAvg = Number(peTotal) / Number(years);
  //   form.setFieldValue('projectEmissionsAverage', peAvg.toFixed(2));

  //   const leTotal = form.getFieldValue('leakageEmissionsTotal') || 0;
  //   const leAvg = Number(leTotal) / Number(years);
  //   form.setFieldValue('leakageEmissionsAverage', leAvg.toFixed(2));

  //   const ghgTotal = form.getFieldValue('ghgEmissionsTotal') || 0;
  //   const ghgAvg = Number(ghgTotal) / Number(years);
  //   form.setFieldValue('ghgEmissionsAverage', ghgAvg.toFixed(2));
  // };

  // const onEmissionsYearChange = () => {
  //   const listVals = form.getFieldValue('emissionReductionsRemovalsList');
  //   form.setFieldValue('yearsTotal', listVals.length);
  //   calculateAnnualAverage();
  // };

  // const onBaselineEmissionsChange = () => {
  //   const listVals = form.getFieldValue('emissionReductionsRemovalsList');
  //   let tempTotal = 0;
  //   if (listVals?.length) {
  //     listVals.forEach((item: any) => {
  //       tempTotal =
  //         typeof item?.baselineEmissions !== 'undefined'
  //           ? Number(item?.baselineEmissions) + tempTotal
  //           : tempTotal;
  //     });
  //   }
  //   form.setFieldValue('baselineEmissionsTotal', String(tempTotal));
  //   calculateAnnualAverage();
  // };

  // const onProjectEmissionsChange = () => {
  //   const listVals = form.getFieldValue('emissionReductionsRemovalsList');
  //   let tempTotal = 0;
  //   if (listVals?.length) {
  //     listVals.forEach((item: any) => {
  //       tempTotal =
  //         typeof item?.projectEmissions !== 'undefined'
  //           ? Number(item?.projectEmissions) + tempTotal
  //           : tempTotal;
  //     });
  //   }
  //   form.setFieldValue('projectEmissionsTotal', String(tempTotal));
  //   calculateAnnualAverage();
  // };

  // const onLeakageEmissionsChange = () => {
  //   const listVals = form.getFieldValue('emissionReductionsRemovalsList');
  //   let tempTotal = 0;
  //   if (listVals?.length) {
  //     listVals.forEach((item: any) => {
  //       tempTotal =
  //         typeof item?.leakageEmissions !== 'undefined'
  //           ? Number(item?.leakageEmissions) + tempTotal
  //           : tempTotal;
  //     });
  //   }
  //   form.setFieldValue('leakageEmissionsTotal', String(tempTotal));
  //   calculateAnnualAverage();
  // };
  // const onGhgEmissionsChange = () => {
  //   const listVals = form.getFieldValue('emissionReductionsRemovalsList');
  //   let tempTotal = 0;
  //   if (listVals?.length) {
  //     listVals.forEach((item: any) => {
  //       tempTotal =
  //         typeof item?.ghgEmissions !== 'undefined'
  //           ? Number(item?.ghgEmissions) + tempTotal
  //           : tempTotal;
  //     });
  //   }
  //   form.setFieldValue('ghgEmissionsTotal', String(tempTotal));
  //   calculateAnnualAverage();
  // };

  const calculateNetGHGEmissions = (value?: any, index?: number) => {
    let baselineEmissionReductionsVal = 0;
    let projectEmissionReductionsVal = 0;
    let leakageEmissionReductionsVal = 0;

    if (index === undefined) {
      baselineEmissionReductionsVal = Number(form.getFieldValue('baselineEmissionReductions') || 0);
      projectEmissionReductionsVal = Number(form.getFieldValue('projectEmissionReductions') || 0);
      leakageEmissionReductionsVal = Number(form.getFieldValue('leakageEmissionReductions') || 0);
      const netGHGEmissions =
        baselineEmissionReductionsVal - projectEmissionReductionsVal - leakageEmissionReductionsVal;

      if (netGHGEmissions < 0) {
        form.setFields([
          {
            name: 'netEmissionReductions',
            errors: [`${t('PDD:shouldHavePositive')}`],
          },
        ]);
      } else {
        form.setFields([
          {
            name: 'netEmissionReductions',
            errors: [],
          },
        ]);
      }
      form.setFieldValue('netEmissionReductions', String(netGHGEmissions));
    } else {
      const listVals = form.getFieldValue('extraEmissionReductions');

      if (listVals[index] !== undefined) {
        baselineEmissionReductionsVal = Number(listVals[index].baselineEmissionReductions || 0);
        projectEmissionReductionsVal = Number(listVals[index].projectEmissionReductions || 0);
        leakageEmissionReductionsVal = Number(listVals[index].leakageEmissionReductions || 0);

        const netGHGEmissions =
          baselineEmissionReductionsVal -
          projectEmissionReductionsVal -
          leakageEmissionReductionsVal;

        listVals[index].netEmissionReductions = netGHGEmissions;

        if (netGHGEmissions < 0) {
          form.setFields([
            {
              name: ['extraEmissionReductions', index, 'netEmissionReductions'],
              errors: [`${t('PDD:shouldHavePositive')}`],
            },
          ]);
        } else {
          form.setFields([
            {
              name: ['extraEmissionReductions', index, 'netEmissionReductions'],
              errors: [],
            },
          ]);
        }

        form.setFieldValue('extraEmissionReductions', listVals);
      }
    }
  };

  const CalculateNetTotalEmissions = () => {
    const category = 'netEmissionReductions';
    const categoryToAdd = 'totalNetEmissionReductions';
    let tempTotal = Number(form.getFieldValue(category) || 0);
    const listVals = form.getFieldValue('extraEmissionReductions');
    if (listVals !== undefined && listVals[0] !== undefined) {
      listVals.forEach((item: any) => {
        if (item[category]) {
          tempTotal += Number(item[category]);
        }
      });
    }
    const creditingYears = Number(form.getFieldValue('totalCreditingYears') || 0);
    form.setFieldValue(categoryToAdd, String(tempTotal));
    const avgTempTotal =
      creditingYears > 0 ? formatNumberWithDecimalPlaces(tempTotal / creditingYears) : 0;
    form.setFieldValue(EMISSION_CATEGORY_AVG_MAP[category], avgTempTotal);
  };

  const calculateTotalEmissions = (value: any, category: string, categoryToAdd: string) => {
    let tempTotal = Number(form.getFieldValue(category) || 0);
    const listVals = form.getFieldValue('extraEmissionReductions');
    if (listVals !== undefined && listVals[0] !== undefined) {
      listVals.forEach((item: any) => {
        if (item[category]) {
          tempTotal += Number(item[category]);
        }
      });
    }
    const creditingYears = Number(form.getFieldValue('totalCreditingYears') || 0);
    form.setFieldValue(categoryToAdd, String(tempTotal));
    const total =
      creditingYears > 0 ? formatNumberWithDecimalPlaces(tempTotal / creditingYears) : 0;
    form.setFieldValue(EMISSION_CATEGORY_AVG_MAP[category], total);

    CalculateNetTotalEmissions();
  };

  const onPeriodEndChange = (value: any, fieldCounts: number) => {
    let totalCreditingYears = form.getFieldValue('totalCreditingYears') || 0;
    if (value && totalCreditingYears < fieldCounts) {
      totalCreditingYears += 1;
    } else if (value === null && totalCreditingYears !== 0) {
      totalCreditingYears -= 1;
    }
    form.setFieldValue('totalCreditingYears', totalCreditingYears);
    calculateNetGHGEmissions(value);
    calculateTotalEmissions(value, 'baselineEmissionReductions', 'totalBaselineEmissionReductions');
    calculateTotalEmissions(value, 'projectEmissionReductions', 'totalProjectEmissionReductions');
    calculateTotalEmissions(value, 'leakageEmissionReductions', 'totalLeakageEmissionReductions');
  };

  // const onFinish = (values: any) => {
  //   const tempValues: any = {
  //     titleAndReference: values?.titleAndReferenceOfMethodology,
  //     applicability: values?.applicabilityOfMethodology,
  //     // baselineScenario: values?.baselineScenario,
  //     // additionality: values?.additionality,
  //     descriptionOfBaselineScenario: values?.descriptionOfBaselineScenario,
  //     demonstrationOfAdditionality: values?.demonstrationOfAdditionality,
  //     exAnteCalculationOfEmissionReduction: values?.exAnteCalculationOfEmissionReduction,
  //     emissionReductionEstimation: values?.emissionReductionEstimation,
  //     monitoringPlan: values?.monitoringPlan,
  //     dataAndParametersExAnte: {
  //       parameter: values?.parameter,
  //       unit: values?.unit,
  //       description: values?.description,
  //       dataSource: values?.dataSource,
  //       descriptionOfMeasurementMethods: values?.descriptionOfMeasurementMethods,
  //       purpose: values?.purpose,
  //       comments: values?.comments,
  //     },
  //     dataAndParametersMonitored: {
  //       monitoringParameter: values?.monitoringParameter,
  //       monitoringUnit: values?.monitoringUnit,
  //       unit: values?.unit,
  //       monitoringDescription: values?.monitoringDescription,
  //       data_parameterDescription: values?.data_parameterDescription,
  //       monitoringSource: values?.monitoringSource,
  //       monitoringMeasurementMethods: values?.monitoringMeasurementMethods,
  //       monitoringFrequency: values?.monitoringFrequency,
  //       monitoringValueApplied: values?.monitoringValueApplied,
  //       monitoringEquipment: values?.monitoringEquipment,
  //       monitoringQAProcedures: values?.monitoringQAProcedures,
  //       monitoringPurpose: values?.monitoringPurpose,
  //       monitoringCalculation: values?.monitoringCalculation,
  //       monitoringComments: values?.monitoringComments,
  //     },
  //     samplingPlan: values?.samplingPlan,
  //     otherElementsOfMonitoringPlan: values?.otherElementsOfMonitoringPlan,
  //     methodologyDeviations: values?.methodologyDeviations,
  //     projectBoundary: (function () {
  //       const tempVal: any = {};

  //       const tempbaseline = [];
  //       const firstBaseline = {
  //         source: values?.baselineSource,
  //         isCO2Included: values?.baselineIsCO2Included,
  //         co2Justification: values?.baselineco2Justification,
  //         isCH4Included: values?.baselineIsCH4Included,
  //         ch4Justification: values?.baselinech4Justification,
  //         isN2OIncluded: values?.baselineIsN2OIncluded,
  //         n2oJustification: values?.baselinen2oJustification,
  //         isOtherIncluded: values?.baselineIsOtherIncluded,
  //         otherJustification: values?.baselineotherJustification,
  //       };

  //       tempbaseline.push(firstBaseline);

  //       if (values?.extraBaseline) {
  //         values.extraBaseline.forEach((item: any) => {
  //           const tempObj: any = {
  //             source: item?.source,
  //             isCO2Included: item?.isCO2Included,
  //             co2Justification: item?.co2Justification,
  //             isCH4Included: item?.isCH4Included,
  //             ch4Justification: item?.ch4Justification,
  //             isN2OIncluded: item?.isN2OIncluded,
  //             n2oJustification: item?.n2oJustification,
  //             isOtherIncluded: item?.isOtherIncluded,
  //             otherJustification: item?.otherJustification,
  //           };
  //           tempbaseline.push(tempObj);
  //         });
  //       }

  //       const tempProject: any = [];
  //       const firstProject = {
  //         source: values?.projectSource,
  //         isCO2Included: values?.projectIsCO2Included,
  //         co2Justification: values?.projectco2Justification,
  //         isCH4Included: values?.projectIsCH4Included,
  //         ch4Justification: values?.projectch4Justification,
  //         isN2OIncluded: values?.projectIsN2OIncluded,
  //         n2oJustification: values?.projectn2oJustification,
  //         isOtherIncluded: values?.projectIsOtherIncluded,
  //         otherJustification: values?.projectotherJustification,
  //       };
  //       tempProject.push(firstProject);
  //       if (values.extraProject) {
  //         values.extraProject.forEach((item: any) => {
  //           const tempObj: any = {
  //             source: item?.source,
  //             isCO2Included: item?.isCO2Included,
  //             co2Justification: item?.co2Justification,
  //             isCH4Included: item?.isCH4Included,
  //             ch4Justification: item?.ch4Justification,
  //             isN2OIncluded: item?.isN2OIncluded,
  //             n2oJustification: item?.n2oJustification,
  //             isOtherIncluded: item?.isOtherIncluded,
  //             otherJustification: item?.otherJustification,
  //           };
  //           tempProject.push(tempObj);
  //         });
  //       }

  //       tempVal.baseline = tempbaseline;
  //       tempVal.project = tempProject;

  //       return tempVal;
  //     })(),
  //     netGHGEmissionReductions: (function () {
  //       const tempGHG: any = {
  //         description: values?.netGHGEmissionReductionsAndRemovals,
  //       };

  //       const tempYearlyReductions: any = [];

  //       const firstReduction = {
  //         startDate: moment(values?.emissionsPeriodStart).startOf('month').unix(),
  //         endDate: moment(values?.emissionsPeriodEnd).endOf('month').unix(),
  //         baselineEmissionReductions: Number(values?.baselineEmissionReductions),
  //         projectEmissionReductions: Number(values?.projectEmissionReductions),
  //         leakageEmissionReductions: Number(values?.leakageEmissionReductions),
  //         netEmissionReductions: Number(values?.netEmissionReductions),
  //       };

  //       tempYearlyReductions.push(firstReduction);

  //       if (values?.extraEmissionReductions) {
  //         values.extraEmissionReductions.forEach((item: any) => {
  //           const tempObj = {
  //             startDate: moment(item?.emissionsPeriodStart).startOf('month').unix(),
  //             endDate: moment(item?.emissionsPeriodEnd).endOf('month').unix(),
  //             baselineEmissionReductions: Number(item?.baselineEmissionReductions),
  //             projectEmissionReductions: Number(item?.projectEmissionReductions),
  //             leakageEmissionReductions: Number(item?.leakageEmissionReductions),
  //             netEmissionReductions: Number(item?.netEmissionReductions),
  //           };

  //           tempYearlyReductions.push(tempObj);
  //         });
  //       }
  //       tempGHG.yearlyGHGEmissionReductions = tempYearlyReductions;
  //       tempGHG.totalBaselineEmissionReductions = Number(values?.totalBaselineEmissionReductions);
  //       tempGHG.totalProjectEmissionReductions = Number(values?.totalProjectEmissionReductions);
  //       tempGHG.totalLeakageEmissionReductions = Number(values?.totalLeakageEmissionReductions);
  //       tempGHG.totalNetEmissionReductions = Number(values?.totalNetEmissionReductions);
  //       tempGHG.totalNumberOfCredingYears = Number(values?.totalCreditingYears);
  //       tempGHG.avgBaselineEmissionReductions = Number(values?.avgBaselineEmissionReductions);
  //       tempGHG.avgProjectEmissionReductions = Number(values?.avgProjectEmissionReductions);
  //       tempGHG.avgLeakageEmissionReductions = Number(values?.avgLeakageEmissionReductions);
  //       tempGHG.avgNetEmissionReductions = Number(values?.avgNetEmissionReductions);

  //       return tempGHG;
  //     })(),
  //   };

  //   handleValuesUpdate({ applicationOfMethodology: tempValues });
  return (
    <>
      {current === 5 && (
        <div>
          <div className="step-form-container">
            <Form
              labelCol={{ span: 20 }}
              wrapperCol={{ span: 24 }}
              className="step-form"
              layout="vertical"
              requiredMark={true}
              form={form}
              disabled={FormMode.VIEW === formMode}
              initialValues={{
                q_baselineEmission2:
                  'B𝑬𝒚 = 𝑬𝑮𝒚×𝑬F𝒚\nWhere,\nB𝑬𝒚= Baseline Emissions in year y (tCO₂ₑ)\n𝑬𝑮𝒚 = Quantity of net electricity supplied to the grid as a result of the implementation of the Clean Development Mechanism (CDM) project activity in year y (MWh).\n𝑬F𝒚 = CO₂ Emission factor of the grid in the year 2020 (tCO₂/ MWh)',
              }}
              onFinish={async (values: any) => {
                onValueChange({ quantifications: values });
                next();
              }}
            >
              <Row className="row" gutter={[40, 16]}>
                <Col xl={24} md={24}>
                  <div className="step-form-left-col">
                    <Form.Item
                      label={`${t('monitoringReport:ce_baselineEmission')}`}
                      name="ce_baselineEmission"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:ce_baselineEmission')} ${t(
                            'isRequired'
                          )}`,
                        },
                      ]}
                    >
                      <TextArea rows={4} disabled={FormMode.VIEW === formMode} />
                    </Form.Item>

                    <Form.Item name="q_baselineEmission2">
                      <TextArea rows={4} disabled={true} />
                    </Form.Item>

                    <Form.Item
                      label={t('monitoringReport:ce_documentUpload')}
                      name="ce_documentUpload"
                      valuePropName="fileList"
                      getValueFromEvent={normFile}
                      required={false}
                      rules={[
                        {
                          validator: async (rule, file) => {
                            if (file?.length > 0) {
                              if (file[0]?.size > maximumImageSize) {
                                // default size format of files would be in bytes -> 1MB = 1000000bytes
                                throw new Error(`${t('common:maxSizeVal')}`);
                              }
                            }
                          },
                        },
                      ]}
                    >
                      <Upload
                        accept=".doc, .docx, .pdf, .png, .jpg"
                        beforeUpload={(file: any) => {
                          return false;
                        }}
                        className="design-upload-section"
                        name="design"
                        action="/upload.do"
                        listType="picture"
                        multiple={false}
                        // maxCount={1}
                      >
                        <Button className="upload-doc" size="large" icon={<UploadOutlined />}>
                          {t('monitoringReport:upload')}
                        </Button>
                      </Upload>
                    </Form.Item>

                    <Form.Item
                      label={`${t('monitoringReport:ce_projectEmissions')}`}
                      name="ce_projectEmissions"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:ce_projectEmissions')} ${t(
                            'isRequired'
                          )}`,
                        },
                      ]}
                    >
                      <TextArea rows={4} disabled={FormMode.VIEW === formMode} />
                    </Form.Item>

                    <Form.Item
                      label={`${t('monitoringReport:ce_leakage')}`}
                      name="ce_leakage"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:ce_leakage')} ${t('isRequired')}`,
                        },
                      ]}
                    >
                      <TextArea rows={4} disabled={FormMode.VIEW === formMode} />
                    </Form.Item>

                    <>
                      <h3 className="form-section-title">
                        {`${t('monitoringReport:ce_estimatedEmissionReduction')}`}
                      </h3>

                      {/* <Row justify={'space-between'} gutter={[40, 16]}>
                        <Col xl={24} md={24}>
                          <div className="step-form-left-col">
                            <Form.Item
                              name="q_ghgEmission"
                              rules={[
                                {
                                  required: true,
                                  message: `${t(
                                    'monitoringReport:q_emissionRedictionAndRemovals'
                                  )} ${t('isRequired')}`,
                                },
                              ]}
                            >
                              <TextArea
                                rows={4}
                                disabled={FormMode.VIEW === formMode}
                                placeholder="Quantify the net GHG emission reductions and removals, summarizing the key results using the table below. Specify breakdown of GHG emission reductions and removals by annually. 
                                For AFOLU projects, include quantification of the net change in carbon stocks. Also, state the non-permanence risk rating (as determined in the AFOLU non-permanence risk report) and calculate the total number of buffer credits that need to be deposited into the AFOLU pooled buffer account. Attach the non-permanence risk report as either an appendix or a separate document."
                              />
                            </Form.Item>
                          </div>
                        </Col>
                      </Row> */}

                      {/* <NetEmissionReduction
                        form={form}
                        t={t}
                        projectCategory={projectCategory}
                        disableFields={FormMode.VIEW === formMode}
                      ></NetEmissionReduction> */}
                    </>

                    <>
                      <h3 className="form-section-title">
                        {`${t('monitoringReport:ce_comparisonWithPDD')}`}
                      </h3>

                      <Row justify={'space-between'} gutter={[40, 16]} className="form-section">
                        <Row className="row" gutter={[40, 16]}>
                          <Col xl={8} md={24}>
                            <div className="step-form-left-col">
                              <Form.Item
                                label={t('monitoringReport:item')}
                                name="item"
                                rules={[
                                  {
                                    required: true,
                                    message: `${t('monitoringReport:item')} ${t('isRequired')}`,
                                  },
                                ]}
                              >
                                <Input size="large" />
                              </Form.Item>
                            </div>
                          </Col>

                          <Col xl={8} md={24}>
                            <div className="step-form-right-col">
                              <Form.Item
                                label={t('monitoringReport:valueApplied')}
                                name="valueApplied"
                                rules={[
                                  {
                                    required: true,
                                    message: `${t('monitoringReport:valueApplied')} ${t(
                                      'isRequired'
                                    )}`,
                                  },
                                ]}
                              >
                                <Input size="large" />
                              </Form.Item>
                            </div>
                          </Col>

                          <Col xl={8} md={24}>
                            <div className="step-form-right-col">
                              <Form.Item
                                label={t('monitoringReport:actualValues')}
                                name="actualValues"
                                rules={[
                                  {
                                    required: true,
                                    message: `${t('monitoringReport:actualValues')} ${t(
                                      'isRequired'
                                    )}`,
                                  },
                                ]}
                              >
                                <Input size="large" />
                              </Form.Item>
                            </div>
                          </Col>
                        </Row>
                      </Row>
                    </>
                    <Form.Item
                      label={`${t('monitoringReport:ce_remarks')}`}
                      name="ce_remarks"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:ce_remarks')} ${t('isRequired')}`,
                        },
                      ]}
                    >
                      <TextArea rows={4} disabled={FormMode.VIEW === formMode} />
                    </Form.Item>
                  </div>
                </Col>
              </Row>
              <Row justify={'end'} className="step-actions-end">
                <Button style={{ margin: '0 8px' }} onClick={prev} disabled={false}>
                  {t('monitoringReport:back')}
                </Button>
                <Button type="primary" htmlType="submit" disabled={false}>
                  {t('monitoringReport:next')}
                </Button>
              </Row>
            </Form>
          </div>
        </div>
      )}
    </>
  );
};
// };

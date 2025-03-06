import { useEffect, useState } from 'react';
import { Button, Col, DatePicker, Form, Input, Row, Select, Upload } from 'antd';
import PhoneInput, {
  Country,
  formatPhoneNumber,
  formatPhoneNumberIntl,
  isPossiblePhoneNumber,
} from 'react-phone-number-input';

import moment from 'moment';
import { useConnection } from '../../Context/ConnectionContext/connectionContext';
import TextArea from 'antd/lib/input/TextArea';
import { MinusOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import GetLocationMapComponent from '../Maps/GetLocationMapComponent';
import { FormMode } from '../../Definitions/Enums/formMode.enum';
import LabelWithTooltip, { TooltipPostion } from '../LabelWithTooltip/LabelWithTooltip';
import { API_PATHS } from '../../Config/apiConfig';

export const ProjectActivityStep = (props: any) => {
  const {
    useLocation,
    translator,
    current,
    form,
    formMode,
    next,
    countries,
    prev,
    onValueChange,
    disableFields,
  } = props;

  const { post } = useConnection();
  const [contactNoInput] = useState<any>();

  const [provinces, setProvinces] = useState<string[]>([]);
  const [districts, setDistricts] = useState<{ [key: number]: string[] }>({});
  // const [dsDivisions, setDsDivisions] = useState<{ [key: number]: string[] }>({});
  const [cities, setCities] = useState<{ [key: number]: string[] }>({});

  const maximumImageSize = process.env.REACT_APP_MAXIMUM_FILE_SIZE
    ? parseInt(process.env.REACT_APP_MAXIMUM_FILE_SIZE)
    : 5000000;
  const normFile = (e: any) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  const getExistingCordinate = (locationIndex: number) => {
    const locationList = form.getFieldValue('projectActivityLocationsList');
    console.log(locationList);
    if (locationList[locationIndex] && locationList[locationIndex].location)
      return locationList[locationIndex].location;

    return null;
  };

  const getProvinces = async () => {
    try {
      const { data } = await post(API_PATHS.PROVINCES);
      const tempProvinces = data.map((provinceData: any) => provinceData.provinceName);
      setProvinces(tempProvinces);
    } catch (error) {
      console.log(error);
    }
  };

  const getDistricts = async (provinceName: string, index: number) => {
    try {
      const { data } = await post(API_PATHS.DISTRICTS, {
        filterAnd: [
          {
            key: 'provinceName',
            operation: '=',
            value: provinceName,
          },
        ],
      });
      const tempDistricts = data.map((districtData: any) => districtData.districtName);
      setDistricts((prev1) => ({ ...prev1, [index]: tempDistricts }));
    } catch (error) {
      console.log(error);
    }
  };

  // const getDivisions = async (districtName: string, index: number) => {
  //   try {
  //     const { data } = await post(API_PATHS.DIVISIONS, {
  //       filterAnd: [
  //         {
  //           key: 'districtName',
  //           operation: '=',
  //           value: districtName,
  //         },
  //       ],
  //     });

  //     const tempDivisions = data.map((divisionData: any) => divisionData.divisionName);
  //     setDsDivisions((prev2) => ({ ...prev2, [index]: tempDivisions }));
  //   } catch (error) {
  //     console.log(error);
  //   }
  // };

  const getCities = async (division: string, index: number) => {
    try {
      const { data } = await post(API_PATHS.CITIES, {
        filterAnd: [
          {
            key: 'divisionName',
            operation: '=',
            value: division,
          },
        ],
      });
      console.log({ data });
      const tempCities = data.map((cityData: any) => cityData.cityName);
      setCities((prev3) => ({ ...prev3, [index]: tempCities }));
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    getProvinces();
  }, []);

  const onProvinceSelect = async (value: any, index: number) => {
    getDistricts(value, index);
  };

  const onDistrictSelect = (value: string, index: number) => {
    // getDivisions(value, index);
    getCities(value, index);
  };

  // const onDivisionSelect = (value: string, index: number) => {
  //   getCities(value, index);
  // };

  const t = translator.t;

  return (
    <>
      {current === 1 && (
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
              initialValues={{}}
              onFinish={async (values: any) => {
                onValueChange({ projectActivity: values });
                next();
              }}
            >
              <Row className="row" gutter={[40, 16]}>
                <Col xl={24} md={24}>
                  <div className="step-form-left-col">
                    <Form.Item
                      label={`${t('monitoringReport:pa_monitoringPurpose')}`}
                      name="pa_monitoringPurpose"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:pa_monitoringPurpose')} ${t(
                            'isRequired'
                          )}`,
                        },
                      ]}
                    >
                      <TextArea
                        disabled={FormMode.VIEW === formMode}
                        rows={6}
                        // placeholder={`${t('monitoringReport:pa_monitoringObjectivePlaceholder')}`}
                      />
                    </Form.Item>

                    {/* <Form.Item
                      label={`1.3 ${t('monitoringReport:pa_scopeAndType')}`}
                      name="scopeAndType"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:pa_scopeAndType')} ${t('isRequired')}`,
                        },
                      ]}
                    >
                      <TextArea
                        disabled={FormMode.VIEW === formMode}
                        rows={6}
                        placeholder={`${t('monitoringReport:pa_scopeAndTypePlaceholder')}`}
                      />
                    </Form.Item>*/}
                    <h3 className="form-section-title">{`${t(
                      'monitoringReport:projectActivityLocation'
                    )}`}</h3>

                    <Row justify={'space-between'} gutter={[40, 16]} className="form-section">
                      <Col xl={12} md={24}>
                        <div className="step-form-right-col">
                          <Form.Item
                            label={t('monitoringReport:locationOfProjectActivity')}
                            name="locationOfProjectActivity"
                            rules={[
                              {
                                required: true,
                                message: `${t('monitoringReport:locationOfProjectActivity')} ${t(
                                  'isRequired'
                                )}`,
                              },
                            ]}
                          >
                            <Input size="large" disabled />
                          </Form.Item>

                          <Form.Item
                            label={t('monitoringReport:pa_siteNo')}
                            name="pa_siteNo"
                            rules={[
                              {
                                required: true,
                                message: `${t('monitoringReport:pa_siteNo')} ${t('isRequired')}`,
                              },
                            ]}
                          >
                            <Input size="large" disabled />
                          </Form.Item>

                          {/* <Form.Item
                            label={t('monitoringReport:telephone')}
                            name="pp_telephone"
                            rules={[
                              {
                                required: true,
                                message: ``,
                              },
                              {
                                validator: async (rule: any, value: any) => {
                                  if (
                                    String(value).trim() === '' ||
                                    String(value).trim() === undefined ||
                                    value === null ||
                                    value === undefined
                                  ) {
                                    throw new Error(
                                      `${t('monitoringReport:telephone')} ${t('isRequired')}`
                                    );
                                  } else {
                                    const phoneNo = formatPhoneNumber(String(value));
                                    if (String(value).trim() !== '') {
                                      if (!isPossiblePhoneNumber(String(value))) {
                                        throw new Error(
                                          `${t('monitoringReport:telephone')} ${t('isInvalid')}`
                                        );
                                      }
                                    }
                                  }
                                },
                              },
                            ]}
                          >
                            <PhoneInput
                              disabled
                              international
                              value={formatPhoneNumberIntl(contactNoInput)}
                              defaultCountry="LK"
                              countryCallingCodeEditable={false}
                              onChange={(v) => {}}
                              countries={countries as Country[]}
                            />
                          </Form.Item> */}
                          <Form.Item
                            label={t('monitoringReport:province')}
                            name="province"
                            rules={[
                              {
                                required: true,
                                message: `${t('monitoringReport:province')} ${t('isRequired')}`,
                              },
                            ]}
                          >
                            <Select
                              size="large"
                              onChange={(value) => onProvinceSelect(value, 0)}
                              // placeholder={t('PDD:provincePlaceholder')}
                              disabled={disableFields}
                            >
                              {provinces.map((province: string, index: number) => (
                                <Select.Option value={province} key={province + index}>
                                  {province}
                                </Select.Option>
                              ))}
                            </Select>
                          </Form.Item>

                          <Form.Item
                            label={t('monitoringReport:district')}
                            name="district"
                            rules={[
                              {
                                required: true,
                                message: `${t('monitoringReport:district')} ${t('isRequired')}`,
                              },
                            ]}
                          >
                            <Select
                              size="large"
                              // placeholder={t('PDD:districtPlaceholder')}
                              onSelect={(value) => onDistrictSelect(value, 0)}
                              disabled={disableFields}
                            >
                              {districts[0]?.map((district: string, index: number) => (
                                <Select.Option key={district + index} value={district}>
                                  {district}
                                </Select.Option>
                              ))}
                            </Select>
                          </Form.Item>

                          <Form.Item
                            label={t('monitoringReport:pa_city')}
                            name="pa_city"
                            rules={[
                              {
                                required: true,
                                message: `${t('monitoringReport:pa_city')} ${t('isRequired')}`,
                              },
                            ]}
                          >
                            <Select
                              size="large"
                              // placeholder={t('PDD:cityPlaceholder')}
                              disabled={disableFields}
                            >
                              {cities[0]?.map((city: string, index) => (
                                <Select.Option value={city} key={city + index}>
                                  {city}
                                </Select.Option>
                              ))}
                            </Select>
                          </Form.Item>

                          <Form.Item
                            label={t('monitoringReport:community')}
                            name="community"
                            rules={[
                              {
                                required: true,
                                message: `${t('monitoringReport:community')} ${t('isRequired')}`,
                              },
                            ]}
                          >
                            <Input size="large" disabled />
                          </Form.Item>
                        </div>
                      </Col>

                      <Col xl={12} md={24}>
                        <Form.Item
                          label={t('monitoringReport:setLocation')}
                          name="location"
                          rules={[
                            {
                              required: true,
                              message: `${t('monitoringReport:setLocation')} ${t('isRequired')}`,
                            },
                          ]}
                        >
                          <GetLocationMapComponent
                            form={form}
                            formItemName={'location'}
                            existingCordinate={form.getFieldValue('location')}
                            disabled={disableFields}
                          />
                        </Form.Item>
                      </Col>

                      <Col xl={24} md={24}>
                        <Form.Item
                          label={t('monitoringReport:pa_uploadImages')}
                          name="pa_uploadImages"
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
                            disabled={disableFields}
                            // maxCount={1}
                          >
                            <Button
                              className="upload-doc"
                              size="large"
                              icon={<UploadOutlined />}
                              disabled={disableFields}
                            >
                              Upload
                            </Button>
                          </Upload>
                        </Form.Item>
                      </Col>
                    </Row>

                    <>
                      <Form.List name="projectProponentsList">
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map(({ key, name, ...restField }) => (
                              <>
                                <div className="form-list-actions">
                                  <h4>Entity {name + 1}</h4>
                                  <Form.Item>
                                    {name !== 0 && (
                                      <Button
                                        // type="dashed"
                                        onClick={() => {
                                          remove(name);
                                        }}
                                        size="large"
                                        className="addMinusBtn"
                                        // block
                                        icon={<MinusOutlined />}
                                        disabled
                                      >
                                        {/* Remove Entity */}
                                      </Button>
                                    )}
                                  </Form.Item>
                                </div>
                                <Row
                                  justify={'space-between'}
                                  gutter={[40, 16]}
                                  className="form-section"
                                >
                                  <Col xl={12} md={24}>
                                    <div className="step-form-right-col">
                                      {/* <Form.Item
                                        label={t('monitoringReport:organizationName')}
                                        name={[name, 'organizationName']}
                                        rules={[
                                          {
                                            required: true,
                                            message: `${t('monitoringReport:organizationName')} ${t(
                                              'isRequired'
                                            )}`,
                                          },
                                        ]}
                                      >
                                        <Input size="large" disabled />
                                      </Form.Item> */}

                                      {/* <Form.Item
                                        label={t('monitoringReport:contactPerson')}
                                        name={[name, 'contactPerson']}
                                        rules={[
                                          {
                                            required: true,
                                            message: `${t('monitoringReport:contactPerson')} ${t(
                                              'isRequired'
                                            )}`,
                                          },
                                        ]}
                                      >
                                        <Input size="large" disabled />
                                      </Form.Item> */}

                                      {/* <Form.Item
                                        label={t('monitoringReport:roleInTheProject')}
                                        name={[name, 'roleInTheProject']}
                                        rules={[
                                          {
                                            required: true,
                                            message: `${t('monitoringReport:roleInTheProject')} ${t(
                                              'isRequired'
                                            )}`,
                                          },
                                        ]}
                                      >
                                        <TextArea rows={4} disabled />
                                      </Form.Item> */}

                                      {/* <Form.Item
                                        label={t('monitoringReport:telephone')}
                                        name={[name, 'telephone']}
                                        rules={[
                                          {
                                            required: true,
                                            message: ``,
                                          },
                                          {
                                            validator: async (rule: any, value: any) => {
                                              if (
                                                String(value).trim() === '' ||
                                                String(value).trim() === undefined ||
                                                value === null ||
                                                value === undefined
                                              ) {
                                                throw new Error(
                                                  `${t('monitoringReport:telephone')} ${t(
                                                    'isRequired'
                                                  )}`
                                                );
                                              } else {
                                                const phoneNo = formatPhoneNumber(String(value));
                                                if (String(value).trim() !== '') {
                                                  if (!isPossiblePhoneNumber(String(value))) {
                                                    throw new Error(
                                                      `${t('monitoringReport:telephone')} ${t(
                                                        'isInvalid'
                                                      )}`
                                                    );
                                                  }
                                                }
                                              }
                                            },
                                          },
                                        ]}
                                      >
                                        <PhoneInput
                                          disabled
                                          international
                                          value={formatPhoneNumberIntl(contactNoInput)}
                                          defaultCountry="LK"
                                          countryCallingCodeEditable={false}
                                          onChange={(v) => {}}
                                          countries={countries as Country[]}
                                        />
                                      </Form.Item> */}
                                    </div>
                                  </Col>

                                  <Col xl={12} md={24}>
                                    {/* <Form.Item
                                      label={t('monitoringReport:email')}
                                      name={[name, 'email']}
                                      rules={[
                                        {
                                          required: true,
                                          message: ``,
                                        },
                                        {
                                          validator: async (rule, value) => {
                                            if (
                                              String(value).trim() === '' ||
                                              String(value).trim() === undefined ||
                                              value === null ||
                                              value === undefined
                                            ) {
                                              throw new Error(
                                                `${t('monitoringReport:email')} ${t('isRequired')}`
                                              );
                                            } else {
                                              const val = value.trim();
                                              const reg =
                                                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                                              const matches = val.match(reg) ? val.match(reg) : [];
                                              if (matches.length === 0) {
                                                throw new Error(
                                                  `${t('monitoringReport:email')} ${t('isInvalid')}`
                                                );
                                              }
                                            }
                                          },
                                        },
                                      ]}
                                    >
                                      <Input size="large" disabled />
                                    </Form.Item> */}

                                    {/* <Form.Item
                                      label={t('monitoringReport:designation')}
                                      name={[name, 'designation']}
                                      rules={[
                                        {
                                          required: true,
                                          message: `${t('monitoringReport:designation')} ${t(
                                            'isRequired'
                                          )}`,
                                        },
                                      ]}
                                    >
                                      <Input size="large" />
                                    </Form.Item> */}

                                    {/* <Form.Item
                                      label={t('monitoringReport:address')}
                                      name={[name, 'address']}
                                      rules={[
                                        {
                                          required: true,
                                          message: `${t('monitoringReport:address')} ${t(
                                            'isRequired'
                                          )}`,
                                        },
                                      ]}
                                    >
                                      <TextArea rows={4} disabled />
                                    </Form.Item> */}
                                  </Col>
                                </Row>
                              </>
                            ))}
                            <div className="form-list-actions">
                              <Form.Item>
                                <Button
                                  // type="dashed"
                                  onClick={() => {
                                    add();
                                  }}
                                  size="large"
                                  className="addMinusBtn"
                                  // block
                                  icon={<PlusOutlined />}
                                  disabled
                                >
                                  {/* Add Entity */}
                                </Button>
                              </Form.Item>
                            </div>
                          </>
                        )}
                      </Form.List>
                    </>
                  </div>
                </Col>
              </Row>
              {/* project participant table start */}
              <h3 className="form-section-title">
                {`${t('monitoringReport:pa_partiesAndProjectParticipants')}`}
              </h3>

              <div className="projectParticipantsTable">
                <div className="header">
                  <div className="col-1">{t('monitoringReport:pa_partiesInvolved')}</div>
                  <div className="col-2">{t('monitoringReport:pa_projectParticipants')}</div>
                </div>

                <div className="data-body">
                  <Form.List name="projectParticipants">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restFields }) => (
                          <div className="row" key={key}>
                            <div className="col-1">
                              <Form.Item
                                name={[name, 'partiesInvolved']}
                                rules={[
                                  {
                                    required: true,
                                    message: ``,
                                  },
                                  {
                                    validator: async (rule, value) => {
                                      if (
                                        String(value).trim() === '' ||
                                        String(value).trim() === undefined ||
                                        value === null ||
                                        value === undefined
                                      ) {
                                        throw new Error(
                                          `${t('monitoringReport:pa_partiesInvolved')} ${t(
                                            'isRequired'
                                          )}`
                                        );
                                      }
                                    },
                                  },
                                ]}
                              >
                                <Input />
                              </Form.Item>
                            </div>
                            <div className="col-2">
                              <Form.List name={[name, 'projectParticipants']}>
                                {(
                                  fields2,
                                  { add: addParticipants, remove: removeParticipants }
                                ) => (
                                  <div key={key + name} className="participant-row">
                                    {fields2.map(({ key: key2, name: name2 }) => (
                                      <div className="participant-col">
                                        <Form.Item
                                          name={[name2, 'participant']}
                                          className="participant-form-item"
                                          rules={[
                                            {
                                              required: true,
                                              message: ``,
                                            },
                                            {
                                              validator: async (rule, value) => {
                                                if (
                                                  String(value).trim() === '' ||
                                                  String(value).trim() === undefined ||
                                                  value === null ||
                                                  value === undefined
                                                ) {
                                                  throw new Error(
                                                    `${t(
                                                      'monitoringReport:pa_projectParticipants'
                                                    )} ${t('isRequired')}`
                                                  );
                                                }
                                              },
                                            },
                                          ]}
                                        >
                                          <Input />
                                        </Form.Item>

                                        <Form.Item>
                                          <Button
                                            // type="dashed"
                                            onClick={() => {
                                              addParticipants();
                                            }}
                                            size="large"
                                            className="addMinusBtn"
                                            // block
                                            icon={<PlusOutlined />}
                                            disabled={disableFields}
                                          >
                                            {/* Add Participant */}
                                          </Button>
                                        </Form.Item>

                                        {key2 !== 0 && (
                                          <Form.Item>
                                            <Button
                                              // type="dashed"
                                              onClick={() => {
                                                removeParticipants(name2);
                                              }}
                                              size="large"
                                              className="addMinusBtn"
                                              // block
                                              icon={<MinusOutlined />}
                                              disabled={disableFields}
                                            >
                                              {/* Minus Participant */}
                                            </Button>
                                          </Form.Item>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </Form.List>
                            </div>
                            {/* <div className="col-3">hello</div> */}
                          </div>
                        ))}

                        <div>
                          <Form.Item>
                            <Button
                              onClick={() => {
                                // add();
                                const temp = form.getFieldValue('projectParticipants');
                                console.log('---------temp--------', temp);
                                temp[fields.length] = {
                                  partiesInvolved: '',
                                  projectParticipants: [{ participant: '' }],
                                };
                                console.log('---------temp after--------', temp);
                                form.setFieldValue('projectParticipants', temp);
                              }}
                            >
                              {t('monitoringReport:pa_addProjectParticipant')}
                            </Button>
                          </Form.Item>
                        </div>
                      </>
                    )}
                  </Form.List>
                  {/* <Form.List name="projectParticipants">
                                    {(fields, { add, remove }) => (
                                      <>
                                        1212345
                                        <>{console.log('fields', fields[0])}</>
                                        {fields.map(({ key, name, ...restField }) => {
                                          <div>
                                            123
                                            <div className="col-1">
                                              a
                                              <Form.Item
                                                name={[name, 'partiesInvolved']}
                                                rules={[
                                                  {
                                                    validator: async (rule, value) => {
                                                      if (
                                                        String(value).trim() === '' ||
                                                        String(value).trim() === undefined ||
                                                        value === null ||
                                                        value === undefined
                                                      ) {
                                                        throw new Error(
                                                          `${t('PDD:partiesInvolved')} ${t('isRequired')}`
                                                        );
                                                      }
                                                    },
                                                  },
                                                ]}
                                              >
                                                <Input />
                                              </Form.Item>
                                            </div>
                                            <div className="col-2">
                                              b
                                              <Form.Item
                                                name={[name, 'projectParticipant']}
                                                rules={[
                                                  {
                                                    validator: async (rule, value) => {
                                                      if (
                                                        String(value).trim() === '' ||
                                                        String(value).trim() === undefined ||
                                                        value === null ||
                                                        value === undefined
                                                      ) {
                                                        throw new Error(
                                                          `${t('PDD:projectParticipant')} ${t('isRequired')}`
                                                        );
                                                      }
                                                    },
                                                  },
                                                ]}
                                              >
                                                <Input />
                                              </Form.Item>
                                            </div>
                                            <button onClick={add}>+</button>
                                          </div>;
                                        })}
                                      </>
                                    )}
                                  </Form.List> */}
                </div>
              </div>
              {/* project participant table end */}

              <Row className="row" gutter={[40, 16]}>
                <Col xl={12} md={24}>
                  <div className="step-form-left-col">
                    <Form.Item
                      label={t('monitoringReport:pa_methodology')}
                      name="pa_methodology"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:pa_methodology')} ${t('isRequired')}`,
                        },
                      ]}
                    >
                      <Input size="large" />
                    </Form.Item>
                  </div>
                  <LabelWithTooltip
                    label={t('monitoringReport:pa_projectCreditingPeriod')}
                    required={true}
                  />
                  <Row gutter={[40, 16]} justify={'space-between'} align={'stretch'}>
                    <Col md={11} xl={11}>
                      <Form.Item
                        // label={`${t('PDD:pa_projectCreditingStartDate')}`}
                        name="pa_projectCreditingStartDate"
                        rules={[
                          {
                            required: true,
                            message: ``,
                          },
                          {
                            validator: async (rule, value) => {
                              if (
                                String(value).trim() === '' ||
                                String(value).trim() === undefined ||
                                value === null ||
                                value === undefined
                              ) {
                                throw new Error(
                                  `${t('monitoringReport:pa_projectCreditingStartDate')} ${t(
                                    'isRequired'
                                  )}`
                                );
                              }
                            },
                          },
                        ]}
                      >
                        <DatePicker
                          size="large"
                          disabledDate={(currentDate: any) => currentDate < moment().startOf('day')}
                          // onChange={() => updateCreditingPeriodDuration()}
                        />
                      </Form.Item>
                    </Col>
                    <Col md={2} xl={2}>
                      <p className="to-margin">to</p>
                    </Col>
                    <Col md={11} xl={11}>
                      <Form.Item
                        // label={`${t('monitoringReport:pa_projectCreditingPeriodEndDate')}`}
                        name="pa_projectCreditingPeriodEndDate"
                        rules={[
                          {
                            required: true,
                            message: ``,
                          },
                          {
                            validator: async (rule, value) => {
                              if (
                                String(value).trim() === '' ||
                                String(value).trim() === undefined ||
                                value === null ||
                                value === undefined
                              ) {
                                throw new Error(
                                  `${t('monitoringReport:pa_projectCreditingPeriodEndDate')} ${t(
                                    'isRequired'
                                  )}`
                                );
                              }
                            },
                          },
                        ]}
                      >
                        <DatePicker
                          size="large"
                          disabledDate={(currentDate: any) => currentDate < moment().startOf('day')}
                          // onChange={() => updateCreditingPeriodDuration()}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Col>

                <Col xl={12} md={24}>
                  <div className="step-form-right-col">
                    <Form.Item
                      label={t('monitoringReport:pa_creditingPeriodType')}
                      name="pa_creditingPeriodType"
                      rules={[
                        {
                          required: true,
                          message: `${t('monitoringReport:pa_creditingPeriodType')} ${t(
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

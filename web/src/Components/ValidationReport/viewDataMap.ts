import moment from 'moment';

const mapBase64ToFields = (fileUrls: string[]) => {
  let fileObjs: any[] = [];

  if (fileUrls !== undefined && fileUrls.length > 0) {
    fileObjs = fileUrls.map((item: any, index) => {
      const nameParts = item.split('/');
      const name = nameParts[nameParts.length - 1];
      const tempObj = {
        uid: name,
        name: name,
        status: 'done',
        url: item,
      };
      return tempObj;
    });
  }

  return fileObjs;
};

export const basicInformationMapDataToFields = (vals: any) => {
  if (vals === undefined) {
    return;
  }

  const firstLocation =
    vals?.locationsOfProjectActivity && vals?.locationsOfProjectActivity?.length > 0
      ? vals?.locationsOfProjectActivity.shift()
      : undefined;

  const tempVals = {
    ...vals,
    locationOfProjectActivity: firstLocation?.locationOfProjectActivity,
    province: firstLocation?.province,
    siteNo: firstLocation?.siteNo,
    district: firstLocation?.district,
    dsDivision: firstLocation?.dsDivision,
    city: firstLocation?.city,
    community: firstLocation?.community,
    location: firstLocation?.geographicalLocationCoordinates,
    optionalImages: mapBase64ToFields(firstLocation?.additionalDocuments),
    extraLocations: (function () {
      const locations = vals?.locationsOfProjectActivity;
      let tempExtraLocations: any[] = [];
      if (locations !== 0 && locations.length > 0) {
        tempExtraLocations = locations.map((location: any) => {
          const tempObj = {
            locationOfProjectActivity: location?.locationOfProjectActivity,
            province: location?.province,
            district: location?.district,
            dsDivision: location?.dsDivision,
            city: location?.city,
            community: location?.community,
            location: location?.geographicalLocationCoordinates,
            optionalImages: mapBase64ToFields(location?.additionalDocuments),
          };
          return tempObj;
        });
      }
      return tempExtraLocations;
    })(),
    completionDate: vals?.completionDate ? moment.unix(vals?.completionDate) : undefined,
    pddUploadedGlobalStakeholderConsultation: vals?.pddUploadedGlobalStakeholderConsultation
      ? moment.unix(vals?.pddUploadedGlobalStakeholderConsultation)
      : undefined,
    approverSignature: mapBase64ToFields(vals?.approverSignature),
  };

  return tempVals;
};

export const ghgProjectDescriptionMapDataToFields = (vals: any) => {
  if (vals === undefined) return;

  const tempValues = {
    ...vals,
  };

  return tempValues;
};

export const executiveSummaryMapDataToFields = (vals: any) => {
  if (vals === undefined) return;

  const tempValues = {
    ...vals,
  };

  return tempValues;
};

export const validationMethodologyMapDataToFields = (vals: any) => {
  if (vals === undefined) return;

  const tempValues = {
    ...vals,
  };

  return tempValues;
};

export const meansOfValidationMapDataToFields = (vals: any) => {
  if (vals === undefined) return;

  const tempValues = {
    ...vals,
    siteInspectionDurationStart: vals?.siteInspectionDurationStart
      ? moment.unix(vals?.siteInspectionDurationStart)
      : undefined,
    siteInspectionDurationEnd: vals?.siteInspectionDurationEnd
      ? moment.unix(vals?.siteInspectionDurationEnd)
      : undefined,
  };

  return tempValues;
};

export const validationFindingsMapDataToFields = (vals: any) => {
  if (vals === undefined) return;

  const tempValues = {
    ...vals,
  };

  return tempValues;
};

export const internalQualityControlMapDataToFields = (vals: any) => {
  if (vals === undefined) return;

  const tempValues = {
    ...vals,
  };

  return tempValues;
};

export const validationOpinionMapDataToFields = (vals: any) => {
  if (vals === undefined) return;

  const tempValues = {
    ...vals,
  };

  return tempValues;
};

export const validationReportAppendixMapDataToFields = (vals: any) => {
  if (vals === undefined) return;

  const tempValues = {
    ...vals,
  };

  return tempValues;
};

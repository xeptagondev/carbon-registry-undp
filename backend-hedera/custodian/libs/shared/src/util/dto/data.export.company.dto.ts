import { DataExportDto } from './data.export.dto';

export class DataExportCompanyDto extends DataExportDto {
    companyId;
    taxId;
    paymentId;
    name;
    email;
    phoneNo;
    website;
    address;
    companyRole;
    state;
    creditBalance;
    secondaryAccountBalanceLocal;
    secondaryAccountBalanceInternational;
    secondaryAccountBalanceOmge;
    programmeCount;
    lastUpdateVersion;
    creditTxTime;
    remarks;
    createdTime;
    geographicalLocationCordintes;
    regions;
    nameOfMinister;
    sectoralScope;
}

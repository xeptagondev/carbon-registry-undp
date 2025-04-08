export type UserProps = {
  id: number;
  userRole: string;
  userHederaAccount: string;
  companyId: number;
  companyRole: string;
  companyLogo: string;
  companyName: string;
  companyState: number;
  organizationHederaAccount: string;
  name: string;
};

export interface UserContextProps {
  userInfoState?: UserProps;
  setUserInfo: (val: UserProps) => void;
  removeUserInfo: () => void;
  IsAuthenticated: (tkn?: any) => boolean;
  isTokenExpired: boolean;
  setIsTokenExpired: (val: boolean) => void;
}

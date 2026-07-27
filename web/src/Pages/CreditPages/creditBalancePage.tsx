import { useCallback, useEffect, useState } from 'react';
import { Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  FilterBar,
  type FilterControlValue,
  type FilterValues,
} from '../../Components/Common/FilterBar';
import { useUserContext } from '../../Context/UserInformationContext/userInformationContext';
import { CompanyRole } from '../../Definitions/Enums/company.role.enum';
import {
  CreditBalanceByProjectTable,
} from './Components/creditBalanceByProjectTable';
import {
  CreditBalanceByOrganizationTable,
} from './Components/creditBalanceByOrganizationTable';
import { TimedPageInfoTitle } from '../../Components/Common/TimedPageInfoTitle/TimedPageInfoTitle';
import './creditPageStyles.scss';

type BalanceView = 'project' | 'organization';

export const CreditBalancePage = () => {
  const { t } = useTranslation(['creditPages']);
  const { userInfoState } = useUserContext();
  const [view, setView] = useState<BalanceView>('project');
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [projectOrganizationOptions, setProjectOrganizationOptions] = useState<string[]>([]);
  const [organizationOptions, setOrganizationOptions] = useState<string[]>([]);
  const canViewOrganization =
    userInfoState?.companyRole === CompanyRole.DESIGNATED_NATIONAL_AUTHORITY;

  useEffect(() => {
    if (!canViewOrganization) {
      if (view === 'organization') {
        setView('project');
      }
      setFilterValues((current) => {
        const organizations = current.organizations;
        return Array.isArray(organizations) && organizations.length === 0
          ? current
          : { ...current, organizations: [] };
      });
    }
  }, [canViewOrganization, view]);

  const selectedOrganizations = canViewOrganization
    && Array.isArray(filterValues.organizations)
    ? filterValues.organizations.map(String)
    : [];
  const selectedProjects = Array.isArray(filterValues.projects)
    ? filterValues.projects.map(String)
    : [];

  const onFilterChange = (id: string, value: FilterControlValue) => {
    setFilterValues((current) => ({ ...current, [id]: value }));
  };

  const onProjectFilterOptionsChange = useCallback((options: {
    organizations: string[];
    projects: string[];
  }) => {
    setProjectOptions((current) => {
      const next = Array.from(new Set([...current, ...options.projects]));
      return next.length === current.length ? current : next;
    });
    setProjectOrganizationOptions((current) => {
      const next = Array.from(new Set([...current, ...options.organizations]));
      return next.length === current.length ? current : next;
    });
  }, []);

  const onOrganizationFilterOptionsChange = useCallback((organizations: string[]) => {
    setOrganizationOptions((current) => {
      const next = Array.from(new Set([...current, ...organizations]));
      return next.length === current.length ? current : next;
    });
  }, []);

  return (
    <div className="content-container credit-management credit-balance-redesign">
      <div className="credit-title-bar">
        <div className="title-bar">
          <TimedPageInfoTitle
            title={t('creditBalance')}
            description={t('creditBalancePageDescription', {
              defaultValue:
                'Review available and reserved credit balances grouped by project or organization.',
            })}
            infoButtonLabel={t('showCreditBalancePageDescription', {
              defaultValue: 'Show information about Credit Balance',
            })}
          />

          <section className="content-card credit-balance-card">
            <div className="credit-balance-toolbar">
              <div className="credit-balance-tabs radio-selection">
                <Radio.Group
                  value={view}
                  aria-label="Credit balance grouping"
                  onChange={(event) => {
                    const nextView = event.target.value as BalanceView;
                    if (nextView === 'project' || canViewOrganization) {
                      setView(nextView);
                    }
                  }}
                >
                  <Radio.Button className="overall" value="project">By Project</Radio.Button>
                  <Radio.Button
                    className="mine"
                    value="organization"
                    disabled={!canViewOrganization}
                  >
                    By Organization
                  </Radio.Button>
                </Radio.Group>
              </div>

              <FilterBar
                className="credit-balance-filter-bar"
                values={filterValues}
                controls={[
                  {
                    id: 'organizations',
                    type: 'select',
                    mode: 'multiple',
                    placeholder: t('selectOrganization'),
                    width: 240,
                    options: (view === 'project'
                      ? projectOrganizationOptions
                      : organizationOptions
                    ).map((name) => ({ label: name, value: name })),
                    clearValue: [],
                    showAsApplied: false,
                    visible: canViewOrganization,
                  },
                  {
                    id: 'projects',
                    type: 'select',
                    mode: 'multiple',
                    placeholder: t('selectProject'),
                    width: 280,
                    options: projectOptions.map((name) => ({ label: name, value: name })),
                    clearValue: [],
                    showAsApplied: false,
                    visible: view === 'project',
                  },
                ]}
                onChange={onFilterChange}
                appliedFiltersLabel="Applied filters"
                clearAllLabel="Clear all"
                onClearAll={() => setFilterValues({ organizations: [], projects: [] })}
                showAppliedFilters={false}
              />
            </div>

            {view === 'project' ? (
              <CreditBalanceByProjectTable
                selectedOrganizations={selectedOrganizations}
                selectedProjects={selectedProjects}
                onFilterOptionsChange={onProjectFilterOptionsChange}
              />
            ) : canViewOrganization ? (
              <CreditBalanceByOrganizationTable
                selectedOrganizations={selectedOrganizations}
                onFilterOptionsChange={onOrganizationFilterOptionsChange}
              />
            ) : (
              <CreditBalanceByProjectTable
                selectedOrganizations={selectedOrganizations}
                selectedProjects={selectedProjects}
                onFilterOptionsChange={onProjectFilterOptionsChange}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

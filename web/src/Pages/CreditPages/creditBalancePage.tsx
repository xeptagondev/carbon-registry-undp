import { useState } from 'react';
import { Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  FilterBar,
  type FilterControlValue,
  type FilterValues,
} from '../../Components/Common/FilterBar';
import {
  CreditBalanceByProjectTable,
  CREDIT_BALANCE_PROJECT_OPTIONS,
} from './Components/creditBalanceByProjectTable';
import {
  CreditBalanceByOrganizationTable,
  CREDIT_BALANCE_ORGANIZATION_OPTIONS,
} from './Components/creditBalanceByOrganizationTable';
import './creditPageStyles.scss';

type BalanceView = 'project' | 'organization';

export const CreditBalancePage = () => {
  const { t } = useTranslation(['creditPages']);
  const [view, setView] = useState<BalanceView>('project');
  const [filterValues, setFilterValues] = useState<FilterValues>({});

  const selectedOrganizations = Array.isArray(filterValues.organizations)
    ? filterValues.organizations.map(String)
    : [];
  const selectedProjects = Array.isArray(filterValues.projects)
    ? filterValues.projects.map(String)
    : [];

  const onFilterChange = (id: string, value: FilterControlValue) => {
    setFilterValues((current) => ({ ...current, [id]: value }));
  };

  return (
    <div className="content-container credit-management credit-balance-redesign">
      <div className="credit-title-bar">
        <div className="title-bar">
          <div className="body-title">{t('creditBalance')}</div>

          <section className="content-card credit-balance-card">
            <div className="credit-balance-toolbar">
              <div className="credit-balance-tabs radio-selection">
                <Radio.Group
                  value={view}
                  aria-label="Credit balance grouping"
                  onChange={(event) => setView(event.target.value as BalanceView)}
                >
                  <Radio.Button className="overall" value="project">By Project</Radio.Button>
                  <Radio.Button className="mine" value="organization">By Organization</Radio.Button>
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
                    options: CREDIT_BALANCE_ORGANIZATION_OPTIONS.map((name) => ({ label: name, value: name })),
                    clearValue: [],
                    showAsApplied: false,
                  },
                  {
                    id: 'projects',
                    type: 'select',
                    mode: 'multiple',
                    placeholder: t('selectProject'),
                    width: 280,
                    options: CREDIT_BALANCE_PROJECT_OPTIONS.map((name) => ({ label: name, value: name })),
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
              />
            ) : (
              <CreditBalanceByOrganizationTable selectedOrganizations={selectedOrganizations} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

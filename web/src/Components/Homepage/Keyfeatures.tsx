import React from 'react';
import './Dashboard.scss';
import { LayoutDashboard, NotebookText, ArrowRightLeftIcon, ChartColumnBig } from 'lucide-react';

const FeatureCards = () => {
  return (
    <div className="feature-cards-container">
      <h2 className="header-title">Key Features Of The Carbon Registry</h2>

      <div className="feature-cards-grid">
        {/* First Row - 2 Large Cards */}
        <div className="feature-cards-item feature-cards-large">
          <div className="feature-cards-icon">123</div>
          <h3 className="feature-cards-heading">Unique Serial Numbering</h3>
          <p className="feature-cards-text">
            Each Carbon Credit Receives a Unique Serial Number (ID). The Demo Carbon Registry is
            Aligned to UNFCCC’s Article 6.2 Guidance (Decision 6/CMA.4) but Can be Adapted to Other
            Types of Carbon Credits.
          </p>
        </div>

        <div className="feature-cards-item feature-cards-large">
          <div className="feature-cards-icon">
            <ChartColumnBig />
          </div>
          <h3 className="feature-cards-heading"> Automated Compliance Reporting</h3>
          <p className="feature-cards-text">
            TThe registry generates reports in formats aligned with Gold Standard’s requirements and
            the Article 6.2 Agreed Electronic Format (AEF), enabling seamless integration into
            international transparency frameworks.
          </p>
        </div>

        {/* Second Row - 3 Small Cards */}
        <div className="feature-cards-item feature-cards-small">
          <div className="feature-cards-icon">
            <NotebookText />
          </div>
          <h3 className="feature-cards-heading">Immutable Ledger of Transactions</h3>
          <p className="feature-cards-text">
            All transactions (issuance, transfer, retirement, cancellation) are immutably recorded
            in the ledger, providing a tamper-proof
          </p>
        </div>

        <div className="feature-cards-item feature-cards-small">
          <div className="feature-cards-icon">
            <LayoutDashboard />
          </div>
          <h3 className="feature-cards-heading">Dashboard & Insights</h3>
          <p className="feature-cards-text">
            A real-time interactive dashboard allows users to view and analyse project performance,
            credit issuances, retirements, and associated SDG impacts. Insights are available by
            country, methodology, geography, and organisation.
          </p>
        </div>

        <div className="feature-cards-item feature-cards-small">
          <div className="feature-cards-icon">
            <ArrowRightLeftIcon />
          </div>
          <h3 className="feature-cards-heading">Interoperable & Exportable Data</h3>
          <p className="feature-cards-text">
            The system is aligned with the CAD Trust Data Model and ITMO Voluntary Cooperation
            Platform, with open RESTful APIs for integrations. Data can be exported for compliance,
            auditing, and cross-platform use.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FeatureCards;

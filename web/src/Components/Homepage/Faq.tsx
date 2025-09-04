import React, { useState } from 'react';
import './Dashboard.scss';
import { ChevronDown, Envelope } from 'react-bootstrap-icons';

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="faq-container pb-[20px]">
      <h2 className="header-title">Frequently Asked Questions</h2>
      <div className="faq-list">
        <div className="faq-item">
          <button
            className={`faq-question ${openIndex === 0 ? 'active' : ''}`}
            onClick={() => toggleItem(0)}
          >
            <span className={`chevron ${openIndex === 0 ? 'rotated' : ''}`}>
              <ChevronDown />
            </span>
            <span className="question-text">What is the Gold Standard Impact Registry?</span>
          </button>
          {openIndex === 0 && (
            <div className="faq-answer">
              <p>
                The Gold Standard Impact Registry is the authoritative, public ledger where Gold
                Standard-certified carbon credits such as Verified Emission Reductions are issued,
                held, transferred, and retired with full transparency. Each credit is assigned a
                unique serial number, enabling stakeholders to trace it throughout its entire
                lifecycle. The registry also showcases certified SDG impacts of projects.
              </p>
            </div>
          )}
        </div>

        <div className="faq-item">
          <button
            className={`faq-question ${openIndex === 1 ? 'active' : ''}`}
            onClick={() => toggleItem(1)}
          >
            <span className={`chevron ${openIndex === 1 ? 'rotated' : ''}`}>
              <ChevronDown />
            </span>
            <span className="question-text">Who can use the Registry?</span>
          </button>
          {openIndex === 1 && (
            <div className="faq-answer">
              <p>
                This global platform serves various user groups, including project developers,
                credit buyers, marketplaces, and the general public. It provides an open, reliable
                view of project statuses, issued credits, and retirement records.
              </p>
            </div>
          )}
        </div>

        <div className="faq-item">
          <button
            className={`faq-question ${openIndex === 2 ? 'active' : ''}`}
            onClick={() => toggleItem(2)}
          >
            <span className={`chevron ${openIndex === 2 ? 'rotated' : ''}`}>
              <ChevronDown />
            </span>
            <span className="question-text">
              Can the Registry distinguish Article 6-authorized credits?
            </span>
          </button>
          {openIndex === 2 && (
            <div className="faq-answer">
              <p>
                Yes. The registry supports Article 6 labelling, enabling users to identify and track
                credits explicitly authorized under Article 6 of the Paris Agreement. This enhances
                transparency and compliance with global frameworks and standards.
              </p>
            </div>
          )}
        </div>
        <div className="faq-item">
          <button
            className={`faq-question ${openIndex === 5 ? 'active' : ''}`}
            onClick={() => toggleItem(5)}
          >
            <span className={`chevron ${openIndex === 5 ? 'rotated' : ''}`}>
              <ChevronDown />
            </span>
            <span className="question-text">
              How does the certification and assurance process work?
            </span>
          </button>
          {openIndex === 5 && (
            <div className="faq-answer">
              <p>
                Gold Standard's certification involves multiple stages: project planning,
                stakeholder consultation, preliminary review, validation by an independent VVB,
                verification, and issuance of credits. A digital assurance platform streamlines
                document submission, reviews, and monitoring, while expert reviewers conduct quality
                checks to uphold integrity.
              </p>
            </div>
          )}
        </div>
        <div className="faq-item">
          <button
            className={`faq-question ${openIndex === 6 ? 'active' : ''}`}
            onClick={() => toggleItem(6)}
          >
            <span className={`chevron ${openIndex === 6 ? 'rotated' : ''}`}>
              <ChevronDown />
            </span>
            <span className="question-text">Who are VVBs and what is their role?</span>
          </button>
          {openIndex === 6 && (
            <div className="faq-answer">
              <p>
                Validation and Verification Bodies (VVBs) are independent, accredited entities
                responsible for assessing projects against Gold Standard requirements, conducting
                validation or verification, and making certification decisions. They follow strict
                competence, impartiality, and transparency criteria, supported by peer review and
                oversight from Gold Standard.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FAQ;

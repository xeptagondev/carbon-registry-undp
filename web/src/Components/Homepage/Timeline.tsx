import React, { useEffect, useRef, useState } from 'react';
import './Timeline.scss'; // import your SCSS file
import { Envelope, Check2Circle, Tools, Wallet, Wallet2 } from 'react-bootstrap-icons';

type TimelineItem = {
  icon?: React.ReactNode;
  title: string;
  description: string;
};

const timelineData: TimelineItem[] = [
  {
    icon: <Envelope />,
    title: 'Initial Request Phase',
    description:
      'Projects aimed at reducing or removing carbon emissions sign up to the Registry and are assigned an Independent Certifier.',
  },
  {
    icon: <Check2Circle />,
    title: 'Project Authorisation',
    description:
      'After the Project Design Document (PDD) is reviewed, the project is officially authorized and recorded on the Registry’s Ledger.',
  },
  {
    icon: <Tools />,
    title: 'Implementation Phase',
    description:
      'Once implemented, projects are monitored, and emissions reductions are reported. Carbon credits can be issued and serialized following verification.',
  },
  {
    icon: <Wallet2 />,
    title: 'Credit Transfer & Retirement',
    description:
      'Issued credits can be traded domestically or internationally. Credits can be tracked, retired, or cancelled within the Registry, ensuring proper ownership transfer and preventing double counting.',
  },
];

const Timeline: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [animate, setAnimate] = useState(false);

  // Detect when timeline section enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setAnimate(true);
        }
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => {
      if (sectionRef.current) observer.unobserve(sectionRef.current);
    };
  }, []);

  return (
    <section className="t-block-teal py-16">
      <div
        ref={sectionRef}
        className={`block-content max-w-4xl mx-auto px-6 ${animate ? 'animate' : ''}`}
      >
        <h2 className="text-3xl font-bold text-white text-center mb-12">How does it Work?</h2>

        <ul className="timeline-list relative list-none">
          {timelineData.map((item, index) => (
            <li key={index} className="list-none">
              <div className="content">
                <h3 className="text-xl font-semibold flex">
                  {item.icon} {item.title}
                </h3>
                <p className="text-white/90 mt-2">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default Timeline;

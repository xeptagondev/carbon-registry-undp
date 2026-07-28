import { Link } from "react-router-dom";
import { ROUTES } from "../../../Config/uiRoutingConfig";

interface ProjectDetailsLinkProps {
  projectId?: string | number | null;
  projectName: string;
}

export const ProjectDetailsLink = ({
  projectId,
  projectName,
}: ProjectDetailsLinkProps) => {
  if (projectId === undefined || projectId === null || projectId === "") {
    return <span>{projectName}</span>;
  }

  return (
    <Link
      className="credit-project-link"
      to={ROUTES.PROGRAMME_DETAILS_BY_ID(String(projectId))}
    >
      {projectName}
    </Link>
  );
};

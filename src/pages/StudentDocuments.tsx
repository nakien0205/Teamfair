import { useTeam } from "@/context/TeamContext";
import MaterialsSection from "@/components/MaterialsSection";

const StudentDocuments = () => {
  const { currentUserName } = useTeam();

  return (
    <div className="container mx-auto px-6 py-6 max-w-6xl space-y-6">
      <MaterialsSection role="student" uploaderName={currentUserName || "Student"} />
    </div>
  );
};

export default StudentDocuments;


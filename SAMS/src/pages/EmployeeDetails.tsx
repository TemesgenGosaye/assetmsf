import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getEmployee, type Employee, deleteEmployee } from "@/services/employees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  User, Briefcase, Calendar, Users, FileText, Trash2,
  Hash, ShieldAlert, Award, Clock, Accessibility
} from "lucide-react";
import StatusChip from "@/components/ui/status-chip";
import DetailPage from "@/components/detail/DetailPage";

export default function EmployeeDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const role = (() => { try { const r = localStorage.getItem("auth_user"); return r ? (JSON.parse(r).role ?? "").toLowerCase() : ""; } catch { return ""; } })();
  const isAdmin = role === "admin";
  const confirm = useConfirm();

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const empData = await getEmployee(id);
        setEmployee(empData);
      } catch (error: any) {
        console.error("Error loading employee:", error);
        toast.error(error.message || "Failed to load employee details");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleDelete = async () => {
    if (!employee) return;
    const ok = await confirm({
      title: "Delete employee",
      description: `Are you sure you want to delete "${employee.full_name}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteEmployee(employee.id);
      toast.success("Employee deleted successfully");
      navigate("/employees");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete employee");
    }
  };

  if (loading || !employee) {
    return (
      <DetailPage
        backTo="/employees"
        breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "Employees", to: "/employees" }, { label: "Employee Details" }]}
        title="Employee Profile"
        hero={{ name: "" }}
        sections={[]}
        loading={loading}
        loadingMessage="Loading employee details..."
        notFound={!loading && !employee}
        notFoundTitle="Employee Not Found"
      />
    );
  }

  const initials = employee.full_name.slice(0, 2).toUpperCase();

  return (
    <DetailPage
      backTo="/employees"
breadcrumbs={[{ label: "SAMS", to: "/dashboard" }, { label: "Employees", to: "/employees" }, { label: "Employee Details" }]}
        title="Employee Profile"
        hero={{
        initials,
        name: employee.full_name,
        subtitle: employee.job_position,
        status: employee.status,
        badges: (
          <>
            <Badge variant="outline" className="text-[10px] font-mono">{employee.employee_id}</Badge>
            {employee.has_disability && (
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Accessibility className="h-3.5 w-3.5 mr-1" /> Disability Accommodated
              </Badge>
            )}
          </>
        ),
      }}
      sections={[
        {
          title: "Personal Information",
          titleIcon: User,
          fields: [
            { icon: Hash, label: "Employee ID", value: <span className="font-mono">{employee.employee_id}</span> },
            { icon: ShieldAlert, label: "National ID", value: <span className="font-mono">{employee.national_id}</span> },
            { icon: Users, label: "Family Size", value: employee.family_size ? employee.family_size.toString() : "0" },
          ],
        },
        {
          title: "Employment Details",
          titleIcon: Briefcase,
          fields: [
            { icon: Briefcase, label: "Department", value: employee.department_name || "—" },
            { icon: Award, label: "Job Grade", value: employee.job_grade || "—" },
            { icon: Calendar, label: "Hire Date", value: employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : "—" },
          ],
        },
      ]}
      adminActions={
        isAdmin ? (
          <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1">
            <Trash2 className="h-4 w-4" /> Delete Employee
          </Button>
        ) : undefined
      }
      sidebar={
        <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-semibold">Service Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Years of Service</span>
              </div>
              <span className="font-bold text-foreground">{employee.service_years} years</span>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Documents & Files</p>
              {employee.cv_file ? (
                <Button asChild variant="outline" className="w-full text-xs gap-1.5 justify-start">
                  <a href={employee.cv_file} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 text-primary" /> Download Curriculum Vitae (CV)
                  </a>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground italic">No CV uploaded for this employee</p>
              )}
            </div>
          </CardContent>
        </Card>
      }
    />
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { houseApplicationService, houseService } from "@/services/houses";
import type { HouseApplication } from "@/services/houses";
import { AllocationMode, determineAllocationMode } from "@/services/houses";

const HouseQueuePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [applications, setApplications] = useState<HouseApplication[]>([]);
  const [houses, setHouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState("csv");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportData, setExportData] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportData, setExportData] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportData, setExportData] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showExportDialog, setShowExportDialog] = useState(false);
  const exportToCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      [
        "Application No,Employee Name,Employee ID,Job Grade,Service,Family,Disability,Score,Position,Status,Type,Category",
        ...filteredData.map(row => [
          row.application_no,
          row.employee_name,
          row.employee_id,
          row.job_grade,
          row.years_of_service,
          row.family_size,
          row.has_disability ? "Yes" : "No",
          row.priority_score,
          row.queue_position ?? "—",
          row.status,
          row.requested_house_category,
          determineAllocationMode(row) === "ROOM_ALLOCATION" ? "Room" : "House"
        ].join(","))
      ].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HouseQueue_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const [exportData, setExportData] = useState<any[]>([]);
  const exportToCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      [
        "Application No,Employee Name,Employee ID,Job Grade,Service,Family,Disability,Score,Position,Status,Type,Category",
        ...filteredData.map(row => [
          row.application_no,
          row.employee_name,
          row.employee_id,
          row.job_grade,
          row.years_of_service,
          row.family_size,
          row.has_disability ? "Yes" : "No",
          row.priority_score,
          row.queue_position ?? "—",
          row.status,
          mode === "ROOM_ALLOCATION" ? "Room" : "House",
          row.requested_house_category
        ].join(","))
      ].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HouseQueue_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [apps, housesData] = await Promise.all([
        houseApplicationService.getRankedQueue(category),
        houseService.listHouses()
      ]);
      setApplications(apps);
      setHouses(housesData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch queue data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [category, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRecalculate = async (applicationId: string) => {
    try {
      await houseApplicationService.recalculateApplicationScore(applicationId);
      toast({
        title: "Success",
        description: "Score recalculated and queue re-ranked",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to recalculate score",
      });
    }
  };

  const handleAutoAllocate = async (houseId: string) => {
    try {
      const available = houses.filter(h => h.is_available && h.allocation_category !== "G");
      const targetHouse = available.find(h => h.id === houseId) || available[0];
      if (!targetHouse) {
        throw new Error("No available houses found");
      }
      await houseApplicationService.autoAllocateHouse(targetHouse.id);
      toast({
        title: "Success",
        description: "House allocated automatically",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to allocate house",
      });
    }
  };

  const handleManualAllocate = (applicationId: string) => {
    navigate(`/housing/allocate/${applicationId}`);
  };

  const handleReview = (applicationId: string) => {
    navigate(`/housing/review/${applicationId}`);
  };

  const columns = [
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "employee_id",
    header: "ID",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>,
  },
  {
    key: "job_grade",
    header: "Grade",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>,
  },
  {
    key: "years_of_service",
    header: "Service",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>,
  },
  {
    key: "family_size",
    header: "Family",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>,
  },
  {
    key: "has_disability",
    header: "Disability",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>,
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    cell: (row) => <Badge className="font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    cell: (row) => <Badge variant="secondary" className="font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <Badge className="text-xs">{row.status}</Badge>,
  },
  {
    key: "allocation_mode",
    header: "Type",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>,
  },
  {
    key: "actions",
    header: "Actions",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
];
  const bulkActions = [
    { label: "Review Selected", action: () => {
      const selectedApps = filteredData.filter(app => selected.has(app.id));
      selectedApps.forEach(app => handleReview(app.id));
    }},
    { label: "Recalculate Selected", action: () => {
      const selectedApps = filteredData.filter(app => selected.has(app.id));
      selectedApps.forEach(app => handleRecalculate(app.id));
    }},
    { label: "Export Selected", action: () => {
      setExportData(selected.size > 0 ? filteredData.filter(app => selected.has(app.id)) : filteredData);
      setShowExportDialog(true);
    }}
  ];
  { key: "application_no", header: "Application #", cell: (row) => <div className="font-medium text-sm">{row.application_no}</div> },
  { key: "employee_name", header: "Applicant", cell: (row) => <div className="font-medium">{row.employee_name}</div> },
  { key: "employee_id", header: "ID", cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div> },
  { key: "job_grade", header: "Grade", cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge> },
  { key: "years_of_service", header: "Service", cell: (row) => <div className="text-sm">{row.years_of_service} yr</div> },
  { key: "family_size", header: "Family", cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge> },
  { key: "has_disability", header: "Disability", cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge> },
  { key: "priority_score", header: "Score", cell: (row) => <Badge className="font-bold font-mono" variant="secondary">{row.priority_score}</Badge> },
  { key: "queue_position", header: "Position", cell: (row) => <Badge variant="secondary" className="font-mono">{row.queue_position ?? "—"}</Badge> },
  { key: "status", header: "Status", cell: (row) => <Badge className="text-xs">{row.status}</Badge> },
  { key: "allocation_mode", header: "Type", cell: (row) => {
    const mode = determineAllocationMode(row);
    return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
  } },
  { key: "requested_house_category", header: "Category", cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge> },
  { key: "actions", header: "Actions", cell: (row) => (
    <div className="flex gap-1 flex-wrap">
      <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
      <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
      <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
    </div>
  ) }
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "employee_id",
    header: "ID",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>,
  },
  {
    key: "job_grade",
    header: "Grade",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>,
  },
  {
    key: "years_of_service",
    header: "Service",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>,
  },
  {
    key: "family_size",
    header: "Family",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>,
  },
  {
    key: "has_disability",
    header: "Disability",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>,
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    cell: (row) => <Badge className="font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    cell: (row) => <Badge variant="secondary" className="font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <Badge className="text-xs">{row.status}</Badge>,
  },
  {
    key: "allocation_mode",
    header: "Type",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>,
  },
  {
    key: "actions",
    header: "Actions",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
];
  const bulkActions = [
  { label: "Review Selected", action: () => {
    const selectedApps = filteredData.filter(app => selected.has(app.id));
    selectedApps.forEach(app => handleReview(app.id));
  }},
  { label: "Recalculate Selected", action: () => {
    const selectedApps = filteredData.filter(app => selected.has(app.id));
    selectedApps.forEach(app => handleRecalculate(app.id));
  }},
  { label: "Export Selected", action: () => {
    setExportData(selected.size > 0 ? filteredData.filter(app => selected.has(app.id)) : filteredData);
    setShowExportDialog(true);
  }}
];
    { label: "Review Selected", action: () => {
      const selectedApps = filteredData.filter(app => selected.has(app.id));
      selectedApps.forEach(app => handleReview(app.id));
    }},
    { label: "Recalculate Selected", action: () => {
      const selectedApps = filteredData.filter(app => selected.has(app.id));
      selectedApps.forEach(app => handleRecalculate(app.id));
    }},
    { label: "Export Selected", action: () => {
      setExportData(selected.size > 0 ? filteredData.filter(app => selected.has(app.id)) : filteredData);
      setShowExportDialog(true);
    }}
  ];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "employee_id",
    header: "ID",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>,
  },
  {
    key: "job_grade",
    header: "Grade",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>,
  },
  {
    key: "years_of_service",
    header: "Service",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>,
  },
  {
    key: "family_size",
    header: "Family",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>,
  },
  {
    key: "has_disability",
    header: "Disability",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>,
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    cell: (row) => <Badge className="font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    cell: (row) => <Badge variant="secondary" className="font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <Badge className="text-xs">{row.status}</Badge>,
  },
  {
    key: "allocation_mode",
    header: "Type",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>,
  },
  {
    key: "actions",
    header: "Actions",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "employee_id",
    header: "ID",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>,
  },
  {
    key: "job_grade",
    header: "Grade",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>,
  },
  {
    key: "years_of_service",
    header: "Service",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>,
  },
  {
    key: "family_size",
    header: "Family",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>,
  },
  {
    key: "has_disability",
    header: "Disability",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>,
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    cell: (row) => <Badge className="font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    cell: (row) => <Badge variant="secondary" className="font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <Badge className="text-xs">{row.status}</Badge>,
  },
  {
    key: "allocation_mode",
    header: "Type",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>,
  },
  {
    key: "actions",
    header: "Actions",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "employee_id",
    header: "ID",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>,
  },
  {
    key: "job_grade",
    header: "Grade",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>,
  },
  {
    key: "years_of_service",
    header: "Service",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>,
  },
  {
    key: "family_size",
    header: "Family",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>,
  },
  {
    key: "has_disability",
    header: "Disability",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>,
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    cell: (row) => <Badge className="font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    cell: (row) => <Badge variant="secondary" className="font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <Badge className="text-xs">{row.status}</Badge>,
  },
  {
    key: "allocation_mode",
    header: "Type",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>,
  },
  {
    key: "actions",
    header: "Actions",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "employee_id",
    header: "ID",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>,
  },
  {
    key: "job_grade",
    header: "Grade",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>,
  },
  {
    key: "years_of_service",
    header: "Service",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>,
  },
  {
    key: "family_size",
    header: "Family",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>,
  },
  {
    key: "has_disability",
    header: "Disability",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>,
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    cell: (row) => <Badge className="font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    cell: (row) => <Badge variant="secondary" className="font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <Badge className="text-xs">{row.status}</Badge>,
  },
  {
    key: "allocation_mode",
    header: "Type",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>,
  },
  {
    key: "actions",
    header: "Actions",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
]; { key: "test", header: "Test", cell: (row) => <div>Test</div> } ];
  {
    key: "application_no",
    header: "Application #",
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "employee_id",
    header: "ID",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>,
  },
  {
    key: "job_grade",
    header: "Grade",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>,
  },
  {
    key: "years_of_service",
    header: "Service",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>,
  },
  {
    key: "family_size",
    header: "Family",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>,
  },
  {
    key: "has_disability",
    header: "Disability",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>,
  },
  {
    key: "priority_score",
    header: "Score",
    cell: (row) => <Badge className="font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    cell: (row) => <Badge variant="secondary" className="font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <Badge className="text-xs">{row.status}</Badge>,
  },
  {
    key: "allocation_mode",
    header: "Type",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>,
  },
  {
    key: "actions",
    header: "Actions",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "employee_id",
    header: "ID",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>,
  },
  {
    key: "job_grade",
    header: "Grade",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>,
  },
  {
    key: "years_of_service",
    header: "Service",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>,
  },
  {
    key: "family_size",
    header: "Family",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>,
  },
  {
    key: "has_disability",
    header: "Disability",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>,
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    cell: (row) => <Badge className="font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    cell: (row) => <Badge variant="secondary" className="font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <Badge className="text-xs">{row.status}</Badge>,
  },
  {
    key: "allocation_mode",
    header: "Type",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>,
  },
  {
    key: "actions",
    header: "Actions",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    cell: (row) => <Badge className="font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    cell: (row) => <Badge variant="secondary" className="font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <Badge className="text-xs">{row.status}</Badge>,
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>,
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>,
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>,
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>,
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>,
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => <Badge className="text-lg font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => <Badge variant="secondary" className="text-xs font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>,
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>,
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>,
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>,
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>,
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>,
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => <Badge className="text-lg font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => <Badge variant="secondary" className="text-xs font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>,
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => <Badge className="text-lg font-bold font-mono" variant="secondary">{row.priority_score}</Badge>
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => <Badge variant="secondary" className="text-xs font-mono">{row.queue_position ?? "—"}</Badge>
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>,
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>,
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>,
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>,
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>,
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => <Badge className="text-lg font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => <Badge variant="secondary" className="text-xs font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>,
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => <div className="font-medium text-sm">{row.application_no}</div>,
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => <div className="font-medium">{row.employee_name}</div>,
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>,
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>,
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => <div className="text-sm">{row.years_of_service} yr</div>,
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>,
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">{row.has_disability ? "Yes" : "No"}</Badge>,
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => <Badge className="text-lg font-bold font-mono" variant="secondary">{row.priority_score}</Badge>,
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => <Badge variant="secondary" className="text-xs font-mono">{row.queue_position ?? "—"}</Badge>,
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>,
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => handleReview(row.id)} className="h-7 text-xs px-2">Review</Button>
        <Button variant="outline" size="sm" onClick={() => handleRecalculate(row.id)} className="h-7 text-xs px-2">Recalc</Button>
        <Button variant="secondary" size="sm" onClick={() => handleManualAllocate(row.id)} className="h-7 text-xs px-2">Allocate</Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => (
      <div className="font-medium text-sm">{row.application_no}</div>
    ),
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => (
      <div className="font-medium">{row.employee_name}</div>
    ),
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => (
      <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>
    ),
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>
    ),
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => (
      <div className="text-sm">{row.years_of_service} yr</div>
    ),
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>
    ),
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => (
      <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">
        {row.has_disability ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge className="text-lg font-bold font-mono" variant="secondary">
        {row.priority_score}
      </Badge>
    ),
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge variant="secondary" className="text-xs font-mono">
        {row.queue_position ?? "—"}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleReview(row.id)}
          className="h-7 text-xs px-2"
        >
          Review
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRecalculate(row.id)}
          className="h-7 text-xs px-2"
        >
          Recalc
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleManualAllocate(row.id)}
          className="h-7 text-xs px-2"
        >
          Allocate
        </Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => (
      <div className="font-medium text-sm">{row.application_no}</div>
    ),
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => (
      <div className="font-medium">{row.employee_name}</div>
    ),
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => (
      <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>
    ),
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>
    ),
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => (
      <div className="text-sm">{row.years_of_service} yr</div>
    ),
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>
    ),
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => (
      <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">
        {row.has_disability ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge className="text-lg font-bold font-mono" variant="secondary">
        {row.priority_score}
      </Badge>
    ),
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge variant="secondary" className="text-xs font-mono">
        {row.queue_position ?? "—"}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleReview(row.id)}
          className="h-7 text-xs px-2"
        >
          Review
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRecalculate(row.id)}
          className="h-7 text-xs px-2"
        >
          Recalc
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleManualAllocate(row.id)}
          className="h-7 text-xs px-2"
        >
          Allocate
        </Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => (
      <div className="font-medium text-sm">{row.application_no}</div>
    ),
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => (
      <div className="font-medium">{row.employee_name}</div>
    ),
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => (
      <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>
    ),
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>
    ),
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => (
      <div className="text-sm">{row.years_of_service} yr</div>
    ),
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>
    ),
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => (
      <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">
        {row.has_disability ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge className="text-lg font-bold font-mono" variant="secondary">
        {row.priority_score}
      </Badge>
    ),
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge variant="secondary" className="text-xs font-mono">
        {row.queue_position ?? "—"}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>
      
    ),
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleReview(row.id)}
          className="h-7 text-xs px-2"
        >
          Review
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRecalculate(row.id)}
          className="h-7 text-xs px-2"
        >
          Recalc
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleManualAllocate(row.id)}
          className="h-7 text-xs px-2"
        >
          Allocate
        </Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => (
      <div className="font-medium text-sm">{row.application_no}</div>
    ),
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => (
      <div className="font-medium">{row.employee_name}</div>
    ),
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => (
      <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>
    ),
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>
    ),
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => (
      <div className="text-sm">{row.years_of_service} yr</div>
    ),
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>
    ),
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => (
      <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">
        {row.has_disability ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge className="text-lg font-bold font-mono" variant="secondary">
        {row.priority_score}
      </Badge>
    ),
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge variant="secondary" className="text-xs font-mono">
        {row.queue_position ?? "—"}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>
      
    ),
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleReview(row.id)}
          className="h-7 text-xs px-2"
        >
          Review
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRecalculate(row.id)}
          className="h-7 text-xs px-2"
        >
          Recalc
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleManualAllocate(row.id)}
          className="h-7 text-xs px-2"
        >
          Allocate
        </Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => (
      <div className="font-medium text-sm">{row.application_no}</div>
    ),
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => (
      <div className="font-medium">{row.employee_name}</div>
    ),
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => (
      <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>
    ),
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>
    ),
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => (
      <div className="text-sm">{row.years_of_service} yr</div>
    ),
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>
    ),
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => (
      <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">
        {row.has_disability ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge className="text-lg font-bold font-mono" variant="secondary">
        {row.priority_score}
      </Badge>
    ),
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge variant="secondary" className="text-xs font-mono">
        {row.queue_position ?? "—"}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>
        
    ),
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleReview(row.id)}
          className="h-7 text-xs px-2"
        >
          Review
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRecalculate(row.id)}
          className="h-7 text-xs px-2"
        >
          Recalc
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleManualAllocate(row.id)}
          className="h-7 text-xs px-2"
        >
          Allocate
        </Button>
      </div>
    ),
  },
];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => (
      <div className="font-medium text-sm">{row.application_no}</div>
    ),
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => (
      <div className="font-medium">{row.employee_name}</div>
    ),
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => (
      <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>
    ),
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>
    ),
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => (
      <div className="text-sm">{row.years_of_service} yr</div>
    ),
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>
    ),
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => (
      <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">
        {row.has_disability ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge className="text-lg font-bold font-mono" variant="secondary">
        {row.priority_score}
      </Badge>
    ),
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge variant="secondary" className="text-xs font-mono">
        {row.queue_position ?? "—"}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleReview(row.id)}
          className="h-7 text-xs px-2"
        >
          Review
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRecalculate(row.id)}
          className="h-7 text-xs px-2"
        >
          Recalc
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleManualAllocate(row.id)}
          className="h-7 text-xs px-2"
        >
          Allocate
        </Button>
      </div>
    ),
  },
  ];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => (
      <div className="font-medium text-sm">{row.application_no}</div>
    ),
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => (
      <div className="font-medium">{row.employee_name}</div>
    ),
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => (
      <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>
    ),
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>
    ),
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => (
      <div className="text-sm">{row.years_of_service} yr</div>
    ),
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>
    ),
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => (
      <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">
        {row.has_disability ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge className="text-lg font-bold font-mono" variant="secondary">
        {row.priority_score}
      </Badge>
    ),
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge variant="secondary" className="text-xs font-mono">
        {row.queue_position ?? "—"}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>
      
    ),
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleReview(row.id)}
          className="h-7 text-xs px-2"
        >
          Review
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRecalculate(row.id)}
          className="h-7 text-xs px-2"
        >
          Recalc
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleManualAllocate(row.id)}
          className="h-7 text-xs px-2"
        >
          Allocate
        </Button>
      </div>
    ),
  },
  ];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => (
      <div className="font-medium text-sm">{row.application_no}</div>
    ),
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => (
      <div className="font-medium">{row.employee_name}</div>
    ),
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => (
      <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>
    ),
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>
    ),
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => (
      <div className="text-sm">{row.years_of_service} yr</div>
    ),
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>
    ),
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => (
      <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">
        {row.has_disability ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge className="text-lg font-bold font-mono" variant="secondary">
        {row.priority_score}
      </Badge>
    ),
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge variant="secondary" className="text-xs font-mono">
        {row.queue_position ?? "—"}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleReview(row.id)}
          className="h-7 text-xs px-2"
        >
          Review
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRecalculate(row.id)}
          className="h-7 text-xs px-2"
        >
          Recalc
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleManualAllocate(row.id)}
          className="h-7 text-xs px-2"
        >
          Allocate
        </Button>
      </div>
    ),
  },
  ];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => (
      <div className="font-medium text-sm">{row.application_no}</div>
    ),
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => (
      <div className="font-medium">{row.employee_name}</div>
    ),
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => (
      <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>
    ),
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>
    ),
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => (
      <div className="text-sm">{row.years_of_service} yr</div>
    ),
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>
    ),
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => (
      <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">
        {row.has_disability ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge className="text-lg font-bold font-mono" variant="secondary">
        {row.priority_score}
      </Badge>
    ),
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge variant="secondary" className="text-xs font-mono">
        {row.queue_position ?? "—"}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleReview(row.id)}
          className="h-7 text-xs px-2"
        >
          Review
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRecalculate(row.id)}
          className="h-7 text-xs px-2"
        >
          Recalc
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleManualAllocate(row.id)}
          className="h-7 text-xs px-2"
        >
          Allocate
        </Button>
      </div>
    ),
  },
  ];
  {
    key: "application_no",
    header: "Application #",
    sortable: true,
    width: "w-24",
    cell: (row) => (
      <div className="font-medium text-sm">{row.application_no}</div>
    ),
  },
  {
    key: "employee_name",
    header: "Applicant",
    sortable: true,
    cell: (row) => (
      <div className="font-medium">{row.employee_name}</div>
    ),
  },
  {
    key: "employee_id",
    header: "ID",
    width: "w-28",
    cell: (row) => (
      <div className="text-xs text-muted-foreground font-mono">{row.employee_id}</div>
    ),
  },
  {
    key: "job_grade",
    header: "Grade",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs font-mono">{row.job_grade}</Badge>
    ),
  },
  {
    key: "years_of_service",
    header: "Service",
    width: "w-24",
    cell: (row) => (
      <div className="text-sm">{row.years_of_service} yr</div>
    ),
  },
  {
    key: "family_size",
    header: "Family",
    width: "w-20",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.family_size} members</Badge>
    ),
  },
  {
    key: "has_disability",
    header: "Disability",
    width: "w-20",
    cell: (row) => (
      <Badge variant={row.has_disability ? "destructive" : "outline"} className="text-xs">
        {row.has_disability ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    key: "priority_score",
    header: "Score",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge className="text-lg font-bold font-mono" variant="secondary">
        {row.priority_score}
      </Badge>
    ),
  },
  {
    key: "queue_position",
    header: "Position",
    sortable: true,
    width: "w-20",
    cell: (row) => (
      <Badge variant="secondary" className="text-xs font-mono">
        {row.queue_position ?? "—"}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "w-32",
    cell: (row) => {
      const status = row.status;
      const colors = {
        "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
        "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
        "Verified": "bg-green-100 text-green-800 border-green-200",
        "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
        "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
        "Rejected": "bg-red-100 text-red-800 border-red-200",
        "Returned": "bg-slate-100 text-slate-800 border-slate-200",
      };
      return <Badge className={`${colors[status] || "bg-gray-100 text-gray-800 border-gray-200"} text-xs`}>{status}</Badge>;
    },
  },
  {
    key: "allocation_mode",
    header: "Type",
    width: "w-32",
    cell: (row) => {
      const mode = determineAllocationMode(row);
      return <Badge variant="outline" className="text-xs">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
    },
  },
  {
    key: "requested_house_category",
    header: "Category",
    width: "w-28",
    cell: (row) => (
      <Badge variant="outline" className="text-xs">{row.requested_house_category}</Badge>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    width: "w-40",
    cell: (row) => (
      <div className="flex gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleReview(row.id)}
          className="h-7 text-xs px-2"
        >
          Review
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRecalculate(row.id)}
          className="h-7 text-xs px-2"
        >
          Recalc
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleManualAllocate(row.id)}
          className="h-7 text-xs px-2"
        >
          Allocate
        </Button>
      </div>
    ),
  },
  ];
    {
      key: "application_no",
      header: "Application #",
      sortable: true,
      width: "w-24",
    },
    {
      key: "employee_name",
      header: "Applicant",
      sortable: true,
      cell: (row) => (
        <div className="font-medium">{row.employee_name}</div>
      ),
    },
    {
      key: "queue_position",
      header: "Position",
      sortable: true,
      width: "w-20",
      cell: (row) => (
        <Badge variant="secondary" className="font-mono">{row.queue_position ?? "—"}</Badge>
      ),
    },
    {
      key: "priority_score",
      header: "Score",
      sortable: true,
      width: "w-20",
      cell: (row) => (
        <Badge className="font-mono">{row.priority_score}</Badge>
      ),
    },
    {
      key: "allocation_mode",
      header: "Type",
      width: "w-32",
      cell: (row) => {
        const mode = determineAllocationMode(row);
        return <Badge variant="outline">{mode === "ROOM_ALLOCATION" ? "Room" : "House"}</Badge>;
      },
    },
    {
      key: "requested_house_category",
      header: "Category",
      width: "w-28",
      cell: (row) => (
        <Badge variant="outline">{row.requested_house_category}</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-32",
      badge: (row) => row.status,
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-40",
      cell: (row) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleReview(row.id)}
            className="h-7 text-xs"
          >
            Review
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRecalculate(row.id)}
            className="h-7 text-xs"
          >
            Recalc
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleAutoAllocate(row.id)}
            className="h-7 text-xs"
          >
            Auto Allocate
          </Button>
        </div>
      ),
    },
  ];

  const filteredData = applications.filter(app => {
  return (!category || app.requested_house_category === category) &&
    (!searchTerm ||
      app.application_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.employee_id.toLowerCase().includes(searchTerm.toLowerCase()));
});
  // Include all applications for bulk selection
  return (!category || app.requested_house_category === category) &&
    (!searchTerm ||
      app.application_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.employee_id.toLowerCase().includes(searchTerm.toLowerCase()));
});
    (!category || app.requested_house_category === category) &&
    (!searchTerm ||
      app.application_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.employee_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const categoryOptions = [
  { value: "", label: "All Categories" },
  { value: "Staff", label: "Staff" },
  { value: "A", label: "Category A" },
  { value: "B", label: "Category B" },
  { value: "C", label: "Category C" },
  { value: "D", label: "Category D" },
  { value: "E", label: "Category E" },
];
  { value: "", label: "All Categories" },
  { value: "Staff", label: "Staff" },
  { value: "A", label: "Category A" },
  { value: "B", label: "Category B" },
  { value: "C", label: "Category C" },
  { value: "D", label: "Category D" },
  { value: "E", label: "Category E" },
];
    { value: "", label: "All Categories" },
    { value: "Staff", label: "Staff" },
    { value: "A", label: "Category A" },
    { value: "B", label: "Category B" },
    { value: "C", label: "Category C" },
    { value: "D", label: "Category D" },
    { value: "E", label: "Category E" },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">House Allocation Queue</h1>
          <p className="text-muted-foreground">Real-time queue with priority scoring and allocation controls</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={category}
            onValueChange={setCategory}
            className="w-48"
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search applications…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Queue Applications</CardTitle>
            <Badge variant="secondary" className="font-mono">
              {filteredData.length} items
            </Badge>
          </div>
          <CardDescription>
            Sorted by priority score (highest first). Queue position updates in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            tableKey="house-queue"
            columns={columns}
            data={filteredData}
            rowKey={(row) => row.id}
            loading={loading}
            selectable={false}
            searchable={false}
            filters={[]}
            pageSize={50}
            onRowClick={(row) => handleReview(row.id)}
            className="rounded-lg border"
          />
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bulk Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Implement bulk review
                  const selectedApps = filteredData.filter(app => selected.has(app.id));
                  selectedApps.forEach(app => handleReview(app.id));
                }}
              >
                Review Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Implement bulk recalculate
                  const selectedApps = filteredData.filter(app => selected.has(app.id));
                  selectedApps.forEach(app => handleRecalculate(app.id));
                }}
              >
                Recalculate Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HouseQueuePage;
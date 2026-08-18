import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { houseApplicationService, houseService, employeeService } from "@/services/houses";
import type { HouseApplication } from "@/services/houses";
import type { House } from "@/services/houses";
import type { EmployeeLookupResult } from "@/services/houses";
import { AllocationMode, determineAllocationMode } from "@/services/houses";

const HouseReviewPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [application, setApplication] = useState<HouseApplication | null>(null);
  const [house, setHouse] = useState<House | null>(null);
  const [employee, setEmployee] = useState<EmployeeLookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");
  const [scoreBreakdown, setScoreBreakdown] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [app, emp] = await Promise.all([
        houseApplicationService.getApplication(id),
        employeeService.validateEmployeeId(application?.employee_id || "")
    ]);
      setApplication(app);
      setEmployee(emp);
      setScoreBreakdown(app.score_breakdown);
      
      if (app.allocated_house_id) {
        const houseData = await houseService.getHouse(app.allocated_house_id);
        setHouse(houseData);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch application data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCalculateScore = async () => {
    if (!application) return;
    try {
      const updated = await houseApplicationService.recalculateApplicationScore(application.id);
      setApplication(updated);
      setScoreBreakdown(updated.score_breakdown);
      setRecommendations(updated.score_breakdown?.recommendation_reasons || []);
      toast({
        title: "Success",
        description: "Eligibility and allocation analysis completed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to calculate score",
        variant: "destructive",
      });
    }
  };

  const handleApprove = async () => {
    if (!application) return;
    try {
      await houseApplicationService.updateApplicationStatus(application.id, "Waiting for Allocation");
      toast({
        title: "Success",
        description: "Application approved and moved to allocation queue",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve application",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (reason: string) => {
    if (!application) return;
    try {
      await houseApplicationService.updateApplicationStatus(application.id, "Rejected", reason);
      toast({
        title: "Success",
        description: "Application rejected",
      });
      navigate(-1);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject application",
        variant: "destructive",
      });
    }
  };

  const handleReturn = async (reason: string) => {
    if (!application) return;
    try {
      await houseApplicationService.updateApplicationStatus(application.id, "Returned", reason);
      toast({
        title: "Success",
        description: "Application returned to applicant",
      });
      navigate(-1);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to return application",
        variant: "destructive",
      });
    }
  };

  const handleAllocate = () => {
    if (!application) return;
    navigate(`/housing/allocate/${application.id}`);
  };

  const renderProfileTab = () => {
  // Enhanced profile tab with card layout
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Personal Profile</CardTitle>
        <CardDescription>Employee and family information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Employee ID</label>
            <div className="font-medium">{application?.employee_id}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Employee Name</label>
            <div className="font-medium">{application?.employee_name}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Job Position</label>
            <div className="font-medium">{application?.job_position}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Job Grade</label>
            <div className="font-medium">{application?.job_grade}</div>
          </div>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Years of Service</label>
            <div className="font-medium">{application?.years_of_service} years</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Marital Status</label>
            <div className="font-medium">{application?.marital_status}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Family Size</label>
            <div className="font-medium">{application?.family_size} members</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Disability Status</label>
            <div className="font-medium">{application?.has_disability ? "Yes" : "No"}</div>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Requested House Category</label>
          <div className="font-medium">{application?.requested_house_category}</div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Preferred Location</label>
          <div className="font-medium">{application?.preferred_location || "—"}</div>
        </div>
      </CardContent>
    </Card>
  );
  }
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Employee ID</label>
          <div className="font-medium">{application?.employee_id}</div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Employee Name</label>
          <div className="font-medium">{application?.employee_name}</div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Job Position</label>
          <div className="font-medium">{application?.job_position}</div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Job Grade</label>
          <div className="font-medium">{application?.job_grade}</div>
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Years of Service</label>
          <div className="font-medium">{application?.years_of_service} years</div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Marital Status</label>
          <div className="font-medium">{application?.marital_status}</div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Family Size</label>
          <div className="font-medium">{application?.family_size} members</div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Disability Status</label>
          <div className="font-medium">{application?.has_disability ? "Yes" : "No"}</div>
        </div>
      </div>
      <Separator />
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Requested House Category</label>
        <div className="font-medium">{application?.requested_house_category}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Preferred Location</label>
        <div className="font-medium">{application?.preferred_location || "—"}</div>
      </div>
    </div>
  );

  const renderApplicationTab = () => {
  // Application details card
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Application Details</CardTitle>
        <CardDescription>Submission and request information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Application #</label>
            <div className="font-medium">{application?.application_no}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Reason for Request</label>
            <div className="font-medium">{application?.reason_for_request || "—"}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Supporting Document</label>
            <div className="font-medium">{application?.supporting_document || "—"}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Submission Date</label>
            <div className="font-medium">{application?.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : "—"}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  };
  // Application details card
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Application Details</CardTitle>
        <CardDescription>Submission and request information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Application #</label>
            <div className="font-medium">{application?.application_no}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Reason for Request</label>
            <div className="font-medium">{application?.reason_for_request || "—"}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Supporting Document</label>
            <div className="font-medium">{application?.supporting_document || "—"}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Submission Date</label>
            <div className="font-medium">{application?.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : "—"}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  };
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Application #</label>
        <div className="font-medium">{application?.application_no}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Reason for Request</label>
        <div className="font-medium">{application?.reason_for_request || "—"}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Supporting Document</label>
        <div className="font-medium">{application?.supporting_document || "—"}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Submission Date</label>
        <div className="font-medium">{application?.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : "—"}</div>
      </div>
    </div>
  );

  const renderEligibilityTab = () => {
  // Enhanced eligibility tab with scoring breakdown and system info
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Eligibility & Scoring Analysis</CardTitle>
        <CardDescription>Automated scoring system with detailed breakdown</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h3 className="text-lg font-semibold">Priority Score</h3>
            <p className="text-sm text-muted-foreground">Overall eligibility score for allocation</p>
          </div>
          <Badge className="text-lg font-bold" variant="secondary">
            {application?.priority_score || "0"}
          </Badge>
        </div>
        <Separator />
        {scoreBreakdown && (
          <ScrollArea className="h-48 rounded-md border bg-muted/50 p-4">
            <div className="space-y-3">
              {Object.entries(scoreBreakdown).map(([key, value], idx) => {
                if (!value || typeof value === "string") return null;
                const val = value as any;
                return (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-card border">
                    <div className="text-sm font-medium">{key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-mono">{val.raw}</Badge>
                      <Badge variant="outline" className="text-xs font-mono">{val.normalised}</Badge>
                      <Badge className="text-xs font-mono">{val.contribution}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
        <Separator />
        {recommendations.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Recommendations</label>
            <div className="space-y-1">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="text-sm text-muted-foreground pl-2 border-l-2 border-primary">
                  {rec}
                </div>
                ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Eligible Category</label>
            <div className="font-medium">{application?.eligible_house_category || "—"}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Allocation Type</label>
            <div className="font-medium">{determineAllocationMode(application)}</div>
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          <h4 className="text-sm font-medium">System Information</h4>
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div>
              <label className="font-medium">House Categories:</label>
              <div>{Object.keys(HOUSE_TYPES).join(", ")}</div>
            </div>
            <div>
              <label className="font-medium">Allocation Rules:</label>
              <div>Single applicants → Room | Family >1 → House</div>
            </div>
            <div>
              <label className="font-medium">Available Houses:</label>
              <div>{houses.filter(h => h.is_available).length} total</div>
            </div>
            <div>
              <label className="font-medium">Your Category:</label>
              <div>{application?.requested_house_category}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  };
  // Enhanced eligibility tab with scoring breakdown
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Eligibility & Scoring Analysis</CardTitle>
        <CardDescription>Automated scoring system with detailed breakdown</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h3 className="text-lg font-semibold">Priority Score</h3>
            <p className="text-sm text-muted-foreground">Overall eligibility score for allocation</p>
          </div>
          <Badge className="text-lg font-bold" variant="secondary">
            {application?.priority_score || "0"}
          </Badge>
        </div>
        <Separator />
        {scoreBreakdown && (
          <ScrollArea className="h-48 rounded-md border bg-muted/50 p-4">
            <div className="space-y-3">
              {Object.entries(scoreBreakdown).map(([key, value], idx) => {
                if (!value || typeof value === "string") return null;
                const val = value as any;
                return (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-card border">
                    <div className="text-sm font-medium">{key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-mono">{val.raw}</Badge>
                      <Badge variant="outline" className="text-xs font-mono">{val.normalised}</Badge>
                      <Badge className="text-xs font-mono">{val.contribution}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
        <Separator />
        {recommendations.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Recommendations</label>
            <div className="space-y-1">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="text-sm text-muted-foreground pl-2 border-l-2 border-primary">
                  {rec}
                </div>
                ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Eligible Category</label>
            <div className="font-medium">{application?.eligible_house_category || "—"}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Allocation Type</label>
            <div className="font-medium">{determineAllocationMode(application)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  };
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">Eligibility Analysis</h3>
          <p className="text-sm text-muted-foreground">Score: {application?.priority_score}</p>
        </div>
        <Button
          variant="outline"
        size="sm"
        onClick={handleCalculateScore}
        disabled={loading}
        className="h-7 text-xs"
        >
          Run Analysis
        </Button>
      </div>
      {scoreBreakdown && (
        <ScrollArea className="h-48 rounded-md border bg-muted/50 p-4">
          <div className="space-y-3">
            {Object.entries(scoreBreakdown).map(([key, value], idx) => {
              if (!value || typeof value === "string") return null;
              const val = value as any;
              return (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-card border">
                  <div className="text-sm font-medium">{key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">{val.raw}</Badge>
                    <Badge variant="outline" className="text-xs font-mono">{val.normalised}</Badge>
                    <Badge className="text-xs font-mono">{val.contribution}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Recommendations</label>
          <div className="space-y-1">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="text-sm text-muted-foreground pl-2 border-l-2 border-primary">
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Eligible Category</label>
        <div className="font-medium">{application?.eligible_house_category || "—"}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Allocation Type</label>
        <div className="font-medium">{determineAllocationMode(application)}</div>
      </div>
    </div>
  );

  const renderAllocationTab = () => {
  // Allocation information tab with system info
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Allocation Details</CardTitle>
        <CardDescription>House and room allocation information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {house ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Allocated House</label>
            <div className="font-medium">{house.house_number} ({house.location})</div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Allocated House</label>
            <div className="font-medium text-muted-foreground">—</div>
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Allocated Room</label>
          <div className="font-medium">{application?.allocated_room_label || "—"}</div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Allocation Date</label>
          <div className="font-medium">{application?.allocated_at ? new Date(application.allocated_at).toLocaleDateString() : "—"}</div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Allocated By</label>
          <div className="font-medium">{application?.allocated_by_name || "—"}</div>
        </div>
      </CardContent>
    </Card>
  );
  };
  // Allocation information tab
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Allocation Details</CardTitle>
        <CardDescription>House and room allocation information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {house ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Allocated House</label>
            <div className="font-medium">{house.house_number} ({house.location})</div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Allocated House</label>
            <div className="font-medium text-muted-foreground">—</div>
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Allocated Room</label>
          <div className="font-medium">{application?.allocated_room_label || "—"}</div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Allocation Date</label>
          <div className="font-medium">{application?.allocated_at ? new Date(application.allocated_at).toLocaleDateString() : "—"}</div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Allocated By</label>
          <div className="font-medium">{application?.allocated_by_name || "—"}</div>
        </div>
      </CardContent>
    </Card>
  );
  };
    <div className="space-y-4">
      {house ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Allocated House</label>
          <div className="font-medium">{house.house_number} ({house.location})</div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Allocated House</label>
          <div className="font-medium text-muted-foreground">—</div>
        </div>
      )}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Allocated Room</label>
        <div className="font-medium">{application?.allocated_room_label || "—"}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Allocation Date</label>
        <div className="font-medium">{application?.allocated_at ? new Date(application.allocated_at).toLocaleDateString() : "—"}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Allocated By</label>
        <div className="font-medium">{application?.allocated_by_name || "—"}</div>
      </div>
    </div>
  );

  const renderDocumentsTab = () => {
  // Documents and verification tab
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Documents & Verification</CardTitle>
        <CardDescription>Identity and supporting documentation status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Identity Document</label>
            <div className="font-medium">{application?.national_id}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Supporting Documents</label>
            <div className="font-medium">{application?.supporting_document || "—"}</div>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Verification Status</label>
          <div className="font-medium">
            {application?.reviewed_by_name ? "Verified by " + application.reviewed_by_name : "Pending verification"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  };
  // Documents and verification tab
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Documents & Verification</CardTitle>
        <CardDescription>Identity and supporting documentation status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Identity Document</label>
            <div className="font-medium">{application?.national_id}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Supporting Documents</label>
            <div className="font-medium">{application?.supporting_document || "—"}</div>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Verification Status</label>
          <div className="font-medium">
            {application?.reviewed_by_name ? "Verified by " + application.reviewed_by_name : "Pending verification"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  };
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Identity Document</label>
        <div className="font-medium">{application?.national_id}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Supporting Documents</label>
        <div className="font-medium">{application?.supporting_document || "—"}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Verification Status</label>
        <div className="font-medium">{application?.reviewed_by_name ? "Verified by " + application.reviewed_by_name : "Pending verification"}</div>
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Created</label>
        <div className="font-medium">{application?.created_at ? new Date(application.created_at).toLocaleString() : "—"}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
        <div className="font-medium">{application?.updated_at ? new Date(application.updated_at).toLocaleString() : "—"}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Status Changes</label>
        <div className="font-medium">{application?.status}</div>
      </div>
    </div>
  );

  const renderAuditTab = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Reviewed By</label>
        <div className="font-medium">{application?.reviewed_by_name || "—"}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Review Date</label>
        <div className="font-medium">{application?.reviewed_at ? new Date(application.reviewed_at).toLocaleString() : "—"}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Rejection Reason</label>
        <div className="font-medium">{application?.rejection_reason || "—"}</div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Return Reason</label>
        <div className="font-medium">{application?.returned_reason || "—"}</div>
      </div>
    </div>
  );

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      "Draft": "bg-yellow-100 text-yellow-800 border-yellow-200",
      "Submitted": "bg-blue-100 text-blue-800 border-blue-200",
      "Under Review": "bg-orange-100 text-orange-800 border-orange-200",
      "Verified": "bg-green-100 text-green-800 border-green-200",
      "Waiting for Allocation": "bg-purple-100 text-purple-800 border-purple-200",
      "Allocated": "bg-emerald-100 text-emerald-800 border-emerald-200",
      "Rejected": "bg-red-100 text-red-800 border-red-200",
      "Returned": "bg-slate-100 text-slate-800 border-slate-200",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading application data…</p>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Application not found</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Back to Queue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="h-7 text-xs"
            >
              ← Back
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Application Review</h1>
          </div>
          <p className="text-muted-foreground mt-1">Application #{application.application_no} • {application.employee_name}</p>
        </div>
        <div className="flex gap-2">
          <Badge
            className={getStatusColor(application.status)}
          >
            {application.status}
          </Badge>
          {application.queue_position && (
            <Badge variant="secondary" className="font-mono">
              Position: {application.queue_position}
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Applicant Workspace</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCalculateScore}
                className="h-7 text-xs"
                disabled={!application || loading}
              >
                Run Analysis
              </Button>
              {application.status === "Under Review" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleApprove}
                  className="h-7 text-xs"
                >
                  Approve
                </Button>
              )}
            </div>
          </div>
          <CardDescription>
            Complete review workspace with all applicant information and allocation tools
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-6 mb-4">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="application">Application</TabsTrigger>
              <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
              <TabsTrigger value="allocation">Allocation</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-4">
              {renderProfileTab()}
            </TabsContent>
            <TabsContent value="application" className="mt-4">
              {renderApplicationTab()}
            </TabsContent>
            <TabsContent value="eligibility" className="mt-4">
              {renderEligibilityTab()}
            </TabsContent>
            <TabsContent value="allocation" className="mt-4">
              {renderAllocationTab()}
            </TabsContent>
            <TabsContent value="documents" className="mt-4">
              {renderDocumentsTab()}
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              {renderHistoryTab()}
            </TabsContent>
            <TabsContent value="audit" className="mt-4">
              {renderAuditTab()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {application.status === "Under Review" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Review Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleApprove}
                className="flex-1"
              >
                Approve & Move to Queue
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const reason = prompt("Enter rejection reason:");
                  if (reason) handleReject(reason);
                }}
              >
                Reject
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const reason = prompt("Enter return reason:");
                  if (reason) handleReturn(reason);
                }}
              >
                Return
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HouseReviewPage;
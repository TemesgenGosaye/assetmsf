import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { houseApplicationService, houseService } from "@/services/houses";
import type { HouseApplication } from "@/services/houses";
import type { House } from "@/services/houses";
import { AllocationMode, determineAllocationMode } from "@/services/houses";

const HouseAllocatePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [application, setApplication] = useState<HouseApplication | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [houseId, setHouseId] = useState<string>("");
  const [roomLabel, setRoomLabel] = useState<string>("");
  const [allocationType, setAllocationType] = useState("auto");
  const [notes, setNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [app, housesData] = await Promise.all([
        houseApplicationService.getApplication(id),
        houseService.listHouses()
      ]);
      setApplication(app);
      setHouses(housesData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch allocation data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getAvailableHouses = () => {
    return houses.filter(
      (h) =>
        h.is_available &&
        h.allocation_category !== "G" &&
        (!houseId || h.id === houseId)
    );
  };

  const handleAllocate = async () => {
    if (!application) return;
    const available = getAvailableHouses();
    const targetHouse = available.find((h) => h.id === houseId) || available[0];
    if (!targetHouse) {
      toast({
        title: "Error",
        description: "No available houses found",
        variant: "destructive",
      });
      return;
    }

    if (allocationType === "override" && !overrideReason.trim()) {
      toast({
        title: "Error",
        description: "Override reason is required",
        variant: "destructive",
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmAllocation = async () => {
    if (!application) return;
    const available = getAvailableHouses();
    const targetHouse = available.find((h) => h.id === houseId) || available[0];
    if (!targetHouse) return;

    try {
      setLoading(true);
      let result;
      if (allocationType === "auto") {
        result = await houseApplicationService.autoAllocateHouse(targetHouse.id, application.id);
      } else if (allocationType === "manual") {
        result = await houseApplicationService.manualAllocateHouse(
          targetHouse.id,
          application.id,
          notes,
          roomLabel
        );
      } else {
        result = await houseApplicationService.manualAllocateHouse(
          targetHouse.id,
          application.id,
          notes,
          roomLabel,
          overrideReason
        );
      }

      toast({
        title: "Success",
        description: `House ${targetHouse.house_id} allocated to ${result.employee_name}`,
      });
      navigate(`/housing/review/${application.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to allocate house",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  const renderHouseSelector = () => (
    <div className="space-y-2">
      <Label htmlFor="house-select">Select House</Label>
      <Select
        id="house-select"
        value={houseId}
        onValueChange={setHouseId}
        disabled={loading}
      >
        <SelectTrigger>
          <SelectValue placeholder="Choose a house…" />
        </SelectTrigger>
        <SelectContent>
          {getAvailableHouses().map((house) => (
            <SelectItem key={house.id} value={house.id}>
              {house.house_number} ({house.location}) • {house.house_type} • {house.room_count} rooms
            </SelectItem>
          ))}
          {getAvailableHouses().length === 0 && (
            <SelectItem value="" disabled>
              No available houses
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );

  const renderRoomSelector = () => {
    const selectedHouse = houses.find((h) => h.id === houseId);
    if (!selectedHouse) return null;
    const roomLabels = selectedHouse.room_labels || [];
    if (roomLabels.length <= 1) return null;

    return (
      <div className="space-y-2">
        <Label htmlFor="room-select">Room Label (optional)</Label>
        <Select
          id="room-select"
          value={roomLabel}
          onValueChange={setRoomLabel}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select room…" />
          </SelectTrigger>
          <SelectContent>
            {roomLabels.map((label) => (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderOverrideSection = () => {
    if (allocationType !== "override") return null;
    return (
      <div className="space-y-2">
        <Label htmlFor="override-reason">Override Reason *</Label>
        <Textarea
          id="override-reason"
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Explain why this allocation overrides standard rules…"
          className="min-h-[60px]"
        />
      </div>
    );
  };

  const renderNotesSection = () => {
    if (allocationType === "override") return null;
    return (
      <div className="space-y-2">
        <Label htmlFor="allocation-notes">Allocation Notes (optional)</Label>
        <Textarea
          id="allocation-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this allocation…"
          className="min-h-[40px]"
        />
      </div>
    );
  };

  const renderConfirmationDialog = () => (
    <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm House Allocation</DialogTitle>
          <DialogDescription>
            {allocationType === "override" && (
              <div className="space-y-2 text-sm">
                <p><strong>Override Reason:</strong> {overrideReason}</p>
                <p><strong>Standard scoring rules will be bypassed.</strong></p>
              </div>
            )}
            <div className="mt-2">
              <p><strong>House:</strong> {houses.find((h) => h.id === houseId)?.house_number || "Auto-selected"}</p>
              <p><strong>Applicant:</strong> {application?.employee_name}</p>
              <p><strong>Category:</strong> {application?.requested_house_category}</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowConfirmDialog(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmAllocation}
            disabled={loading}
          >
            Confirm Allocation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const getAllocationTypeOptions = () => [
    { value: "auto", label: "Auto Allocate (Best Match)" },
    { value: "manual", label: "Manual Allocation" },
    { value: "override", label: "Override Allocation" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading allocation data…</p>
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
            <h1 className="text-2xl font-bold tracking-tight">House Allocation</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Allocate {application.employee_name} ({application.application_no})
          </p>
        </div>
        <Badge variant="secondary" className="font-mono">
          {application.priority_score} points
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Allocation Details</CardTitle>
          <CardDescription>
            Select house and allocation method. Auto allocation uses scoring rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="allocation-type">Allocation Method</Label>
            <Select
              id="allocation-type"
              value={allocationType}
              onValueChange={setAllocationType}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select allocation method…" />
              </SelectTrigger>
              <SelectContent>
                {getAllocationTypeOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {renderHouseSelector()}
          {renderRoomSelector()}
          {renderNotesSection()}
          {renderOverrideSection()}

          <Button
            onClick={handleAllocate}
            disabled={!houseId && getAvailableHouses().length === 0 || (allocationType === "override" && !overrideReason.trim())}
            className="w-full"
          >
            Allocate House
          </Button>
        </CardContent>
      </Card>

      {renderConfirmationDialog()}
    </div>
  );
};

export default HouseAllocatePage;
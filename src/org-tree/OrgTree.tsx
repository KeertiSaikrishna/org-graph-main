import { useCallback, useEffect, useMemo, useState } from "react";
import { Employee } from "../services/types";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { EmployeeNode } from "./components/EmployeeNode";
import { ELKLayout, calculateOrgChartLayout } from "./utils/elkUtils";
import { notification, Select, Skeleton } from "antd";
import axios from "axios";

export default function OrgTree() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [layout, setLayout] = useState<ELKLayout | null>(null);
  const [overNodeId, setOverNodeId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const teams = [...new Set(employees.map((e) => e.team || ""))];

  const filteredEmployees = useMemo(() => {
    let filtered = employees;

    if (searchTerm) {
      filtered = filtered.filter(
        (emp) =>
          emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.team.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedTeam) {
      filtered = filtered.filter((emp) => emp.team === selectedTeam);
    }

    return filtered;
  }, [searchTerm, selectedTeam, employees]);

  useEffect(() => {
    const calculateLayout = async () => {
      const graph = await calculateOrgChartLayout(employees, filteredEmployees);
      if (graph) {
        setLayout(graph);
      }
    };

    if (filteredEmployees.length > 0) {
      calculateLayout();
    }
  }, [filteredEmployees, employees]);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/employees");
      console.log("employees list response", response);
      const employees = response?.data?.employees || [];
      setEmployees(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      notification.error({
        title: "Error fetching employees",
        description: "Please try again later",
        duration: 2000,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id.toString());
  };

  const updateEmployeeManager = useCallback(async (draggedId: string, newManagerId: string) => {
    try {
        const employee = employees.find((e) => e.id === draggedId);
        const response = await axios.patch(`/api/employees/${draggedId}`, {
            managerId: newManagerId,
            ...employee
        });
        console.log("update employee manager response", response.data);
    } catch (error) {
        console.error("Error updating employee manager:", error);
        notification.error({
            title: "Error updating employee manager",
            description: "Please try again later",
            duration: 2000,
        });
    }
  }, [employees]);

  const isSubordinate = useCallback((empId: string, potentialSubId: string) => {
    const emp = employees.find((e) => e.id === potentialSubId);
    if (!emp || !emp.managerId) return false;
    if (emp.managerId === empId) return true;
    return isSubordinate(empId, emp.managerId);
  }, [employees]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setOverNodeId(null);
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const draggedId = active.id.toString();
    const newManagerId = over.id.toString().replace("drop-", "");

    if (draggedId === newManagerId) return;

    if (isSubordinate(draggedId, newManagerId)) {
      notification.info({
        title: "Cannot assign a subordinate as manager!",
        duration: 1,
      });
      return;
    }

    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === draggedId ? { ...emp, managerId: newManagerId } : emp
      )
    );
    updateEmployeeManager(draggedId, newManagerId);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (event.over) {
      setOverNodeId(event.over.id.toString().replace("drop-", ""));
    } else {
      setOverNodeId(null);
    }
  };

  const isInvalidDrop = useCallback((draggedId: string, targetId: string) => {
    if (!draggedId || !targetId || draggedId === targetId) return false;
    return isSubordinate(draggedId, targetId);
  }, [isSubordinate]);

  const layoutDimensions = useMemo(() => {
    if (!layout) return null;

    const children = layout.children || [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    children.forEach((node) => {
      if (node.x !== undefined && node.y !== undefined) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
      }
    });

    const layoutWidth = layout.width || (maxX - minX + 100);
    const layoutHeight = layout.height || (maxY - minY + 100);

    return { width: layoutWidth, height: layoutHeight };
  }, [layout]);

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Employees</h2>
          <input
            type="text"
            placeholder="Search by name, designation, or team..."
            className="search-box"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            className="filter-dropdown"
            value={selectedTeam}
            onChange={(value) => setSelectedTeam(value)}
            options={[
                { label: "All Teams", value: "" }
                , ...teams.map((team) => ({
                    label: team,
                    value: team
                })
            )]}
          />
        </div>
        <div className="employee-list">
          {isLoading ? (
            <>
              {[...Array(6)].map((_, index) => (
                <div key={index} className="employee-list-item">
                  <Skeleton.Node
                    active
                    style={{
                      width: "100%",
                      height: "60px",
                    }}
                  />
                </div>
              ))}
            </>
          ) : (
            filteredEmployees.map((emp) => (
              <div key={emp.id} className="employee-list-item">
                <div className="employee-list-item-name">{emp.name}</div>
                <div className="employee-list-item-designation">
                  {emp.designation}
                </div>
                <span className="employee-list-item-team">{emp.team}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="chart-container">
        {isLoading ? (
          LoadingSkeleton
        ) : (
          <DndContext
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
          >
            <div
              className="chart-canvas"
              style={
                layoutDimensions
                  ? {
                      width: `${layoutDimensions.width}px`,
                      height: `${layoutDimensions.height}px`,
                    }
                  : undefined
              }
            >
              {layout && layoutDimensions && (
                <svg
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: `${layoutDimensions.width}px`,
                    height: `${layoutDimensions.height}px`,
                    pointerEvents: "none",
                  }}
                >
                  {layout.edges?.map((edge) => {
                    const source = layout.children?.find(
                      (n) => n.id === edge.sources[0]
                    );
                    const target = layout.children?.find(
                      (n) => n.id === edge.targets[0]
                    );

                    if (
                      !source ||
                      !target ||
                      source.x === undefined ||
                      source.y === undefined ||
                      target.x === undefined ||
                      target.y === undefined
                    )
                      return null;

                    const x1 = source.x + source.width / 2;
                    const y1 = source.y + source.height;
                    const x2 = target.x + target.width / 2;
                    const y2 = target.y;

                    return (
                      <path
                        key={edge.id}
                        d={`M ${x1} ${y1} L ${x1} ${(y1 + y2) / 2} L ${x2} ${
                          (y1 + y2) / 2
                        } L ${x2} ${y2}`}
                        className="connection-line"
                      />
                    );
                  })}
                </svg>
              )}

              {layout?.children?.map((node) => {
                const employee = employees.find((e) => e.id === node.id);
                if (!employee || node.x === undefined || node.y === undefined)
                  return null;

                const isOver = overNodeId === employee.id;
                const isInvalid = activeId ? isInvalidDrop(activeId, employee.id) : false;

                return (
                  <EmployeeNode
                    key={employee.id}
                    employee={employee}
                    position={{ x: node.x, y: node.y }}
                    isOver={isOver && !isInvalid}
                    isInvalidDrop={isInvalid}
                  />
                );
              })}
              </div>
            <DragOverlay>
            {activeId
              ? (() => {
                  const draggedEmployee = employees.find(
                    (e) => e.id === activeId
                  );
                  const node = layout?.children?.find((n) => n.id === activeId);
                  if (!draggedEmployee || !node) return null;
                  return (
                    <div
                      style={{
                        width: "220px",
                        opacity: 0.8,
                        transform: "rotate(5deg)",
                      }}
                      className="employee-card"
                    >
                      <div className="employee-avatar">
                        {draggedEmployee.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div className="employee-info">
                        <div className="employee-name">
                          {draggedEmployee.name}
                        </div>
                        <div className="employee-designation">
                          {draggedEmployee.designation}
                        </div>
                        <div className="employee-team">
                          {draggedEmployee.team}
                        </div>
                      </div>
                    </div>
                  );
                })()
              : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}

const LoadingSkeleton = (
    <div className="chart-canvas" style={{ minHeight: "600px", position: "relative" }}>
    <svg
        style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        }}
    >
        <path
        d="M 460 100 L 460 140 L 310 140 L 310 180"
        className="connection-line"
        opacity={0.3}
        />
        <path
        d="M 460 100 L 460 140 L 610 140 L 610 180"
        className="connection-line"
        opacity={0.3}
        />
        <path
        d="M 460 100 L 460 140 L 860 140 L 860 180"
        className="connection-line"
        opacity={0.3}
        />
    </svg>
    {/* Skeleton boxes in org chart layout */}
    <div style={{ position: "absolute", left: "350px", top: "20px", padding: 0 }}>
        <Skeleton.Node
        active
        style={{
            width: "220px",
            height: "80px",
            padding: 0,
        }}
        className="employee-card"
        />
    </div>
    <div style={{ position: "absolute", left: "200px", top: "180px", padding: 0 }}>
        <Skeleton.Node
        active
        style={{
            width: "220px",
            height: "80px",
            padding: 0,
        }}
        className="employee-card"
        />
    </div>
    <div style={{ position: "absolute", left: "500px", top: "180px", padding: 0 }}>
        <Skeleton.Node
        active
        style={{
            width: "220px",
            height: "80px",
            padding: 0,
        }}
        className="employee-card"
        />
    </div>
    <div style={{ position: "absolute", left: "770px", top: "180px", padding: 0 }}>
        <Skeleton.Node
        active
        style={{
            width: "220px",
            height: "80px",
            padding: 0,
        }}
        className="employee-card"
        />
    </div>
    </div>
);

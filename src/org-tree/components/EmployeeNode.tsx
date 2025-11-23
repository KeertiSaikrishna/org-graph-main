import React from 'react';

import { useDraggable } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { Employee } from '../../services/types';

interface EmployeeNodeProps {
    employee: Employee;
    position: { x: number, y: number };
    isOver: boolean;
}


export const EmployeeNode: React.FC<EmployeeNodeProps> = ({ employee, position, isOver }) => {
    const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
      id: employee.id,
      data: employee
    });
  
    const { setNodeRef: setDropRef } = useDroppable({
      id: `drop-${employee.id}`,
      data: employee
    });
  
    const setRefs = (element: HTMLDivElement) => {
      setDragRef(element);
      setDropRef(element);
    };
  
    return (
      <div
        ref={setRefs}
        {...listeners}
        {...attributes}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: '220px',
          cursor: isDragging ? 'grabbing' : 'grab',
          opacity: isDragging ? 0.3 : 1,
          zIndex: isDragging ? 1000 : 1,
        }}
        className={`employee-card ${isOver ? 'drop-target' : ''}`}
      >
        <div className="employee-avatar">
          {employee.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div className="employee-info">
          <div className="employee-name">{employee.name}</div>
          <div className="employee-designation">{employee.designation}</div>
          <div className="employee-team">{employee.team}</div>
        </div>
      </div>
    );
  }

import React from 'react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FaUserTie, FaUser } from "react-icons/fa";

interface RoleSelectorProps {
  selectedRole: string;
  onChange: (role: string) => void;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ selectedRole, onChange }) => {
  return (
    <div className="space-y-3">
      <Label>Select your role</Label>
      <RadioGroup 
        value={selectedRole} 
        onValueChange={onChange}
        className="grid grid-cols-2 gap-4"
      >
        <div className={`flex flex-col items-center justify-between rounded-md border-2 p-4 ${
          selectedRole === 'EMPLOYEE' ? 'border-primary bg-primary/10' : 'border-muted'
        }`}>
          <RadioGroupItem 
            value="EMPLOYEE" 
            id="employee" 
            className="sr-only" 
          />
          <FaUser className={`h-6 w-6 ${selectedRole === 'EMPLOYEE' ? 'text-primary' : 'text-muted-foreground'}`} />
          <Label 
            htmlFor="employee" 
            className={`mt-2 font-medium ${selectedRole === 'EMPLOYEE' ? 'text-primary' : 'text-muted-foreground'}`}
          >
            Employee
          </Label>
        </div>
        
        <div className={`flex flex-col items-center justify-between rounded-md border-2 p-4 ${
          selectedRole === 'ADMIN' ? 'border-primary bg-primary/10' : 'border-muted'
        }`}>
          <RadioGroupItem 
            value="ADMIN" 
            id="admin" 
            className="sr-only" 
          />
          <FaUserTie className={`h-6 w-6 ${selectedRole === 'ADMIN' ? 'text-primary' : 'text-muted-foreground'}`} />
          <Label 
            htmlFor="admin" 
            className={`mt-2 font-medium ${selectedRole === 'ADMIN' ? 'text-primary' : 'text-muted-foreground'}`}
          >
            Admin
          </Label>
        </div>
      </RadioGroup>
      <p className="text-xs text-muted-foreground">
        {selectedRole === 'ADMIN' 
          ? 'Admins can manage locations, employees, and system settings.' 
          : 'Employees can track attendance and manage their profile.'}
      </p>
    </div>
  );
};

export default RoleSelector;
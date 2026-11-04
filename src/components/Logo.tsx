import React from 'react';
import { FaUserClock } from 'react-icons/fa';

const Logo: React.FC = () => {
  return (
    <div className="flex items-center gap-2">
      <FaUserClock className="text-primary h-6 w-6" />
      <span className="text-xl font-bold">TimeTrack</span>
    </div>
  );
};

export default Logo;

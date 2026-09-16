import type { ChangeEvent } from 'react';
import type { Employee } from '../types';
import { SIMULATED_USERS } from '../mockData';

interface TopbarProps {
  currentTab: 'dashboard' | 'manager';
  activeUser: Employee;
  onUserChange: (user: Employee) => void;
}

export default function Topbar({ currentTab, activeUser, onUserChange }: TopbarProps) {
  const handleUserSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const user = SIMULATED_USERS.find((u) => u.id === e.target.value);
    if (user) {
      onUserChange(user);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="topbar">
      <div className="topbar__crumb">
        Console &gt;{' '}
        <b>{currentTab === 'dashboard' ? 'Team Dashboard' : 'Manager Overview'}</b>
      </div>
      <div className="topbar__right">
        {/* Role Switcher Selector */}
        <div className="role-switcher-badge" title="Switch simulated login to test permissions">
          <label htmlFor="simulated-role-select">Simulated Role: </label>
          <select
            id="simulated-role-select"
            className="role-select"
            value={activeUser.id}
            onChange={handleUserSelect}
          >
            {SIMULATED_USERS.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.role.replace('ROLE_', '')})
              </option>
            ))}
          </select>
        </div>

        {/* User Avatar */}
        <div className="avatar" title={`Logged in as ${activeUser.name}`}>
          {getInitials(activeUser.name.split(' (')[0])}
        </div>
      </div>
    </header>
  );
}

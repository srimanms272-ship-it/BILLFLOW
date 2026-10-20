'use client';

import { UserCog, Users } from 'lucide-react';

export default function TeamPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Team Management</h1>
        <p className="text-slate-400 text-sm mt-1">Manage team members and their roles</p>
      </div>

      <div className="metric-card text-center py-16">
        <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">Team management coming soon</p>
        <p className="text-slate-600 text-sm mt-1">
          Invite team members, assign roles (Owner, Admin, Accountant, Staff), and manage permissions.
        </p>
      </div>
    </div>
  );
}

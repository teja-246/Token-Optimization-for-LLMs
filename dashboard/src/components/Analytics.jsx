import React from 'react';
import { Database, DollarSign } from 'lucide-react';

export default function Analytics({ tokensSaved = 124500, costSaved = 14.50 }) {
  return (
    <div className="flex items-center gap-4 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg shadow-sm">
      
      {/* Tokens Saved Section */}
      <div className="flex items-center gap-2">
        <div className="p-1 bg-blue-500/10 rounded-md">
          <Database size={14} className="text-blue-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none mb-0.5">Tokens Saved</span>
          <span className="text-xs font-bold text-slate-100 leading-none">{tokensSaved.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Divider */}
      <div className="w-px h-6 bg-slate-700"></div>

      {/* Cost Saved Section */}
      <div className="flex items-center gap-2">
        <div className="p-1 bg-emerald-500/10 rounded-md">
          <DollarSign size={14} className="text-emerald-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider leading-none mb-0.5">Est. Savings</span>
          <span className="text-xs font-bold text-slate-100 leading-none">${costSaved.toFixed(2)}</span>
        </div>
      </div>

    </div>
  );
}
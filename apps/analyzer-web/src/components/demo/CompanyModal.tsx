import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Company = {
  name: string;
  employees: number;
  industry: string;
};

interface CompanyModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  companies: Company[];
}

export const CompanyModal: React.FC<CompanyModalProps> = ({ open, onOpenChange, title, companies }) => {
  const industryCounts = React.useMemo(() => {
    const map = new Map<string, number>();
    companies.forEach(c => map.set(c.industry, (map.get(c.industry) || 0) + 1));
    return Array.from(map.entries()).map(([k, v]) => ({ industry: k, count: v }));
  }, [companies]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-right">#</TableHead>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Employees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c, index) => (
                  <TableRow key={c.name}>
                    <TableCell className="text-right text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.industry}</TableCell>
                    <TableCell>{c.employees}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Industry distribution</div>
            <div className="flex flex-wrap gap-3 text-xs">
              {industryCounts.map((item) => (
                <span key={item.industry} className="inline-flex items-center gap-2 bg-muted px-2 py-1 rounded">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                  {item.industry}: {item.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CompanyModal;

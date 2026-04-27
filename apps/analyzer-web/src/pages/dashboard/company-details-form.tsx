
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import type{ TechParkClient, ClientStatus, Priority } from '../../components/types';

const statusOptions = [
  { value: 'in-progress', label: 'In Progress' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'meeting-scheduled', label: 'Meeting Scheduled' },
  { value: 'demo-given', label: 'Demo Given' },
  { value: 'proposal-sent', label: 'Proposal Sent' },
  { value: 'closed-won', label: 'Closed - Won' },
  { value: 'closed-lost', label: 'Closed - Lost' },
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const industryOptions = [
  { value: 'software-development', label: 'Software Development' },
  { value: 'artificial-intelligence', label: 'Artificial Intelligence' },
  { value: 'data-analytics', label: 'Data Analytics' },
  { value: 'cloud-computing', label: 'Cloud Computing' },
  { value: 'financial-technology', label: 'Financial Technology' },
  { value: 'healthcare-tech', label: 'Healthcare Technology' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
];

const clientSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  contactPerson: z.string().min(1, 'Contact person is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  techParkName: z.string().min(1, 'Tech park name is required'),
  location: z.string().min(1, 'Location is required'),
  industry: z.string().min(1, 'Industry is required'),
  employeeCount: z.number().min(1, 'Employee count must be at least 1'),
  revenue: z.string().min(1, 'Revenue is required'),
  status: z.enum(['in-progress', 'contacted', 'meeting-scheduled', 'demo-given', 'proposal-sent', 'closed-won', 'closed-lost']),
  priority: z.enum(['low', 'medium', 'high']),
  nextFollowUp: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormProps {
  client?: TechParkClient;
  onSubmit: (data: Omit<TechParkClient, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ClientForm({ client, onSubmit, onCancel, isLoading }: ClientFormProps) {
  const { register, handleSubmit, formState: { errors }, setValue} = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: client ? {
      companyName: client.companyName,
      contactPerson: client.contactPerson,
      email: client.email,
      phone: client.phone,
      techParkName: client.techParkName,
      location: client.location,
      industry: client.industry,
      employeeCount: client.employeeCount,
      revenue: client.revenue,
      status: client.status,
      priority: client.priority,
      nextFollowUp: client.nextFollowUp,
      rating: client.rating,
      notes: client.notes,
    } : {
      status: 'contacted',
      priority: 'medium',
      employeeCount: 1,
    },
  });

  const handleFormSubmit = (data: ClientFormData) => {
    onSubmit({
      ...data,
      lastContact: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name</Label>
          <Input
            id="companyName"
            {...register('companyName')}
            placeholder="Enter company name"
          />
          {errors.companyName && (
            <p className="text-sm text-red-600">{errors.companyName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactPerson">Contact Person</Label>
          <Input
            id="contactPerson"
            {...register('contactPerson')}
            placeholder="Enter contact person name"
          />
          {errors.contactPerson && (
            <p className="text-sm text-red-600">{errors.contactPerson.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder="Enter email address"
          />
          {errors.email && (
            <p className="text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            {...register('phone')}
            placeholder="Enter phone number"
          />
          {errors.phone && (
            <p className="text-sm text-red-600">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="techParkName">Tech Park Name</Label>
          <Input
            id="techParkName"
            {...register('techParkName')}
            placeholder="Enter tech park name"
          />
          {errors.techParkName && (
            <p className="text-sm text-red-600">{errors.techParkName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            {...register('location')}
            placeholder="Enter location"
          />
          {errors.location && (
            <p className="text-sm text-red-600">{errors.location.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Select onValueChange={(value) => setValue('industry', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              {industryOptions.map((option) => (
                <SelectItem key={option.value} value={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.industry && (
            <p className="text-sm text-red-600">{errors.industry.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="employeeCount">Employee Count</Label>
          <Input
            id="employeeCount"
            type="number"
            {...register('employeeCount', { valueAsNumber: true })}
            placeholder="Enter employee count"
          />
          {errors.employeeCount && (
            <p className="text-sm text-red-600">{errors.employeeCount.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="revenue">Revenue</Label>
          <Input
            id="revenue"
            {...register('revenue')}
            placeholder="e.g., $5,000,000"
          />
          {errors.revenue && (
            <p className="text-sm text-red-600">{errors.revenue.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select onValueChange={(value: ClientStatus) => setValue('status', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.status && (
            <p className="text-sm text-red-600">{errors.status.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select onValueChange={(value: Priority) => setValue('priority', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.priority && (
            <p className="text-sm text-red-600">{errors.priority.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nextFollowUp">Next Follow-up</Label>
          <Input
            id="nextFollowUp"
            type="date"
            {...register('nextFollowUp')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rating">Rating (0-5)</Label>
          <Input
            id="rating"
            type="number"
            min="0"
            max="5"
            step="0.1"
            {...register('rating', { valueAsNumber: true })}
            placeholder="Enter rating"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Enter any additional notes"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : client ? 'Update Client' : 'Add Client'}
        </Button>
      </div>
    </form>
  );
}
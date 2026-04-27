import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { FundingNewsService, type ContactUpdateRequest } from '@/services/fundingNewsService';
import { Loader2, User, Mail, Phone, CheckCircle } from 'lucide-react';
import { z } from 'zod';

// Individual field validation schemas
const contactPersonSchema = z.string()
  .min(2, 'Contact person name must be at least 2 characters')
  .max(100, 'Contact person name must be less than 100 characters')
  .regex(/^[a-zA-Z\s]+$/, 'Contact person name can only contain letters and spaces');

const contactEmailSchema = z.string()
  .email('Please enter a valid email address')
  .max(255, 'Email must be less than 255 characters');

const contactPhoneSchema = z.string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(15, 'Phone number must be less than 15 digits')
  .regex(/^[\d\s\-+()]+$/, 'Phone number can only contain digits, spaces, hyphens, plus signs, and parentheses');

type ApiErrorShape = {
  response?: {
    data?: {
      error?: string;
    };
  };
};

interface ContactEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  newsItem: {
    id: string;
    title: string;
    contact_person?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_status?: 'NOT_CONTACTED' | 'CONTACTED' | 'INTERESTED' | 'MEETING_SCHEDULED' | 'PROPOSAL_SENT' | 'CLOSED';
  };
  onUpdate: () => void;
}

const statusOptions = [
  { value: 'NOT_CONTACTED', label: 'Not Contacted', color: 'bg-gray-100 text-gray-800' },
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-blue-100 text-blue-800' },
  { value: 'INTERESTED', label: 'Interested', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'MEETING_SCHEDULED', label: 'Meeting Scheduled', color: 'bg-purple-100 text-purple-800' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent', color: 'bg-orange-100 text-orange-800' },
  { value: 'CLOSED', label: 'Closed', color: 'bg-green-100 text-green-800' },
];

export default function ContactEditDialog({ 
  isOpen, 
  onClose, 
  newsItem, 
  onUpdate 
}: ContactEditDialogProps) {
  const [formData, setFormData] = useState<ContactUpdateRequest>({
    contact_person: newsItem.contact_person || '',
    contact_email: newsItem.contact_email || '',
    contact_phone: newsItem.contact_phone || '',
    contact_status: newsItem.contact_status || 'NOT_CONTACTED',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof ContactUpdateRequest, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setErrors({});
    
    // Validate fields that have content
    const fieldErrors: Record<string, string> = {};
    
    // Validate contact_person only if it has content
    if (formData.contact_person && formData.contact_person.trim()) {
      const personResult = contactPersonSchema.safeParse(formData.contact_person);
      
      if (!personResult.success) {
        fieldErrors.contact_person = personResult.error.issues[0].message;
      }
    }
    
    // Validate contact_email only if it has content
    if (formData.contact_email && formData.contact_email.trim()) {
      const emailResult = contactEmailSchema.safeParse(formData.contact_email);
      
      if (!emailResult.success) {
        fieldErrors.contact_email = emailResult.error.issues[0].message;
      }
    }
    
    // Validate contact_phone only if it has content
    if (formData.contact_phone && formData.contact_phone.trim()) {
      const phoneResult = contactPhoneSchema.safeParse(formData.contact_phone);
      
      if (!phoneResult.success) {
        fieldErrors.contact_phone = phoneResult.error.issues[0].message;
      }
    }
    
    // If there are validation errors, show them and return
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    
    // Prepare data to send - always send all fields to allow clearing
    const fieldsToUpdate = {
      contact_person: formData.contact_person || '',
      contact_email: formData.contact_email || '',
      contact_phone: formData.contact_phone || '',
      contact_status: formData.contact_status
    };

    setIsLoading(true);
    try {
      await FundingNewsService.updateContactDetails(newsItem.id, fieldsToUpdate);
      toast.success("Contact details updated successfully!");
      onUpdate();
      onClose();
    } catch (error: unknown) {
      const apiError = error as ApiErrorShape;
      console.error('Error updating contact details:', error);
      toast.error(apiError.response?.data?.error || "Failed to update contact details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Contact Details
          </DialogTitle>
          <DialogDescription>
            Update contact information for: <span className="font-medium">{newsItem.title}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact_person" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Person
            </Label>
            <Input
              id="contact_person"
              value={formData.contact_person}
              onChange={(e) => handleInputChange('contact_person', e.target.value)}
              placeholder="Enter contact person name"
              disabled={isLoading}
              className={errors.contact_person ? 'border-red-500' : ''}
            />
            {errors.contact_person && (
              <p className="text-sm text-red-500">{errors.contact_person}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Address
            </Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => handleInputChange('contact_email', e.target.value)}
              placeholder="Enter email address"
              disabled={isLoading}
              className={errors.contact_email ? 'border-red-500' : ''}
            />
            {errors.contact_email && (
              <p className="text-sm text-red-500">{errors.contact_email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number
            </Label>
            <Input
              id="contact_phone"
              value={formData.contact_phone}
              onChange={(e) => handleInputChange('contact_phone', e.target.value)}
              placeholder="Enter phone number"
              disabled={isLoading}
              className={errors.contact_phone ? 'border-red-500' : ''}
            />
            {errors.contact_phone && (
              <p className="text-sm text-red-500">{errors.contact_phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_status" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Status
            </Label>
            <Select
              value={formData.contact_status}
              onValueChange={(value) => handleInputChange('contact_status', value)}
              disabled={isLoading}
            >
              <SelectTrigger className={errors.contact_status ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.contact_status && (
              <p className="text-sm text-red-500">{errors.contact_status}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Updating...' : 'Update Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

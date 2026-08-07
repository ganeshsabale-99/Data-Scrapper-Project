import { motion } from 'framer-motion';
import { ArrowLeft, Edit, Phone, Mail, MapPin, Building, Star, Globe, Clock, Trash, RefreshCw, Linkedin, Twitter, Facebook, Instagram } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { ContactLogs } from '../../components/contact-logs/ContactLogs';

type CompanyDetailsRecord = {
  id: string;
  name?: string;
  phone?: string;
  contact_phone?: string;
  contact_international_phone?: string;
  contact_email?: string;
  address?: string;
  description?: string;
  opening_hours?: string | string[];
  website?: string;
  linkedin_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  instagram_url?: string;
  rating?: number;
  total_ratings?: number;
  business_status?: string;
  city?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

interface CompanyDetailsProps {
  company: CompanyDetailsRecord;
  onBack: () => void;
  onEdit: (company: CompanyDetailsRecord) => void;
  onDelete: (company: CompanyDetailsRecord) => void;
  onChangeStatus: (companyId: string, status: string) => void;
  companyType?: 'techpark' | 'coworking';
  canEdit?: boolean;
  canDelete?: boolean;
  canChangeStatus?: boolean;
}

export function CompanyDetails({
  company,
  onBack,
  onEdit,
  onDelete,
  onChangeStatus,
  companyType = 'techpark',
  canEdit = true,
  canDelete = true,
  canChangeStatus = true,
}: CompanyDetailsProps) {




  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isLikelyUrl = (val: unknown) => typeof val === 'string' && /^https?:\/\//i.test(val);
  const websiteVal = typeof company.website === 'string' ? company.website : '';

  const statusOptions = [
    'NOT_CONTACTED',
    'CONTACTED', 
    'INTERESTED',
    'MEETING_SCHEDULED',
    'PROPOSAL_SENT',
    'IN_PROGRESS',
    'CLOSED',
  ];

  const infoItems = [
    { icon: Phone, label: 'Phone', value: company.phone || company.contact_phone || company.contact_international_phone || 'N/A' },
    { icon: Mail, label: 'Email', value: company.contact_email || 'N/A' },
    { icon: MapPin, label: 'Address', value: company.address || 'N/A' },
    { icon: Building, label: 'Company Name', value: company.name || 'N/A' },
    { icon: Globe, label: 'Website', value: websiteVal || 'N/A', isUrl: isLikelyUrl(websiteVal) },
    { icon: Star, label: 'Rating', value: company.rating ? `${company.rating}/5` : 'N/A' },
    { icon: Clock, label: 'Business Status', value: company.business_status || 'N/A' },
    { icon: MapPin, label: 'City', value: company.city || 'N/A' },
  ];

  // Social links only show up once found — no point cluttering the card with
  // four more "N/A" rows for data that's frequently unavailable.
  const socialItems = [
    { icon: Linkedin, label: 'LinkedIn', value: company.linkedin_url },
    { icon: Twitter, label: 'Twitter / X', value: company.twitter_url },
    { icon: Facebook, label: 'Facebook', value: company.facebook_url },
    { icon: Instagram, label: 'Instagram', value: company.instagram_url },
  ].filter((item): item is typeof item & { value: string } => Boolean(item.value));

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="space-y-4 sm:hidden">
        <div className="flex items-center">
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight break-words">
              {company.name || 'Company Details'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {company.business_status || 'Business Information'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-100 text-blue-800 text-xs">
              {company.business_status || 'Unknown'}
            </Badge>
            {company.rating && (
              <Badge className="bg-green-100 text-green-800 text-xs">
                {company.rating}★
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onEdit(company)}
                  className="flex items-center gap-2 px-3"
                  aria-label="Edit company"
                >
                  <Edit className="h-4 w-4" />
                  <span>Edit</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          ) : null}

          {canChangeStatus ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 px-3">
                  <RefreshCw className="h-4 w-4" />
                  <span>Status</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {statusOptions.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => onChangeStatus(company.id, status)}
                    className={company.business_status === status ? 'bg-accent' : ''}
                  >
                    {status.replace(/_/g, ' ')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {canDelete ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onDelete(company)}
                  variant="destructive"
                  className="flex items-center gap-2 px-3"
                  aria-label="Delete company"
                >
                  <Trash className="h-4 w-4" />
                  <span>Delete</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <div className="hidden sm:flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {company.name || 'Company Details'}
            </h1>
            <p className="text-muted-foreground">{company.business_status || 'Business Information'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onEdit(company)}
                  className="flex items-center gap-2 px-2 sm:px-4"
                  aria-label="Edit company"
                >
                  <Edit className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit Company</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          ) : null}
          {canChangeStatus ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 px-2 sm:px-4">
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">Change Status</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {statusOptions.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => onChangeStatus(company.id, status)}
                    className={company.business_status === status ? 'bg-accent' : ''}
                  >
                    {status.replace(/_/g, ' ')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {canDelete ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onDelete(company)}
                  variant="destructive"
                  className="flex items-center gap-2 px-2 sm:px-4"
                  aria-label="Delete company"
                >
                  <Trash className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Company Information
                <div className="hidden sm:flex gap-2">
                  <Badge className="bg-blue-100 text-blue-800">
                    {company.business_status || 'Unknown'}
                  </Badge>
                  {company.rating && (
                    <Badge className="bg-green-100 text-green-800">
                      {company.rating}★
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                {infoItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                    >
                      <div className="text-muted-foreground flex-shrink-0 mt-0.5">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
                        {item.isUrl && typeof item.value === 'string' ? (
                          <a
                            href={item.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-700 hover:underline break-words block"
                          >
                            {item.value}
                          </a>
                        ) : (
                          <p className="font-medium break-words text-sm leading-relaxed">{item.value}</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {socialItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Social Media</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {socialItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="flex items-start gap-3 p-3 rounded-lg border"
                      >
                        <div className="text-muted-foreground flex-shrink-0 mt-0.5">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
                          <a
                            href={item.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-700 hover:underline break-words block text-sm"
                          >
                            {item.value}
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {company.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line break-words">{company.description}</p>
              </CardContent>
            </Card>
          )}

          {company.opening_hours && company.opening_hours.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Opening Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.isArray(company.opening_hours) ? 
                    company.opening_hours.map((hour: string, index: number) => (
                      <p key={index} className="text-sm text-muted-foreground break-words">{hour}</p>
                    )) : 
                    <p className="text-sm text-muted-foreground break-words">{company.opening_hours}</p>
                  }
                </div>
              </CardContent>
            </Card>
          )}

          <ContactLogs 
            companyId={company.id} 
            companyName={company.name || "Unknown company"}
            companyType={companyType}
            onStatusChange={(status) => onChangeStatus(company.id, status)}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold break-words text-center">
                  {company.name || 'N/A'}
                </h3>
                <p className="text-sm text-muted-foreground break-words">{company.contact_email || 'N/A'}</p>
                <p className="text-sm text-muted-foreground break-words">{company.phone || company.contact_phone || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                {company.rating && company.rating > 0 ? (
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                      <span className="text-2xl font-bold">{company.rating}</span>
                      <span className="text-muted-foreground">/5</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {company.total_ratings ? `${company.total_ratings} reviews` : 'Google rating'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-muted-foreground mb-2">
                      <Star className="h-8 w-8 mx-auto" />
                    </div>
                    <p className="text-sm text-muted-foreground">No rating available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm font-medium">{formatDate(company.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last Updated</span>
                <span className="text-sm font-medium">{formatDate(company.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Contact Logs</span>
                <span className="text-sm font-medium">0</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 
